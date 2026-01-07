import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaService } from '../database/prisma.service';
import { bearer } from 'better-auth/plugins';
import * as nodemailer from 'nodemailer';

export const auth = betterAuth({
  database: prismaAdapter(new PrismaService(), {
    provider: 'postgresql',
  }),
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      // ... same logic
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const resetLink = url;
      const html = `<p>Halo ${user.name},</p><p>Anda meminta untuk mengatur ulang kata sandi. Silakan klik tautan di bawah ini:</p><p><a href="${resetLink}">${resetLink}</a></p><p>Jika Anda tidak meminta ini, abaikan email ini.</p>`;

      if (!process.env.EMAIL_HOST) {
        console.log('--- RESET PASSWORD EMAIL MOCK ---');
        console.log(`To: ${user.email}`);
        console.log(`Subject: Reset Password`);
        console.log(`Link: ${resetLink}`);
        console.log('---------------------------------');
        return;
      }

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'no-reply@rsi.com',
        to: user.email,
        subject: 'Atur Ulang Kata Sandi - RSI',
        html: html,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const verificationLink = url;
      const html = `<p>Halo ${user.name},</p><p>Terima kasih telah mendaftar. Silakan verifikasi email Anda dengan mengklik tautan di bawah ini:</p><p><a href="${verificationLink}">${verificationLink}</a></p>`;

      if (!process.env.EMAIL_HOST) {
        console.log('--- VERIFICATION EMAIL MOCK ---');
        console.log(`To: ${user.email}`);
        console.log(`Subject: Verifikasi Email`);
        console.log(`Link: ${verificationLink}`);
        console.log('-------------------------------');
        return;
      }

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'no-reply@rsi.com',
        to: user.email,
        subject: 'Verifikasi Email - RSI',
        html: html,
      });
    },
  },
  email: {
    from: process.env.EMAIL_FROM || 'no-reply@rsi.com',
    sendEmail: async ({ to, subject, body }) => {
      // Setup nodemailer transport
      // If SMTP details are missing, it will log to console (useful for dev)
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      if (!process.env.EMAIL_HOST) {
        console.log('--- EMAIL MOCK ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${body}`);
        console.log('------------------');
        return;
      }

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'no-reply@rsi.com',
        to,
        subject,
        html: body,
      });
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