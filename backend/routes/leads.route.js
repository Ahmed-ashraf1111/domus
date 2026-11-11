const express = require("express");
const controller = require("../controllers/leads.controller");
const { verifyToken, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(verifyToken);

router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:id", controller.getOne);
router.patch("/:id", controller.update);
router.patch("/:id/stage", controller.updateStage);
router.post("/:id/activities", controller.addActivity);

// only the admin can assign a lead to an agent
router.patch("/:id/assign", requireRole("admin"), controller.assign);

module.exports = router;
