import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsUrl } from 'class-validator';

export class CreatePartnerDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    imageUrl: string;

    @IsString()
    @IsOptional()
    @IsUrl()
    link?: string;

    @IsInt()
    @IsOptional()
    order?: number;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
