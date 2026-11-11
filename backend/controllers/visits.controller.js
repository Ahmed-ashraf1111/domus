const pool = require("../config/db");

const STATUSES = [
  "requested",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];
// only these statuses block the agent calendar
const BLOCKING = ["requested", "confirmed"];

// admin sees every visit, agent sees only his own visits
function accessCondition(user, values) {
  values.push(user.agency_id);
  let sql = `v.agency_id = $${values.length}`;
  if (user.role !== "admin") {
    values.push(user.id);
    sql += ` AND v.agent_id = $${values.length}`;
  }
  return sql;
}

function validDate(value) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// GET /api/visits
async function list(req, res) {
  try {
    const { status, from, to, property_id } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 200);

    const values = [];
    const where = [accessCondition(req.user, values)];

    if (status && STATUSES.includes(status)) {
      values.push(status);
      where.push(`v.status = $${values.length}`);
    }
    if (from && validDate(from)) {
      values.push(validDate(from));
      where.push(`v.starts_at >= $${values.length}`);
    }
    if (to && validDate(to)) {
      values.push(validDate(to));
      where.push(`v.starts_at <= $${values.length}`);
    }
    if (property_id) {
      values.push(parseInt(property_id, 10) || 0);
      where.push(`v.property_id = $${values.length}`);
    }

    const whereSql = where.join(" AND ");

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM visits v WHERE ${whereSql}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count);

    values.push(limit, (page - 1) * limit);
    const rows = await pool.query(
      `SELECT v.*, p.title AS property_title, c.full_name AS contact_name,
              u.full_name AS agent_name
       FROM visits v
       JOIN properties p ON p.id = v.property_id
       JOIN users u ON u.id = v.agent_id
       LEFT JOIN leads l ON l.id = v.lead_id
       LEFT JOIN contacts c ON c.id = l.contact_id
       WHERE ${whereSql}
       ORDER BY v.starts_at ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    res.json({ data: rows.rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("List visits error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// POST /api/visits
// body: property_id, lead_id (optional), agent_id (admin only), starts_at,
//       duration_minutes (default 60), notes, force (ignore the conflict warning)
async function create(req, res) {
  const b = req.body;
  const propertyId = parseInt(b.property_id, 10);
  const startsAt = validDate(b.starts_at);
  const duration = parseInt(b.duration_minutes, 10) || 60;

  if (!propertyId)
    return res.status(400).json({ message: "Property is required" });
  if (!startsAt)
    return res.status(400).json({ message: "A valid start time is required" });
  if (duration < 15 || duration > 480) {
    return res
      .status(400)
      .json({ message: "Duration must be between 15 and 480 minutes" });
  }
  const endsAt = new Date(startsAt.getTime() + duration * 60000);

  const client = await pool.connect();
  try {
    const agencyId = req.user.agency_id;

    const prop = await client.query(
      "SELECT id, title, assigned_agent_id FROM properties WHERE id = $1 AND agency_id = $2",
      [propertyId, agencyId],
    );
    if (prop.rows.length === 0) {
      return res.status(400).json({ message: "Property not found" });
    }
    const property = prop.rows[0];

    // an agent books for himself, the admin can choose the agent
    let agentId = req.user.id;
    if (req.user.role === "admin") {
      agentId = parseInt(b.agent_id, 10) || property.assigned_agent_id;
      if (!agentId) {
        return res.status(400).json({ message: "Agent is required" });
      }
      const agent = await client.query(
        "SELECT id FROM users WHERE id = $1 AND agency_id = $2 AND status = 'active'",
        [agentId, agencyId],
      );
      if (agent.rows.length === 0) {
        return res.status(400).json({ message: "Agent not found" });
      }
    }

    let leadId = null;
    let leadStage = null;
    if (b.lead_id) {
      const lead = await client.query(
        "SELECT id, stage, assigned_agent_id FROM leads WHERE id = $1 AND agency_id = $2",
        [parseInt(b.lead_id, 10) || 0, agencyId],
      );
      if (lead.rows.length === 0) {
        return res.status(400).json({ message: "Lead not found" });
      }
      if (
        req.user.role !== "admin" &&
        lead.rows[0].assigned_agent_id !== req.user.id
      ) {
        return res
          .status(403)
          .json({ message: "This lead is not assigned to you" });
      }
      leadId = lead.rows[0].id;
      leadStage = lead.rows[0].stage;
    }

    // look for another visit of the same agent that overlaps this time slot
    const conflicts = await client.query(
      `SELECT v.id, v.starts_at, v.ends_at, p.title AS property_title
       FROM visits v
       JOIN properties p ON p.id = v.property_id
       WHERE v.agent_id = $1 AND v.status = ANY($2)
         AND v.starts_at < $4 AND v.ends_at > $3
       ORDER BY v.starts_at`,
      [agentId, BLOCKING, startsAt, endsAt],
    );
    if (conflicts.rows.length > 0 && b.force !== true) {
      return res.status(409).json({
        message: "This agent already has a visit at that time",
        conflicts: conflicts.rows,
      });
    }

    await client.query("BEGIN");

    const visit = await client.query(
      `INSERT INTO visits
        (agency_id, property_id, lead_id, agent_id, starts_at, ends_at, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7)
       RETURNING *`,
      [
        agencyId,
        propertyId,
        leadId,
        agentId,
        startsAt,
        endsAt,
        b.notes || null,
      ],
    );

    if (leadId) {
      await client.query(
        `INSERT INTO activities (agency_id, lead_id, user_id, activity_type, body)
         VALUES ($1, $2, $3, 'visit', $4)`,
        [
          agencyId,
          leadId,
          req.user.id,
          `Visit scheduled for "${property.title}"`,
        ],
      );
      // early stage leads move forward automatically
      if (["new", "contacted", "qualified"].includes(leadStage)) {
        await client.query(
          "UPDATE leads SET stage = 'visit_scheduled', updated_at = NOW() WHERE id = $1",
          [leadId],
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json(visit.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create visit error:", err.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

// PATCH /api/visits/:id/status   body: { "status": "completed", "outcome": "..." }
async function updateStatus(req, res) {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const { status, outcome } = req.body;

    if (!id) return res.status(400).json({ message: "Invalid visit id" });
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const values = [id];
    const access = accessCondition(req.user, values);
    const found = await client.query(
      `SELECT v.id, v.status, v.lead_id, p.title AS property_title
       FROM visits v JOIN properties p ON p.id = v.property_id
       WHERE v.id = $1 AND ${access}`,
      values,
    );
    if (found.rows.length === 0) {
      return res.status(404).json({ message: "Visit not found" });
    }
    const visit = found.rows[0];

    // a finished visit cannot be changed again
    if (!BLOCKING.includes(visit.status)) {
      return res.status(409).json({ message: "This visit is already closed" });
    }

    await client.query("BEGIN");

    const updated = await client.query(
      `UPDATE visits SET status = $1, outcome = COALESCE($2, outcome)
       WHERE id = $3 RETURNING *`,
      [status, outcome || null, id],
    );

    if (visit.lead_id) {
      await client.query(
        `INSERT INTO activities (agency_id, lead_id, user_id, activity_type, body)
         VALUES ($1, $2, $3, 'visit', $4)`,
        [
          req.user.agency_id,
          visit.lead_id,
          req.user.id,
          `Visit for "${visit.property_title}" marked as ${status}`,
        ],
      );
    }

    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update visit status error:", err.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

module.exports = { list, create, updateStatus };
