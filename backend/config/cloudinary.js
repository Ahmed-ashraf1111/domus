const { v2: cloudinary } = require("cloudinary");
require("dotenv").config();

// the credentials are read from the CLOUDINARY_URL environment variable
cloudinary.config({ secure: true });

const FOLDER = "domus";

// upload an image that is in memory (from multer) and return the cloudinary result
function uploadBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: FOLDER, resource_type: "image" },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
    stream.end(buffer);
  });
}

// upload an image from a file path (used by the demo seed)
function uploadFile(filePath) {
  return cloudinary.uploader.upload(filePath, {
    folder: FOLDER,
    resource_type: "image",
  });
}

// the public id is the part of the url after /upload/ without the version and the extension
function publicIdFromUrl(url) {
  const match = /\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(url);
  return match ? match[1] : null;
}

// delete an image from cloudinary using its stored url, errors are only logged
async function deleteByUrl(url) {
  if (!url || !url.startsWith("http")) return;
  const publicId = publicIdFromUrl(url);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary delete error:", err.message);
  }
}

module.exports = { uploadBuffer, uploadFile, deleteByUrl };
