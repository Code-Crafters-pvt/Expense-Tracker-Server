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
 * Returns empty strings if name is invalid - calling code must handle this
 * @param name Full name string
 * @returns Object containing firstName and lastName (may be empty)
 */
export const parseFullName = (name: string | undefined): { firstName: string; lastName: string } => {
  // Handle undefined, null, or empty strings
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { firstName: '', lastName: '' };
  }

  const trimmedName = name.trim();
  const nameParts = trimmedName.split(/\s+/).filter(part => part.length > 0);
  
  // If no valid parts, return empty
  if (nameParts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  
  // If only one part, use it as firstName and empty lastName
  if (nameParts.length === 1) {
    return { 
      firstName: nameParts[0], 
      lastName: '' // Empty lastName for single names
    };
  }
  
  // Multiple parts: first is firstName, rest is lastName
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');
  
  return { firstName, lastName };
};

/**
 * Extracts name from email prefix, handling various formats
 * Handles: john.doe, mary_jane_watson, samarasinghe2024
 * Removes numbers, capitalizes words properly
 * @param email Email address
 * @returns Object containing firstName and lastName (may have empty lastName)
 */
export const extractNameFromEmail = (email: string): { firstName: string; lastName: string } => {
  if (!email || typeof email !== 'string') {
    return { firstName: '', lastName: '' };
  }

  const prefix = email.split('@')[0];
  if (!prefix) {
    return { firstName: '', lastName: '' };
  }

  // Remove numbers and replace common separators with spaces
  const cleaned = prefix
    .replace(/\d+/g, '') // Remove numbers
    .replace(/[._-]/g, ' ') // Replace separators with spaces
    .trim();

  if (!cleaned) {
    return { firstName: '', lastName: '' };
  }

  // Capitalize words and parse
  const words = cleaned
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

  if (words.length === 0) {
    return { firstName: '', lastName: '' };
  }

  if (words.length === 1) {
    return { firstName: words[0], lastName: '' };
  }

  return {
    firstName: words[0],
    lastName: words.slice(1).join(' ')
  };
};

/**
 * Gets a valid user name by intelligently combining OAuth name and email
 * Strategy:
 * 1. Try parsing OAuth name first
 * 2. If missing parts, extract from email
 * 3. Combine intelligently
 * 4. For single names: use same value for firstName/lastName
 * @param oauthName OAuth provider name (may be undefined/empty)
 * @param email User email address
 * @returns Object containing firstName, lastName, and fullName (guaranteed non-empty)
 */
export const getValidUserName = (
  oauthName: string | undefined,
  email: string
): { firstName: string; lastName: string; fullName: string } => {
  let firstName = '';
  let lastName = '';

  // Step 1: Try parsing OAuth name first
  if (oauthName && oauthName.trim()) {
    const parsed = parseFullName(oauthName);
    firstName = parsed.firstName;
    lastName = parsed.lastName;
  }

  // Step 2: If missing parts, extract from email
  if (!firstName || !lastName) {
    const emailBased = extractNameFromEmail(email);
    
    // Combine intelligently: prefer OAuth firstName if available, otherwise use email
    if (!firstName) {
      firstName = emailBased.firstName;
    }
    
    // Use email lastName if OAuth didn't provide one
    if (!lastName) {
      lastName = emailBased.lastName;
    }
  }

  // Step 3: Handle single names - use same value for both
  if (firstName && !lastName) {
    lastName = firstName; // Single name: use same for both
  }

  // Step 4: Final fallback to ensure we never have empty values
  if (!firstName) {
    const emailPrefix = email.split('@')[0] || 'user';
    firstName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1).toLowerCase() || 'User';
  }
  if (!lastName) {
    lastName = firstName; // Use firstName as lastName if still empty
  }

  // Ensure values are trimmed
  firstName = firstName.trim();
  lastName = lastName.trim();

  // Construct full name
  const fullName = `${firstName} ${lastName}`.trim();

  return { firstName, lastName, fullName };
};
