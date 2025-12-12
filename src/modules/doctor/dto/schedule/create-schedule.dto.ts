import { IsInt, IsString, IsNotEmpty, Min, Max } from 'class-validator';

export class CreateScheduleDto {
    @IsInt()
    @Min(0)
    @Max(6)
    dayOfWeek: number;

    @IsString()
    @IsNotEmpty()
    startTime: string; // HH:mm

    @IsString()
    @IsNotEmpty()
    endTime: string; // HH:mm
}
