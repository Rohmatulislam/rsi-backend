import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateServiceDto {
    @IsString()
    name: string;

    @IsString()
    slug: string;

    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    subtitle?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    icon?: string;

    @IsOptional()
    @IsString()
    image?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsBoolean()
    isFeatured?: boolean;

    @IsOptional()
    @IsNumber()
    order?: number;
}
