const multer = require("multer");

const allowedTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// images are kept in memory and sent to cloudinary by the controller
const storage = multer.memoryStorage();

const uploader = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedTypes[file.mimetype]) {
      return cb(new Error("Only JPG, PNG and WEBP images are allowed"));
    }
    cb(null, true);
  },
}).array("images", 4);

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
