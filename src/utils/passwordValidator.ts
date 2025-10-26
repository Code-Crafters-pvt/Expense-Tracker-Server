export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[];
  }
  
  export const validatePasswordComplexity = (
    password: string
  ): PasswordValidationResult => {
    const errors: string[] = [];
  
    // Minimum length (8 characters)
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
  
    // Maximum length (to prevent DoS attacks with huge passwords)
    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }
  
    // Check for extremely common weak passwords only
    const commonPasswords = [
      'password', 'password123', '12345678', 'qwerty123',
      'abc123456', 'password1', '123456789', 'qwerty12345'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('This password is too common. Please choose a stronger password');
    }
  
    return {
      isValid: errors.length === 0,
      errors,
    };
  };