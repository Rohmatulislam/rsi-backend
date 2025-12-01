import { IsString, IsUUID } from 'class-validator';

export class GetDoctorByIdDto {
  @IsString()
  @IsUUID()
  readonly id: string;
}
