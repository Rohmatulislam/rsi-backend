import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DoctorService } from './doctor.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { GetDoctorByIdDto } from './dto/get-doctor-by-id.dto';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { GetDoctorsDto } from './dto/get-doctors.dto';
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('doctors')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) { }

  @Get('active-poli')
  @AllowAnonymous()
  async getPoliklinikWithActiveSchedules() {
    return await this.doctorService.getPoliklinikWithActiveSchedules();
  }

  @Get('payment-methods')
  @AllowAnonymous()
  async getPaymentMethods() {
    return await this.doctorService.getPaymentMethods();
  }

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
  @UseGuards(AdminGuard)
  create(@Body() createDoctorDto: CreateDoctorDto) {
    return this.doctorService.create(createDoctorDto);
  }

  @Post('sync')
  @AllowAnonymous() // For now allow anonymous or secure it
  sync() {
    return this.doctorService.syncDoctors();
  }


  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() updateDoctorDto: UpdateDoctorDto) {
    return this.doctorService.update(id, updateDoctorDto);
  }

  @Patch(':id/image')
  @UseGuards(AdminGuard)
  updateImage(@Param('id') id: string, @Body('imageUrl') imageUrl: string) {
    return this.doctorService.updateDoctorImage(id, imageUrl);
  }

  @Post(':id/upload-image')
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('image', {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
      // Hanya izinkan file gambar
      if (!file.mimetype.startsWith('image/')) {
        cb(new Error('File harus berupa gambar'), false);
        return;
      }
      cb(null, true);
    },
  }))
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body('base64Image') base64Image: string
  ) {
    if (base64Image) {
      // Jika base64Image dikirim, gunakan itu
      return this.doctorService.updateDoctorImage(id, base64Image);
    } else if (file) {
      // Jika file diupload, konversi ke base64
      const imageData = `data:image/${file.mimetype.split('/')[1]};base64,${file.buffer.toString('base64')}`;
      return this.doctorService.updateDoctorImage(id, imageData);
    } else {
      throw new Error('Tidak ada gambar yang dikirim');
    }
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.doctorService.remove(id);
  }

  @Post(':id/schedules')
  @UseGuards(AdminGuard)
  addSchedule(@Param('id') id: string, @Body() createScheduleDto: any) {
    return this.doctorService.addSchedule(id, createScheduleDto);
  }

  @Patch('schedules/:id')
  @UseGuards(AdminGuard)
  updateSchedule(@Param('id') id: string, @Body() updateScheduleDto: any) {
    return this.doctorService.updateSchedule(id, updateScheduleDto);
  }

  @Delete('schedules/:id')
  @UseGuards(AdminGuard)
  removeSchedule(@Param('id') id: string) {
    return this.doctorService.removeSchedule(id);
  }
}
