import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatService } from './chat.service';
import { PrismaService } from '../../infra/database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { KnowledgeBaseService } from './knowledge-base.service';
import { LabService } from '../lab/lab.service';
import { RadiologiService } from '../radiologi/radiologi.service';
import * as fs from 'fs';
import * as path from 'path';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('ai-admin')
export class AIController {
    private readonly logger = new Logger(AIController.name);

    constructor(
        private readonly chatService: ChatService,
        private readonly prisma: PrismaService,
        private readonly kbService: KnowledgeBaseService,
        private readonly labService: LabService,
        private readonly radiologiService: RadiologiService
    ) { }

    @Get('settings')
    async getSettings() {
        const prompt = await this.prisma.aboutContent.findUnique({
            where: { key: 'ai_system_prompt' }
        });

        // MCU file info
        const csvPath = path.join(process.cwd(), 'Paket MCU 2026.csv');
        const fileExists = fs.existsSync(csvPath);
        const stats = fileExists ? fs.statSync(csvPath) : null;

        return {
            prompt: prompt?.value || '',
            mcuFile: fileExists ? {
                name: 'Paket MCU 2026.csv',
                updatedAt: stats?.mtime,
                size: stats?.size
            } : null
        };
    }

    @Patch('prompt')
    async updatePrompt(@Body('value') value: string) {
        await this.prisma.aboutContent.upsert({
            where: { key: 'ai_system_prompt' },
            update: { value },
            create: { key: 'ai_system_prompt', value }
        });

        await this.chatService.reloadPrompt();
        return { success: true };
    }

    @Post('upload-mcu')
    @UseInterceptors(FileInterceptor('file'))
    async uploadMCU(@UploadedFile() file: any) {
        if (!file) throw new BadRequestException('No file uploaded');

        // Path logic matches KnowledgeBaseService
        const csvPath = path.join(process.cwd(), 'Paket MCU 2026.csv');

        try {
            fs.writeFileSync(csvPath, file.buffer);
            this.logger.log(`MCU CSV updated by admin: ${file.size} bytes`);
            return { success: true };
        } catch (error) {
            this.logger.error('Failed to save MCU CSV:', error);
            throw new BadRequestException('Failed to save file');
        }
    }

    @Get('treatments')
    async getTreatments() {
        return this.prisma.treatmentMetadata.findMany({
            orderBy: { treatmentId: 'asc' }
        });
    }

    @Post('treatments')
    async createTreatment(@Body() data: any) {
        return this.prisma.treatmentMetadata.create({
            data: {
                treatmentId: data.treatmentId,
                description: data.description,
                preparation: data.preparation,
                type: data.type,
                estimatedTime: data.estimatedTime,
                isPopular: data.isPopular || false
            }
        });
    }

    @Patch('treatments/:id')
    async updateTreatment(@Param('id') id: string, @Body() data: any) {
        return this.prisma.treatmentMetadata.update({
            where: { id },
            data: {
                description: data.description,
                preparation: data.preparation,
                type: data.type,
                estimatedTime: data.estimatedTime,
                isPopular: data.isPopular
            }
        });
    }

    @Delete('treatments/:id')
    async deleteTreatment(@Param('id') id: string) {
        return this.prisma.treatmentMetadata.delete({
            where: { id }
        });
    }

    @Get('logs')
    async getLogs() {
        return (this.prisma as any).chatMessage.groupBy({
            by: ['sessionId'],
            _count: { id: true },
            _max: { createdAt: true },
            orderBy: { _max: { createdAt: 'desc' } },
            take: 50
        });
    }

    @Get('session/:sessionId')
    async getSessionMessages(@Param('sessionId') sessionId: string) {
        return (this.prisma as any).chatMessage.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' }
        });
    }

    @Post('test')
    async testPrompt(@Body('prompt') prompt: string, @Body('message') message: string) {
        try {
            // This is a stateless test call with custom prompt
            // We'll use the same KnowledgeBase context to make it realistic
            const [rsContext, mcuContext] = await Promise.all([
                this.kbService.getHospitalContext(),
                this.kbService.getMCUPackagesContext()
            ]);

            const combinedContext = `[KNOWLEDGE_BASE]\n${rsContext}\n${mcuContext}\n`;

            // We need a temporary model instance with the test prompt
            const apiKey = process.env.GEMINI_API_KEY;
            const genAI = new GoogleGenerativeAI(apiKey!);
            const testModel = genAI.getGenerativeModel({
                model: 'gemini-flash-latest',
                systemInstruction: prompt,
            });

            const promptWithContext = `${combinedContext}\n\nUser: ${message}`;
            const result = await testModel.generateContent(promptWithContext);
            return { response: result.response.text() };
        } catch (error) {
            this.logger.error('AI Test failed:', error);
            throw new BadRequestException('AI Test failed: ' + error.message);
        }
    }

    @Get('search-services')
    async searchServices(@Query('q') query: string) {
        const [labTests, radTests] = await Promise.all([
            this.labService.getTests(),
            this.radiologiService.getTests()
        ]);

        const q = (query || '').toLowerCase();

        const results = [
            ...labTests.map((t: any) => ({ id: t.id, name: t.name, type: 'LAB' })),
            ...radTests.map((t: any) => ({ id: t.id, name: t.name, type: 'RADIOLOGY' }))
        ].filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.id.toLowerCase().includes(q)
        ).slice(0, 20);

        return results;
    }

    @Get('analytics')
    async getAnalytics() {
        const [totalMessages, totalFeedbacks, feedbacks] = await Promise.all([
            (this.prisma as any).chatMessage.count({ where: { role: 'user' } }),
            (this.prisma as any).chatFeedback.count(),
            (this.prisma as any).chatFeedback.findMany()
        ]);

        // Simple topic detection based on keywords in recent messages
        const recentUserMessages = await (this.prisma as any).chatMessage.findMany({
            where: { role: 'user' },
            take: 200,
            orderBy: { createdAt: 'desc' }
        });

        const topicCounts: Record<string, number> = {
            'Dokter & Jadwal': 0,
            'MCU': 0,
            'Lab & Radiologi': 0,
            'Darurat/SOS': 0,
            'Lainnya': 0
        };

        recentUserMessages.forEach((msg: any) => {
            const content = msg.content.toLowerCase();
            if (content.includes('dokter') || content.includes('jadwal') || content.includes('spesialis')) {
                topicCounts['Dokter & Jadwal']++;
            } else if (content.includes('mcu') || content.includes('medical check up')) {
                topicCounts['MCU']++;
            } else if (content.includes('lab') || content.includes('darah') || content.includes('rontgen') || content.includes('radiologi')) {
                topicCounts['Lab & Radiologi']++;
            } else if (content.includes('sesak') || content.includes('nyeri') || content.includes('gawat') || content.includes('darurat')) {
                topicCounts['Darurat/SOS']++;
            } else {
                topicCounts['Lainnya']++;
            }
        });

        const topics = Object.entries(topicCounts).map(([name, value]) => ({ name, value }));

        const ratingAvg = feedbacks.length > 0
            ? feedbacks.reduce((acc: number, curr: any) => acc + curr.rating, 0) / feedbacks.length
            : 0;

        return {
            totalMessages,
            totalFeedbacks,
            averageRating: ratingAvg,
            topicTrends: topics,
            recentFeedback: feedbacks.slice(0, 10).map((f: any) => ({
                id: f.id,
                rating: f.rating,
                createdAt: f.createdAt
            }))
        };
    }
}
