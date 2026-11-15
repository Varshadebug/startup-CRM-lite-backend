import 'dotenv/config'; // Loads env variables before anything else
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';

// Import database configuration
import { connectDB } from './config/database.js';

// Import error handler middleware
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import leadRoutes from './routes/leadRoutes.js';

// --- Environment Validation ---
const checkRequiredEnvVars = () => {
  const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoURI) {
    console.error('❌ [FATAL ERROR] Missing required environment variable: MONGODB_URI or MONGO_URI');
    process.exit(1);
  }

  if (!process.env.JWT_SECRET) {
    console.error('❌ [FATAL ERROR] Missing required environment variable: JWT_SECRET');
    process.exit(1);
  }
};

// Run environment validation before proceeding
checkRequiredEnvVars();

// Initialize Express app
const app = express();

// --- Security & Middleware Configuration ---

// helmet() sets various HTTP headers to help secure the Express app
app.use(helmet());

// Request logging improvement (Combined for production, Dev for development)
if (process.env.NODE_ENV?.trim() === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Build allowed origins list with trailing slashes stripped
const parseAllowedOrigins = () => {
  const defaultOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];

  if (process.env.FRONTEND_URL) {
    const customOrigins = process.env.FRONTEND_URL
      .split(',')
      .map(url => url.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    defaultOrigins.push(...customOrigins);
  }

  return defaultOrigins;
};

const allowedOrigins = parseAllowedOrigins();

// CORS configuration supporting dynamic Vercel domains and sanitized origins
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile apps, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    const cleanOrigin = origin.trim().replace(/\/+$/, '');

    // Allow if in explicit list or matching Vercel deployment pattern or non-production
    if (
      allowedOrigins.includes(cleanOrigin) ||
      cleanOrigin.endsWith('.vercel.app') ||
      process.env.NODE_ENV?.trim() !== 'production'
    ) {
      return callback(null, true);
    }

    console.warn(`⚠️ [CORS Warning] Origin "${origin}" rejected by CORS policy.`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// express.json() parses incoming JSON requests. Limit to prevent DoS.
app.use(express.json({ limit: '10kb' }));

// express.urlencoded() parses incoming URL-encoded payloads.
app.use(express.urlencoded({ extended: true }));

// Data Sanitization against NoSQL Query Injection (Express 5 compatible)
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  if (req.query) mongoSanitize.sanitize(req.query);
  next();
});

// --- Rate Limiting ---
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { success: false, message: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Stricter limit for auth routes
  message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});

// Apply rate limiters
app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);

// --- Health Check Endpoint ---
// Available immediately upon server start for Render / uptime monitoring
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  res.status(200).json({
    status: 'OK',
    uptime: Math.floor(process.uptime()),
    database: dbStatusMap[dbState] || 'unknown',
    environment: process.env.NODE_ENV?.trim() || 'development',
    timestamp: new Date().toISOString()
  });
});

// --- Database Readiness Middleware ---
// Protects database-dependent operations from hanging or timing out while DB connects/reconnects
const checkDatabaseReady = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database connection is initializing or temporarily unavailable. Please retry shortly.',
      database: mongoose.connection.readyState === 2 ? 'connecting' : 'disconnected'
    });
  }
  next();
};

// --- Route Registration ---
app.use('/api/auth', checkDatabaseReady, authRoutes);
app.use('/api/leads', checkDatabaseReady, leadRoutes);

// --- Error Handling ---
// Register the global error handler middleware LAST (after all routes)
app.use(errorHandler);

// --- Server Startup & Graceful Shutdown ---
const PORT = process.env.PORT || 5000;
const MODE = process.env.NODE_ENV?.trim() || 'development';

let server;

// Start HTTP server immediately so Render detects port binding
server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${MODE} mode`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
});

// Connect to MongoDB Atlas asynchronously with non-blocking retry
connectDB();

// Graceful shutdown handling
const gracefulShutdown = () => {
  console.log('\n🛑 Server shutting down gracefully...');
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        if (mongoose.connection.readyState !== 0) {
          await mongoose.connection.close();
          console.log('MongoDB connection closed.');
        }
        process.exit(0);
      } catch (err) {
        console.error('Error during MongoDB closure:', err.message);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};

// Handle termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
