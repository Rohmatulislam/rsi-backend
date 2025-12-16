import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateFounderDto {
    @IsString()
    name: string;

    @IsString()
    role: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    image?: string; // Base64 atau URL

    @IsString()
    @IsOptional()
    badge?: string;

    @IsNumber()
    @IsOptional()
    order?: number;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
