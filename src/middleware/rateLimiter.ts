import rateLimit from 'express-rate-limit';

// Rate limiter for password reset requests (5 per hour per email)
// NOTE: Requires express.json() middleware to be applied globally BEFORE routes
// to ensure req.body.email is available when this rate limiter runs
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

// Rate limiter for password reset code entry attempts
// Uses submitted code (or legacy token) with IP to slow down brute-force guesses
export const passwordResetCodeAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 failed attempts per 15 minutes
  message: {
    success: false,
    error: 'Too many reset code attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    return req.ip || 'unknown';
  },
});

// Rate limiter for email verification code entry attempts
export const emailVerificationCodeAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 failed attempts per 15 minutes
  message: {
    success: false,
    error: 'Too many verification code attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    return (req as any).user?._id?.toString() || req.ip || 'unknown';
  },
});

// Rate limiter for password change (5 attempts per hour per user)
export const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour (increased from 3 for better UX)
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

// Short-term rate limiter for failed login attempts (3 per 1 minute)
// This provides quick cooldown after rapid failed attempts
export const loginFailureLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3, // 3 attempts per minute
  message: {
    success: false,
    error: 'Too many failed login attempts. Please wait 1 minute before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  keyGenerator: (req) => {
    // Use email + IP combination for better accuracy
    return `${req.body.email || 'unknown'}_${req.ip || 'unknown'}`;
  },
});

// Rate limiter for account reactivation attempts (5 per 15 minutes per IP)
// Similar to login since it requires password verification
export const accountReactivateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: {
    success: false,
    error: 'Too many reactivation attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  keyGenerator: (req) => {
    // Use email + IP combination for better accuracy
    return `${req.body.email || 'unknown'}_${req.ip || 'unknown'}`;
  },
});

// Short-term rate limiter for failed reactivation attempts (3 per 1 minute)
// This provides quick cooldown after rapid failed attempts
export const accountReactivateFailureLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3, // 3 attempts per minute
  message: {
    success: false,
    error: 'Too many failed reactivation attempts. Please wait 1 minute before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  keyGenerator: (req) => {
    // Use email + IP combination for better accuracy
    return `${req.body.email || 'unknown'}_${req.ip || 'unknown'}`;
  },
});

// Rate limiter for sync requests (60 per minute per user)
// Allows frequent syncing but prevents abuse
export const syncLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (1 per second average)
  message: {
    success: false,
    error: 'Sync rate limit exceeded. Please wait a moment before syncing again.',
    code: 'SYNC_RATE_LIMITED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req as any).user?._id?.toString() || req.ip || 'unknown';
  },
});