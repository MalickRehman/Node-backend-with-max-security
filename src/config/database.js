import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import config from './environment.js';

/**
 * MongoDB Database Configuration
 */

let isConnected = false;

/**
 * Connect to MongoDB
 */
export const connectDB = async () => {
  if (isConnected) {
    logger.info('Using existing MongoDB connection');
    return;
  }

  try {
    const mongoURI = config.database.mongodb.uri ||
      `mongodb://${config.database.mongodb.host}:${config.database.mongodb.port}/${config.database.mongodb.name}`;

    const options = {
      maxPoolSize: config.database.mongodb.poolSize || 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    // Add authentication if credentials provided
    if (config.database.mongodb.user && config.database.mongodb.password) {
      options.auth = {
        username: config.database.mongodb.user,
        password: config.database.mongodb.password,
      };
      options.authSource = 'admin';
    }

    await mongoose.connect(mongoURI, options);

    isConnected = true;

    logger.info('✅ MongoDB connected successfully', {
      host: config.database.mongodb.host,
      port: config.database.mongodb.port,
      database: config.database.mongodb.name,
    });

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      isConnected = true;
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await disconnectDB();
      process.exit(0);
    });

  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    isConnected = false;

    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
    throw error;
  }
};

/**
 * Disconnect from MongoDB
 */
export const disconnectDB = async () => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
    throw error;
  }
};

/**
 * Get connection status
 */
export const getConnectionStatus = () => {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
  };
};

/**
 * Drop database (use with caution!)
 */
export const dropDatabase = async () => {
  if (config.nodeEnv === 'production') {
    throw new Error('Cannot drop database in production');
  }

  try {
    await mongoose.connection.dropDatabase();
    logger.warn('Database dropped');
  } catch (error) {
    logger.error('Error dropping database:', error);
    throw error;
  }
};

export default {
  connectDB,
  disconnectDB,
  getConnectionStatus,
  dropDatabase,
};
