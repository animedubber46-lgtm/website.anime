import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const emailTemplates = {
  'verify-email': ({ username, verifyUrl }) => ({
    subject: 'Verify your AnimeX account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f1a; color: #fff; padding: 40px; border-radius: 12px;">
        <h1 style="color: #e11d48; margin-bottom: 8px;">AnimeX</h1>
        <h2>Welcome, ${username}!</h2>
        <p>Click the button below to verify your email address and start watching.</p>
        <a href="${verifyUrl}" style="display: inline-block; background: #e11d48; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">
          Verify Email
        </a>
        <p style="color: #888; font-size: 12px;">Link expires in 24 hours. If you didn't create this account, ignore this email.</p>
      </div>
    `,
  }),

  'reset-password': ({ username, resetUrl }) => ({
    subject: 'AnimeX Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f1a; color: #fff; padding: 40px; border-radius: 12px;">
        <h1 style="color: #e11d48; margin-bottom: 8px;">AnimeX</h1>
        <h2>Reset Password</h2>
        <p>Hi ${username}, click below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; background: #e11d48; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">
          Reset Password
        </a>
        <p style="color: #888; font-size: 12px;">This link expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  }),

  'new-episode': ({ username, animeTitle, episodeNumber, episodeTitle, watchUrl, coverImage }) => ({
    subject: `New Episode: ${animeTitle} - Episode ${episodeNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f1a; color: #fff; padding: 40px; border-radius: 12px;">
        <h1 style="color: #e11d48; margin-bottom: 8px;">AnimeX</h1>
        <p>Hi ${username}, a new episode is available!</p>
        ${coverImage ? `<img src="${coverImage}" style="width: 100%; border-radius: 8px; margin: 16px 0;" />` : ''}
        <h2>${animeTitle}</h2>
        <p style="color: #aaa;">Episode ${episodeNumber}${episodeTitle ? ` — ${episodeTitle}` : ''}</p>
        <a href="${watchUrl}" style="display: inline-block; background: #e11d48; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">
          Watch Now
        </a>
      </div>
    `,
  }),
};

export async function sendEmail({ to, subject, template, data, html }) {
  try {
    const content = template && emailTemplates[template]
      ? emailTemplates[template](data)
      : { subject, html };

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'AnimeX <noreply@animex.tv>',
      to,
      subject: content.subject,
      html: content.html,
    });
  } catch (error) {
    console.error('Email send failed:', error.message);
    // Non-fatal — don't crash the app
  }
}
