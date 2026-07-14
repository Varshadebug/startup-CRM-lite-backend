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

// --- Environment Validation ---
const checkRequiredEnvVars = () => {
  const requiredVars = ['MONGODB_URI', 'JWT_SECRET', 'PORT'];
  const missingVars = requiredVars.filter((envVar) => !process.env[envVar]);
  
  if (missingVars.length > 0) {
    console.error(`[FATAL ERROR] Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1); // Exits the process if configuration is missing
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
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// cors() enables Cross-Origin Resource Sharing. Configured dynamically for production.
const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173', 'https://your-app.vercel.app'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// express.json() parses incoming JSON requests. Limit to prevent DoS.
app.use(express.json({ limit: '10kb' }));

// express.urlencoded() parses incoming URL-encoded payloads.
app.use(express.urlencoded({ extended: true }));

// Data Sanitization against NoSQL Query Injection
app.use(mongoSanitize());

// --- Rate Limiting ---
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Stricter limit for auth routes
  message: 'Too many auth attempts.'
});

// Apply rate limiters
app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);


// --- Route Registration ---
import authRoutes from './routes/authRoutes.js';
import leadRoutes from './routes/leadRoutes.js';

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date()
  });
});

// --- Error Handling ---
// Register the global error handler middleware LAST (after all routes)
app.use(errorHandler);


// --- Server Startup & Graceful Shutdown ---
const PORT = process.env.PORT || 5000;
const MODE = process.env.NODE_ENV || 'development';

let server;

// Start server after connecting to the database
const startServer = async () => {
  await connectDB();
  
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${MODE} mode`);
  });
};

startServer();

// Graceful shutdown handling
const gracefulShutdown = () => {
  console.log('\nServer shutting down gracefully...');
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
        process.exit(0);
      } catch (err) {
        console.error('Error during MongoDB closure:', err);
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
