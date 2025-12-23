import { IsString, IsOptional, IsBoolean, IsEnum, IsInt } from 'class-validator';
import { CategoryType } from '@prisma/client';

export class CreateCategoryDto {
    @IsString()
    name: string;

    @IsString()
    slug: string;

    @IsEnum(CategoryType)
    type: CategoryType;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    icon?: string;

    @IsOptional()
    @IsString()
    color?: string;

    @IsOptional()
    @IsInt()
    order?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
