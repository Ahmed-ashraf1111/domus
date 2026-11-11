const pool = require("../config/db");

const STAGES = ["offer", "negotiation", "booking", "closed_won", "closed_lost"];
// a property can only have one deal in these stages at the same time
const ACTIVE_SALE_STAGES = ["booking", "closed_won"];
const CLOSED_STAGES = ["closed_won", "closed_lost"];

// admin sees every deal, agent sees only his own deals
function accessCondition(user, values) {
  values.push(user.agency_id);
  let sql = `d.agency_id = $${values.length}`;
  if (user.role !== "admin") {
    values.push(user.id);
    sql += ` AND d.agent_id = $${values.length}`;
  }
  return sql;
}

function validAmount(value) {
  if (value === undefined || value === null || value === "") return true;
  return !isNaN(Number(value)) && Number(value) >= 0;
}

function toNull(value) {
  return value === "" || value === undefined ? null : value;
}

// GET /api/deals
async function list(req, res) {
  try {
    const { stage, property_id } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

    const values = [];
    const where = [accessCondition(req.user, values)];

    if (stage && STAGES.includes(stage)) {
      values.push(stage);
      where.push(`d.stage = $${values.length}`);
    }
    if (property_id) {
      values.push(parseInt(property_id, 10) || 0);
      where.push(`d.property_id = $${values.length}`);
    }

    const whereSql = where.join(" AND ");

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM deals d WHERE ${whereSql}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count);

    values.push(limit, (page - 1) * limit);
    const rows = await pool.query(
      `SELECT d.*, p.title AS property_title, p.price AS property_price,
              c.full_name AS contact_name, u.full_name AS agent_name
       FROM deals d
       JOIN properties p ON p.id = d.property_id
       LEFT JOIN leads l ON l.id = d.lead_id
       LEFT JOIN contacts c ON c.id = l.contact_id
       LEFT JOIN users u ON u.id = d.agent_id
       WHERE ${whereSql}
       ORDER BY d.updated_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    res.json({ data: rows.rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("List deals error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// GET /api/deals/:id
async function getOne(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: "Invalid deal id" });

    const values = [id];
    const access = accessCondition(req.user, values);
    const result = await pool.query(
      `SELECT d.*, p.title AS property_title, p.slug AS property_slug,
              p.purpose AS property_purpose, p.status AS property_status,
              c.full_name AS contact_name, c.phone AS contact_phone,
              u.full_name AS agent_name
       FROM deals d
       JOIN properties p ON p.id = d.property_id
       LEFT JOIN leads l ON l.id = d.lead_id
       LEFT JOIN contacts c ON c.id = l.contact_id
       LEFT JOIN users u ON u.id = d.agent_id
       WHERE d.id = $1 AND ${access}`,
      values,
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Deal not found" });
    }

    const events = await pool.query(
      `SELECT e.id, e.old_stage, e.new_stage, e.created_at, u.full_name AS user_name
       FROM deal_events e
       LEFT JOIN users u ON u.id = e.changed_by
       WHERE e.deal_id = $1
       ORDER BY e.created_at DESC, e.id DESC`,
      [id],
    );

    res.json({ ...result.rows[0], events: events.rows });
  } catch (err) {
    console.error("Get deal error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// POST /api/deals
// body: property_id, lead_id (optional), agent_id (admin only), offer_amount,
//       expected_close_date, notes
async function create(req, res) {
  const b = req.body;
  const propertyId = parseInt(b.property_id, 10);

  if (!propertyId)
    return res.status(400).json({ message: "Property is required" });
  if (!validAmount(b.offer_amount)) {
    return res
      .status(400)
      .json({ message: "Offer amount must be a positive number" });
  }
  if (
    b.expected_close_date &&
    isNaN(new Date(b.expected_close_date).getTime())
  ) {
    return res.status(400).json({ message: "Invalid expected close date" });
  }

  const client = await pool.connect();
  try {
    const agencyId = req.user.agency_id;

    const prop = await client.query(
      "SELECT id, status, assigned_agent_id FROM properties WHERE id = $1 AND agency_id = $2",
      [propertyId, agencyId],
    );
    if (prop.rows.length === 0) {
      return res.status(400).json({ message: "Property not found" });
    }
    const property = prop.rows[0];

    if (["sold", "rented"].includes(property.status)) {
      return res
        .status(409)
        .json({ message: "This property is already sold or rented" });
    }

    let leadId = null;
    let leadAgentId = null;
    if (b.lead_id) {
      const lead = await client.query(
        "SELECT id, assigned_agent_id FROM leads WHERE id = $1 AND agency_id = $2",
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
      leadAgentId = lead.rows[0].assigned_agent_id;
    }

    let agentId = req.user.id;
    if (req.user.role === "admin") {
      agentId =
        parseInt(b.agent_id, 10) ||
        leadAgentId ||
        property.assigned_agent_id ||
        null;
      if (agentId) {
        const agent = await client.query(
          "SELECT id FROM users WHERE id = $1 AND agency_id = $2 AND status = 'active'",
          [agentId, agencyId],
        );
        if (agent.rows.length === 0) {
          return res.status(400).json({ message: "Agent not found" });
        }
      }
    }

    await client.query("BEGIN");

    const deal = await client.query(
      `INSERT INTO deals
        (agency_id, property_id, lead_id, agent_id, stage, offer_amount,
         expected_close_date, notes)
       VALUES ($1, $2, $3, $4, 'offer', $5, $6, $7)
       RETURNING *`,
      [
        agencyId,
        propertyId,
        leadId,
        agentId,
        toNull(b.offer_amount),
        toNull(b.expected_close_date),
        toNull(b.notes),
      ],
    );

    await client.query(
      `INSERT INTO deal_events (deal_id, old_stage, new_stage, changed_by)
       VALUES ($1, NULL, 'offer', $2)`,
      [deal.rows[0].id, req.user.id],
    );

    if (leadId) {
      await client.query(
        `INSERT INTO activities (agency_id, lead_id, user_id, activity_type, body)
         VALUES ($1, $2, $3, 'note', 'Deal created')`,
        [agencyId, leadId, req.user.id],
      );
    }

    await client.query("COMMIT");
    res.status(201).json(deal.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create deal error:", err.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

// PATCH /api/deals/:id   (amounts, close date and notes)
async function update(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body;

    if (!id) return res.status(400).json({ message: "Invalid deal id" });
    if (!validAmount(b.offer_amount) || !validAmount(b.agreed_amount)) {
      return res
        .status(400)
        .json({ message: "Amounts must be positive numbers" });
    }
    if (
      b.expected_close_date &&
      isNaN(new Date(b.expected_close_date).getTime())
    ) {
      return res.status(400).json({ message: "Invalid expected close date" });
    }

    const values = [id];
    const access = accessCondition(req.user, values);
    const found = await pool.query(
      `SELECT d.id, d.stage FROM deals d WHERE d.id = $1 AND ${access}`,
      values,
    );
    if (found.rows.length === 0) {
      return res.status(404).json({ message: "Deal not found" });
    }
    if (CLOSED_STAGES.includes(found.rows[0].stage)) {
      return res
        .status(409)
        .json({ message: "A closed deal cannot be edited" });
    }

    const sets = [];
    const params = [];
    ["offer_amount", "agreed_amount", "expected_close_date", "notes"].forEach(
      (field) => {
        if (b[field] === undefined) return;
        params.push(toNull(b[field]));
        sets.push(`${field} = $${params.length}`);
      },
    );
    if (sets.length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }
    sets.push("updated_at = NOW()");

    params.push(id, req.user.agency_id);
    const result = await pool.query(
      `UPDATE deals SET ${sets.join(", ")}
       WHERE id = $${params.length - 1} AND agency_id = $${params.length}
       RETURNING *`,
      params,
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update deal error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// PATCH /api/deals/:id/stage   body: { "stage": "booking", "override": false }
async function changeStage(req, res) {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const { stage, override } = req.body;

    if (!id) return res.status(400).json({ message: "Invalid deal id" });
    if (!STAGES.includes(stage)) {
      return res.status(400).json({ message: "Invalid stage" });
    }

    await client.query("BEGIN");

    // lock the deal row so two requests cannot change it at the same time
    const values = [id];
    const access = accessCondition(req.user, values);
    const found = await client.query(
      `SELECT d.*, p.purpose AS property_purpose
       FROM deals d JOIN properties p ON p.id = d.property_id
       WHERE d.id = $1 AND ${access}
       FOR UPDATE OF d`,
      values,
    );
    if (found.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Deal not found" });
    }
    const deal = found.rows[0];

    if (CLOSED_STAGES.includes(deal.stage)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "This deal is already closed" });
    }
    if (deal.stage === stage) {
      await client.query("ROLLBACK");
      return res.json({ id, stage });
    }

    // only one confirmed sale per property, unless the admin overrides it
    if (ACTIVE_SALE_STAGES.includes(stage)) {
      const other = await client.query(
        `SELECT id FROM deals
         WHERE property_id = $1 AND id <> $2 AND stage = ANY($3)`,
        [deal.property_id, id, ACTIVE_SALE_STAGES],
      );
      if (
        other.rows.length > 0 &&
        !(override === true && req.user.role === "admin")
      ) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message: "Another deal for this property is already booked or closed",
        });
      }
    }

    await client.query(
      `UPDATE deals
       SET stage = $1::varchar,
           agreed_amount = CASE WHEN $1::varchar = 'closed_won'
                                THEN COALESCE(agreed_amount, offer_amount)
                                ELSE agreed_amount END,
           updated_at = NOW()
       WHERE id = $2`,
      [stage, id],
    );

    await client.query(
      `INSERT INTO deal_events (deal_id, old_stage, new_stage, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [id, deal.stage, stage, req.user.id],
    );

    // keep the property status in sync with the deal
    if (stage === "booking") {
      await client.query(
        "UPDATE properties SET status = 'reserved', updated_at = NOW() WHERE id = $1 AND status = 'available'",
        [deal.property_id],
      );
    } else if (stage === "closed_won") {
      const finalStatus = deal.property_purpose === "sale" ? "sold" : "rented";
      await client.query(
        "UPDATE properties SET status = $1, updated_at = NOW() WHERE id = $2",
        [finalStatus, deal.property_id],
      );
    } else if (deal.stage === "booking") {
      // the deal left the booking stage, free the property if nobody else booked it
      await client.query(
        `UPDATE properties SET status = 'available', updated_at = NOW()
         WHERE id = $1 AND status = 'reserved'
           AND NOT EXISTS (SELECT 1 FROM deals
                           WHERE property_id = $1 AND id <> $2 AND stage = 'booking')`,
        [deal.property_id, id],
      );
    }

    if (deal.lead_id) {
      if (stage === "closed_won") {
        await client.query(
          "UPDATE leads SET stage = 'converted', updated_at = NOW() WHERE id = $1",
          [deal.lead_id],
        );
      }
      await client.query(
        `INSERT INTO activities (agency_id, lead_id, user_id, activity_type, body)
         VALUES ($1, $2, $3, 'note', $4)`,
        [
          req.user.agency_id,
          deal.lead_id,
          req.user.id,
          `Deal moved from ${deal.stage} to ${stage}`,
        ],
      );
    }

    await client.query("COMMIT");
    res.json({ id, stage });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Change deal stage error:", err.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

module.exports = { list, getOne, create, update, changeStage };
