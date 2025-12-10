import { IsString, IsNotEmpty, IsDateString, IsEnum, IsOptional } from 'class-validator';

export class CreateAppointmentDto {
  @IsNotEmpty()
  @IsString()
  doctorId: string; // Bisa ID atau Kode Dokter Khanza if needed

  @IsNotEmpty()
  @IsDateString()
  bookingDate: string; // YYYY-MM-DD

  @IsNotEmpty()
  @IsString()
  patientType: 'new' | 'old';

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
  paymentType: 'umum' | 'bpjs';

  @IsOptional()
  @IsString()
  bpjsNumber?: string;
}
