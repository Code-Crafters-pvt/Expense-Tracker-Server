export {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangedNotification,
  sendEmailChangedNotification,
  sendAccountDeletionEmail,
  sendTwoFactorCode,
} from './modules/auth/auth.emails';

// Re-export expense emails (when implemented)
// export { ... } from './modules/expense/expense.emails';

export { isMailerooConfigured } from './config/maileroo.config';
