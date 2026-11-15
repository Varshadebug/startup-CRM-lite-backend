import mongoose from 'mongoose';
import dns from 'dns';

let isConnecting = false;
let listenersAttached = false;

/**
 * Configure DNS resolver intelligently.
 * Sets public DNS servers (Google 8.8.8.8, Cloudflare 1.1.1.1) to ensure
 * reliable SRV record resolution across both local and cloud container
 * environments (e.g. Render / Linux / Docker) where default DNS proxies
 * may fail to resolve MongoDB Atlas SRV (_mongodb._tcp) queries.
 */
const configureDNS = () => {
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  } catch (e) {
    console.warn('[Database] Notice: Could not set custom DNS servers, using system default:', e.message);
  }
};

/**
 * Attach Mongoose connection event listeners once.
 */
const attachConnectionListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('connected', () => {
    console.log(`✅ MongoDB connected successfully to host: ${mongoose.connection.host}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error(`❌ MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected. Attempting automatic reconnection...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected successfully.');
  });
};

/**
 * Connects to MongoDB Atlas using Mongoose with resilient retry handling.
 * Does NOT crash the Express process if the database is temporarily unreachable,
 * ensuring Render's port binding and health check remain active.
 *
 * @param {number} retryAttempt - Current retry count
 * @param {number} maxRetries - Maximum retry attempts before switching to background polling
 */
export const connectDB = async (retryAttempt = 1, maxRetries = 5) => {
  if (mongoose.connection.readyState === 1) {
    return; // Already connected
  }

  if (isConnecting && retryAttempt === 1) {
    return; // Already an active connection attempt in progress
  }

  isConnecting = true;
  attachConnectionListeners();
  configureDNS();

  const rawURI = (process.env.MONGODB_URI || process.env.MONGO_URI || '');
  const mongoURI = rawURI.trim().replace(/^["']|["']$/g, '');

  if (!mongoURI) {
    console.error('❌ [FATAL] Neither MONGODB_URI nor MONGO_URI is defined in environment variables.');
    console.error('👉 Please configure MONGODB_URI in your Render Dashboard / .env file.');
    isConnecting = false;
    return;
  }

  const options = {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10
  };

  try {
    console.log(`📡 Connecting to MongoDB Atlas (Attempt ${retryAttempt}/${maxRetries})...`);
    await mongoose.connect(mongoURI, options);
    console.log(`🚀 MongoDB Atlas Connected: ${mongoose.connection.host}`);
    isConnecting = false;
  } catch (error) {
    isConnecting = false;
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);

    // Provide actionable diagnostic logs based on the error code/message
    if (error.message.includes('ENOTFOUND') || error.message.includes('querySrv')) {
      console.error('\n🔍 [DIAGNOSTIC] DNS / SRV Resolution Failure:');
      console.error('   1. Verify your MongoDB Atlas cluster is NOT PAUSED.');
      console.error('      Free tier (M0) clusters pause after inactivity. Log into https://cloud.mongodb.com and click "Resume".');
      console.error('   2. Verify the cluster hostname in your MONGODB_URI matches your current cluster.');
      console.error('   3. In MongoDB Atlas Network Access, ensure 0.0.0.0/0 (Allow Access from Anywhere) is active.');
      console.error('   4. If mongodb+srv:// continues failing on Render, use the Standard Connection String (mongodb://cluster0-shard-00-00...) from Atlas.\n');
    } else if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
      console.error('\n🔍 [DIAGNOSTIC] Authentication Failure:');
      console.error('   Verify the database username and password in MONGODB_URI.');
      console.error('   If the password contains special characters, ensure they are URL-encoded.\n');
    }

    if (retryAttempt >= maxRetries) {
      console.error(`❌ [Database] Reached maximum connection attempts (${maxRetries}). Halting automatic retry loop.`);
      console.error('👉 Please check MongoDB Atlas cluster state and Render MONGODB_URI environment variable.');
      return;
    }

    // Exponential backoff capped at 20 seconds
    const delay = Math.min(4000 * Math.pow(1.5, retryAttempt - 1), 20000);
    const nextAttempt = retryAttempt + 1;

    console.log(`⏳ Retrying MongoDB connection in ${Math.round(delay / 1000)}s (Attempt ${nextAttempt}/${maxRetries})...`);
    
    setTimeout(() => {
      connectDB(nextAttempt, maxRetries);
    }, delay);
  }
};

/**
 * Gracefully close the MongoDB connection.
 */
export const closeDB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed gracefully');
    }
  } catch (err) {
    console.error('Error closing MongoDB connection:', err.message);
  }
};
