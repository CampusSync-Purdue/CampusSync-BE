import nodemailer from 'nodemailer'

/**
 * CSYNC-29 — Password reset email delivery.
 *
 * SMTP configuration is loaded from environment variables.
 * Credentials must never be committed to Git.
 */
export async function sendPasswordResetEmail(
  recipientEmail: string,
  resetUrl: string,
): Promise<void> {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT ?? '587')
  const username = process.env.SMTP_USER?.trim()
  const password = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM?.trim()

  if (!host || !username || !password || !from) {
    throw new Error('SMTP email delivery is not configured.')
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port.')
  }

  /**
   * Port 465: TLS immediately.
   * Other ports (normally 587): require STARTTLS.
   *
   * Unencrypted delivery is not permitted.
   */
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user: username,
      pass: password,
    },
    connectionTimeout: 10000,
    socketTimeout: 10000,
  })

  const result = await transporter.sendMail({
    from,
    to: recipientEmail,
    subject: 'Reset your CampusSync password',
    text: [
      'Hello,',
      '',
      'We received a request to reset your CampusSync password.',
      '',
      'Use the following link to create a new password:',
      resetUrl,
      '',
      'This link expires in 30 minutes and can only be used once.',
      '',
      'If you did not request a password reset,',
      'you can safely ignore this email.',
      '',
      'CampusSync Team',
    ].join('\n'),
    disableFileAccess: true,
    disableUrlAccess: true,
  })

  if (result.accepted.length === 0 || result.rejected.length > 0) {
    throw new Error('The password-reset email was not accepted.')
  }
}