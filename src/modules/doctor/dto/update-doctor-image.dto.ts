import { IsString, IsBoolean, IsNumber, IsOptional, IsEmail, IsInt } from 'class-validator';

export class UpdateDoctorImageDto {
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  imageFile?: string; // Jika ingin menyimpan data gambar dalam format base64
}