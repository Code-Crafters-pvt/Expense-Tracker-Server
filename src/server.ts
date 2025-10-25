import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import os from 'os';
import cookieParser from 'cookie-parser';

import { connectDB } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

// Routes
import authRoutes from './routes/auth';
import expenseRoutes from './routes/expenses';
import categoryRoutes from './routes/categories';
import analyticsRoutes from './routes/analytics';
import exportRoutes from './routes/export';
import userRoutes from './routes/users';

// Load environment variables
dotenv.config();
const app = express();
app.set('trust proxy', 1);
const PORT = process.env['PORT'] || 3000;

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(
  cors({
    origin: process.env['CORS_ORIGIN']?.split(',') || [
      'http://localhost:3000',
      'http://localhost:19006',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'), // 15 minutes
  max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'), // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging middleware
if (process.env['NODE_ENV'] === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'],
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// Get network interfaces
const getNetworkAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const networkInterface of interfaces[name]!) {
      const { address, family, internal } = networkInterface;
      if (family === 'IPv4' && !internal) {
        return address;
      }
    }
  }
  return 'localhost';
};

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('✅ Connected to MongoDB');

    // Get network address
    const networkAddress = getNetworkAddress();

    // Start Express server
    app.listen(PORT, () => {
      console.log('\n🚀 Server is running!');
      console.log('📱 Environment:', process.env['NODE_ENV']);
      console.log('🔗 Local URL: http://localhost:' + PORT);
      console.log('🌐 Network URL: http://' + networkAddress + ':' + PORT);
      console.log('💚 Health check: http://localhost:' + PORT + '/health');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

startServer();
