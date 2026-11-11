const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../index");
const pool = require("../config/db");

let agencyId;

beforeAll(async () => {
  // clean start so the test can be run many times
  await pool.query("DELETE FROM users WHERE email LIKE '%@authtest.com'");
  await pool.query("DELETE FROM agencies WHERE slug = 'auth-test'");

  const agency = await pool.query(
    `INSERT INTO agencies (name, slug) VALUES ('Auth Test Agency', 'auth-test') RETURNING id`,
  );
  agencyId = agency.rows[0].id;

  const hash = await bcrypt.hash("Test@1234", 10);
  await pool.query(
    `INSERT INTO users (agency_id, full_name, email, password_hash, role)
     VALUES ($1, 'Active Admin', 'admin@authtest.com', $2, 'admin'),
            ($1, 'Inactive Agent', 'inactive@authtest.com', $2, 'agent')`,
    [agencyId, hash],
  );
  await pool.query(
    "UPDATE users SET status = 'inactive' WHERE email = 'inactive@authtest.com'",
  );
});

afterAll(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE '%@authtest.com'");
  await pool.query("DELETE FROM agencies WHERE slug = 'auth-test'");
  await pool.end();
});

describe("authentication", () => {
  test("login works with correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@authtest.com", password: "Test@1234" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe("admin");
  });

  test("login fails with a wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@authtest.com", password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  test("an inactive account cannot log in", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "inactive@authtest.com", password: "Test@1234" });
    expect(res.status).toBe(403);
  });

  test("a protected route rejects a request without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("a protected route accepts a valid token", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@authtest.com", password: "Test@1234" });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
  });
});
