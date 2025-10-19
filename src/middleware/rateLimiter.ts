import rateLimit from 'express-rate-limit';

// Rate limiter for password reset requests (5 per hour per IP)
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: {
    success: false,
    error: 'Too many password reset requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use email as key instead of IP (more accurate)
  keyGenerator: (req) => {
    return req.body.email || req.ip || 'unknown';
  },
});

// Rate limiter for password change (3 attempts per hour per user)
export const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    success: false,
    error: 'Too many password change attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID from authenticated request
    return (req as any).user?._id?.toString() || req.ip || 'unknown';
  },
});

// Rate limiter for login attempts (5 per 15 minutes per IP)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: {
    success: false,
    error: 'Too many login attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
});