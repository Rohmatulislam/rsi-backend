import { Module } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { NotificationModule } from '../notification/notification.module';
import { PrismaModule } from '../../infra/database/prisma.module';

@Module({
  imports: [NotificationModule, PrismaModule],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class ReminderModule {}