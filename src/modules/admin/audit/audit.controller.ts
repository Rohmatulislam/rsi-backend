import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('admin/logs')
@UseGuards(AdminGuard)
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Get()
    findAll(@Query('limit') limit?: string) {
        return this.auditService.findAll(limit ? parseInt(limit) : 100);
    }
}
