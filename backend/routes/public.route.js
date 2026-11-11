const express = require("express");
const rateLimit = require("express-rate-limit");
const controller = require("../controllers/public.controller");

const router = express.Router();

// stops spam on the inquiry form
const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many requests, please try again later" },
});

router.get("/properties", controller.list);
router.get("/properties/featured", controller.featured);
router.get("/properties/:slug", controller.getBySlug);
router.get("/filters", controller.filters);
router.get("/agency", controller.agency);
router.post("/inquiries", inquiryLimiter, controller.createInquiry);

module.exports = router;
