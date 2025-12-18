import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaService } from '../database/prisma.service';
import { bearer } from 'better-auth/plugins';

export const auth = betterAuth({
  database: prismaAdapter(new PrismaService(), {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Nonaktifkan dulu untuk development
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