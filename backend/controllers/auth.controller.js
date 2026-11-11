const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const result = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email.trim()],
    );
    const user = result.rows[0];

    // same message for wrong email and wrong password
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ message: "This account is inactive" });
    }

    // agency_id and role are stored in the token, never taken from the request body
    const token = jwt.sign(
      { id: user.id, agency_id: user.agency_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        agency_id: user.agency_id,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// GET /api/auth/me
async function me(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, role, agency_id
       FROM users WHERE id = $1 AND agency_id = $2`,
      [req.user.id, req.user.agency_id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("Me error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = { login, me };
