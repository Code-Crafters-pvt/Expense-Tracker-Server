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

export const accountReactivationTemplate = (name: string) => {
  const content = `
    <p>Hi ${name},</p>
    <p>Your Expense Tracker account has been successfully reactivated!</p>
    <p>You can now log in and access all your account features.</p>
    <p><strong>What you can do now:</strong></p>
    <ul>
      <li>📊 Access your expense history</li>
      <li>📈 View your analytics and reports</li>
      <li>💰 Continue tracking your expenses</li>
      <li>⚙️ Manage your account settings</li>
    </ul>
    <p>Welcome back! If you have any questions, feel free to contact our support team.</p>
  `;

  const text = `
    Account Reactivated
    
    Hi ${name},
    
    Your Expense Tracker account has been successfully reactivated!
    
    You can now log in and access all your account features.
    
    Welcome back! If you have any questions, feel free to contact our support team.
  `;

  return {
    html: getBaseEmailTemplate('Account Reactivated', content),
    text,
  };
};

export const accountDeactivationTemplate = (name: string) => {
  const content = `
    <p>Hi ${name},</p>
    <p>Your Expense Tracker account has been deactivated.</p>
    <p><strong>What this means:</strong></p>
    <ul>
      <li>You won't be able to log in to your account</li>
      <li>Your data will be preserved and can be restored when you reactivate</li>
      <li>You can reactivate your account anytime by logging in</li>
    </ul>
    <p>If you didn't request this deactivation, please contact our support team immediately.</p>
    <p>We're sorry to see you go. If you'd like to provide feedback, we'd appreciate it.</p>
  `;

  const text = `
    Account Deactivated
    
    Hi ${name},
    
    Your Expense Tracker account has been deactivated.
    
    You won't be able to log in, but your data will be preserved. You can reactivate your account anytime by logging in.
    
    If you didn't request this deactivation, please contact our support team immediately.
  `;

  return {
    html: getBaseEmailTemplate('Account Deactivated', content),
    text,
  };
};

export const suspiciousLoginTemplate = (
  name: string,
  loginDetails: {
    ipAddress?: string;
    deviceInfo?: string;
    location?: string;
    timestamp: string;
  }
) => {
  const content = `
    <p>Hi ${name},</p>
    <p>We detected a new login to your Expense Tracker account.</p>
    <div class="alert-box">
      <strong>⚠️ Security Alert:</strong><br>
      If this wasn't you, please secure your account immediately by changing your password.
    </div>
    <p><strong>Login Details:</strong></p>
    <ul>
      <li>Time: ${loginDetails.timestamp}</li>
      ${loginDetails.deviceInfo ? `<li>Device: ${loginDetails.deviceInfo}</li>` : ''}
      ${loginDetails.ipAddress ? `<li>IP Address: ${loginDetails.ipAddress}</li>` : ''}
      ${loginDetails.location ? `<li>Location: ${loginDetails.location}</li>` : ''}
    </ul>
    <p>If this was you, you can safely ignore this email.</p>
    <p>If you don't recognize this activity, please change your password immediately and review your account security settings.</p>
  `;

  const text = `
    Suspicious Login Alert
    
    Hi ${name},
    
    We detected a new login to your Expense Tracker account.
    
    ⚠️ If this wasn't you, please secure your account immediately.
    
    Login Details:
    - Time: ${loginDetails.timestamp}
    ${loginDetails.deviceInfo ? `- Device: ${loginDetails.deviceInfo}` : ''}
    ${loginDetails.ipAddress ? `- IP Address: ${loginDetails.ipAddress}` : ''}
    ${loginDetails.location ? `- Location: ${loginDetails.location}` : ''}
    
    If you don't recognize this activity, please change your password immediately.
  `;

  return {
    html: getBaseEmailTemplate('New Login Detected', content),
    text,
  };
};

export const sessionRevokedTemplate = (
  name: string,
  sessionDetails: {
    deviceInfo?: string;
    ipAddress?: string;
    revokedAt: string;
  }
) => {
  const content = `
    <p>Hi ${name},</p>
    <p>A session for your Expense Tracker account has been revoked.</p>
    <p><strong>Session Details:</strong></p>
    <ul>
      ${sessionDetails.deviceInfo ? `<li>Device: ${sessionDetails.deviceInfo}</li>` : ''}
      ${sessionDetails.ipAddress ? `<li>IP Address: ${sessionDetails.ipAddress}</li>` : ''}
      <li>Revoked at: ${sessionDetails.revokedAt}</li>
    </ul>
    <div class="alert-box">
      <strong>If you didn't revoke this session:</strong><br>
      Someone may have accessed your account. Please change your password immediately and review your active sessions.
    </div>
    <p>If you revoked this session yourself, you can safely ignore this email.</p>
  `;

  const text = `
    Session Revoked
    
    Hi ${name},
    
    A session for your Expense Tracker account has been revoked.
    
    Session Details:
    ${sessionDetails.deviceInfo ? `- Device: ${sessionDetails.deviceInfo}` : ''}
    ${sessionDetails.ipAddress ? `- IP Address: ${sessionDetails.ipAddress}` : ''}
    - Revoked at: ${sessionDetails.revokedAt}
    
    If you didn't revoke this session, please change your password immediately.
  `;

  return {
    html: getBaseEmailTemplate('Session Revoked', content),
    text,
  };
};

