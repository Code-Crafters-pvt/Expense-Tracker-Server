import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import authConfig from '../config/authConfig';
import { TokenPayload } from '../utils/jwt';

const { jwtSecret } = authConfig;

export interface AuthRequest extends Request {
  user?: IUser;
}

export interface OfflineAuthRequest extends Request {
  offlineUser?: IUser;
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

    // Check token version (for logout-everywhere functionality)
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
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

// Offline user authentication middleware
export const authenticateOffline = async (
  req: OfflineAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offlineId = req.headers['x-offline-id'] as string;

    console.log('🔐 Offline Auth Debug:', {
      url: req.url,
      method: req.method,
      hasOfflineId: !!offlineId,
      offlineId: offlineId ? `${offlineId.substring(0, 20)}...` : 'null',
    });

    if (!offlineId) {
      console.log('❌ No offline ID provided');
      res.status(401).json({
        success: false,
        error: 'Access denied. No offline ID provided.',
      });
      return;
    }

    // Find offline user
    const offlineUser = await User.findOne({ 
      offlineId,
      isOfflineUser: true,
      isActive: true
    });

    if (!offlineUser) {
      console.log('❌ Offline user not found');
      res.status(401).json({
        success: false,
        error: 'Invalid offline ID. User not found.',
      });
      return;
    }

    console.log('✅ Offline user authenticated:', {
      userId: offlineUser._id,
      offlineId: offlineUser.offlineId,
      firstName: offlineUser.firstName,
      lastName: offlineUser.lastName,
    });
    
    req.offlineUser = offlineUser;
    next();
  } catch (error) {
    console.log('❌ Offline auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during offline authentication.',
    });
  }
};

// Hybrid authentication middleware (supports both online and offline)
export const authenticateHybrid = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const offlineId = req.headers['x-offline-id'] as string;

    console.log('🔐 Hybrid Auth Debug:', {
      url: req.url,
      method: req.method,
      hasAuthHeader: !!authHeader,
      hasOfflineId: !!offlineId,
    });

    // Try JWT authentication first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, jwtSecret) as TokenPayload;

      const user = await User.findById(decoded.userId).select('-password');
      if (user && user.isActive && 
          (decoded.tokenVersion !== undefined && decoded.tokenVersion === user.tokenVersion)) {
        console.log('✅ Online user authenticated:', { userId: user._id, email: user.email });
        req.user = user;
        return next();
      }
    }

    // Try offline authentication
    if (offlineId) {
      const offlineUser = await User.findOne({ 
        offlineId,
        isOfflineUser: true,
        isActive: true
      });

      if (offlineUser) {
        console.log('✅ Offline user authenticated:', { 
          userId: offlineUser._id, 
          offlineId: offlineUser.offlineId 
        });
        req.user = offlineUser;
        return next();
      }
    }

    // Neither authentication method worked
    console.log('❌ No valid authentication found');
    res.status(401).json({
      success: false,
      error: 'Access denied. No valid authentication provided.',
    });
  } catch (error) {
    console.log('❌ Hybrid auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during authentication.',
    });
  }
};
