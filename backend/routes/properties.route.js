const express = require("express");
const controller = require("../controllers/properties.controller");
const { verifyToken, requireRole } = require("../middleware/auth.middleware");
const { uploadImages } = require("../middleware/upload.middleware");

const router = express.Router();

// every route needs a logged in user
router.use(verifyToken);

// admin and agent can read
router.get("/", controller.list);
router.get("/:id", controller.getOne);

// only admin can change data
router.post("/", requireRole("admin"), controller.create);
router.put("/:id", requireRole("admin"), controller.update);
router.patch("/:id/publish", requireRole("admin"), controller.setPublished);
router.delete("/:id", requireRole("admin"), controller.remove);

router.post(
  "/:id/media",
  requireRole("admin"),
  uploadImages,
  controller.uploadMedia,
);
router.delete(
  "/:id/media/:mediaId",
  requireRole("admin"),
  controller.deleteMedia,
);
router.patch(
  "/:id/media/:mediaId/cover",
  requireRole("admin"),
  controller.setCover,
);

module.exports = router;
