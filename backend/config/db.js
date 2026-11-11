const { Pool } = require("pg");
require("dotenv").config();
const { types } = require("pg");

// return DATE columns as plain strings so the timezone does not shift them
types.setTypeParser(1082, (value) => value);
// one shared pool for the whole app
// use a single connection string when it is set (hosted database), otherwise the separate DB_* variables
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      },
);

pool.on("error", (err) => {
  console.error("Unexpected database error:", err.message);
});

module.exports = pool;
