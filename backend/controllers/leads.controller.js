const pool = require("../config/db");

const STAGES = [
  "new",
  "contacted",
  "qualified",
  "visit_scheduled",
  "negotiation",
  "converted",
  "lost",
];
const PURPOSES = ["sale", "rent"];

// fields the user can edit on a lead (used later by the match engine)
const PREFERENCE_FIELDS = [
  "purpose",
  "property_type",
  "budget_min",
  "budget_max",
  "preferred_city",
  "preferred_bedrooms",
  "next_follow_up_at",
];

function toNull(value) {
  return value === "" || value === undefined ? null : value;
}

function cleanPhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone)
    .trim()
    .replace(/[^\d+]/g, "");
  return cleaned || null;
}

// admin sees every lead of the agency, agent sees only the assigned ones
function accessCondition(user, values) {
  values.push(user.agency_id);
  let sql = `l.agency_id = $${values.length}`;
  if (user.role !== "admin") {
    values.push(user.id);
    sql += ` AND l.assigned_agent_id = $${values.length}`;
  }
  return sql;
}

async function findLead(id, user) {
  const values = [id];
  const access = accessCondition(user, values);
  const result = await pool.query(
    `SELECT l.id FROM leads l WHERE l.id = $1 AND ${access}`,
    values,
  );
  return result.rows[0] || null;
}

// GET /api/leads
async function list(req, res) {
  try {
    const { stage, q, agent_id } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);

    const values = [];
    const where = [accessCondition(req.user, values)];

    if (stage && STAGES.includes(stage)) {
      values.push(stage);
      where.push(`l.stage = $${values.length}`);
    }
    if (q) {
      values.push(`%${q}%`);
      const n = values.length;
      where.push(
        `(c.full_name ILIKE $${n} OR c.phone ILIKE $${n} OR c.email ILIKE $${n})`,
      );
    }
    // only the admin can filter by another agent
    if (agent_id && req.user.role === "admin") {
      values.push(parseInt(agent_id, 10) || 0);
      where.push(`l.assigned_agent_id = $${values.length}`);
    }

    const whereSql = where.join(" AND ");

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM leads l JOIN contacts c ON c.id = l.contact_id WHERE ${whereSql}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count);

    values.push(limit, (page - 1) * limit);
    const rows = await pool.query(
      `SELECT l.id, l.stage, l.source, l.created_at, l.next_follow_up_at,
              l.assigned_agent_id, l.property_id,
              c.full_name, c.phone, c.email,
              p.title AS property_title,
              u.full_name AS agent_name
       FROM leads l
       JOIN contacts c ON c.id = l.contact_id
       LEFT JOIN properties p ON p.id = l.property_id
       LEFT JOIN users u ON u.id = l.assigned_agent_id
       WHERE ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    res.json({ data: rows.rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("List leads error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// GET /api/leads/:id
async function getOne(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    const values = [id];
    const access = accessCondition(req.user, values);

    const result = await pool.query(
      `SELECT l.*, c.full_name, c.phone, c.email,
              p.title AS property_title, p.slug AS property_slug,
              u.full_name AS agent_name
       FROM leads l
       JOIN contacts c ON c.id = l.contact_id
       LEFT JOIN properties p ON p.id = l.property_id
       LEFT JOIN users u ON u.id = l.assigned_agent_id
       WHERE l.id = $1 AND ${access}`,
      values,
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const activities = await pool.query(
      `SELECT a.id, a.activity_type, a.body, a.created_at, u.full_name AS user_name
       FROM activities a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.lead_id = $1
       ORDER BY a.created_at DESC`,
      [id],
    );

    res.json({ ...result.rows[0], activities: activities.rows });
  } catch (err) {
    console.error("Get lead error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// POST /api/leads   (manual lead created by staff)
async function create(req, res) {
  const b = req.body;
  const name = b.full_name && String(b.full_name).trim();
  const phone = cleanPhone(b.phone);
  const email = b.email ? String(b.email).trim().toLowerCase() : null;

  if (!name) return res.status(400).json({ message: "Name is required" });
  if (!phone && !email) {
    return res.status(400).json({ message: "Phone or email is required" });
  }
  if (b.purpose && !PURPOSES.includes(b.purpose)) {
    return res.status(400).json({ message: "Purpose must be sale or rent" });
  }

  const client = await pool.connect();
  try {
    const agencyId = req.user.agency_id;

    // the property must belong to the same agency
    if (b.property_id) {
      const prop = await client.query(
        "SELECT id FROM properties WHERE id = $1 AND agency_id = $2",
        [parseInt(b.property_id, 10) || 0, agencyId],
      );
      if (prop.rows.length === 0) {
        return res.status(400).json({ message: "Property not found" });
      }
    }

    // an agent gets the lead assigned to himself, the admin can choose
    let agentId = req.user.id;
    if (req.user.role === "admin") {
      agentId = toNull(b.assigned_agent_id);
      if (agentId) {
        const agent = await client.query(
          "SELECT id FROM users WHERE id = $1 AND agency_id = $2 AND status = 'active'",
          [agentId, agencyId],
        );
        if (agent.rows.length === 0) {
          return res.status(400).json({ message: "Assigned agent not found" });
        }
      }
    }

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM contacts
       WHERE agency_id = $1 AND ((phone IS NOT NULL AND phone = $2)
                              OR (email IS NOT NULL AND email = $3))
       LIMIT 1`,
      [agencyId, phone, email],
    );

    let contactId;
    if (existing.rows.length > 0) {
      contactId = existing.rows[0].id;
    } else {
      const created = await client.query(
        `INSERT INTO contacts (agency_id, full_name, phone, email)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [agencyId, name, phone, email],
      );
      contactId = created.rows[0].id;
    }

    const lead = await client.query(
      `INSERT INTO leads
        (agency_id, contact_id, property_id, source, message, purpose, property_type,
         budget_min, budget_max, preferred_city, preferred_bedrooms, assigned_agent_id)
       VALUES ($1, $2, $3, 'manual', $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        agencyId,
        contactId,
        toNull(b.property_id),
        toNull(b.message),
        toNull(b.purpose),
        toNull(b.property_type),
        toNull(b.budget_min),
        toNull(b.budget_max),
        toNull(b.preferred_city),
        toNull(b.preferred_bedrooms),
        agentId,
      ],
    );

    await client.query(
      `INSERT INTO activities (agency_id, lead_id, user_id, activity_type, body)
       VALUES ($1, $2, $3, 'note', 'Lead added manually')`,
      [agencyId, lead.rows[0].id, req.user.id],
    );

    await client.query("COMMIT");
    res.status(201).json({ id: lead.rows[0].id });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create lead error:", err.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

// PATCH /api/leads/:id   (preferences and follow up date)
async function update(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: "Invalid lead id" });

    if (!(await findLead(id, req.user))) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (req.body.purpose && !PURPOSES.includes(req.body.purpose)) {
      return res.status(400).json({ message: "Purpose must be sale or rent" });
    }

    const sets = [];
    const values = [];
    PREFERENCE_FIELDS.forEach((field) => {
      if (req.body[field] === undefined) return;
      values.push(toNull(req.body[field]));
      sets.push(`${field} = $${values.length}`);
    });

    if (sets.length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }
    sets.push("updated_at = NOW()");

    values.push(id, req.user.agency_id);
    const result = await pool.query(
      `UPDATE leads SET ${sets.join(", ")}
       WHERE id = $${values.length - 1} AND agency_id = $${values.length}
       RETURNING *`,
      values,
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update lead error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// PATCH /api/leads/:id/stage   body: { "stage": "contacted" }
async function updateStage(req, res) {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const { stage } = req.body;

    if (!id) return res.status(400).json({ message: "Invalid lead id" });
    if (!STAGES.includes(stage)) {
      return res.status(400).json({ message: "Invalid stage" });
    }
    if (!(await findLead(id, req.user))) {
      return res.status(404).json({ message: "Lead not found" });
    }

    await client.query("BEGIN");

    const current = await client.query(
      "SELECT stage FROM leads WHERE id = $1 AND agency_id = $2 FOR UPDATE",
      [id, req.user.agency_id],
    );
    const oldStage = current.rows[0].stage;

    if (oldStage === stage) {
      await client.query("ROLLBACK");
      return res.json({ id, stage });
    }

    await client.query(
      "UPDATE leads SET stage = $1, updated_at = NOW() WHERE id = $2",
      [stage, id],
    );
    await client.query(
      `INSERT INTO activities (agency_id, lead_id, user_id, activity_type, body)
       VALUES ($1, $2, $3, 'stage_change', $4)`,
      [
        req.user.agency_id,
        id,
        req.user.id,
        `Stage changed from ${oldStage} to ${stage}`,
      ],
    );

    await client.query("COMMIT");
    res.json({ id, stage });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update stage error:", err.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

// PATCH /api/leads/:id/assign   body: { "agent_id": 2 }   (admin only)
async function assign(req, res) {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const agentId = parseInt(req.body.agent_id, 10);

    if (!id || !agentId) {
      return res
        .status(400)
        .json({ message: "Lead id and agent id are required" });
    }

    const agent = await client.query(
      `SELECT id, full_name FROM users
       WHERE id = $1 AND agency_id = $2 AND status = 'active'`,
      [agentId, req.user.agency_id],
    );
    if (agent.rows.length === 0) {
      return res.status(400).json({ message: "Agent not found" });
    }

    await client.query("BEGIN");

    const updated = await client.query(
      `UPDATE leads SET assigned_agent_id = $1, updated_at = NOW()
       WHERE id = $2 AND agency_id = $3 RETURNING id`,
      [agentId, id, req.user.agency_id],
    );
    if (updated.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Lead not found" });
    }

    await client.query(
      `INSERT INTO activities (agency_id, lead_id, user_id, activity_type, body)
       VALUES ($1, $2, $3, 'assignment', $4)`,
      [
        req.user.agency_id,
        id,
        req.user.id,
        `Lead assigned to ${agent.rows[0].full_name}`,
      ],
    );

    await client.query("COMMIT");
    res.json({
      id,
      assigned_agent_id: agentId,
      agent_name: agent.rows[0].full_name,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Assign lead error:", err.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

// POST /api/leads/:id/activities   body: { "body": "...", "activity_type": "note" }
async function addActivity(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const body = req.body.body && String(req.body.body).trim();
    const type = req.body.activity_type === "call" ? "call" : "note";

    if (!id) return res.status(400).json({ message: "Invalid lead id" });
    if (!body)
      return res.status(400).json({ message: "Note text is required" });

    if (!(await findLead(id, req.user))) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const result = await pool.query(
      `INSERT INTO activities (agency_id, lead_id, user_id, activity_type, body)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.agency_id, id, req.user.id, type, body.slice(0, 2000)],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add activity error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  updateStage,
  assign,
  addActivity,
};
