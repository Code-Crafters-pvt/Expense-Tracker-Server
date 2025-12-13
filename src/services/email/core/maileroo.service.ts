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
 * Handles errors gracefully - logs but doesn't throw to prevent breaking the application
 */
export const sendEmail = async (payload: EmailPayload): Promise<string> => {
  const { apiKey, senderEmail, senderName, sendUrl } = MAILEROO_CONFIG;

  if (!apiKey) {
    const errorMsg = 'Maileroo API key not configured. Email cannot be sent.';
    console.error('❌ Email Service Error:', errorMsg);
    throw new Error(errorMsg);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(payload.to)) {
    const errorMsg = `Invalid email address format: ${payload.to}`;
    console.error('❌ Email Validation Error:', errorMsg);
    throw new Error(errorMsg);
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
        timeout: 10000, // 10 second timeout
      }
    );

    const referenceId = response.data?.data?.reference_id || 'sent';
    console.log(`✅ Email sent successfully to ${payload.to}. Reference ID: ${referenceId}`);
    return referenceId;
  } catch (error: any) {
    const errorData = error.response?.data || {};
    const errorMessage = errorData.message || error.message || 'Unknown error';
    const statusCode = error.response?.status || 'N/A';
    
    // Log detailed error information
    console.error('❌ Email sending failed:', {
      to: payload.to,
      subject: payload.subject,
      statusCode,
      error: errorMessage,
      details: errorData,
    });

    // Throw error so calling code can handle it appropriately
    throw new Error(`Failed to send email to ${payload.to}: ${errorMessage}`);
  }
};

