import nodemailer from 'nodemailer';

const createTransporter = () => {
  // For development, use Ethereal (fake SMTP)
  // For production, use real SMTP (Gmail, SendGrid, etc.)
  
  if (process.env.NODE_ENV === 'production') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // For development - logs to console instead of sending
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'your-ethereal-email@ethereal.email',
        pass: 'your-ethereal-password',
      },
    });
  }
};

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string
) => {
  try {
    const transporter = createTransporter();
    
    // In development, just log the reset link
    const resetUrl = `${process.env.APP_URL || 'http://localhost:19006'}/reset-password?token=${resetToken}`;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n📧 ============= PASSWORD RESET EMAIL =============');
      console.log(`To: ${email}`);
      console.log(`Reset Link: ${resetUrl}`);
      console.log(`Token: ${resetToken}`);
      console.log('=================================================\n');
      return true;
    }

    // Send actual email in production
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Expense Tracker" <noreply@expensetracker.com>',
      to: email,
      subject: 'Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background-color: #8B5CF6; 
              color: white; 
              text-decoration: none; 
              border-radius: 6px; 
              margin: 20px 0;
            }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Click the button below to reset it:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #8B5CF6;">${resetUrl}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't request this, please ignore this email.</p>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Expense Tracker. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset Request
        
        You requested to reset your password. Use this link to reset it:
        ${resetUrl}
        
        This link will expire in 1 hour.
        
        If you didn't request this, please ignore this email.
      `,
    });

    console.log('Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

export const sendPasswordChangedNotification = async (
  email: string,
  name: string
) => {
  try {
    const transporter = createTransporter();
    
    // In development, just log
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n🔒 ============= PASSWORD CHANGED NOTIFICATION =============');
      console.log(`To: ${email}`);
      console.log(`Name: ${name}`);
      console.log(`Message: Your password was successfully changed`);
      console.log(`Time: ${new Date().toLocaleString()}`);
      console.log('=======================================================\n');
      return true;
    }

    // Send actual email in production
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Expense Tracker" <noreply@expensetracker.com>',
      to: email,
      subject: 'Password Changed Successfully',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .alert { 
              background-color: #FEF3C7; 
              border-left: 4px solid #F59E0B; 
              padding: 15px; 
              margin: 20px 0;
            }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Password Changed Successfully</h2>
            <p>Hi ${name},</p>
            <p>This email confirms that your password was successfully changed.</p>
            
            <div class="alert">
              <strong>⚠️ If you didn't make this change:</strong><br>
              Please contact our support team immediately, as your account may have been compromised.
            </div>
            
            <p><strong>Change Details:</strong></p>
            <ul>
              <li>Time: ${new Date().toLocaleString()}</li>
              <li>Account: ${email}</li>
            </ul>
            
            <p>For your security, you may need to log in again on other devices.</p>
            
            <div class="footer">
              <p>© ${new Date().getFullYear()} Expense Tracker. All rights reserved.</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Changed Successfully
        
        Hi ${name},
        
        This email confirms that your password was successfully changed.
        
        ⚠️ If you didn't make this change, please contact support immediately.
        
        Change Details:
        - Time: ${new Date().toLocaleString()}
        - Account: ${email}
        
        For your security, you may need to log in again on other devices.
      `,
    });

    console.log('Password changed notification sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password changed notification:', error);
    throw new Error('Failed to send password changed notification');
  }
};