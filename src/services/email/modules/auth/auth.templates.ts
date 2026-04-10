import { getBaseEmailTemplate } from '../../core/templates.helper';

/**
 * Format date consistently for email templates
 * Uses UTC timezone and en-US locale for consistent formatting across all server environments
 */
const formatEmailDate = (date: Date = new Date()): string => {
  return date.toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }) + ' UTC';
};

export const emailVerificationTemplate = (
  name: string,
  verificationCode: string,
  expiresInMinutes: number,
  appLink?: string
) => {
  const content = `
    <p>Hi ${name},</p>
    <p>Welcome to Expense Tracker! Please verify your email address to complete your registration.</p>
    <p>${appLink ? 'Tap the button below to open the app, or use the verification code manually.' : 'Use this verification code in the mobile app to activate your account:'}</p>
    <div style="text-align: center; margin: 30px 0;">
      <h2 style="font-size: 32px; color: #8B5CF6; letter-spacing: 8px; margin: 0;">${verificationCode}</h2>
    </div>
    <p style="color: #6b7280; font-size: 14px;">This code will expire in ${expiresInMinutes} minutes.</p>
  `;

  const text = `
    Hi ${name},
    
    Welcome to Expense Tracker! Please verify your email address to complete your registration.
    
    ${appLink ? `Open in app: ${appLink}\n    \n` : ''}Use this verification code in the mobile app: ${verificationCode}

    This code will expire in ${expiresInMinutes} minutes.
    
    If you didn't create an account, please ignore this email.
  `;

  return {
    html: getBaseEmailTemplate(
      'Verify Your Email',
      content,
      appLink ? 'Open in App' : undefined,
      appLink
    ),
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

export const passwordResetTemplate = (
  name: string,
  resetCode: string,
  expiresInMinutes: number,
  appLink?: string
) => {
  const content = `
    <p>Hi ${name},</p>
    <p>You requested to reset your password for your Expense Tracker account.</p>
    <p>${appLink ? 'Tap the button below to open the app, or use the reset code manually.' : 'Use this reset code in the mobile app to continue:'}</p>
    <div style="text-align: center; margin: 30px 0;">
      <h2 style="font-size: 32px; color: #8B5CF6; letter-spacing: 8px; margin: 0;">${resetCode}</h2>
    </div>
    <p style="color: #6b7280; font-size: 14px;"><strong>This code will expire in ${expiresInMinutes} minutes.</strong></p>
    <p style="color: #6b7280; font-size: 14px;">If you didn't request this, please ignore this email and your password will remain unchanged.</p>
  `;

  const text = `
    Password Reset Request

    Hi ${name},
    
    You requested to reset your password.
    
    ${appLink ? `Open in app: ${appLink}\n    \n` : ''}Use this code in the mobile app to reset it:
    ${resetCode}
    
    This code will expire in ${expiresInMinutes} minutes.
    
    If you didn't request this, please ignore this email.
  `;

  return {
    html: getBaseEmailTemplate(
      'Password Reset Request',
      content,
      appLink ? 'Open in App' : undefined,
      appLink
    ),
    text,
  };
};

export const passwordChangedTemplate = (email: string, name: string, changedAt: Date = new Date()) => {
  const content = `
    <p>Hi ${name},</p>
    <p>This email confirms that your password was successfully changed.</p>
    <div class="alert-box">
      <strong>⚠️ If you didn't make this change:</strong><br>
      Please contact our support team immediately, as your account may have been compromised.
    </div>
    <p><strong>Change Details:</strong></p>
    <ul>
      <li>Time: ${formatEmailDate(changedAt)}</li>
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
    - Time: ${formatEmailDate(changedAt)}
    - Account: ${email}
    
    For your security, you may need to log in again on other devices.
  `;

  return {
    html: getBaseEmailTemplate('Password Changed Successfully', content),
    text,
  };
};

export const emailChangedTemplate = (newEmail: string, name: string, changedAt: Date = new Date()) => {
  const content = `
    <p>Hi ${name},</p>
    <p>Your email address has been successfully changed to: <strong>${newEmail}</strong></p>
    <div class="alert-box">
      <strong>⚠️ If you didn't make this change:</strong><br>
      Please contact our support team immediately.
    </div>
    <p><strong>Change Details:</strong></p>
    <ul>
      <li>Time: ${formatEmailDate(changedAt)}</li>
      <li>New Email: ${newEmail}</li>
    </ul>
  `;

  const text = `
    Email Address Changed
    
    Hi ${name},
    
    Your email address has been successfully changed to: ${newEmail}
    
    ⚠️ If you didn't make this change, please contact support immediately.
    
    Change Details:
    - Time: ${formatEmailDate(changedAt)}
    - New Email: ${newEmail}
  `;

  return {
    html: getBaseEmailTemplate('Email Address Changed', content),
    text,
  };
};

export const accountDeletionTemplate = (name: string, cancelDeletionUrl?: string) => {
  const content = `
    <p>Hi ${name},</p>
    <p>Your account deletion request has been confirmed.</p>
    <p><strong>What happens next:</strong></p>
    <ul>
      <li>Your account will be permanently deleted in 30 days</li>
      <li>All your data will be removed from our servers</li>
      <li>You can cancel this request within 30 days using the "Cancel Deletion" option in your account settings</li>
    </ul>
    ${cancelDeletionUrl ? `<p>To cancel your deletion, simply log in to your account and navigate to your account settings.</p>` : ''}
    <p>If you need assistance, you can also contact our support team.</p>
    <p>We're sorry to see you go. If you'd like to provide feedback on why you're leaving, we'd appreciate it.</p>
  `;

  const text = `
    Account Deletion Confirmed
    
    Hi ${name},
    
    Your account deletion request has been confirmed.
    
    What happens next:
    - Your account will be permanently deleted in 30 days
    - All your data will be removed from our servers
    - You can cancel this request within 30 days using the "Cancel Deletion" option in your account settings
    
    ${cancelDeletionUrl ? `To cancel your deletion, log in to your account and navigate to your account settings.\n\n` : ''}If you need assistance, you can also contact our support team.
    
    We're sorry to see you go. If you'd like to provide feedback, we'd appreciate it.
  `;

  return {
    html: getBaseEmailTemplate(
      'Account Deletion Confirmed',
      content,
      cancelDeletionUrl ? 'Go to Account Settings' : undefined,
      cancelDeletionUrl
    ),
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

export const sessionRevokedTemplate = (
  name: string,
  sessionDetails: {
    deviceInfo?: string;
    ipAddress?: string;
    revokedAt: Date;
  }
) => {
  const content = `
    <p>Hi ${name},</p>
    <p>A session for your Expense Tracker account has been revoked.</p>
    <p><strong>Session Details:</strong></p>
    <ul>
      ${sessionDetails.deviceInfo ? `<li>Device: ${sessionDetails.deviceInfo}</li>` : ''}
      ${sessionDetails.ipAddress ? `<li>IP Address: ${sessionDetails.ipAddress}</li>` : ''}
      <li>Revoked at: ${formatEmailDate(sessionDetails.revokedAt)}</li>
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
    - Revoked at: ${formatEmailDate(sessionDetails.revokedAt)}
    
    If you didn't revoke this session, please change your password immediately.
  `;

  return {
    html: getBaseEmailTemplate('Session Revoked', content),
    text,
  };
};

export const emailChangeVerificationTemplate = (
  name: string,
  newEmail: string,
  verificationCode: string,
  expiresInMinutes: number,
  appLink?: string
) => {
  const content = `
    <p>Hi ${name},</p>
    <p>You requested to change your email address to: <strong>${newEmail}</strong></p>
    <p>${appLink ? 'Tap the button below to open the app, or enter the verification code manually.' : 'To complete this change, enter this verification code in the mobile app:'}</p>
    <div style="text-align: center; margin: 30px 0;">
      <h2 style="font-size: 32px; color: #8B5CF6; letter-spacing: 8px; margin: 0;">${verificationCode}</h2>
    </div>
    <p style="color: #6b7280; font-size: 14px;">This code will expire in ${expiresInMinutes} minutes.</p>
    <div class="alert-box">
      <strong>⚠️ If you didn't request this change:</strong><br>
      Please ignore this email and contact our support team immediately if you believe your account may be compromised.
    </div>
  `;

  const text = `
    Email Change Verification
    
    Hi ${name},
    
    You requested to change your email address to: ${newEmail}
    
    ${appLink ? `Open in app: ${appLink}\n    \n` : ''}To complete this change, enter this verification code in the mobile app:
    ${verificationCode}
    
    This code will expire in ${expiresInMinutes} minutes.
    
    ⚠️ If you didn't request this change, please ignore this email and contact support immediately.
  `;

  return {
    html: getBaseEmailTemplate(
      'Verify Your New Email Address',
      content,
      appLink ? 'Open in App' : undefined,
      appLink
    ),
    text,
  };
};


