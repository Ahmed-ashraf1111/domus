// runs before every test file: forces the tests onto the local test database
require("dotenv").config();

// never let the tests reach a hosted database
delete process.env.DATABASE_URL;
process.env.DB_NAME = "domus_test";

if (process.env.DB_NAME !== "domus_test" || process.env.DATABASE_URL) {
  throw new Error("Tests must run on the domus_test database only");
}

// keep the secret stable for the token tests
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";
