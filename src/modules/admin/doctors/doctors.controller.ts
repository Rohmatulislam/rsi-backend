import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DoctorService } from '../../doctor/doctor.service';
import { CreateDoctorDto } from '../../doctor/dto/create-doctor.dto';
import { UpdateDoctorDto } from '../../doctor/dto/update-doctor.dto';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('admin/doctors')
@UseGuards(AdminGuard)
export class DoctorsController {
  constructor(private readonly doctorService: DoctorService) { }

  @Get()
  findAll(@Query() query: any) {
    return this.doctorService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.doctorService.findOne(id);
  }

  @Post()
  create(@Body() createDoctorDto: CreateDoctorDto) {
    return this.doctorService.create(createDoctorDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDoctorDto: UpdateDoctorDto) {
    return this.doctorService.update(id, updateDoctorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.doctorService.remove(id);
  }
}