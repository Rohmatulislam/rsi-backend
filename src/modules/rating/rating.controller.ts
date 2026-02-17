import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { RatingService } from './rating.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { UpdateRatingStatusDto } from './dto/update-rating-status.dto';
import { GetRatingsDto } from './dto/get-ratings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';

@Controller('ratings')
@UseGuards(JwtAuthGuard)
export class RatingController {
    constructor(private readonly ratingService: RatingService) { }

    @Post()
    create(@Request() req, @Body() createRatingDto: CreateRatingDto) {
        return this.ratingService.create(req.user.id, createRatingDto);
    }

    @Get()
    @AllowAnonymous()
    findAll(@Query() query: GetRatingsDto) {
        return this.ratingService.findAll(query);
    }

    @Get('average/:doctorId')
    @AllowAnonymous()
    getAverage(@Param('doctorId') doctorId: string) {
        return this.ratingService.getAverageRating(doctorId);
    }

    @Patch(':id/status')
    @UseGuards(AdminGuard)
    updateStatus(
        @Param('id') id: string,
        @Body() updateDto: UpdateRatingStatusDto,
    ) {
        return this.ratingService.updateStatus(id, updateDto);
    }

    @Delete(':id')
    @UseGuards(AdminGuard)
    remove(@Param('id') id: string) {
        return this.ratingService.remove(id);
    }
}
