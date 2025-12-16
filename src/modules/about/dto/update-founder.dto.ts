import { PartialType } from '@nestjs/mapped-types';
import { CreateFounderDto } from './create-founder.dto';

export class UpdateFounderDto extends PartialType(CreateFounderDto) { }
