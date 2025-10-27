import { Request } from 'express';

/**
 * Extracts the client's IP address from the request headers
 * Handles various proxy scenarios including X-Forwarded-For headers
 * @param req Express request object
 * @returns The client's IP address
 */
export const getClientIpAddress = (req: Request): string => {
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one (original client)
    return forwardedFor.split(',')[0].trim();
  }
  
  // Fallback to other IP sources
  return req.ip || req.socket.remoteAddress || 'Unknown';
};

/**
 * Extracts device information from the request headers
 * @param req Express request object
 * @returns Device information string
 */
export const getDeviceInfo = (req: Request): string => {
  return req.headers['user-agent'] || 'Unknown Device';
};

/**
 * Parses a full name into firstName and lastName components
 * @param name Full name string
 * @returns Object containing firstName and lastName
 */
export const parseFullName = (name: string): { firstName: string; lastName: string } => {
  const nameParts = name.trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  return { firstName, lastName };
};
