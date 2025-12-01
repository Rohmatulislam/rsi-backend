import { isString, isUUID } from 'class-validator';

export class GetDoctorByIdDto {
  @isString()
  @isUUID()
  readonly id: string;
}
