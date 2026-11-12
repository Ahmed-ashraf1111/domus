const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../index");
const pool = require("../config/db");

let agencyId;
let adminToken;
let agentToken;
let agentId;
let otherAgentId;
let propertyId;
let contactId;
let ownLeadId;
let otherLeadId;
let firstVisitId;

async function login(email) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "Test@1234" });
  return res.body.token;
}

async function cleanUp() {
  const sub = "SELECT id FROM agencies WHERE slug = 'visit-test'";
  await pool.query(`DELETE FROM activities WHERE agency_id IN (${sub})`);
  await pool.query(`DELETE FROM visits WHERE agency_id IN (${sub})`);
  await pool.query(`DELETE FROM leads WHERE agency_id IN (${sub})`);
  await pool.query(`DELETE FROM contacts WHERE agency_id IN (${sub})`);
  await pool.query(`DELETE FROM properties WHERE agency_id IN (${sub})`);
  await pool.query("DELETE FROM users WHERE email LIKE '%@visittest.com'");
  await pool.query("DELETE FROM agencies WHERE slug = 'visit-test'");
}

async function addLead(assignedAgentId) {
  const result = await pool.query(
    `INSERT INTO leads (agency_id, contact_id, source, assigned_agent_id)
     VALUES ($1, $2, 'manual', $3) RETURNING id`,
    [agencyId, contactId, assignedAgentId],
  );
  return result.rows[0].id;
}

function bookVisit(token, body) {
  return request(app)
    .post("/api/visits")
    .set("Authorization", `Bearer ${token}`)
    .send({
      property_id: propertyId,
      starts_at: "2030-06-10T10:00:00Z",
      duration_minutes: 60,
      ...body,
    });
}

beforeAll(async () => {
  await cleanUp();

  const agency = await pool.query(
    `INSERT INTO agencies (name, slug) VALUES ('Visit Test Agency', 'visit-test') RETURNING id`,
  );
  agencyId = agency.rows[0].id;

  const hash = await bcrypt.hash("Test@1234", 10);
  const users = await pool.query(
    `INSERT INTO users (agency_id, full_name, email, password_hash, role)
     VALUES ($1, 'Visit Admin', 'admin@visittest.com', $2, 'admin'),
            ($1, 'Visit Agent', 'agent@visittest.com', $2, 'agent'),
            ($1, 'Other Agent', 'other@visittest.com', $2, 'agent')
     RETURNING id, email`,
    [agencyId, hash],
  );
  agentId = users.rows.find((u) => u.email === "agent@visittest.com").id;
  otherAgentId = users.rows.find((u) => u.email === "other@visittest.com").id;

  const property = await pool.query(
    `INSERT INTO properties
      (agency_id, reference_code, slug, title, purpose, property_type, price, city, status, is_published)
     VALUES ($1, 'VIS-0001', 'visit-test-house', 'Visit Test House', 'sale', 'house', 1000000, 'Lahore', 'available', TRUE)
     RETURNING id`,
    [agencyId],
  );
  propertyId = property.rows[0].id;

  const contact = await pool.query(
    `INSERT INTO contacts (agency_id, full_name, phone)
     VALUES ($1, 'Visit Contact', '01077777777') RETURNING id`,
    [agencyId],
  );
  contactId = contact.rows[0].id;

  ownLeadId = await addLead(agentId);
  otherLeadId = await addLead(otherAgentId);

  adminToken = await login("admin@visittest.com");
  agentToken = await login("agent@visittest.com");
});

afterAll(async () => {
  await cleanUp();
  await pool.end();
});

describe("visits", () => {
  test("an agent books a visit and it is saved for himself", async () => {
    const res = await bookVisit(agentToken, { lead_id: ownLeadId });
    expect(res.status).toBe(201);
    expect(res.body.agent_id).toBe(agentId);
    expect(res.body.status).toBe("confirmed");
    firstVisitId = res.body.id;
  });

  test("booking a visit moves an early stage lead to visit scheduled", async () => {
    const lead = await pool.query("SELECT stage FROM leads WHERE id = $1", [
      ownLeadId,
    ]);
    expect(lead.rows[0].stage).toBe("visit_scheduled");

    const log = await pool.query(
      `SELECT id FROM activities WHERE lead_id = $1 AND activity_type = 'visit'`,
      [ownLeadId],
    );
    expect(log.rows).toHaveLength(1);
  });

  test("an overlapping visit of the same agent returns a conflict warning", async () => {
    const res = await bookVisit(agentToken, {
      starts_at: "2030-06-10T10:30:00Z",
    });
    expect(res.status).toBe(409);
    expect(res.body.conflicts).toHaveLength(1);
    expect(res.body.conflicts[0].id).toBe(firstVisitId);
  });

  test("the conflict warning can be ignored with force", async () => {
    const res = await bookVisit(agentToken, {
      starts_at: "2030-06-10T10:30:00Z",
      force: true,
    });
    expect(res.status).toBe(201);
  });

  test("a visit that starts when another one ends does not conflict", async () => {
    // use a free day so the earlier tests do not interfere
    const first = await bookVisit(agentToken, {
      starts_at: "2030-06-11T10:00:00Z",
    });
    expect(first.status).toBe(201);

    const second = await bookVisit(agentToken, {
      starts_at: "2030-06-11T11:00:00Z",
    });
    expect(second.status).toBe(201);
  });

  test("another agent at the same time does not conflict", async () => {
    const res = await bookVisit(adminToken, { agent_id: otherAgentId });
    expect(res.status).toBe(201);
    expect(res.body.agent_id).toBe(otherAgentId);
  });

  test("an agent cannot link a lead assigned to someone else", async () => {
    const res = await bookVisit(agentToken, {
      starts_at: "2030-07-01T10:00:00Z",
      lead_id: otherLeadId,
    });
    expect(res.status).toBe(403);
  });

  test("an agent sees only his own visits", async () => {
    const res = await request(app)
      .get("/api/visits")
      .set("Authorization", `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((v) => expect(v.agent_id).toBe(agentId));
  });

  test("an agent cannot update the visit of another agent", async () => {
    const other = await pool.query(
      "SELECT id FROM visits WHERE agent_id = $1 LIMIT 1",
      [otherAgentId],
    );
    const res = await request(app)
      .patch(`/api/visits/${other.rows[0].id}/status`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ status: "completed" });
    expect(res.status).toBe(404);
  });

  test("a completed visit cannot be changed again", async () => {
    const first = await request(app)
      .patch(`/api/visits/${firstVisitId}/status`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ status: "completed" });
    expect(first.status).toBe(200);
    expect(first.body.status).toBe("completed");

    const second = await request(app)
      .patch(`/api/visits/${firstVisitId}/status`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ status: "cancelled" });
    expect(second.status).toBe(409);
  });
});
