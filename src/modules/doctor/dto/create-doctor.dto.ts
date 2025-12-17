import { IsString, IsBoolean, IsNumber, IsOptional, IsEmail, IsInt } from 'class-validator';

export class CreateDoctorDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  licenseNumber: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  specialization?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsOptional()
  @IsInt()
  experience_years?: number;

  @IsString()
  @IsOptional()
  education?: string;

  @IsString()
  @IsOptional()
  certifications?: string;

  @IsOptional()
  @IsNumber()
  consultation_fee?: number;

  @IsString()
  @IsOptional()
  specialtyImage_url?: string;

  @IsBoolean()
  @IsOptional()
  is_executive?: boolean;

  @IsString()
  @IsOptional()
  sip_number?: string;

  @IsBoolean()
  @IsOptional()
  bpjs?: boolean;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  kd_dokter?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}