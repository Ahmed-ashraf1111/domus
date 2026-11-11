const express = require("express");
const controller = require("../controllers/dashboard.controller");
const { verifyToken } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", verifyToken, controller.stats);

module.exports = router;
