import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { DoctorModule } from '../doctor/doctor.module';
import { PrismaModule } from '../../infra/database/prisma.module';

@Module({
    imports: [DoctorModule, PrismaModule],
    providers: [ChatService],
    controllers: [ChatController],
})
export class ChatModule { }
