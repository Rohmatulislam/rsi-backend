import { Controller, Post, Body, Delete, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) { }

  @Post()
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentService.create(createAppointmentDto);
  }

  @Delete(':id')
  cancel(@Param('id') id: string) {
    return this.appointmentService.cancel(id);
  }

  @Patch(':id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body() rescheduleDto: RescheduleAppointmentDto
  ) {
    return this.appointmentService.reschedule(id, rescheduleDto);
  }

  @Get('patient/:patientId')
  getPatientHistory(@Param('patientId') patientId: string) {
    return this.appointmentService.getPatientHistory(patientId);
  }


  @Get()
  getAllAppointments() {
    return this.appointmentService.getAllAppointments();
  }

  @Get('search-patient/:mrNumber')
  @AllowAnonymous() // Allow public search for booking
  searchPatientByRM(@Param('mrNumber') mrNumber: string) {
    return this.appointmentService.searchPatientByRM(mrNumber);
  }

  @Get('search-patient-nik/:nik')
  @AllowAnonymous() // Allow public search for booking
  searchPatientByNIK(@Param('nik') nik: string) {
    return this.appointmentService.searchPatientByNIK(nik);
  }

  @Get('my-patients/:userId')
  getByUserId(@Param('userId') userId: string) {
    return this.appointmentService.getByUserId(userId);
  }

  @Get('queue-status/:doctorCode/:poliCode/:date')
  @AllowAnonymous()
  getQueueStatus(
    @Param('doctorCode') doctorCode: string,
    @Param('poliCode') poliCode: string,
    @Param('date') date: string
  ) {
    return this.appointmentService.getQueueStatus(doctorCode, poliCode, date);
  }
}
