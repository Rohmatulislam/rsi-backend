import { Controller, Get, Param } from '@nestjs/common';
import { RehabilitationService } from './rehabilitation.service';

@Controller('rehabilitation')
export class RehabilitationController {
    constructor(private readonly rehabilitationService: RehabilitationService) { }

    @Get('progress/:identifier')
    async getRehabProgress(@Param('identifier') identifier: string) {
        return this.rehabilitationService.getRehabProgress(identifier);
    }
}
