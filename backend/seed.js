require("dotenv").config();
const bcrypt = require("bcrypt");
const pool = require("./config/db");

// creates one agency with an admin and an agent so we can log in
async function seed() {
  try {
    const existing = await pool.query(
      "SELECT id FROM agencies WHERE slug = $1",
      ["domus-demo"],
    );
    if (existing.rows.length > 0) {
      console.log("Seed data already exists, nothing to do");
      return;
    }

    const agency = await pool.query(
      `INSERT INTO agencies (name, slug, phone, email, address)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        "Domus Real Estate",
        "domus-demo",
        "+92 300 1234567",
        "info@domus.com",
        "Lahore, Pakistan",
      ],
    );
    const agencyId = agency.rows[0].id;

    const adminHash = await bcrypt.hash("Admin@123", 10);
    const agentHash = await bcrypt.hash("Agent@123", 10);

    await pool.query(
      `INSERT INTO users (agency_id, full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, 'admin'),
              ($1, $6, $7, $8, $9, 'agent')`,
      [
        agencyId,
        "Sara Khan",
        "admin@domus.com",
        "+92 300 1111111",
        adminHash,
        "Ali Raza",
        "agent@domus.com",
        "+92 300 2222222",
        agentHash,
      ],
    );

    console.log("Seed done");
    console.log("Admin: admin@domus.com / Admin@123");
    console.log("Agent: agent@domus.com / Agent@123");
  } catch (err) {
    console.error("Seed failed:", err.message);
  } finally {
    await pool.end();
  }
}

seed();
