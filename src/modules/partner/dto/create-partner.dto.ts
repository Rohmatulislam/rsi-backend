import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsUrl, ValidateIf } from 'class-validator';

export class CreatePartnerDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    imageUrl: string;

    @IsString()
    @IsOptional()
    @ValidateIf((o) => o.link !== "" && o.link !== null && o.link !== undefined)
    @IsUrl({}, { message: 'Link must be a valid URL' })
    link?: string;

    @IsInt()
    @IsOptional()
    order?: number;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
