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
 * Handles edge cases: empty names, single names, etc.
 * @param name Full name string
 * @returns Object containing firstName and lastName (guaranteed non-empty)
 */
export const parseFullName = (name: string | undefined): { firstName: string; lastName: string } => {
  // Handle undefined, null, or empty strings
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { firstName: 'User', lastName: 'Name' };
  }

  const trimmedName = name.trim();
  const nameParts = trimmedName.split(/\s+/).filter(part => part.length > 0);
  
  // If no valid parts, return defaults
  if (nameParts.length === 0) {
    return { firstName: 'User', lastName: 'Name' };
  }
  
  // If only one part, use it as firstName and set lastName to "Name"
  if (nameParts.length === 1) {
    return { firstName: nameParts[0], lastName: 'Name' };
  }
  
  // Multiple parts: first is firstName, rest is lastName
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');
  
  return { firstName, lastName };
};
