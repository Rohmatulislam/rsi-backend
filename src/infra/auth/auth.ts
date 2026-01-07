import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaService } from '../database/prisma.service';
import { bearer } from 'better-auth/plugins';
import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);
const emailFrom = process.env.EMAIL_FROM || 'RSI Hospital <onboarding@resend.dev>';

// Helper function to send email via Resend
async function sendEmailViaResend(to: string, subject: string, html: string) {
  console.log('[RESEND] Sending email to:', to);
  console.log('[RESEND] API Key exists:', !!process.env.RESEND_API_KEY);

  if (!process.env.RESEND_API_KEY) {
    console.log('--- EMAIL MOCK (No API Key) ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML: ${html}`);
    console.log('-------------------------------');
    return;
  }

  try {
    const result = await resend.emails.send({
      from: emailFrom,
      to: [to],
      subject: subject,
      html: html,
    });
    console.log('[RESEND] Email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('[RESEND ERROR]', error);
    throw error;
  }
}

export const auth = betterAuth({
  database: prismaAdapter(new PrismaService(), {
    provider: 'postgresql',
  }),
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const html = `<p>Halo ${user.name},</p><p>Anda meminta untuk mengatur ulang kata sandi. Silakan klik tautan di bawah ini:</p><p><a href="${url}">${url}</a></p><p>Jika Anda tidak meminta ini, abaikan email ini.</p>`;
      await sendEmailViaResend(user.email, 'Atur Ulang Kata Sandi - RSI', html);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      const html = `<p>Halo ${user.name},</p><p>Terima kasih telah mendaftar. Silakan verifikasi email Anda dengan mengklik tautan di bawah ini:</p><p><a href="${url}">${url}</a></p>`;
      await sendEmailViaResend(user.email, 'Verifikasi Email - RSI', html);
    },
  },
  email: {
    from: emailFrom,
    sendEmail: async ({ to, subject, body }) => {
      await sendEmailViaResend(to, subject, body);
    },
  },
  trustedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [],
  user: {
    // Menambahkan field tambahan untuk sistem rumah sakit
    additionalFields: {
      role: {
        type: 'string',
        required: false, // Tidak wajib dulu
        defaultValue: 'user' // Default role
      },
      licenseNumber: {
        type: 'string',
        required: false // Hanya untuk dokter
      }
    }
  },
  plugins: [
    bearer(),
  ],
});