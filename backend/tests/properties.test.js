const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../index");
const pool = require("../config/db");

let agencyId;
let adminToken;
let agentToken;
let propertyId;
let propertySlug;

async function login(email) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "Test@1234" });
  return res.body.token;
}

async function cleanUp() {
  await pool.query(
    "DELETE FROM properties WHERE agency_id IN (SELECT id FROM agencies WHERE slug = 'property-test')",
  );
  await pool.query("DELETE FROM users WHERE email LIKE '%@proptest.com'");
  await pool.query("DELETE FROM agencies WHERE slug = 'property-test'");
}

beforeAll(async () => {
  await cleanUp();

  const agency = await pool.query(
    `INSERT INTO agencies (name, slug) VALUES ('Property Test Agency', 'property-test') RETURNING id`,
  );
  agencyId = agency.rows[0].id;

  const hash = await bcrypt.hash("Test@1234", 10);
  await pool.query(
    `INSERT INTO users (agency_id, full_name, email, password_hash, role)
     VALUES ($1, 'Prop Admin', 'admin@proptest.com', $2, 'admin'),
            ($1, 'Prop Agent', 'agent@proptest.com', $2, 'agent')`,
    [agencyId, hash],
  );

  adminToken = await login("admin@proptest.com");
  agentToken = await login("agent@proptest.com");
});

afterAll(async () => {
  await cleanUp();
  await pool.end();
});

describe("property access", () => {
  test("an agent cannot create a property", async () => {
    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        title: "Agent Property",
        purpose: "sale",
        property_type: "house",
        price: 1000000,
        city: "Lahore",
      });
    expect(res.status).toBe(403);
  });

  test("an admin can create a property", async () => {
    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Access Test House",
        purpose: "sale",
        property_type: "house",
        price: 2500000,
        city: "Lahore",
      });
    expect(res.status).toBe(201);
    propertyId = res.body.id;
    propertySlug = res.body.slug;
    expect(propertySlug).toBeDefined();
  });

  test("a draft property is not visible on the public site", async () => {
    const res = await request(app).get(
      `/api/public/properties/${propertySlug}`,
    );
    expect(res.status).toBe(404);
  });

  test("publishing without an image is rejected", async () => {
    const res = await request(app)
      .patch(`/api/properties/${propertyId}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ is_published: true });
    expect(res.status).toBe(400);
  });

  test("a published property is visible on the public site", async () => {
    // the image is inserted directly so the test does not need Cloudinary
    await pool.query(
      `INSERT INTO property_media (property_id, file_url, sort_order, is_cover)
       VALUES ($1, 'https://example.com/test.jpg', 0, TRUE)`,
      [propertyId],
    );
    const publish = await request(app)
      .patch(`/api/properties/${propertyId}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ is_published: true });
    expect(publish.status).toBe(200);

    const res = await request(app).get(
      `/api/public/properties/${propertySlug}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Access Test House");
  });

  test("an agent can read the property list but only of his agency", async () => {
    const res = await request(app)
      .get("/api/properties")
      .set("Authorization", `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((p) => p.id === propertyId)).toBe(true);
  });
});
