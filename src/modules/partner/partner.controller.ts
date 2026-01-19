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
import { PartnerService } from './partner.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('partners')
export class PartnerController {
    constructor(private readonly partnerService: PartnerService) { }

    @Post()
    @UseGuards(AdminGuard)
    create(@Body() createPartnerDto: CreatePartnerDto) {
        return this.partnerService.create(createPartnerDto);
    }

    @Get()
    @UseGuards(AdminGuard)
    findAll() {
        return this.partnerService.findAll();
    }

    @Get('active')
    @AllowAnonymous()
    findActive() {
        return this.partnerService.findActive();
    }

    @Get(':id')
    @UseGuards(AdminGuard)
    findOne(@Param('id') id: string) {
        return this.partnerService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(AdminGuard)
    update(@Param('id') id: string, @Body() updatePartnerDto: UpdatePartnerDto) {
        return this.partnerService.update(id, updatePartnerDto);
    }

    @Delete(':id')
    @UseGuards(AdminGuard)
    remove(@Param('id') id: string) {
        return this.partnerService.remove(id);
    }

    @Patch('reorder/bulk')
    @UseGuards(AdminGuard)
    reorder(@Body() orders: { id: string; order: number }[]) {
        return this.partnerService.reorder(orders);
    }
}
