import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';

const VISITOR_COUNT_KEY = 'visitor_count';

@Injectable()
export class StatsService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get current visitor count
     */
    async getVisitorCount(): Promise<number> {
        try {
            const stats = await this.prisma.siteStats.findUnique({
                where: { key: VISITOR_COUNT_KEY },
            });
            return stats?.value ?? 0;
        } catch (error) {
            console.error('Error fetching visitor count (possibly missing table):', error.message);
            return 0;
        }
    }

    /**
     * Increment visitor count by 1
     */
    async incrementVisitorCount(): Promise<number> {
        try {
            const stats = await this.prisma.siteStats.upsert({
                where: { key: VISITOR_COUNT_KEY },
                create: {
                    key: VISITOR_COUNT_KEY,
                    value: 1,
                    lastUpdated: new Date(),
                },
                update: {
                    value: { increment: 1 },
                    lastUpdated: new Date(),
                },
            });
            return stats.value;
        } catch (error) {
            console.error('Error incrementing visitor count (possibly missing table):', error.message);
            return 0;
        }
    }

    /**
     * Get all site statistics
     */
    async getAllStats() {
        const visitorCount = await this.getVisitorCount();

        // Could add more stats here in the future
        return {
            visitorCount,
            lastUpdated: new Date().toISOString(),
        };
    }
}
