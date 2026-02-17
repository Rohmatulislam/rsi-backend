import { IsString, IsOptional, IsEnum } from 'class-validator';
import { RatingStatus } from '@prisma/client';

export class GetRatingsDto {
    @IsString()
    @IsOptional()
    doctorId?: string;

    @IsEnum(RatingStatus)
    @IsOptional()
    status?: RatingStatus;
}
