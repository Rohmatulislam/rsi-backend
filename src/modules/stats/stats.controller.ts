import { Controller, Get, Post } from '@nestjs/common';
import { StatsService } from './stats.service';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';

@Controller('stats')
export class StatsController {
    constructor(private readonly statsService: StatsService) { }

    /**
     * Get current site statistics including visitor count
     */
    @Get()
    @AllowAnonymous()
    async getStats() {
        return this.statsService.getAllStats();
    }

    /**
     * Get visitor count only
     */
    @Get('visitors')
    @AllowAnonymous()
    async getVisitorCount() {
        const count = await this.statsService.getVisitorCount();
        return { visitorCount: count };
    }

    /**
     * Track a new visit - increments visitor count
     * Called when a user visits the site
     */
    @Post('track-visit')
    @AllowAnonymous()
    async trackVisit() {
        const newCount = await this.statsService.incrementVisitorCount();
        return {
            success: true,
            visitorCount: newCount,
        };
    }
}
