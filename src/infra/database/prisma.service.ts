import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    const adapter = new PrismaPg(client);
    super({ adapter });
  }
}
