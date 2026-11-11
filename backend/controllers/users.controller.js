const bcrypt = require("bcrypt");
const pool = require("../config/db");

const SALT_ROUNDS = 10;
const ROLES = ["admin", "agent"];
const STATUSES = ["active", "inactive"];

// GET /api/users/agents  (used to fill the assign dropdown)
async function listStaff(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, role
       FROM users
       WHERE agency_id = $1 AND status = 'active'
       ORDER BY full_name`,
      [req.user.agency_id],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List staff error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// GET /api/users  (full list for the Staff page, includes inactive users)
async function listAll(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, role, status, created_at
       FROM users
       WHERE agency_id = $1
       ORDER BY status ASC, full_name`,
      [req.user.agency_id],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("List users error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}
// GET /api/users/:id  (one user for the edit page)
async function getUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ message: "User not found" });
    }

    const result = await pool.query(
      `SELECT id, full_name, email, phone, role, status, created_at
       FROM users
       WHERE id = $1 AND agency_id = $2`,
      [id, req.user.agency_id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Get user error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}
// POST /api/users
async function createUser(req, res) {
  try {
    const { full_name, email, phone, password, role } = req.body;

    if (!full_name || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: "Name, email, password and role are required" });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    const exists = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [email.trim()],
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "Email is already in use" });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (agency_id, full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, email, phone, role, status, created_at`,
      [
        req.user.agency_id,
        full_name.trim(),
        email.trim().toLowerCase(),
        phone ? phone.trim() : null,
        hash,
        role,
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create user error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// PUT /api/users/:id  (partial update, only the fields that were sent)
async function updateUser(req, res) {
  try {
    const id = Number(req.params.id);
    const { full_name, email, phone, password, role, status } = req.body;

    const found = await pool.query(
      "SELECT id, role, status FROM users WHERE id = $1 AND agency_id = $2",
      [id, req.user.agency_id],
    );
    if (found.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // an admin must not lock himself out
    if (id === req.user.id) {
      if (role && role !== "admin") {
        return res
          .status(400)
          .json({ message: "You cannot change your own role" });
      }
      if (status && status !== "active") {
        return res
          .status(400)
          .json({ message: "You cannot deactivate your own account" });
      }
    }

    if (role && !ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    if (password && password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    if (email) {
      const dup = await pool.query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2",
        [email.trim(), id],
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ message: "Email is already in use" });
      }
    }

    const fields = [];
    const values = [];
    function add(column, value) {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    }

    if (full_name) add("full_name", full_name.trim());
    if (email) add("email", email.trim().toLowerCase());
    if (phone !== undefined) add("phone", phone ? phone.trim() : null);
    if (role) add("role", role);
    if (status) add("status", status);
    if (password)
      add("password_hash", await bcrypt.hash(password, SALT_ROUNDS));

    if (fields.length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    values.push(id, req.user.agency_id);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(", ")}
       WHERE id = $${values.length - 1} AND agency_id = $${values.length}
       RETURNING id, full_name, email, phone, role, status, created_at`,
      values,
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update user error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = { listStaff, listAll, getUser, createUser, updateUser };
