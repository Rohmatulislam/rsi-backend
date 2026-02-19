import { Module } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { ReminderController } from './reminder.controller';
import { NotificationModule } from '../notification/notification.module';
import { PrismaModule } from '../../infra/database/prisma.module';

@Module({
  imports: [NotificationModule, PrismaModule],
  controllers: [ReminderController],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class ReminderModule { }