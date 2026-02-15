import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PrismaModule } from '../../infra/database/prisma.module';

import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [PrismaModule, HttpModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule { }