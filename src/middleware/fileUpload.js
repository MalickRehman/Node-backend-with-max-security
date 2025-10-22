import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { fileURLToPath } from 'url';
import { fileTypeFromBuffer } from 'file-type';
import config from '../config/environment.js';
import logger, { logSecurityEvent } from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';
import malwareScanService from '../services/malwareScanService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * File Upload Security Middleware
 * Secure file upload handling with validation
 */

// Allowed MIME types
const ALLOWED_MIME_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  all: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
};

// Allowed file extensions
const ALLOWED_EXTENSIONS = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  documents: ['.pdf', '.doc', '.docx'],
  all: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'],
};

/**
 * Configure multer storage
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = config.upload?.path || './uploads';

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `${Date.now()}-${uniqueSuffix}${extension}`;
    cb(null, filename);
  },
});

/**
 * File filter function
 */
const createFileFilter = (allowedTypes = 'all') => {
  return (req, file, cb) => {
    const allowedMimeTypes = ALLOWED_MIME_TYPES[allowedTypes] || ALLOWED_MIME_TYPES.all;
    const allowedExts = ALLOWED_EXTENSIONS[allowedTypes] || ALLOWED_EXTENSIONS.all;

    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      logSecurityEvent('FILE_UPLOAD_REJECTED', {
        reason: 'Invalid MIME type',
        mimetype: file.mimetype,
        originalname: file.originalname,
        userId: req.userId,
        ip: req.ip,
      });

      return cb(
        ApiError.badRequest(`File type not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`),
        false
      );
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(ext)) {
      logSecurityEvent('FILE_UPLOAD_REJECTED', {
        reason: 'Invalid extension',
        extension: ext,
        originalname: file.originalname,
        userId: req.userId,
        ip: req.ip,
      });

      return cb(
        ApiError.badRequest(
          `File extension not allowed. Allowed extensions: ${allowedExts.join(', ')}`
        ),
        false
      );
    }

    // Check filename for malicious patterns
    const maliciousPatterns = [
      /\.\./, // Directory traversal
      /[<>:"|?*]/, // Invalid filename characters
      /\.exe$|\.bat$|\.cmd$|\.sh$/i, // Executable files
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(file.originalname)) {
        logSecurityEvent('FILE_UPLOAD_REJECTED', {
          reason: 'Malicious filename pattern',
          originalname: file.originalname,
          userId: req.userId,
          ip: req.ip,
        });

        return cb(ApiError.badRequest('Invalid filename'), false);
      }
    }

    cb(null, true);
  };
};

/**
 * Create upload middleware
 */
export const createUploadMiddleware = (options = {}) => {
  const {
    fileType = 'all',
    maxSize = config.upload?.maxFileSize || 5 * 1024 * 1024, // 5MB default
    maxFiles = 1,
  } = options;

  return multer({
    storage,
    fileFilter: createFileFilter(fileType),
    limits: {
      fileSize: maxSize,
      files: maxFiles,
    },
  });
};

/**
 * Single file upload
 */
export const uploadSingle = (fieldName = 'file', fileType = 'all') => {
  const upload = createUploadMiddleware({ fileType });
  return upload.single(fieldName);
};

/**
 * Multiple files upload
 */
export const uploadMultiple = (fieldName = 'files', maxFiles = 10, fileType = 'all') => {
  const upload = createUploadMiddleware({ fileType, maxFiles });
  return upload.array(fieldName, maxFiles);
};

/**
 * Image upload only
 */
export const uploadImage = (fieldName = 'image') => {
  return uploadSingle(fieldName, 'images');
};

/**
 * Document upload only
 */
export const uploadDocument = (fieldName = 'document') => {
  return uploadSingle(fieldName, 'documents');
};

/**
 * Handle multer errors
 */
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      logger.warn('File size limit exceeded:', {
        userId: req.userId,
        ip: req.ip,
        file: req.file?.originalname,
      });
      return res.error(400, 'File size exceeds limit');
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      logger.warn('File count limit exceeded:', {
        userId: req.userId,
        ip: req.ip,
      });
      return res.error(400, 'Too many files');
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      logger.warn('Unexpected field in upload:', {
        userId: req.userId,
        ip: req.ip,
        field: err.field,
      });
      return res.error(400, 'Unexpected field in upload');
    }

    return res.error(400, `Upload error: ${err.message}`);
  }

  // Pass other errors to error handler
  next(err);
};

/**
 * File validation middleware (use after upload)
 */
export const validateUploadedFile = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }

  const files = req.files || [req.file];

  for (const file of files) {
    // Log successful upload
    logger.info('File uploaded:', {
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      userId: req.userId,
    });
  }

  next();
};

/**
 * Malware scanning middleware (use after upload)
 */
export const scanForMalware = async (req, res, next) => {
  try {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files || [req.file];
    logger.info(`🔍 Scanning ${files.length} file(s) for malware...`);

    for (const file of files) {
      if (!file || !file.path) {
        continue;
      }

      // Scan file for malware
      const scanResult = await malwareScanService.scanFile(file.path);

      // Store scan result in request
      if (!req.scanResults) {
        req.scanResults = [];
      }
      req.scanResults.push(scanResult);

      // If infected or unsafe
      if (!scanResult.safe || scanResult.infected) {
        // Quarantine infected file
        if (scanResult.infected) {
          await malwareScanService.quarantineFile(file.path);

          logSecurityEvent('MALWARE_DETECTED', {
            userId: req.userId,
            ip: req.ip,
            filename: file.originalname,
            viruses: scanResult.viruses,
            scanner: scanResult.scanner,
            action: 'quarantined',
          });

          logger.error(
            `🦠 MALWARE DETECTED: ${file.originalname} - ${scanResult.viruses.join(', ')}`
          );

          return res.error(400, `Malware detected: ${scanResult.viruses.join(', ')}`);
        }

        // Delete unsafe file
        deleteFile(file.path);

        logSecurityEvent('FILE_REJECTED_UNSAFE', {
          userId: req.userId,
          ip: req.ip,
          filename: file.originalname,
          warnings: scanResult.warnings,
          scanner: scanResult.scanner,
        });

        logger.warn(`⚠️  File rejected (unsafe): ${file.originalname}`);

        return res.error(
          400,
          `File rejected: ${scanResult.warnings?.join(', ') || 'Security check failed'}`
        );
      }

      logger.info(`✅ File passed malware scan: ${file.originalname} (${scanResult.scanTime}ms)`);
    }

    // All files passed scan
    logSecurityEvent('FILES_SCANNED', {
      userId: req.userId,
      fileCount: files.length,
      allSafe: true,
    });

    next();
  } catch (error) {
    logger.error('Malware scan error:', error);

    // Clean up files on error
    const files = req.files || [req.file];
    for (const file of files) {
      if (file?.path) {
        deleteFile(file.path);
      }
    }

    return res.error(500, 'File security scan failed');
  }
};

/**
 * Validate file content type (magic bytes validation)
 */
export const validateFileContent = async (req, res, next) => {
  try {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files || [req.file];

    for (const file of files) {
      if (!file || !file.path) {
        continue;
      }

      // Read file buffer
      const buffer = await fsPromises.readFile(file.path);

      // Detect actual file type from content
      const detectedType = await fileTypeFromBuffer(buffer);

      if (!detectedType) {
        logger.warn(`Could not detect file type for: ${file.originalname}`);
        continue;
      }

      // Check if extension matches actual content
      const declaredExt = path.extname(file.originalname).toLowerCase().slice(1);
      const actualExt = detectedType.ext;

      if (declaredExt !== actualExt) {
        logger.warn(
          `Extension mismatch: ${file.originalname} (declared: .${declaredExt}, actual: .${actualExt})`
        );

        logSecurityEvent('FILE_EXTENSION_MISMATCH', {
          userId: req.userId,
          ip: req.ip,
          filename: file.originalname,
          declaredExt,
          actualExt,
          actualMime: detectedType.mime,
        });

        // Delete suspicious file
        deleteFile(file.path);

        return res.error(
          400,
          `File extension mismatch. Declared: .${declaredExt}, Actual: .${actualExt}`
        );
      }

      // Store detected type in file object
      file.detectedType = detectedType;

      logger.info(`File type validated: ${file.originalname} (${detectedType.mime})`);
    }

    next();
  } catch (error) {
    logger.error('File content validation error:', error);

    // Clean up files on error
    const files = req.files || [req.file];
    for (const file of files) {
      if (file?.path) {
        deleteFile(file.path);
      }
    }

    return res.error(500, 'File content validation failed');
  }
};

/**
 * Sanitize filename
 */
export const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/_+/g, '_')
    .toLowerCase();
};

/**
 * Delete uploaded file
 */
export const deleteFile = (filepath) => {
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      logger.info(`File deleted: ${filepath}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error deleting file:', error);
    return false;
  }
};

/**
 * Delete multiple files
 */
export const deleteFiles = (filepaths) => {
  return filepaths.map((filepath) => deleteFile(filepath));
};

export default {
  createUploadMiddleware,
  uploadSingle,
  uploadMultiple,
  uploadImage,
  uploadDocument,
  handleUploadError,
  validateUploadedFile,
  scanForMalware,
  validateFileContent,
  sanitizeFilename,
  deleteFile,
  deleteFiles,
};
