import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { TreatmentMetadataService } from './treatment-metadata.service';

@Controller('treatment-metadata')
export class TreatmentMetadataController {
    constructor(private readonly service: TreatmentMetadataService) { }

    @Get()
    async findAll() {
        return this.service.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }

    @Post()
    async upsert(@Body() data: any) {
        return this.service.upsert(data);
    }
}
