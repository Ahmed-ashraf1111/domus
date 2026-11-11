const express = require("express");
const controller = require("../controllers/users.controller");
const { verifyToken, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/agents", verifyToken, requireRole("admin"), controller.listStaff);
router.get("/", verifyToken, requireRole("admin"), controller.listAll);
router.get("/:id", verifyToken, requireRole("admin"), controller.getUser);
router.post("/", verifyToken, requireRole("admin"), controller.createUser);
router.put("/:id", verifyToken, requireRole("admin"), controller.updateUser);

module.exports = router;
