const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../index");
const pool = require("../config/db");

let agencyId;
let adminToken;
let agentToken;
let agentId;
let otherAgentId;
let contactId;
let ownLeadId;
let otherLeadId;

async function login(email) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "Test@1234" });
  return res.body.token;
}

async function cleanUp() {
  const sub = "SELECT id FROM agencies WHERE slug = 'lead-test'";
  await pool.query(`DELETE FROM activities WHERE agency_id IN (${sub})`);
  await pool.query(`DELETE FROM leads WHERE agency_id IN (${sub})`);
  await pool.query(`DELETE FROM contacts WHERE agency_id IN (${sub})`);
  await pool.query("DELETE FROM users WHERE email LIKE '%@leadtest.com'");
  await pool.query("DELETE FROM agencies WHERE slug = 'lead-test'");
}

async function addLead(assignedAgentId) {
  const result = await pool.query(
    `INSERT INTO leads (agency_id, contact_id, source, assigned_agent_id)
     VALUES ($1, $2, 'manual', $3) RETURNING id`,
    [agencyId, contactId, assignedAgentId],
  );
  return result.rows[0].id;
}

beforeAll(async () => {
  await cleanUp();

  const agency = await pool.query(
    `INSERT INTO agencies (name, slug) VALUES ('Lead Test Agency', 'lead-test') RETURNING id`,
  );
  agencyId = agency.rows[0].id;

  const hash = await bcrypt.hash("Test@1234", 10);
  const users = await pool.query(
    `INSERT INTO users (agency_id, full_name, email, password_hash, role)
     VALUES ($1, 'Lead Admin', 'admin@leadtest.com', $2, 'admin'),
            ($1, 'Lead Agent', 'agent@leadtest.com', $2, 'agent'),
            ($1, 'Other Agent', 'other@leadtest.com', $2, 'agent')
     RETURNING id, email`,
    [agencyId, hash],
  );
  agentId = users.rows.find((u) => u.email === "agent@leadtest.com").id;
  otherAgentId = users.rows.find((u) => u.email === "other@leadtest.com").id;

  const contact = await pool.query(
    `INSERT INTO contacts (agency_id, full_name, phone)
     VALUES ($1, 'Lead Contact', '01088888888') RETURNING id`,
    [agencyId],
  );
  contactId = contact.rows[0].id;

  ownLeadId = await addLead(agentId);
  otherLeadId = await addLead(otherAgentId);

  adminToken = await login("admin@leadtest.com");
  agentToken = await login("agent@leadtest.com");
});

afterAll(async () => {
  await cleanUp();
  await pool.end();
});

describe("lead permissions", () => {
  test("an agent sees only the leads assigned to him", async () => {
    const res = await request(app)
      .get("/api/leads")
      .set("Authorization", `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((l) => l.id);
    expect(ids).toContain(ownLeadId);
    expect(ids).not.toContain(otherLeadId);
  });

  test("an admin sees every lead of the agency", async () => {
    const res = await request(app)
      .get("/api/leads")
      .set("Authorization", `Bearer ${adminToken}`);
    const ids = res.body.data.map((l) => l.id);
    expect(ids).toContain(ownLeadId);
    expect(ids).toContain(otherLeadId);
  });

  test("an agent cannot open a lead assigned to someone else", async () => {
    const res = await request(app)
      .get(`/api/leads/${otherLeadId}`)
      .set("Authorization", `Bearer ${agentToken}`);
    expect(res.status).toBe(404);
  });

  test("an agent cannot assign a lead", async () => {
    const res = await request(app)
      .patch(`/api/leads/${ownLeadId}/assign`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ agent_id: otherAgentId });
    expect(res.status).toBe(403);
  });

  test("an admin can assign a lead and the assignment is logged", async () => {
    const res = await request(app)
      .patch(`/api/leads/${otherLeadId}/assign`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ agent_id: agentId });
    expect(res.status).toBe(200);
    expect(res.body.assigned_agent_id).toBe(agentId);

    const log = await pool.query(
      `SELECT id FROM activities WHERE lead_id = $1 AND activity_type = 'assignment'`,
      [otherLeadId],
    );
    expect(log.rows).toHaveLength(1);

    // put the lead back with the other agent for the next tests
    await pool.query("UPDATE leads SET assigned_agent_id = $1 WHERE id = $2", [
      otherAgentId,
      otherLeadId,
    ]);
  });

  test("an agent cannot change the stage of someone else's lead", async () => {
    const res = await request(app)
      .patch(`/api/leads/${otherLeadId}/stage`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ stage: "contacted" });
    expect(res.status).toBe(404);
  });

  test("an agent can change the stage of his own lead and it is logged", async () => {
    const res = await request(app)
      .patch(`/api/leads/${ownLeadId}/stage`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ stage: "contacted" });
    expect(res.status).toBe(200);

    const log = await pool.query(
      `SELECT body FROM activities WHERE lead_id = $1 AND activity_type = 'stage_change'`,
      [ownLeadId],
    );
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0].body).toBe("Stage changed from new to contacted");
  });

  test("an invalid stage is rejected", async () => {
    const res = await request(app)
      .patch(`/api/leads/${ownLeadId}/stage`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ stage: "not_a_stage" });
    expect(res.status).toBe(400);
  });

  test("an agent cannot add a note to someone else's lead", async () => {
    const res = await request(app)
      .post(`/api/leads/${otherLeadId}/activities`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ body: "Should not be saved" });
    expect(res.status).toBe(404);
  });
});
