import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Prefer DATABASE_URL for pooled connections, fallback to DIRECT_URL
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

// Adjust pool size based on environment
const isProduction = process.env.NODE_ENV === 'production';
const pool = connectionString ? new Pool({
  connectionString,
  max: isProduction ? 15 : 5, // Increased from 2 to 5 for dev
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased from 5000 to 10000 ms
}) : null;
const adapter = pool ? new PrismaPg(pool) : undefined;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter } as any);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}


