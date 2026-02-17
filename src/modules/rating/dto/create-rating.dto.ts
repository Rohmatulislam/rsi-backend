import { IsString, IsInt, IsOptional, IsEnum, Min, Max } from 'class-validator';

export class CreateRatingDto {
    @IsString()
    doctorId: string;

    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @IsString()
    @IsOptional()
    comment?: string;
}
