export enum AccountStatus {
  PENDING_VERIFICATION = 'pending_verification', // Just registered, email not verified
  ACTIVE = 'active', // Email verified, can use app
  SUSPENDED = 'suspended', // Admin suspended account
  DEACTIVATED = 'deactivated', // User deactivated their own account
  DELETED = 'deleted', // Soft deleted, pending permanent deletion
}

