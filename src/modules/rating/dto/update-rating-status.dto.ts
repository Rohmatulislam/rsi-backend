import { IsEnum } from 'class-validator';
import { RatingStatus } from '@prisma/client';

export class UpdateRatingStatusDto {
    @IsEnum(RatingStatus)
    status: RatingStatus;
}
