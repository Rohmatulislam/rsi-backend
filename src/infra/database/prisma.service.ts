import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Prefer DATABASE_URL for pooled connections, fallback to DIRECT_URL
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

// Limit pool size in development to avoid "MaxClientsInSessionMode" error
const pool = connectionString ? new Pool({
  connectionString,
  max: 2, // Low limit for dev to prevent exhaustion
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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


