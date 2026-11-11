const request = require("supertest");
const app = require("../index");
const pool = require("../config/db");

let agencyId;
let propertyId;
let draftId;

async function cleanUp() {
  await pool.query(
    "DELETE FROM activities WHERE agency_id IN (SELECT id FROM agencies WHERE slug = 'inquiry-test')",
  );
  await pool.query(
    "DELETE FROM leads WHERE agency_id IN (SELECT id FROM agencies WHERE slug = 'inquiry-test')",
  );
  await pool.query(
    "DELETE FROM contacts WHERE agency_id IN (SELECT id FROM agencies WHERE slug = 'inquiry-test')",
  );
  await pool.query(
    "DELETE FROM properties WHERE agency_id IN (SELECT id FROM agencies WHERE slug = 'inquiry-test')",
  );
  await pool.query("DELETE FROM agencies WHERE slug = 'inquiry-test'");
}

beforeAll(async () => {
  await cleanUp();

  const agency = await pool.query(
    `INSERT INTO agencies (name, slug) VALUES ('Inquiry Test Agency', 'inquiry-test') RETURNING id`,
  );
  agencyId = agency.rows[0].id;

  // one published property and one draft, inserted directly
  const published = await pool.query(
    `INSERT INTO properties
      (agency_id, reference_code, slug, title, purpose, property_type, price, city, status, is_published)
     VALUES ($1, 'INQ-0001', 'inquiry-test-house', 'Inquiry Test House', 'sale', 'house', 1500000, 'Lahore', 'available', TRUE)
     RETURNING id`,
    [agencyId],
  );
  propertyId = published.rows[0].id;

  const draft = await pool.query(
    `INSERT INTO properties
      (agency_id, reference_code, slug, title, purpose, property_type, price, city, status, is_published)
     VALUES ($1, 'INQ-0002', 'inquiry-test-draft', 'Inquiry Test Draft', 'sale', 'house', 900000, 'Lahore', 'draft', FALSE)
     RETURNING id`,
    [agencyId],
  );
  draftId = draft.rows[0].id;
});

afterAll(async () => {
  await cleanUp();
  await pool.end();
});

describe("inquiry to lead", () => {
  test("an inquiry without a name is rejected", async () => {
    const res = await request(app)
      .post("/api/public/inquiries")
      .send({ phone: "01000000001", property_id: propertyId });
    expect(res.status).toBe(400);
  });

  test("an inquiry without phone or email is rejected", async () => {
    const res = await request(app)
      .post("/api/public/inquiries")
      .send({ full_name: "No Contact", property_id: propertyId });
    expect(res.status).toBe(400);
  });

  test("an inquiry on an unpublished property is rejected", async () => {
    const res = await request(app).post("/api/public/inquiries").send({
      full_name: "Draft Asker",
      phone: "01000000002",
      property_id: draftId,
    });
    expect(res.status).toBe(404);
  });

  test("an inquiry creates a lead linked to the property", async () => {
    const res = await request(app).post("/api/public/inquiries").send({
      full_name: "Inquiry Tester",
      phone: "01000000003",
      message: "I want to visit this house",
      property_id: propertyId,
    });
    expect(res.status).toBe(201);

    const lead = await pool.query(
      `SELECT l.source, l.stage, l.property_id, l.message, c.full_name
       FROM leads l JOIN contacts c ON c.id = l.contact_id
       WHERE l.agency_id = $1`,
      [agencyId],
    );
    expect(lead.rows).toHaveLength(1);
    expect(lead.rows[0].source).toBe("website");
    expect(lead.rows[0].stage).toBe("new");
    expect(lead.rows[0].property_id).toBe(propertyId);
    expect(lead.rows[0].full_name).toBe("Inquiry Tester");
  });
});
