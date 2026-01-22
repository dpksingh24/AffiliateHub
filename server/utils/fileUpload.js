/**
 * File Upload Utility
 * Handles file uploads with multer and image compression with sharp
 */

const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'submissions');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage (memory storage for processing with sharp)
const storage = multer.memoryStorage();

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 10 // Max 10 files per request
  }
});

// Image compression settings
const compressionSettings = {
  jpeg: { quality: 80 },
  png: { compressionLevel: 8, quality: 80 },
  webp: { quality: 80 },
  gif: { } // GIF doesn't have quality settings in sharp
};

/**
 * Compress and save an image file
 * @param {Buffer} buffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} mimeType - File MIME type
 * @param {string} formId - Form ID for organizing uploads
 * @returns {Promise<Object>} - Saved file info
 */
const processAndSaveImage = async (buffer, originalName, mimeType, formId) => {
  console.log('=== PROCESSING FILE ===');
  console.log('Original name:', originalName);
  console.log('MIME type:', mimeType);
  console.log('Buffer size:', buffer.length);
  console.log('Form ID:', formId);
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, '_');
  
  // Create form-specific directory
  const formUploadDir = path.join(uploadDir, formId);
  if (!fs.existsSync(formUploadDir)) {
    fs.mkdirSync(formUploadDir, { recursive: true });
  }

  const filename = `${baseName}_${timestamp}_${randomStr}${ext}`;
  const filepath = path.join(formUploadDir, filename);

  // Check if it's an image that can be compressed
  const isCompressibleImage = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType);

  if (isCompressibleImage) {
    try {
      let sharpInstance = sharp(buffer);
      
      // Get image metadata to determine format
      const metadata = await sharpInstance.metadata();
      
      // Resize if image is too large (max 2000px on longest side)
      if (metadata.width > 2000 || metadata.height > 2000) {
        sharpInstance = sharpInstance.resize(2000, 2000, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Apply compression based on format
      switch (metadata.format) {
        case 'jpeg':
        case 'jpg':
          await sharpInstance
            .jpeg(compressionSettings.jpeg)
            .toFile(filepath);
          break;
        case 'png':
          await sharpInstance
            .png(compressionSettings.png)
            .toFile(filepath);
          break;
        case 'webp':
          await sharpInstance
            .webp(compressionSettings.webp)
            .toFile(filepath);
          break;
        case 'gif':
          // For GIF, just save without modification to preserve animation
          await sharpInstance.toFile(filepath);
          break;
        default:
          // Convert unknown formats to JPEG
          await sharpInstance
            .jpeg(compressionSettings.jpeg)
            .toFile(filepath.replace(ext, '.jpg'));
          break;
      }

      // Get final file size
      const stats = fs.statSync(filepath);
      
      console.log('File saved successfully:', filepath);
      console.log('Original size:', buffer.length, '-> Compressed size:', stats.size);
      
      return {
        filename,
        originalName,
        path: `/uploads/submissions/${formId}/${filename}`,
        fullPath: filepath,
        mimeType,
        size: stats.size,
        compressed: true,
        originalSize: buffer.length
      };
    } catch (error) {
      console.error('Error compressing image:', error);
      // If compression fails, save original
      fs.writeFileSync(filepath, buffer);
      return {
        filename,
        originalName,
        path: `/uploads/submissions/${formId}/${filename}`,
        fullPath: filepath,
        mimeType,
        size: buffer.length,
        compressed: false
      };
    }
  } else {
    // For non-image files (PDF, DOC), just save directly
    fs.writeFileSync(filepath, buffer);
    return {
      filename,
      originalName,
      path: `/uploads/submissions/${formId}/${filename}`,
      fullPath: filepath,
      mimeType,
      size: buffer.length,
      compressed: false
    };
  }
};

/**
 * Process multiple uploaded files
 * @param {Array} files - Array of multer file objects
 * @param {string} formId - Form ID
 * @returns {Promise<Object>} - Object with field names as keys and file info as values
 */
const processUploadedFiles = async (files, formId) => {
  const processedFiles = {};

  if (!files || files.length === 0) {
    return processedFiles;
  }

  for (const file of files) {
    const fileInfo = await processAndSaveImage(
      file.buffer,
      file.originalname,
      file.mimetype,
      formId
    );
    
    // Use fieldname as key (this will be the form field label/id)
    if (!processedFiles[file.fieldname]) {
      processedFiles[file.fieldname] = fileInfo;
    } else if (Array.isArray(processedFiles[file.fieldname])) {
      processedFiles[file.fieldname].push(fileInfo);
    } else {
      processedFiles[file.fieldname] = [processedFiles[file.fieldname], fileInfo];
    }
  }

  return processedFiles;
};

/**
 * Delete uploaded files for a submission
 * @param {Array} filePaths - Array of file paths to delete
 */
const deleteUploadedFiles = (filePaths) => {
  for (const filePath of filePaths) {
    try {
      const fullPath = path.join(__dirname, '..', filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (error) {
      console.error('Error deleting file:', filePath, error);
    }
  }
};

module.exports = {
  upload,
  processAndSaveImage,
  processUploadedFiles,
  deleteUploadedFiles,
  uploadDir
};
