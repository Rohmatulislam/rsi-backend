import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { GetDoctorByIdDto } from './dto/get-doctor-by-id.dto';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { GetDoctorsDto } from './dto/get-doctors.dto';

@Controller('doctors')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @Get()
  @AllowAnonymous()
  findAll(@Query() getDoctorsDto: GetDoctorsDto) {
    return this.doctorService.findAll(getDoctorsDto);
  }

  @Get(':slug')
  @AllowAnonymous()
  findBySlug(@Param('slug') slug: string) {
    return this.doctorService.findBySlug(slug);
  }
  @Post()
  create(@Body() createDoctorDto: CreateDoctorDto) {
    return this.doctorService.create(createDoctorDto);
  }


  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDoctorDto: UpdateDoctorDto) {
    return this.doctorService.update(id, updateDoctorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.doctorService.remove(id);
  }
}
