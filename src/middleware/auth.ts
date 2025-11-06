import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import authConfig from '../config/authConfig';
import { TokenPayload } from '../utils/jwt';
import { isTokenVersionValid } from '../utils/authChecks';

const { jwtSecret } = authConfig;

export interface AuthRequest extends Request {
  user?: IUser;
}

// Standard JWT authentication middleware
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    console.log('🔐 Backend Auth Debug:', {
      url: req.url,
      method: req.method,
      hasAuthHeader: !!authHeader,
      authHeader: authHeader ? `${authHeader.substring(0, 20)}...` : 'null',
      allHeaders: Object.keys(req.headers),
    });

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No valid authorization header found');
      res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      console.log('❌ User not found for token');
      res.status(401).json({
        success: false,
        error: 'Invalid token. User not found.',
      });
      return;
    }

    // Check if account is active
    if (!user.isActive) {
      console.log('❌ Account is deactivated');
      res.status(403).json({
        success: false,
        error: 'Account has been deactivated. Please contact support.',
      });
      return;
    }

    // Check token version (required and must match)
    if (!isTokenVersionValid(decoded, user)) {
      console.log('❌ Token version mismatch');
      res.status(401).json({
        success: false,
        error: 'Token has been invalidated. Please log in again.',
      });
      return;
    }

    console.log('✅ User authenticated:', {
      userId: user._id,
      email: user.email,
    });
    req.user = user;
    next();
  } catch (error) {
    console.log('❌ Auth middleware error:', error);

    if (error instanceof jwt.JsonWebTokenError) {
      console.log('❌ JWT Error:', error.message);
      res.status(401).json({
        success: false,
        error: 'Invalid token.',
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      console.log('❌ Token Expired:', error.message);
      res.status(401).json({
        success: false,
        error: 'Token expired.',
      });
    } else {
      console.log('❌ Server Error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error during authentication.',
      });
    }
  }
};
