import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ecommerce',
    allowedFormats: ['jpeg', 'png', 'jpg', 'webp'],
  },
});

// Only these MIME types may reach Cloudinary. Checked against the actual
// browser-declared Content-Type of the file part, before any upload starts.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  // Rejecting via a normal Error (not throwing) lets Express's error handler
  // return a clean 4xx JSON response instead of a raw multer stack trace.
  const error = new Error(`Unsupported file type "${file.mimetype}". Only JPEG, PNG, and WEBP images are allowed.`);
  error.status = 400;
  return cb(error);
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5,          // 5 MB limit for file uploads
    fieldSize: 1024 * 1024 * 20,        // 20 MB limit for text fields (fixes Quill content size issue)
    fieldNameSize: 200                  // Optional: Max size for field name strings
  }
});

export const deleteFromCloudinary = async (imageUrl) => {
  try {
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.includes('cloudinary.com')) return;
    
    const parts = imageUrl.split('/upload/');
    if (parts.length === 2) {
      let pathWithoutVersion = parts[1].replace(/^v\d+\//, ''); 
      const publicId = pathWithoutVersion.split('.')[0]; 
      
      await cloudinary.uploader.destroy(publicId);
      console.log(`Deleted image from Cloudinary: ${publicId}`);
    }
  } catch (err) {
    console.error("Cloudinary Deletion Error:", err);
  }
};

export default upload;