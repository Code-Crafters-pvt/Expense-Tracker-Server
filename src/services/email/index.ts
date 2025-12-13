export {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangedNotification,
  sendEmailChangedNotification,
  sendAccountDeletionEmail,
  sendTwoFactorCode,
  sendAccountReactivationEmail,
  sendAccountDeactivationEmail,
  sendSuspiciousLoginAlert,
  sendSessionRevokedNotification,
} from './modules/auth/auth.emails';

// Re-export expense emails (when implemented)
// export { ... } from './modules/expense/expense.emails';

