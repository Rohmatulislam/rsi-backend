import { Controller, Post, UseGuards, Logger } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('reminders')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ReminderController {
    private readonly logger = new Logger(ReminderController.name);

    constructor(private readonly reminderService: ReminderService) { }

    @Post('broadcast')
    async broadcastReminders() {
        this.logger.log('Manual trigger: broadcastReminders');
        // Run the reminder logic
        await this.reminderService.sendReminders();
        return {
            success: true,
            message: 'Reminder broadcast triggered successfully'
        };
    }
}
