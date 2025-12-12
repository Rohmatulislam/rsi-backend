import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PrismaModule } from '../../infra/database/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}