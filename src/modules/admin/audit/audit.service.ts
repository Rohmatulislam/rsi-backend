import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/database/prisma.service';

@Injectable()
export class AuditService {
    constructor(private prisma: PrismaService) { }

    async log(data: {
        userId: string;
        userEmail: string;
        action: string;
        resource: string;
        details?: string;
        ipAddress?: string;
    }) {
        return this.prisma.auditLog.create({
            data: {
                userId: data.userId,
                userEmail: data.userEmail,
                action: data.action,
                resource: data.resource,
                details: data.details,
                ipAddress: data.ipAddress,
            },
        });
    }

    async findAll(limit: number = 100) {
        return this.prisma.auditLog.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
        });
    }
}
