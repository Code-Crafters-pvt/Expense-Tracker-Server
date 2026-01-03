import { sendEmail } from '../../core/maileroo.service';
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
  const resetUrl = `${MAILEROO_CONFIG.appUrl}reset-password?token=${resetToken}`;
  const name = email.split('@')[0];

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
  name: string,
  changedAt: Date = new Date()
): Promise<string> => {
  const { html, text } = templates.passwordChangedTemplate(email, name, changedAt);

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
 * Returns reference IDs for both emails sent
 */
export const sendEmailChangedNotification = async (
  oldEmail: string,
  newEmail: string,
  name: string,
  changedAt: Date = new Date()
): Promise<{ oldEmail: string | null; newEmail: string | null }> => {
  const { html, text } = templates.emailChangedTemplate(newEmail, name, changedAt);

  // Send to both emails - handle errors individually so one failure doesn't prevent the other
  const emailPromises = [
    sendEmail({
      to: oldEmail,
      toName: name,
      subject: 'Email Address Changed',
      html,
      text,
    }).catch((error) => {
      console.error(`Failed to send email change notification to old email (${oldEmail}):`, error.message);
      return null; // Return null instead of throwing to allow both emails to be attempted
    }),
    sendEmail({
      to: newEmail,
      toName: name,
      subject: 'Email Address Changed',
      html,
      text,
    }).catch((error) => {
      console.error(`Failed to send email change notification to new email (${newEmail}):`, error.message);
      return null; // Return null instead of throwing to allow both emails to be attempted
    }),
  ];

  const results = await Promise.all(emailPromises);

  return {
    oldEmail: results[0] || null,
    newEmail: results[1] || null,
  };
};

/**
 * Send account deletion confirmation
 */
export const sendAccountDeletionEmail = async (
  email: string,
  name: string
): Promise<string> => {
  // Provide link to app where user can log in and cancel deletion
  const cancelDeletionUrl = `${MAILEROO_CONFIG.appUrl}settings`;
  const { html, text } = templates.accountDeletionTemplate(name, cancelDeletionUrl);

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
 * Send session revoked notification
 */
export const sendSessionRevokedNotification = async (
  email: string,
  name: string,
  sessionDetails: {
    deviceInfo?: string;
    ipAddress?: string;
    revokedAt: Date;
  }
): Promise<string> => {
  const { html, text } = templates.sessionRevokedTemplate(name, sessionDetails);

  return await sendEmail({
    to: email,
    toName: name,
    subject: 'Session Revoked',
    html,
    text,
  });
};

/**
 * Send email change verification email
 * Same pattern as sendVerificationEmail
 */
export const sendEmailChangeVerification = async (
  newEmail: string,
  name: string,
  verificationLink: string
): Promise<string> => {
  const { html, text } = templates.emailChangeVerificationTemplate(name, newEmail, verificationLink);

  return await sendEmail({
    to: newEmail,
    toName: name,
    subject: 'Verify Your New Email Address',
    html,
    text,
  });
};


