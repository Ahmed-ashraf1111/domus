const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../index");
const pool = require("../config/db");

const SLUG = "match-test";

let agencyId;
let adminToken;
let contactId;
let exactLeadId;
let emptyLeadId;
let nearBudgetLeadId;
let otherAgencyId;
let otherAdminToken;

async function cleanUp() {
  const sub = `SELECT id FROM agencies WHERE slug IN ('${SLUG}', '${SLUG}-other')`;
  await pool.query(`DELETE FROM activities WHERE agency_id IN (${sub})`);
  await pool.query(`DELETE FROM leads WHERE agency_id IN (${sub})`);
  await pool.query(`DELETE FROM contacts WHERE agency_id IN (${sub})`);
  await pool.query(`DELETE FROM properties WHERE agency_id IN (${sub})`);
  await pool.query(`DELETE FROM users WHERE agency_id IN (${sub})`);
  await pool.query(
    `DELETE FROM agencies WHERE slug IN ('${SLUG}', '${SLUG}-other')`,
  );
}

async function addProperty(code, fields) {
  const p = {
    title: code,
    purpose: "sale",
    property_type: "house",
    price: 1000000,
    city: "Lahore",
    bedrooms: 3,
    status: "available",
    is_published: true,
    ...fields,
  };
  const result = await pool.query(
    `INSERT INTO properties
      (agency_id, reference_code, slug, title, purpose, property_type, price,
       city, bedrooms, status, is_published)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      p.agency_id || agencyId,
      code,
      `match-test-${code.toLowerCase()}`,
      p.title,
      p.purpose,
      p.property_type,
      p.price,
      p.city,
      p.bedrooms,
      p.status,
      p.is_published,
    ],
  );
  return result.rows[0].id;
}

async function addLead(fields) {
  const result = await pool.query(
    `INSERT INTO leads
      (agency_id, contact_id, source, purpose, property_type, budget_min,
       budget_max, preferred_city, preferred_bedrooms)
     VALUES ($1, $2, 'manual', $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      agencyId,
      contactId,
      fields.purpose || null,
      fields.property_type || null,
      fields.budget_min || null,
      fields.budget_max || null,
      fields.preferred_city || null,
      fields.preferred_bedrooms || null,
    ],
  );
  return result.rows[0].id;
}

async function addAdmin(agency, email) {
  const user = await pool.query(
    `INSERT INTO users (agency_id, full_name, email, phone, password_hash, role)
     VALUES ($1, 'Match Admin', $2, '0', 'not-a-real-hash', 'admin')
     RETURNING id`,
    [agency, email],
  );
  return jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

function getMatches(leadId, token) {
  return request(app)
    .get(`/api/leads/${leadId}/matches`)
    .set("Authorization", `Bearer ${token}`);
}

beforeAll(async () => {
  await cleanUp();

  const agency = await pool.query(
    `INSERT INTO agencies (name, slug) VALUES ('Match Test Agency', $1) RETURNING id`,
    [SLUG],
  );
  agencyId = agency.rows[0].id;

  const other = await pool.query(
    `INSERT INTO agencies (name, slug) VALUES ('Match Other Agency', $1) RETURNING id`,
    [`${SLUG}-other`],
  );
  otherAgencyId = other.rows[0].id;

  adminToken = await addAdmin(agencyId, "match-admin@test.local");
  otherAdminToken = await addAdmin(otherAgencyId, "match-other@test.local");

  const contact = await pool.query(
    `INSERT INTO contacts (agency_id, full_name, phone)
     VALUES ($1, 'Match Contact', '01099999999') RETURNING id`,
    [agencyId],
  );
  contactId = contact.rows[0].id;

  // properties of the test agency
  await addProperty("MT-PERFECT", { title: "Perfect Match" });
  await addProperty("MT-NEAR", {
    title: "Slightly Over Budget",
    price: 1080000,
  });
  await addProperty("MT-FARCITY", { title: "Other City", city: "Karachi" });
  await addProperty("MT-FLAT", {
    title: "Wrong Type",
    property_type: "apartment",
    bedrooms: 2,
  });
  await addProperty("MT-DRAFT", {
    title: "Draft Property",
    status: "draft",
    is_published: false,
  });
  await addProperty("MT-SOLD", { title: "Sold Property", status: "sold" });

  // a perfect property that belongs to another agency
  await addProperty("MT-OTHER", {
    title: "Other Agency Property",
    agency_id: otherAgencyId,
  });

  exactLeadId = await addLead({
    purpose: "sale",
    property_type: "house",
    budget_min: 900000,
    budget_max: 1100000,
    preferred_city: "lahore",
    preferred_bedrooms: 3,
  });
  emptyLeadId = await addLead({});
  nearBudgetLeadId = await addLead({
    purpose: "sale",
    property_type: "house",
    budget_max: 1000000,
    preferred_city: "Lahore",
    preferred_bedrooms: 3,
  });
});

afterAll(async () => {
  await cleanUp();
  await pool.end();
});

describe("match engine", () => {
  test("a perfect property gets 100 points and ranks first", async () => {
    const res = await getMatches(exactLeadId, adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data[0].title).toBe("Perfect Match");
    expect(res.body.data[0].score).toBe(100);
  });

  test("city comparison ignores letter case", async () => {
    const res = await getMatches(exactLeadId, adminToken);
    expect(res.body.data[0].breakdown.city).toBe(25);
  });

  test("a different city loses the city points", async () => {
    const res = await getMatches(exactLeadId, adminToken);
    const other = res.body.data.find((m) => m.title === "Other City");
    expect(other.breakdown.city).toBe(0);
    expect(other.score).toBe(75);
  });

  test("a price slightly above the maximum gets half of the budget points", async () => {
    const res = await getMatches(nearBudgetLeadId, adminToken);
    const near = res.body.data.find((m) => m.title === "Slightly Over Budget");
    expect(near.breakdown.budget).toBe(17.5);
  });

  test("bedrooms that differ by one get half of the points", async () => {
    // this lead wants an apartment, so the 2 bedroom flat ranks first
    const lead = await addLead({
      property_type: "apartment",
      preferred_bedrooms: 3,
    });
    const res = await getMatches(lead, adminToken);
    const flat = res.body.data.find((m) => m.title === "Wrong Type");
    expect(flat.breakdown.bedrooms).toBe(5);
    expect(flat.breakdown.type).toBe(20);
    expect(flat.score).toBe(95);
  });

  test("a lead with no criteria gets full points for every property", async () => {
    const res = await getMatches(emptyLeadId, adminToken);
    expect(res.status).toBe(200);
    res.body.data.forEach((m) => expect(m.score).toBe(100));
  });

  test("at most 3 suggestions are returned", async () => {
    const res = await getMatches(emptyLeadId, adminToken);
    expect(res.body.data).toHaveLength(3);
  });

  test("draft, sold and other agency properties are never suggested", async () => {
    const res = await getMatches(emptyLeadId, adminToken);
    const titles = res.body.data.map((m) => m.title);
    expect(titles).not.toContain("Draft Property");
    expect(titles).not.toContain("Sold Property");
    expect(titles).not.toContain("Other Agency Property");
  });

  test("an admin of another agency cannot see the lead", async () => {
    const res = await getMatches(exactLeadId, otherAdminToken);
    expect(res.status).toBe(404);
  });
});
