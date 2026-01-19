import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { DoctorService } from '../../doctor/doctor.service';
import { CreateDoctorDto } from '../../doctor/dto/create-doctor.dto';
import { UpdateDoctorDto } from '../../doctor/dto/update-doctor.dto';
import { AllowAnonymous } from '../../../infra/auth/allow-anonymous.decorator'; // In production, this should be protected

@Controller('admin/doctors')
export class DoctorsController {
  constructor(private readonly doctorService: DoctorService) { }

  @Get()
  @AllowAnonymous()
  findAll(@Query() query: any) {
    return this.doctorService.findAll(query);
  }

  @Get(':id')
  @AllowAnonymous()
  findOne(@Param('id') id: string) {
    return this.doctorService.findOne(id);
  }

  @Post()
  @AllowAnonymous()
  create(@Body() createDoctorDto: CreateDoctorDto) {
    return this.doctorService.create(createDoctorDto);
  }

  @Put(':id')
  @AllowAnonymous()
  update(@Param('id') id: string, @Body() updateDoctorDto: UpdateDoctorDto) {
    return this.doctorService.update(id, updateDoctorDto);
  }

  @Delete(':id')
  @AllowAnonymous()
  remove(@Param('id') id: string) {
    return this.doctorService.remove(id);
  }
}