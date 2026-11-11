const multer = require("multer");
const path = require("path");

const allowedTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    // random name, the extension comes from the mime type not from the user file name
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + allowedTypes[file.mimetype]);
  },
});

const uploader = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedTypes[file.mimetype]) {
      return cb(new Error("Only JPG, PNG and WEBP images are allowed"));
    }
    cb(null, true);
  },
}).array("images", 10);

// wrapper so upload errors return a clean 400 message
function uploadImages(req, res, next) {
  uploader(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}

module.exports = { uploadImages };
