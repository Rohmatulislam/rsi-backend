import { IsBoolean, IsEnum, IsNumber, IsOptional, Max, Min } from "class-validator";
import { Transform } from "class-transformer";

export enum DoctorSortBy {
    RECOMMENDED = 'recommended',
}
export class GetDoctorsDto {
    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => Number(value))
    @Min(1)
    @Max(1000)
    limit?: number;

    @IsOptional()
    @IsEnum(DoctorSortBy)
    sort?: DoctorSortBy;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return value;
    })
    isExecutive?: boolean;
}