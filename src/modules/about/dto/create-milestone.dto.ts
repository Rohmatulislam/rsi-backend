import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateMilestoneDto {
    @IsString()
    year: string;

    @IsString()
    title: string;

    @IsString()
    description: string;

    @IsString()
    @IsOptional()
    icon?: string; // Lucide icon name

    @IsBoolean()
    @IsOptional()
    highlight?: boolean;

    @IsNumber()
    @IsOptional()
    order?: number;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
