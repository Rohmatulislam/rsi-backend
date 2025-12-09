import { IsEnum, IsNumber, IsOptional, Max, Min } from "class-validator";
import { Transform } from "class-transformer";

export enum DoctorSortBy {
    RECOMMENDED = 'recommended',
}
export class GetDoctorsDto {
   @IsOptional()
   @IsNumber()
   @Transform(({ value }) => Number(value))
   @Min(1)
   @Max(100)
   limit?: number;

   @IsOptional()
   @IsEnum(DoctorSortBy)
   sort?: DoctorSortBy;


}