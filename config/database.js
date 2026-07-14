import mongoose from 'mongoose';
import dns from 'dns';

/**
 * Connects to the MongoDB database using Mongoose.
 * Implements retry logic, graceful shutdown, and custom DNS resolution.
 */
export const connectDB = async (retries = 5) => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('Error: MONGODB_URI is not defined in the .env file');
      process.exit(1);
    }

    // Workaround for `querySrv ECONNREFUSED` on Windows/VPNs.
    // Forces Node.js to use Google's Public DNS instead of the local faulty ISP/Router DNS
    // which might be actively blocking SRV record lookups.
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    
    // serverSelectionTimeoutMS: Fails fast if DNS/Network is down (5 seconds)
    // family: 4: Enforces IPv4 for standard A record resolution
    const options = {
      serverSelectionTimeoutMS: 5000, 
      family: 4 
    };

    console.log('Connecting to MongoDB Atlas...');
    const conn = await mongoose.connect(process.env.MONGODB_URI.trim(), options);
    console.log(`MongoDB Atlas Connected: ${conn.connection.host}`);
    
    // Listen for connection errors after initial connection
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    if (retries === 0) {
      console.error('Failed to connect to MongoDB after maximum retries. Exiting...');
      process.exit(1);
    }
    console.log(`Retrying connection... (${retries} retries left)`);
    // Wait for 5 seconds before retrying
    await new Promise(resolve => setTimeout(resolve, 5000));
    return connectDB(retries - 1);
  }
};

/**
 * Handle graceful shutdown of the database connection
 */
export const closeDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed gracefully');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
    process.exit(1);
  }
};

// Listen for termination signals to close DB gracefully
process.on('SIGINT', closeDB);
process.on('SIGTERM', closeDB);
