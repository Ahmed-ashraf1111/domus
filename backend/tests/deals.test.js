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
let firstDealId;
let secondDealId;
let otherDealId;

async function login(email) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "Test@1234" });
  return res.body.token;
}

async function cleanUp() {
  const sub = "SELECT id FROM agencies WHERE slug = 'deal-test'";
  await pool.query(
    `DELETE FROM deal_events WHERE deal_id IN (SELECT id FROM deals WHERE agency_id IN (${sub}))`,
  );
  await pool.query(`DELETE FROM deals WHERE agency_id IN (${sub})`);
  await pool.query(`DELETE FROM activities WHERE agency_id IN (${sub})`);
  await pool.query(`DELETE FROM leads WHERE agency_id IN (${sub})`);
  await pool.query(`DELETE FROM contacts WHERE agency_id IN (${sub})`);
  await pool.query(`DELETE FROM properties WHERE agency_id IN (${sub})`);
  await pool.query("DELETE FROM users WHERE email LIKE '%@dealtest.com'");
  await pool.query("DELETE FROM agencies WHERE slug = 'deal-test'");
}

async function addLead(assignedAgentId) {
  const result = await pool.query(
    `INSERT INTO leads (agency_id, contact_id, source, assigned_agent_id)
     VALUES ($1, $2, 'manual', $3) RETURNING id`,
    [agencyId, contactId, assignedAgentId],
  );
  return result.rows[0].id;
}

function createDeal(token, body) {
  return request(app)
    .post("/api/deals")
    .set("Authorization", `Bearer ${token}`)
    .send({ property_id: propertyId, offer_amount: 900000, ...body });
}

function moveStage(token, id, body) {
  return request(app)
    .patch(`/api/deals/${id}/stage`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

async function propertyStatus() {
  const result = await pool.query(
    "SELECT status FROM properties WHERE id = $1",
    [propertyId],
  );
  return result.rows[0].status;
}

beforeAll(async () => {
  await cleanUp();

  const agency = await pool.query(
    `INSERT INTO agencies (name, slug) VALUES ('Deal Test Agency', 'deal-test') RETURNING id`,
  );
  agencyId = agency.rows[0].id;

  const hash = await bcrypt.hash("Test@1234", 10);
  const users = await pool.query(
    `INSERT INTO users (agency_id, full_name, email, password_hash, role)
     VALUES ($1, 'Deal Admin', 'admin@dealtest.com', $2, 'admin'),
            ($1, 'Deal Agent', 'agent@dealtest.com', $2, 'agent'),
            ($1, 'Other Agent', 'other@dealtest.com', $2, 'agent')
     RETURNING id, email`,
    [agencyId, hash],
  );
  agentId = users.rows.find((u) => u.email === "agent@dealtest.com").id;
  otherAgentId = users.rows.find((u) => u.email === "other@dealtest.com").id;

  const property = await pool.query(
    `INSERT INTO properties
      (agency_id, reference_code, slug, title, purpose, property_type, price, city, status, is_published)
     VALUES ($1, 'DEL-0001', 'deal-test-house', 'Deal Test House', 'sale', 'house', 1000000, 'Lahore', 'available', TRUE)
     RETURNING id`,
    [agencyId],
  );
  propertyId = property.rows[0].id;

  const contact = await pool.query(
    `INSERT INTO contacts (agency_id, full_name, phone)
     VALUES ($1, 'Deal Contact', '01066666666') RETURNING id`,
    [agencyId],
  );
  contactId = contact.rows[0].id;

  ownLeadId = await addLead(agentId);
  otherLeadId = await addLead(otherAgentId);

  adminToken = await login("admin@dealtest.com");
  agentToken = await login("agent@dealtest.com");
});

afterAll(async () => {
  await cleanUp();
  await pool.end();
});

describe("deals", () => {
  test("an agent creates a deal for his own lead and it starts at offer", async () => {
    const res = await createDeal(agentToken, { lead_id: ownLeadId });
    expect(res.status).toBe(201);
    expect(res.body.stage).toBe("offer");
    expect(res.body.agent_id).toBe(agentId);
    firstDealId = res.body.id;

    const events = await pool.query(
      "SELECT new_stage FROM deal_events WHERE deal_id = $1",
      [firstDealId],
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0].new_stage).toBe("offer");
  });

  test("an agent cannot create a deal for a lead assigned to someone else", async () => {
    const res = await createDeal(agentToken, { lead_id: otherLeadId });
    expect(res.status).toBe(403);
  });

  test("an invalid offer amount is rejected", async () => {
    const res = await createDeal(agentToken, { offer_amount: -5 });
    expect(res.status).toBe(400);
  });

  test("an agent sees only his own deals", async () => {
    // the admin creates a deal for the other agent
    const created = await createDeal(adminToken, { agent_id: otherAgentId });
    expect(created.status).toBe(201);
    otherDealId = created.body.id;

    const res = await request(app)
      .get("/api/deals")
      .set("Authorization", `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((d) => d.id);
    expect(ids).toContain(firstDealId);
    expect(ids).not.toContain(otherDealId);
  });

  test("an agent cannot open or move the deal of another agent", async () => {
    const open = await request(app)
      .get(`/api/deals/${otherDealId}`)
      .set("Authorization", `Bearer ${agentToken}`);
    expect(open.status).toBe(404);

    const move = await moveStage(agentToken, otherDealId, { stage: "booking" });
    expect(move.status).toBe(404);
  });

  test("an invalid stage is rejected", async () => {
    const res = await moveStage(agentToken, firstDealId, {
      stage: "not_a_stage",
    });
    expect(res.status).toBe(400);
  });

  test("booking a deal reserves the property", async () => {
    const res = await moveStage(agentToken, firstDealId, { stage: "booking" });
    expect(res.status).toBe(200);
    expect(await propertyStatus()).toBe("reserved");
  });

  test("a second booking for the same property is blocked", async () => {
    const created = await createDeal(adminToken, {
      agent_id: otherAgentId,
      offer_amount: 950000,
    });
    secondDealId = created.body.id;

    const res = await moveStage(adminToken, secondDealId, { stage: "booking" });
    expect(res.status).toBe(409);
  });

  test("closing the booked deal works and keeps the other deal blocked", async () => {
    const res = await moveStage(agentToken, firstDealId, {
      stage: "closed_won",
    });
    expect(res.status).toBe(200);

    // the property is now closed, so a booking without override is still blocked
    const blocked = await moveStage(adminToken, secondDealId, {
      stage: "booking",
    });
    expect(blocked.status).toBe(409);
  });

  test("an admin can override the booking block", async () => {
    const res = await moveStage(adminToken, secondDealId, {
      stage: "booking",
      override: true,
    });
    expect(res.status).toBe(200);
  });

  test("closing a deal as won marks the property sold and the lead converted", async () => {
    expect(await propertyStatus()).toBe("sold");

    const lead = await pool.query("SELECT stage FROM leads WHERE id = $1", [
      ownLeadId,
    ]);
    expect(lead.rows[0].stage).toBe("converted");

    const deal = await pool.query(
      "SELECT agreed_amount FROM deals WHERE id = $1",
      [firstDealId],
    );
    expect(Number(deal.rows[0].agreed_amount)).toBe(900000);
  });

  test("a closed deal cannot be edited or moved again", async () => {
    const edit = await request(app)
      .patch(`/api/deals/${firstDealId}`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ notes: "too late" });
    expect(edit.status).toBe(409);

    const move = await moveStage(agentToken, firstDealId, {
      stage: "closed_lost",
    });
    expect(move.status).toBe(409);
  });
});
