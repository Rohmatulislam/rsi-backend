import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AIController } from './ai.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { DoctorModule } from '../doctor/doctor.module';
import { PrismaModule } from '../../infra/database/prisma.module';
import { LabModule } from '../lab/lab.module';
import { RadiologiModule } from '../radiologi/radiologi.module';

@Module({
    imports: [DoctorModule, PrismaModule, LabModule, RadiologiModule],
    providers: [ChatService, KnowledgeBaseService],
    controllers: [ChatController, AIController],
})
export class ChatModule { }
