import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaService } from '../database/prisma.service';

// Inisialisasi PrismaService untuk digunakan dengan better-auth
const prismaService = new PrismaService();

export const auth = betterAuth({
  database: prismaAdapter(prismaService, {
    provider: 'postgresql',
  }),
});
