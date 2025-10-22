import encryptionService from '../services/encryptionService.js';
import logger from './logger.js';

/**
 * Mongoose Plugin for Field-Level Encryption
 *
 * Usage:
 * userSchema.plugin(encryptionPlugin, {
 *   fields: ['ssn', 'creditCard'],
 *   searchableFields: ['email'] // Creates hash for searching
 * });
 */

export const encryptionPlugin = (schema, options = {}) => {
  const { fields = [], searchableFields = [] } = options;

  if (fields.length === 0 && searchableFields.length === 0) {
    return; // Nothing to encrypt
  }

  // Add hash fields for searchable encrypted fields
  searchableFields.forEach((field) => {
    const hashField = `${field}Hash`;
    if (!schema.paths[hashField]) {
      schema.add({
        [hashField]: {
          type: String,
          select: false, // Don't include in queries by default
          index: true, // Index for fast searching
        },
      });
    }
  });

  /**
   * Pre-save hook: Encrypt specified fields before saving
   */
  schema.pre('save', function (next) {
    try {
      // Encrypt regular fields
      fields.forEach((field) => {
        if (this.isModified(field) && this[field]) {
          this[field] = encryptionService.encrypt(String(this[field]));
        }
      });

      // Encrypt and hash searchable fields
      searchableFields.forEach((field) => {
        if (this.isModified(field) && this[field]) {
          const plaintext = String(this[field]);

          // Encrypt the field
          this[field] = encryptionService.encrypt(plaintext);

          // Create hash for searching
          const hashField = `${field}Hash`;
          this[hashField] = encryptionService.hash(plaintext);
        }
      });

      next();
    } catch (error) {
      logger.error('Encryption plugin error (pre-save):', error);
      next(error);
    }
  });

  /**
   * Post-find hooks: Decrypt fields after retrieval
   */
  const decryptFields = function (doc) {
    if (!doc) return;

    try {
      [...fields, ...searchableFields].forEach((field) => {
        if (doc[field]) {
          try {
            doc[field] = encryptionService.decrypt(doc[field]);
          } catch (error) {
            logger.error(`Failed to decrypt field '${field}':`, error);
            doc[field] = null;
          }
        }
      });
    } catch (error) {
      logger.error('Decryption error:', error);
    }
  };

  const decryptResults = function (docs) {
    if (Array.isArray(docs)) {
      docs.forEach(decryptFields);
    } else if (docs) {
      decryptFields(docs);
    }
  };

  // Apply decryption to various query hooks
  schema.post('find', decryptResults);
  schema.post('findOne', decryptFields);
  schema.post('findOneAndUpdate', decryptFields);
  schema.post('save', decryptFields);
  schema.post('init', decryptFields);

  /**
   * Static method: Find by encrypted field (using hash)
   */
  schema.statics.findByEncryptedField = function (field, value) {
    if (!searchableFields.includes(field)) {
      throw new Error(`Field '${field}' is not configured as searchable`);
    }

    const hashField = `${field}Hash`;
    const hash = encryptionService.hash(String(value));

    return this.findOne({ [hashField]: hash });
  };

  /**
   * Instance method: Decrypt all encrypted fields
   */
  schema.methods.decryptFields = function () {
    const doc = this.toObject();
    [...fields, ...searchableFields].forEach((field) => {
      if (doc[field]) {
        try {
          doc[field] = encryptionService.decrypt(doc[field]);
        } catch (error) {
          logger.error(`Failed to decrypt field '${field}':`, error);
          doc[field] = null;
        }
      }
    });
    return doc;
  };

  /**
   * Instance method: Get masked version of encrypted fields
   */
  schema.methods.getMaskedFields = function () {
    const doc = this.toObject();
    [...fields, ...searchableFields].forEach((field) => {
      if (doc[field]) {
        try {
          const decrypted = encryptionService.decrypt(doc[field]);
          doc[field] = encryptionService.mask(decrypted);
        } catch (error) {
          doc[field] = '****';
        }
      }
    });
    return doc;
  };

  logger.info(`Encryption plugin applied to schema with fields: ${[...fields, ...searchableFields].join(', ')}`);
};

/**
 * Create a model with encrypted fields
 *
 * @param {string} modelName - Name of the model
 * @param {Schema} schema - Mongoose schema
 * @param {Object} encryptionOptions - Encryption options
 * @returns {Model} - Mongoose model with encryption
 */
export const createEncryptedModel = (modelName, schema, encryptionOptions) => {
  schema.plugin(encryptionPlugin, encryptionOptions);
  return mongoose.model(modelName, schema);
};

/**
 * Middleware to automatically decrypt response data
 */
export const decryptResponseMiddleware = (encryptedFields = []) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      if (data && typeof data === 'object') {
        // Decrypt fields in response
        if (data.data && typeof data.data === 'object') {
          if (Array.isArray(data.data)) {
            data.data = data.data.map((item) =>
              encryptionService.decryptObject(item, encryptedFields)
            );
          } else {
            data.data = encryptionService.decryptObject(data.data, encryptedFields);
          }
        }
      }

      return originalJson(data);
    };

    next();
  };
};

export default {
  encryptionPlugin,
  createEncryptedModel,
  decryptResponseMiddleware,
};
