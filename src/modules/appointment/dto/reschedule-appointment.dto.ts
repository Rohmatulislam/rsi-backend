import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';

export class RescheduleAppointmentDto {
    @IsNotEmpty()
    @IsDateString()
    newDate: string; // YYYY-MM-DD

    @IsOptional()
    @IsString()
    newTime?: string; // HH:MM format
}
