import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AboutService } from './about.service';
import { CreateFounderDto } from './dto/create-founder.dto';
import { UpdateFounderDto } from './dto/update-founder.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('about')
export class AboutController {
    constructor(private readonly aboutService: AboutService) { }

    // ========================
    // FOUNDER ENDPOINTS
    // ========================

    @Post('founders')
    @UseGuards(AdminGuard)
    createFounder(@Body() createFounderDto: CreateFounderDto) {
        return this.aboutService.createFounder(createFounderDto);
    }

    @Get('founders')
    @AllowAnonymous()
    findAllFounders() {
        return this.aboutService.findAllFounders();
    }

    @Get('founders/:id')
    @AllowAnonymous()
    findOneFounder(@Param('id') id: string) {
        return this.aboutService.findOneFounder(id);
    }

    @Patch('founders/:id')
    @UseGuards(AdminGuard)
    updateFounder(@Param('id') id: string, @Body() updateFounderDto: UpdateFounderDto) {
        return this.aboutService.updateFounder(id, updateFounderDto);
    }

    @Delete('founders/:id')
    @UseGuards(AdminGuard)
    removeFounder(@Param('id') id: string) {
        return this.aboutService.removeFounder(id);
    }

    // ========================
    // MILESTONE ENDPOINTS
    // ========================

    @Post('milestones')
    @UseGuards(AdminGuard)
    createMilestone(@Body() createMilestoneDto: CreateMilestoneDto) {
        return this.aboutService.createMilestone(createMilestoneDto);
    }

    @Get('milestones')
    @AllowAnonymous()
    findAllMilestones() {
        return this.aboutService.findAllMilestones();
    }

    @Get('milestones/:id')
    @AllowAnonymous()
    findOneMilestone(@Param('id') id: string) {
        return this.aboutService.findOneMilestone(id);
    }

    @Patch('milestones/:id')
    @UseGuards(AdminGuard)
    updateMilestone(@Param('id') id: string, @Body() updateMilestoneDto: UpdateMilestoneDto) {
        return this.aboutService.updateMilestone(id, updateMilestoneDto);
    }

    @Delete('milestones/:id')
    @UseGuards(AdminGuard)
    removeMilestone(@Param('id') id: string) {
        return this.aboutService.removeMilestone(id);
    }

    // ========================
    // ABOUT CONTENT ENDPOINTS
    // ========================

    @Get('content')
    @AllowAnonymous()
    findAllAboutContent() {
        return this.aboutService.findAllAboutContent();
    }

    @Get('content/:key')
    @AllowAnonymous()
    findAboutContentByKey(@Param('key') key: string) {
        return this.aboutService.findAboutContentByKey(key);
    }

    @Patch('content/:key')
    @UseGuards(AdminGuard)
    updateAboutContent(@Param('key') key: string, @Body('value') value: string) {
        return this.aboutService.upsertAboutContent(key, value);
    }

    @Post('content/initialize')
    @UseGuards(AdminGuard)
    initializeAboutContent() {
        return this.aboutService.initializeAboutContent();
    }

    // ========================
    // CORE VALUE ENDPOINTS
    // ========================

    @Get('values')
    @AllowAnonymous()
    findAllCoreValues() {
        return this.aboutService.findAllCoreValues();
    }

    @Get('values/:id')
    @AllowAnonymous()
    findOneCoreValue(@Param('id') id: string) {
        return this.aboutService.findOneCoreValue(id);
    }

    @Patch('values/:id')
    @UseGuards(AdminGuard)
    updateCoreValue(@Param('id') id: string, @Body() data: { title?: string; description?: string; icon?: string }) {
        return this.aboutService.updateCoreValue(id, data);
    }

    @Post('values/initialize')
    @UseGuards(AdminGuard)
    initializeCoreValues() {
        return this.aboutService.initializeCoreValues();
    }
}

