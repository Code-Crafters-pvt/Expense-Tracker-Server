import { sendEmail } from '../../core/maileroo.service';
import { isMailerooConfigured } from '../../config/maileroo.config';
import { MAILEROO_CONFIG } from '../../config/maileroo.config';
import * as templates from './auth.templates';

/**
 * Send email verification email
 */
export const sendVerificationEmail = async (
  email: string,
  name: string,
  verificationLink: string
): Promise<string> => {
  if (!isMailerooConfigured()) {
    console.log('\n📧 ============= VERIFICATION EMAIL =============');
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`Link: ${verificationLink}`);
    console.log('================================================\n');
    return 'console-logged';
  }

  const { html, text } = templates.emailVerificationTemplate(name, verificationLink);

  return await sendEmail({
    to: email,
    toName: name,
    subject: 'Verify Your Email Address',
    html,
    text,
  });
};

/**
 * Send welcome email after verification
 */
export const sendWelcomeEmail = async (email: string, name: string): Promise<string> => {
  if (!isMailerooConfigured()) {
    console.log('\n📧 ============= WELCOME EMAIL =============');
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log('==========================================\n');
    return 'console-logged';
  }

  const { html, text } = templates.welcomeEmailTemplate(name);

  return await sendEmail({
    to: email,
    toName: name,
    subject: 'Welcome to Expense Tracker!',
    html,
    text,
  });
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string
): Promise<string> => {
  const resetUrl = `${MAILEROO_CONFIG.appUrl}/reset-password?token=${resetToken}`;
  const name = email.split('@')[0];

  if (!isMailerooConfigured()) {
    console.log('\n📧 ============= PASSWORD RESET EMAIL =============');
    console.log(`To: ${email}`);
    console.log(`Reset Link: ${resetUrl}`);
    console.log('=================================================\n');
    return 'console-logged';
  }

  const { html, text } = templates.passwordResetTemplate(resetUrl);

  return await sendEmail({
    to: email,
    toName: name,
    subject: 'Password Reset Request',
    html,
    text,
  });
};

/**
 * Send password changed notification
 */
export const sendPasswordChangedNotification = async (
  email: string,
  name: string
): Promise<string> => {
  if (!isMailerooConfigured()) {
    console.log('\n🔒 ============= PASSWORD CHANGED =============');
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log('==============================================\n');
    return 'console-logged';
  }

  const { html, text } = templates.passwordChangedTemplate(email, name);

  return await sendEmail({
    to: email,
    toName: name,
    subject: 'Password Changed Successfully',
    html,
    text,
  });
};

/**
 * Send email changed notification (to both old and new email)
 */
export const sendEmailChangedNotification = async (
  oldEmail: string,
  newEmail: string,
  name: string
): Promise<void> => {
  if (!isMailerooConfigured()) {
    console.log('\n📧 ============= EMAIL CHANGED =============');
    console.log(`Old Email: ${oldEmail}`);
    console.log(`New Email: ${newEmail}`);
    console.log(`Name: ${name}`);
    console.log('==========================================\n');
    return;
  }

  const { html, text } = templates.emailChangedTemplate(newEmail, name);

  // Send to both emails
  await Promise.all([
    sendEmail({
      to: oldEmail,
      toName: name,
      subject: 'Email Address Changed',
      html,
      text,
    }),
    sendEmail({
      to: newEmail,
      toName: name,
      subject: 'Email Address Changed',
      html,
      text,
    }),
  ]);
};

/**
 * Send account deletion confirmation
 */
export const sendAccountDeletionEmail = async (
  email: string,
  name: string
): Promise<string> => {
  if (!isMailerooConfigured()) {
    console.log('\n🗑️ ============= ACCOUNT DELETION =============');
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log('==============================================\n');
    return 'console-logged';
  }

  const { html, text } = templates.accountDeletionTemplate(name);

  return await sendEmail({
    to: email,
    toName: name,
    subject: 'Account Deletion Confirmed',
    html,
    text,
  });
};

/**
 * Send 2FA/OTP code
 */
export const sendTwoFactorCode = async (
  email: string,
  name: string,
  code: string
): Promise<string> => {
  if (!isMailerooConfigured()) {
    console.log('\n🔐 ============= 2FA CODE =============');
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`Code: ${code}`);
    console.log('======================================\n');
    return 'console-logged';
  }

  const { html, text } = templates.twoFactorCodeTemplate(name, code);

  return await sendEmail({
    to: email,
    toName: name,
    subject: 'Your Two-Factor Authentication Code',
    html,
    text,
  });
};

/**
 * Send account reactivation email
 */
export const sendAccountReactivationEmail = async (
  email: string,
  name: string
): Promise<string> => {
  if (!isMailerooConfigured()) {
    console.log('\n✅ ============= ACCOUNT REACTIVATION =============');
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log('==================================================\n');
    return 'console-logged';
  }

  const { html, text } = templates.accountReactivationTemplate(name);

  return await sendEmail({
    to: email,
    toName: name,
    subject: 'Account Reactivated Successfully',
    html,
    text,
  });
};

/**
 * Send account deactivation email
 */
export const sendAccountDeactivationEmail = async (
  email: string,
  name: string
): Promise<string> => {
  if (!isMailerooConfigured()) {
    console.log('\n⏸️ ============= ACCOUNT DEACTIVATION =============');
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log('==================================================\n');
    return 'console-logged';
  }

  const { html, text } = templates.accountDeactivationTemplate(name);

  return await sendEmail({
    to: email,
    toName: name,
    subject: 'Account Deactivated',
    html,
    text,
  });
};

/**
 * Send suspicious login alert
 */
export const sendSuspiciousLoginAlert = async (
  email: string,
  name: string,
  loginDetails: {
    ipAddress?: string;
    deviceInfo?: string;
    location?: string;
    timestamp: string;
  }
): Promise<string> => {
  if (!isMailerooConfigured()) {
    console.log('\n⚠️ ============= SUSPICIOUS LOGIN =============');
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`IP: ${loginDetails.ipAddress || 'Unknown'}`);
    console.log(`Device: ${loginDetails.deviceInfo || 'Unknown'}`);
    console.log(`Time: ${loginDetails.timestamp}`);
    console.log('================================================\n');
    return 'console-logged';
  }

  const { html, text } = templates.suspiciousLoginTemplate(name, loginDetails);

  return await sendEmail({
    to: email,
    toName: name,
    subject: 'New Login Detected - Security Alert',
    html,
    text,
  });
};

/**
 * Send session revoked notification
 */
export const sendSessionRevokedNotification = async (
  email: string,
  name: string,
  sessionDetails: {
    deviceInfo?: string;
    ipAddress?: string;
    revokedAt: string;
  }
): Promise<string> => {
  if (!isMailerooConfigured()) {
    console.log('\n🔒 ============= SESSION REVOKED =============');
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`Device: ${sessionDetails.deviceInfo || 'Unknown'}`);
    console.log(`IP: ${sessionDetails.ipAddress || 'Unknown'}`);
    console.log(`Revoked at: ${sessionDetails.revokedAt}`);
    console.log('==============================================\n');
    return 'console-logged';
  }

  const { html, text } = templates.sessionRevokedTemplate(name, sessionDetails);

  return await sendEmail({
    to: email,
    toName: name,
    subject: 'Session Revoked',
    html,
    text,
  });
};

