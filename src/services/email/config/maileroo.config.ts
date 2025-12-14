export const MAILEROO_CONFIG = {
  apiBase: 'https://smtp.maileroo.com/api/v2',
  sendUrl: 'https://smtp.maileroo.com/api/v2/emails',
  apiKey: process.env.MAILEROO_API_KEY || '',
  senderEmail: process.env.MAILEROO_SENDER_EMAIL || 'noreply@a68e65da11a9142f.maileroo.org',
  senderName: process.env.MAILEROO_SENDER_NAME || 'Expense Tracker',
  appUrl: process.env.APP_URL || 'http://localhost:19006',
};

export const isMailerooConfigured = (): boolean => {
  return !!MAILEROO_CONFIG.apiKey;
};

