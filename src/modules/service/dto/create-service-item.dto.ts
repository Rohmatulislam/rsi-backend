import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateServiceItemDto {
    @IsString()
    serviceId: string;

    @IsOptional()
    @IsString()
    category?: string;

    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    price?: number;

    @IsOptional()
    @IsString()
    features?: string;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsNumber()
    order?: number;
}
