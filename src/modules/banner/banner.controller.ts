import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
} from '@nestjs/common';
import { BannerService } from './banner.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('banners')
export class BannerController {
    constructor(private readonly bannerService: BannerService) { }

    @Post()
    create(@Body() createBannerDto: CreateBannerDto) {
        return this.bannerService.create(createBannerDto);
    }

    @Get()
    findAll() {
        return this.bannerService.findAll();
    }

    @Get('active')
    @AllowAnonymous()
    findActive() {
        return this.bannerService.findActive();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.bannerService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateBannerDto: UpdateBannerDto) {
        return this.bannerService.update(id, updateBannerDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.bannerService.remove(id);
    }

    @Patch('reorder/bulk')
    reorder(@Body() orders: { id: string; order: number }[]) {
        return this.bannerService.reorder(orders);
    }
}
