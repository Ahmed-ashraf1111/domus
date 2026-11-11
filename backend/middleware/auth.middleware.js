const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// checks the Bearer token, then reloads the user from the database
// so a deactivated user or a changed role takes effect immediately
async function verifyToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  let payload;
  try {
    const token = header.split(" ")[1];
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  try {
    const result = await pool.query(
      "SELECT id, agency_id, role, status FROM users WHERE id = $1",
      [payload.id],
    );
    const user = result.rows[0];

    if (!user || user.status !== "active") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = { id: user.id, agency_id: user.agency_id, role: user.role };
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
}

// usage: requireRole("admin") or requireRole("admin", "agent")
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission" });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
