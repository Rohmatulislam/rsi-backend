import { IsString, IsOptional, MinLength } from 'class-validator';

export class UpdateProfileDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    image?: string; // Base64 atau URL

    @IsString()
    @IsOptional()
    nik?: string;
}

export class ChangePasswordDto {
    @IsString()
    @MinLength(1)
    currentPassword: string;

    @IsString()
    @MinLength(8)
    newPassword: string;
}

export class CreateFamilyMemberDto {
    @IsString()
    name: string;

    @IsString()
    relationship: string; // "spouse", "child", "parent", "sibling", "other"

    @IsString()
    @IsOptional()
    nik?: string;

    @IsString()
    @IsOptional()
    birthDate?: string;

    @IsString()
    @IsOptional()
    gender?: string; // "L" | "P"

    @IsString()
    @IsOptional()
    phone?: string;
}
