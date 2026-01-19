import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Post('message')
    @AllowAnonymous()
    async handleMessage(@Body('message') message: string) {
        const response = await this.chatService.processMessage(message);
        return { response };
    }
}
