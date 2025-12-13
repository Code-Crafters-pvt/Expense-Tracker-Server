import { getBaseEmailTemplate } from '../../core/templates.helper';

export const emailVerificationTemplate = (name: string, verificationLink: string) => {
  const content = `
    <p>Hi ${name},</p>
    <p>Welcome to Expense Tracker! Please verify your email address to complete your registration.</p>
    <p>Click the button below to verify your email:</p>
    <p style="color: #6b7280; font-size: 14px;">This link will expire in 24 hours.</p>
  `;

  const text = `
    Hi ${name},
    
    Welcome to Expense Tracker! Please verify your email address to complete your registration.
    
    Click this link to verify: ${verificationLink}
    
    This link will expire in 24 hours.
    
    If you didn't create an account, please ignore this email.
  `;

  return {
    html: getBaseEmailTemplate('Verify Your Email', content, 'Verify Email Address', verificationLink),
    text,
  };
};

export const welcomeEmailTemplate = (name: string) => {
  const content = `
    <p>Hi ${name},</p>
    <p>Your email has been verified successfully! Welcome to Expense Tracker.</p>
    <p><strong>Getting Started:</strong></p>
    <ul>
      <li>📊 Track your daily expenses</li>
      <li>📈 Set budgets for different categories</li>
      <li>💰 Monitor your spending habits</li>
      <li>📱 Access from mobile and web</li>
    </ul>
    <p>If you need any help, feel free to reach out to our support team.</p>
  `;

  const text = `
    Hi ${name},
    
    Your email has been verified successfully! Welcome to Expense Tracker.
    
    Getting Started:
    - Track your daily expenses
    - Set budgets for different categories
    - Monitor your spending habits
    - Access from mobile and web
    
    If you need any help, feel free to reach out to our support team.
  `;

  return {
    html: getBaseEmailTemplate('Welcome to Expense Tracker!', content),
    text,
  };
};

export const passwordResetTemplate = (resetUrl: string) => {
  const content = `
    <p>You requested to reset your password for your Expense Tracker account.</p>
    <p>Click the button below to reset your password:</p>
    <p style="color: #6b7280; font-size: 14px;"><strong>This link will expire in 1 hour.</strong></p>
    <p style="color: #6b7280; font-size: 14px;">If you didn't request this, please ignore this email and your password will remain unchanged.</p>
  `;

  const text = `
    Password Reset Request
    
    You requested to reset your password. Use this link to reset it:
    ${resetUrl}
    
    This link will expire in 1 hour.
    
    If you didn't request this, please ignore this email.
  `;

  return {
    html: getBaseEmailTemplate('Password Reset Request', content, 'Reset Password', resetUrl),
    text,
  };
};

export const passwordChangedTemplate = (email: string, name: string) => {
  const content = `
    <p>Hi ${name},</p>
    <p>This email confirms that your password was successfully changed.</p>
    <div class="alert-box">
      <strong>⚠️ If you didn't make this change:</strong><br>
      Please contact our support team immediately, as your account may have been compromised.
    </div>
    <p><strong>Change Details:</strong></p>
    <ul>
      <li>Time: ${new Date().toLocaleString()}</li>
      <li>Account: ${email}</li>
    </ul>
    <p>For your security, you may need to log in again on other devices.</p>
  `;

  const text = `
    Password Changed Successfully
    
    Hi ${name},
    
    This email confirms that your password was successfully changed.
    
    ⚠️ If you didn't make this change, please contact support immediately.
    
    Change Details:
    - Time: ${new Date().toLocaleString()}
    - Account: ${email}
    
    For your security, you may need to log in again on other devices.
  `;

  return {
    html: getBaseEmailTemplate('Password Changed Successfully', content),
    text,
  };
};

export const emailChangedTemplate = (newEmail: string, name: string) => {
  const content = `
    <p>Hi ${name},</p>
    <p>Your email address has been successfully changed to: <strong>${newEmail}</strong></p>
    <div class="alert-box">
      <strong>⚠️ If you didn't make this change:</strong><br>
      Please contact our support team immediately.
    </div>
    <p><strong>Change Details:</strong></p>
    <ul>
      <li>Time: ${new Date().toLocaleString()}</li>
      <li>New Email: ${newEmail}</li>
    </ul>
  `;

  const text = `
    Email Address Changed
    
    Hi ${name},
    
    Your email address has been successfully changed to: ${newEmail}
    
    ⚠️ If you didn't make this change, please contact support immediately.
    
    Change Details:
    - Time: ${new Date().toLocaleString()}
    - New Email: ${newEmail}
  `;

  return {
    html: getBaseEmailTemplate('Email Address Changed', content),
    text,
  };
};

export const accountDeletionTemplate = (name: string) => {
  const content = `
    <p>Hi ${name},</p>
    <p>Your account deletion request has been confirmed.</p>
    <p><strong>What happens next:</strong></p>
    <ul>
      <li>Your account will be permanently deleted in 30 days</li>
      <li>All your data will be removed from our servers</li>
      <li>You can cancel this request within 30 days by contacting support</li>
    </ul>
    <p>We're sorry to see you go. If you'd like to provide feedback on why you're leaving, we'd appreciate it.</p>
  `;

  const text = `
    Account Deletion Confirmed
    
    Hi ${name},
    
    Your account deletion request has been confirmed.
    
    What happens next:
    - Your account will be permanently deleted in 30 days
    - All your data will be removed from our servers
    - You can cancel this request within 30 days by contacting support
    
    We're sorry to see you go. If you'd like to provide feedback, we'd appreciate it.
  `;

  return {
    html: getBaseEmailTemplate('Account Deletion Confirmed', content),
    text,
  };
};

export const twoFactorCodeTemplate = (name: string, code: string) => {
  const content = `
    <p>Hi ${name},</p>
    <p>Your two-factor authentication code is:</p>
    <div style="text-align: center; margin: 30px 0;">
      <h2 style="font-size: 32px; color: #8B5CF6; letter-spacing: 8px; margin: 0;">${code}</h2>
    </div>
    <p>This code will expire in 10 minutes.</p>
    <p><strong>If you didn't request this code, please secure your account immediately.</strong></p>
  `;

  const text = `
    Hi ${name},
    
    Your two-factor authentication code is: ${code}
    
    This code will expire in 10 minutes.
    
    If you didn't request this code, please secure your account immediately.
  `;

  return {
    html: getBaseEmailTemplate('Two-Factor Authentication Code', content),
    text,
  };
};

