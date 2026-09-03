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
  params: async (req, file) => {
    const isVideo = file.mimetype && file.mimetype.startsWith('video/');
    return {
      folder: isVideo ? 'ecommerce/videos' : 'ecommerce',
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: isVideo ? ['mp4', 'webm', 'mov', 'mkv', 'avi'] : ['jpeg', 'png', 'jpg', 'webp']
    };
  }
});

// Allowed MIME types for images and product videos
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/jpg',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/avi'
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype) || (file.mimetype && (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')))) {
    return cb(null, true);
  }
  const error = new Error(`Unsupported file type "${file.mimetype}". Only images (JPEG, PNG, WEBP) and videos (MP4, WEBM, MOV) are allowed.`);
  error.status = 400;
  return cb(error);
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 100,         // 100 MB limit for video and high-res media files
    fieldSize: 1024 * 1024 * 50,         // 50 MB limit for text fields
    fieldNameSize: 200
  }
});

export const deleteFromCloudinary = async (mediaUrl) => {
  try {
    if (!mediaUrl || typeof mediaUrl !== 'string' || !mediaUrl.includes('cloudinary.com')) return;
    
    const isVideo = mediaUrl.includes('/video/') || mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.webm') || mediaUrl.endsWith('.mov');
    const parts = mediaUrl.split('/upload/');
    if (parts.length === 2) {
      let pathWithoutVersion = parts[1].replace(/^v\d+\//, ''); 
      const publicId = pathWithoutVersion.split('.')[0]; 
      
      await cloudinary.uploader.destroy(publicId, { resource_type: isVideo ? 'video' : 'image' });
      console.log(`Deleted media from Cloudinary: ${publicId}`);
    }
  } catch (err) {
    console.error("Cloudinary Deletion Error:", err);
  }
};

export default upload;