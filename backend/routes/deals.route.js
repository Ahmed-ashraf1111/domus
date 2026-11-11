const express = require("express");
const controller = require("../controllers/deals.controller");
const { verifyToken } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(verifyToken);

router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:id", controller.getOne);
router.patch("/:id", controller.update);
router.patch("/:id/stage", controller.changeStage);

module.exports = router;
