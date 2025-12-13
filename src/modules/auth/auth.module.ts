import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../infra/database/prisma.service';

@Module({
  providers: [AuthService, PrismaService],
  exports: [AuthService],
})
export class AuthModule {}