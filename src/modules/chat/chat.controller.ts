import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Post('message')
    @AllowAnonymous()
    async handleMessage(
        @Body('message') message: string,
        @Body('sessionId') sessionId?: string,
    ) {
        const response = await this.chatService.processMessage(message, sessionId);
        return { response };
    }

    @Get('history/:sessionId')
    @AllowAnonymous()
    async getHistory(@Param('sessionId') sessionId: string) {
        const history = await this.chatService.getHistory(sessionId);
        return history;
    }

    @Get('sessions/:userId')
    @AllowAnonymous()
    async getSessions(@Param('userId') userId: string) {
        const sessions = await this.chatService.getSessions(userId);
        return sessions;
    }

    @Post('rate')
    @AllowAnonymous()
    async rateMessage(
        @Body('messageId') messageId: string,
        @Body('rating') rating: number,
        @Body('comment') comment?: string,
    ) {
        return this.chatService.rateMessage(messageId, rating, comment);
    }
}
