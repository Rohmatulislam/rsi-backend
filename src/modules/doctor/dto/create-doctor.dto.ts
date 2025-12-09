import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';

export class CreateDoctorDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsString()
  licenseNumber: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
