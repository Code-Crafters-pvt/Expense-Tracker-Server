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

