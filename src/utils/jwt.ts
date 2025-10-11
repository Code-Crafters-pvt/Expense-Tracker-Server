import jwt from 'jsonwebtoken';
import type { JwtPayload, SignOptions } from 'jsonwebtoken';
import authConfig from '../config/authConfig';

const {
  accessTokenTtl,
  refreshTokenTtl,
  jwtSecret,
  jwtRefreshSecret,
} = authConfig;

export interface TokenPayload {
  userId: string;
  email: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = { expiresIn: accessTokenTtl };
  return jwt.sign(payload as JwtPayload, jwtSecret, options);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const options: SignOptions = { expiresIn: refreshTokenTtl };
  return jwt.sign(payload as JwtPayload, jwtRefreshSecret, options);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, jwtSecret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, jwtRefreshSecret) as TokenPayload;
};
