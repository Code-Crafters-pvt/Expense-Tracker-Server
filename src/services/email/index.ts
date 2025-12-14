export {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangedNotification,
  sendEmailChangedNotification,
  sendEmailChangeVerification,
  sendAccountDeletionEmail,
  sendTwoFactorCode,
  sendAccountReactivationEmail,
  sendAccountDeactivationEmail,
  sendSessionRevokedNotification,
} from './modules/auth/auth.emails';

// Re-export expense emails (when implemented)
// export { ... } from './modules/expense/expense.emails';

