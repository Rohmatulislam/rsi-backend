import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceDto } from './create-service.dto';
import { CreateServiceItemDto } from './create-service-item.dto';

export class UpdateServiceDto extends PartialType(CreateServiceDto) { }

export class UpdateServiceItemDto extends PartialType(CreateServiceItemDto) { }
