const pool = require("../config/db");

function num(value) {
  return parseInt(value, 10) || 0;
}

// GET /api/dashboard
// admin gets the numbers of the whole agency, agent gets only his own leads, visits and deals
async function stats(req, res) {
  try {
    const agencyId = req.user.agency_id;
    const isAdmin = req.user.role === "admin";

    const params = isAdmin ? [agencyId] : [agencyId, req.user.id];
    const leadScope = isAdmin ? "" : " AND assigned_agent_id = $2";
    const agentScope = isAdmin ? "" : " AND agent_id = $2";
    const leadJoinScope = isAdmin ? "" : " AND l.assigned_agent_id = $2";

    const [props, leads, visits, deals, leadsByStage, dealsByStage, trend] =
      await Promise.all([
        pool.query(
          `SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE is_published) AS published,
                  COUNT(*) FILTER (WHERE status = 'available') AS available
           FROM properties WHERE agency_id = $1`,
          [agencyId],
        ),
        pool.query(
          `SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE stage = 'new') AS new_leads
           FROM leads WHERE agency_id = $1${leadScope}`,
          params,
        ),
        pool.query(
          `SELECT COUNT(*) FILTER (WHERE status IN ('requested', 'confirmed')
                                   AND starts_at >= NOW()) AS upcoming,
                  COUNT(*) FILTER (WHERE status = 'completed') AS completed
           FROM visits WHERE agency_id = $1${agentScope}`,
          params,
        ),
        pool.query(
          `SELECT COUNT(*) FILTER (WHERE stage NOT IN ('closed_won', 'closed_lost')) AS open_deals,
                  COUNT(*) FILTER (WHERE stage = 'closed_won') AS won
           FROM deals WHERE agency_id = $1${agentScope}`,
          params,
        ),
        pool.query(
          `SELECT stage, COUNT(*) AS count FROM leads
           WHERE agency_id = $1${leadScope} GROUP BY stage`,
          params,
        ),
        pool.query(
          `SELECT stage, COUNT(*) AS count FROM deals
           WHERE agency_id = $1${agentScope} GROUP BY stage`,
          params,
        ),
        pool.query(
          `SELECT d::date AS day, COUNT(l.id) AS count
           FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day') AS d
           LEFT JOIN leads l ON l.created_at::date = d::date
                             AND l.agency_id = $1${leadJoinScope}
           GROUP BY d ORDER BY d`,
          params,
        ),
      ]);

    res.json({
      properties: {
        total: num(props.rows[0].total),
        published: num(props.rows[0].published),
        available: num(props.rows[0].available),
      },
      leads: {
        total: num(leads.rows[0].total),
        new: num(leads.rows[0].new_leads),
      },
      visits: {
        upcoming: num(visits.rows[0].upcoming),
        completed: num(visits.rows[0].completed),
      },
      deals: {
        open: num(deals.rows[0].open_deals),
        won: num(deals.rows[0].won),
      },
      leads_by_stage: leadsByStage.rows.map((r) => ({
        stage: r.stage,
        count: num(r.count),
      })),
      deals_by_stage: dealsByStage.rows.map((r) => ({
        stage: r.stage,
        count: num(r.count),
      })),
      leads_last_7_days: trend.rows.map((r) => ({
        day: r.day,
        count: num(r.count),
      })),
    });
  } catch (err) {
    console.error("Dashboard error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = { stats };
