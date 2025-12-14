import { IsString, IsNotEmpty, IsDateString, IsEnum, IsOptional, IsEmail } from 'class-validator';

export class CreateAppointmentDto {
  @IsNotEmpty()
  @IsString()
  doctorId: string; // Bisa ID atau Kode Dokter Khanza if needed

  @IsNotEmpty()
  @IsDateString()
  bookingDate: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  bookingTime?: string; // HH:MM format - Optional for now

  @IsNotEmpty()
  @IsString()
  patientType: 'new' | 'old';

  @IsOptional()
  @IsString()
  patientName?: string;

  @IsOptional()
  @IsString()
  patientPhone?: string;

  @IsOptional()
  @IsEmail()
  patientEmail?: string;

  @IsOptional()
  @IsString()
  patientAddress?: string;

  @IsOptional()
  @IsString()
  mrNumber?: string; // For old patients

  @IsOptional()
  @IsString()
  nik?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsNotEmpty()
  @IsString()
  paymentType: string; // kd_pj dari Khanza (misalnya: "A01", "BPJ", dll)

  @IsOptional()
  @IsString()
  bpjsNumber?: string;

  @IsOptional()
  @IsString()
  keluhan?: string;

  // New patient fields
  @IsOptional()
  @IsDateString()
  birthDate?: string; // YYYY-MM-DD - Required for new patients

  @IsOptional()
  @IsString()
  gender?: 'L' | 'P'; // L = Laki-laki, P = Perempuan - Required for new patients

  @IsOptional()
  @IsString()
  poliId?: string; // ID poliklinik yang dipilih

  @IsOptional()
  @IsString()
  createdByUserId?: string; // ID user yang membuat booking (untuk tracking)
}
