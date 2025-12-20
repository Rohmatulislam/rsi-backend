import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { CreateServiceItemDto } from './dto/create-service-item.dto';
import { UpdateServiceDto, UpdateServiceItemDto } from './dto/update-service.dto';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('services')
export class ServiceController {
    constructor(private readonly serviceService: ServiceService) { }

    @Post()
    create(@Body() createServiceDto: CreateServiceDto) {
        return this.serviceService.create(createServiceDto);
    }

    @Post('seed')
    @AllowAnonymous()
    seed() {
        return this.serviceService.seedDefaultServices();
    }

    @Get()
    @AllowAnonymous()
    findAll() {
        return this.serviceService.findAll();
    }

    @Get(':slug')
    @AllowAnonymous()
    findOne(@Param('slug') slug: string) {
        return this.serviceService.findOneBySlug(slug);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateServiceDto: UpdateServiceDto) {
        return this.serviceService.update(id, updateServiceDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.serviceService.remove(id);
    }

    // ===========================================================================
    // Service Item Endpoints
    // ===========================================================================

    @Post('items')
    createItem(@Body() createItemDto: CreateServiceItemDto) {
        return this.serviceService.createItem(createItemDto);
    }

    @Patch('items/:id')
    updateItem(@Param('id') id: string, @Body() updateItemDto: UpdateServiceItemDto) {
        return this.serviceService.updateItem(id, updateItemDto);
    }

    @Delete('items/:id')
    removeItem(@Param('id') id: string) {
        return this.serviceService.removeItem(id);
    }

    @Get('items/:id')
    @AllowAnonymous()
    findItemById(@Param('id') id: string) {
        return this.serviceService.findItemById(id);
    }
}
