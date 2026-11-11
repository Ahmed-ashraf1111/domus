require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("./config/db");
const authRoutes = require("./routes/auth.route");
const propertiesRoutes = require("./routes/properties.route");
const publicRoutes = require("./routes/public.route");
const leadsRoutes = require("./routes/leads.route");
const usersRoutes = require("./routes/users.route");
const visitsRoutes = require("./routes/visits.route");
const dealsRoutes = require("./routes/deals.route");
const dashboardRoutes = require("./routes/dashboard.route");
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());

// uploaded property images are served from this folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// simple route to check that the server and the database are working
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS time");
    res.json({ status: "ok", dbTime: result.rows[0].time });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/visits", visitsRoutes);
app.use("/api/deals", dealsRoutes);
app.use("/api/dashboard", dashboardRoutes);
const PORT = process.env.PORT || 5000;

// on Vercel the platform runs the app itself, so only listen when running locally
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
