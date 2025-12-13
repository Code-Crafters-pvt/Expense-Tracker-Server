import axios from 'axios';
import { MAILEROO_CONFIG } from '../config/maileroo.config';

interface EmailPayload {
  to: string;
  toName: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Core email sending service - Used by ALL email modules
 */
export const sendEmail = async (payload: EmailPayload): Promise<string> => {
  const { apiKey, senderEmail, senderName, sendUrl } = MAILEROO_CONFIG;

  if (!apiKey) {
    throw new Error('Maileroo API key not configured');
  }

  try {
    const response = await axios.post(
      sendUrl,
      {
        from: {
          address: senderEmail,
          display_name: senderName,
        },
        to: [
          {
            address: payload.to,
            display_name: payload.toName,
          },
        ],
        subject: payload.subject,
        html: payload.html,
        plain: payload.text,
        tracking: true,
      },
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const referenceId = response.data?.data?.reference_id || 'sent';
    console.log(`✅ Email sent successfully. Reference ID: ${referenceId}`);
    return referenceId;
  } catch (error: any) {
    const errorData = error.response?.data || {};
    const errorMessage = errorData.message || error.message;
    console.error('❌ Email sending failed:', errorData);
    throw new Error(`Failed to send email: ${errorMessage}`);
  }
};

