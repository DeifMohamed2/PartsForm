/**
 * Password Reset Controller
 * Handles forgot password and reset password functionality
 */
const crypto = require('crypto');
const Buyer = require('../models/Buyer');
const emailService = require('../services/emailService');

/**
 * Rate limiting configuration for password reset
 * Progressive delays: immediate -> 30s -> 3min -> 10min -> blocked 24h
 */
const RATE_LIMIT_CONFIG = {
  delays: [0, 30, 180, 600], // seconds: 0, 30s, 3min, 10min
  maxAttempts: 5,
  blockDuration: 24 * 60 * 60 * 1000, // 24 hours in ms
  resetWindow: 24 * 60 * 60 * 1000, // Reset counter after 24 hours
};

/**
 * Calculate rate limit status for a user
 */
const getRateLimitStatus = (buyer) => {
  const now = new Date();
  const attempts = buyer.passwordResetAttempts || 0;
  const lastAttempt = buyer.passwordResetLastAttempt;
  const blockedUntil = buyer.passwordResetBlockedUntil;

  // Check if blocked
  if (blockedUntil && blockedUntil > now) {
    const remainingMs = blockedUntil - now;
    const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
    return {
      allowed: false,
      blocked: true,
      message: `Too many attempts. Please try again in ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}.`,
      retryAfter: Math.ceil(remainingMs / 1000),
    };
  }

  // Reset attempts if last attempt was more than 24 hours ago
  if (lastAttempt && (now - lastAttempt) > RATE_LIMIT_CONFIG.resetWindow) {
    return { allowed: true, attempts: 0, nextDelay: 0 };
  }

  // Check if max attempts reached
  if (attempts >= RATE_LIMIT_CONFIG.maxAttempts) {
    return {
      allowed: false,
      blocked: true,
      message: 'Too many attempts. Please try again in 24 hours.',
      retryAfter: 24 * 60 * 60,
    };
  }

  // Calculate required delay based on attempt count
  const delayIndex = Math.min(attempts, RATE_LIMIT_CONFIG.delays.length - 1);
  const requiredDelay = RATE_LIMIT_CONFIG.delays[delayIndex] * 1000; // Convert to ms

  if (lastAttempt && requiredDelay > 0) {
    const timeSinceLastAttempt = now - lastAttempt;
    if (timeSinceLastAttempt < requiredDelay) {
      const remainingMs = requiredDelay - timeSinceLastAttempt;
      const remainingSec = Math.ceil(remainingMs / 1000);
      return {
        allowed: false,
        blocked: false,
        message: `Please wait ${formatWaitTime(remainingSec)} before requesting another code.`,
        retryAfter: remainingSec,
      };
    }
  }

  // Calculate next delay for UI
  const nextDelayIndex = Math.min(attempts + 1, RATE_LIMIT_CONFIG.delays.length - 1);
  const nextDelay = RATE_LIMIT_CONFIG.delays[nextDelayIndex];

  return {
    allowed: true,
    attempts: attempts,
    nextDelay: nextDelay,
    remainingAttempts: RATE_LIMIT_CONFIG.maxAttempts - attempts - 1,
  };
};

/**
 * Format wait time for display
 */
const formatWaitTime = (seconds) => {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
};

/**
 * Generate a 6-digit verification code
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate a secure token for password reset
 */
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash the verification code for storage
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Render forgot password page
 * GET /forgot-password
 */
const getForgotPasswordPage = (req, res) => {
  res.render('Landing/forgot-password', {
    title: 'Forgot Password | PARTSFORM',
    pageClass: 'page-forgot-password',
  });
};

/**
 * Request password reset - Step 1
 * POST /forgot-password
 */
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find buyer by email with rate limit fields
    const buyer = await Buyer.findOne({ email: normalizedEmail })
      .select('+passwordResetAttempts +passwordResetLastAttempt +passwordResetBlockedUntil +passwordResetToken +passwordResetExpires');

    // Show error if email not found
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address. Please check your email or create a new account.',
      });
    }

    // Check if account is active
    if (!buyer.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact support for assistance.',
      });
    }

    // Check rate limit
    const rateLimitStatus = getRateLimitStatus(buyer);
    if (!rateLimitStatus.allowed) {
      return res.status(429).json({
        success: false,
        message: rateLimitStatus.message,
        retryAfter: rateLimitStatus.retryAfter,
        blocked: rateLimitStatus.blocked,
      });
    }

    // Generate verification code (6 digits)
    const verificationCode = generateVerificationCode();
    const hashedCode = hashToken(verificationCode);

    // Set expiration to 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Update rate limit counters
    const newAttempts = (rateLimitStatus.attempts || 0) + 1;
    const shouldBlock = newAttempts >= RATE_LIMIT_CONFIG.maxAttempts;

    // Save hashed code, expiration, and rate limit data
    await Buyer.updateOne(
      { _id: buyer._id },
      {
        $set: {
          passwordResetToken: hashedCode,
          passwordResetExpires: expiresAt,
          passwordResetAttempts: newAttempts,
          passwordResetLastAttempt: new Date(),
          ...(shouldBlock && { passwordResetBlockedUntil: new Date(Date.now() + RATE_LIMIT_CONFIG.blockDuration) }),
        },
      }
    );

    // Send verification email
    try {
      console.log(`📧 Attempting to send password reset email to ${normalizedEmail}...`);
      const emailResult = await sendPasswordResetEmail(buyer.email, buyer.firstName, verificationCode);
      if (emailResult && emailResult.success) {
        console.log(`✅ Password reset email sent successfully to ${normalizedEmail}`);
      } else {
        console.error(`❌ Failed to send password reset email: ${emailResult?.error || 'Unknown error'}`);
      }
    } catch (emailError) {
      console.error('❌ Password reset email exception:', emailError.message);
      console.error(emailError.stack);
      // Still return success to prevent enumeration
    }

    console.log(`📧 Password reset code generated for ${normalizedEmail}`);

    // Calculate next delay for UI
    const nextDelayIndex = Math.min(newAttempts, RATE_LIMIT_CONFIG.delays.length - 1);
    const nextDelay = RATE_LIMIT_CONFIG.delays[nextDelayIndex];
    const remainingAttempts = RATE_LIMIT_CONFIG.maxAttempts - newAttempts;

    res.status(200).json({
      success: true,
      message: 'Verification code sent! Please check your email.',
      rateLimit: {
        nextDelay: nextDelay,
        remainingAttempts: remainingAttempts,
        attempts: newAttempts,
      },
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again later.',
    });
  }
};

/**
 * Verify reset code - Step 2
 * POST /forgot-password/verify
 */
const verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const hashedCode = hashToken(code);

    // Find user with valid reset token
    const buyer = await Buyer.findOne({
      email: normalizedEmail,
      passwordResetToken: hashedCode,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!buyer) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code. Please request a new one.',
      });
    }

    // Generate a reset token for the next step
    const resetToken = generateResetToken();
    const hashedResetToken = hashToken(resetToken);

    // Update token for password reset step
    buyer.passwordResetToken = hashedResetToken;
    buyer.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await buyer.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Code verified successfully',
      resetToken: resetToken, // This token will be used to reset password
    });
  } catch (error) {
    console.error('Verify reset code error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again later.',
    });
  }
};

/**
 * Reset password - Step 3
 * POST /forgot-password/reset
 */
const resetPassword = async (req, res) => {
  try {
    const { email, resetToken, password, confirmPassword } = req.body;

    // Validate inputs
    if (!email || !resetToken || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Validate password match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const hashedToken = hashToken(resetToken);

    // Find user with valid reset token
    const buyer = await Buyer.findOne({
      email: normalizedEmail,
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires +password');

    if (!buyer) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token. Please start over.',
      });
    }

    // Update password using updateOne to avoid full document validation
    // Also clear rate limit fields on successful password reset
    await Buyer.updateOne(
      { _id: buyer._id },
      {
        $set: { password: await require('bcrypt').hash(password, 12) },
        $unset: { 
          passwordResetToken: 1, 
          passwordResetExpires: 1, 
          lockUntil: 1,
          passwordResetAttempts: 1,
          passwordResetLastAttempt: 1,
          passwordResetBlockedUntil: 1,
        },
        loginAttempts: 0,
      }
    );

    // Send confirmation email
    try {
      await sendPasswordChangedEmail(buyer.email, buyer.firstName);
    } catch (emailError) {
      console.error('Failed to send password changed email:', emailError);
    }

    console.log(`🔐 Password reset successful for ${normalizedEmail}`);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again later.',
    });
  }
};

/**
 * Resend verification code
 * POST /forgot-password/resend
 */
const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find buyer by email with rate limit fields
    const buyer = await Buyer.findOne({ email: normalizedEmail })
      .select('+passwordResetAttempts +passwordResetLastAttempt +passwordResetBlockedUntil +passwordResetToken +passwordResetExpires');

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.',
      });
    }

    if (!buyer.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated.',
      });
    }

    // Check rate limit
    const rateLimitStatus = getRateLimitStatus(buyer);
    if (!rateLimitStatus.allowed) {
      return res.status(429).json({
        success: false,
        message: rateLimitStatus.message,
        retryAfter: rateLimitStatus.retryAfter,
        blocked: rateLimitStatus.blocked,
      });
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    const hashedCode = hashToken(verificationCode);

    // Set expiration to 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Update rate limit counters
    const newAttempts = (rateLimitStatus.attempts || 0) + 1;
    const shouldBlock = newAttempts >= RATE_LIMIT_CONFIG.maxAttempts;

    // Save hashed code, expiration, and rate limit data
    await Buyer.updateOne(
      { _id: buyer._id },
      {
        $set: {
          passwordResetToken: hashedCode,
          passwordResetExpires: expiresAt,
          passwordResetAttempts: newAttempts,
          passwordResetLastAttempt: new Date(),
          ...(shouldBlock && { passwordResetBlockedUntil: new Date(Date.now() + RATE_LIMIT_CONFIG.blockDuration) }),
        },
      }
    );

    // Send verification email
    try {
      console.log(`📧 Attempting to resend password reset email to ${normalizedEmail}...`);
      const emailResult = await sendPasswordResetEmail(buyer.email, buyer.firstName, verificationCode);
      if (emailResult && emailResult.success) {
        console.log(`✅ Password reset email resent successfully to ${normalizedEmail}`);
      } else {
        console.error(`❌ Failed to resend password reset email: ${emailResult?.error || 'Unknown error'}`);
      }
    } catch (emailError) {
      console.error('❌ Resend password reset email exception:', emailError.message);
      console.error(emailError.stack);
    }

    // Calculate next delay for UI
    const nextDelayIndex = Math.min(newAttempts, RATE_LIMIT_CONFIG.delays.length - 1);
    const nextDelay = RATE_LIMIT_CONFIG.delays[nextDelayIndex];
    const remainingAttempts = RATE_LIMIT_CONFIG.maxAttempts - newAttempts;

    res.status(200).json({
      success: true,
      message: 'New verification code sent! Please check your email.',
      rateLimit: {
        nextDelay: nextDelay,
        remainingAttempts: remainingAttempts,
        attempts: newAttempts,
      },
    });
  } catch (error) {
    console.error('Resend verification code error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again later.',
    });
  }
};

/**
 * Send password reset email with verification code
 */
const sendPasswordResetEmail = async (email, firstName, code) => {
  const name = firstName || 'there';
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">
          
          <!-- Logo Header -->
          <tr>
            <td style="text-align: center; padding-bottom: 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #2b5278; border-radius: 10px; padding: 14px 32px;">
                    <span style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 3px; text-transform: uppercase; font-family: 'Arial Black', Arial, sans-serif; text-decoration: none;">PARTSFORM</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(43, 82, 120, 0.12);">
                
                <!-- Header Banner -->
                <tr>
                  <td style="background: linear-gradient(135deg, #2b5278 0%, #3a6d9e 100%); padding: 48px 32px; text-align: center;">
                    <p style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff; letter-spacing: 0.5px;">Password Reset</p>
                    <p style="margin: 12px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.8);">Secure verification code</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 36px 32px;">
                    <p style="margin: 0 0 20px 0; font-size: 17px; color: #1a2b3d; line-height: 1.6;">
                      Hi <strong>${name}</strong>,
                    </p>
                    <p style="margin: 0 0 28px 0; font-size: 15px; color: #4b5563; line-height: 1.7;">
                      We received a request to reset your password. Use the verification code below to proceed with the password reset.
                    </p>
                    
                    <!-- Verification Code Box -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; border: 2px solid #bae6fd;">
                      <tr>
                        <td style="padding: 32px; text-align: center;">
                          <p style="margin: 0 0 12px 0; font-size: 12px; color: #0369a1; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Your Verification Code</p>
                          <p style="margin: 0; font-size: 40px; font-weight: 700; color: #2b5278; letter-spacing: 10px; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">${code}</p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Expiry Notice -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                      <tr>
                        <td style="padding: 16px 20px; background-color: #fef3c7; border-radius: 10px; border-left: 4px solid #f59e0b;">
                          <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">
                            <strong style="display: block; margin-bottom: 4px;">This code expires in 15 minutes.</strong>
                            <span style="font-size: 13px;">If you didn't request this reset, please ignore this email.</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Security Notice -->
                    <p style="margin: 28px 0 0 0; font-size: 13px; color: #6b7280; line-height: 1.6; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                      For security reasons, never share this code with anyone. PartsForm will never ask you for this code via phone or chat.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 13px; color: #64748b; text-align: center;">
                      Need help? Contact us at <a href="mailto:support@partsform.com" style="color: #2b5278; text-decoration: none; font-weight: 600;">support@partsform.com</a>
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer Links -->
          <tr>
            <td style="padding: 28px 20px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">
                © ${new Date().getFullYear()} PartsForm. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                This is an automated message, please do not reply directly.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `
Hi ${name},

We received a request to reset your password.

Your verification code is: ${code}

This code expires in 15 minutes.

If you didn't request this reset, please ignore this email.

For security reasons, never share this code with anyone.

- PartsForm Team
`;

  emailService.initializeSmtp();
  
  return await emailService.sendEmail({
    to: email,
    subject: 'Reset Your PartsForm Password - Verification Code Inside',
    text,
    html,
  });
};

/**
 * Send password changed confirmation email
 */
const sendPasswordChangedEmail = async (email, firstName) => {
  const name = firstName || 'there';
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">
          
          <!-- Logo Header -->
          <tr>
            <td style="text-align: center; padding-bottom: 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #2b5278; border-radius: 10px; padding: 14px 32px;">
                    <span style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 3px; text-transform: uppercase; font-family: 'Arial Black', Arial, sans-serif; text-decoration: none;">PARTSFORM</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(43, 82, 120, 0.12);">
                
                <!-- Header Banner -->
                <tr>
                  <td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 48px 32px; text-align: center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td style="width: 64px; height: 64px; background-color: rgba(255,255,255,0.2); border-radius: 50%; text-align: center; vertical-align: middle;">
                          <span style="font-size: 28px; line-height: 64px; color: #ffffff;">&#10003;</span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 16px 0 0 0; font-size: 24px; font-weight: 600; color: #ffffff; letter-spacing: 0.5px;">Password Changed</p>
                    <p style="margin: 8px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.85);">Your account is now secured</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 36px 32px;">
                    <p style="margin: 0 0 20px 0; font-size: 17px; color: #1a2b3d; line-height: 1.6;">
                      Hi <strong>${name}</strong>,
                    </p>
                    <p style="margin: 0 0 28px 0; font-size: 15px; color: #4b5563; line-height: 1.7;">
                      Your password has been successfully changed. You can now log in with your new password.
                    </p>
                    
                    <!-- Success Box -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
                      <tr>
                        <td style="padding: 24px; text-align: center;">
                          <p style="margin: 0; font-size: 15px; color: #166534; font-weight: 600; line-height: 1.5;">
                            Your account is now secured with your new password
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Security Notice -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                      <tr>
                        <td style="padding: 16px 20px; background-color: #fef2f2; border-radius: 10px; border-left: 4px solid #ef4444;">
                          <p style="margin: 0; font-size: 14px; color: #991b1b; line-height: 1.5;">
                            <strong style="display: block; margin-bottom: 4px;">Didn't make this change?</strong>
                            <span style="font-size: 13px;">If you didn't change your password, please contact our support team immediately.</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 13px; color: #64748b; text-align: center;">
                      Need help? Contact us at <a href="mailto:support@partsform.com" style="color: #2b5278; text-decoration: none; font-weight: 600;">support@partsform.com</a>
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer Links -->
          <tr>
            <td style="padding: 28px 20px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © ${new Date().getFullYear()} PartsForm. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `
Hi ${name},

Your password has been successfully changed. You can now log in with your new password.

If you didn't make this change, please contact our support team immediately.

- PartsForm Team
`;

  emailService.initializeSmtp();
  
  return await emailService.sendEmail({
    to: email,
    subject: 'Your PartsForm Password Has Been Changed',
    text,
    html,
  });
};

module.exports = {
  getForgotPasswordPage,
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
  resendVerificationCode,
};
