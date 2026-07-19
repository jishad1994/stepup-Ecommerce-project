const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary.config");

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "stepup-products",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
    },
});

const upload = multer({
    storage,
});

module.exports = upload;
