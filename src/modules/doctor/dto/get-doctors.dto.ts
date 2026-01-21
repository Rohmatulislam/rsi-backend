import { IsBoolean, IsOptional, IsEnum, IsInt } from 'class-validator';
import { Transform } from 'class-transformer';

export enum DoctorSortBy {
    RECOMMENDED = "recommended",
}

export class GetDoctorsDto {
    @IsOptional()
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    limit?: number = 10;

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

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return value;
    })
    showAll?: boolean;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return value;
    })
    includeInactive?: boolean;

    @IsOptional()
    poliCode?: string;
}
