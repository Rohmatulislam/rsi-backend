import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Post('message')
    @AllowAnonymous()
    async handleMessage(@Body('message') message: string) {
        const response = await this.chatService.processMessage(message);
        return { response };
    }
}
