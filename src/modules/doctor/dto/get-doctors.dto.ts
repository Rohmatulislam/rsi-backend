import { IsEnum, IsNumber, IsOptional, Max, Min } from "class-validator";

export enum DoctorSortBy {
    RECOMMENDED = 'recommended',
}
export class GetDoctorsDto {
   @IsOptional()
   @IsNumber()
   @Min(1)
   @Max(100)
   limit?: number;

   @IsOptional()
   @IsEnum(DoctorSortBy)
   sort?: DoctorSortBy;


}