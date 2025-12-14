import { Controller, Post, Body, Delete, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) { }

  @Post()
  @AllowAnonymous() // Allow public booking for now during development
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentService.create(createAppointmentDto);
  }

  @Delete(':id')
  @AllowAnonymous() // Allow public access for now during development
  cancel(@Param('id') id: string) {
    return this.appointmentService.cancel(id);
  }

  @Patch(':id/reschedule')
  @AllowAnonymous() // Allow public access for now during development
  reschedule(
    @Param('id') id: string,
    @Body() rescheduleDto: RescheduleAppointmentDto
  ) {
    return this.appointmentService.reschedule(id, rescheduleDto);
  }

  @Get('patient/:patientId')
  @AllowAnonymous() // Allow public access for now during development
  getPatientHistory(@Param('patientId') patientId: string) {
    return this.appointmentService.getPatientHistory(patientId);
  }


  @Get()
  @AllowAnonymous() // Allow to view all appointments for now
  getAllAppointments() {
    return this.appointmentService.getAllAppointments();
  }

  @Get('search-patient/:mrNumber')
  @AllowAnonymous() // Allow public search for booking
  searchPatientByRM(@Param('mrNumber') mrNumber: string) {
    return this.appointmentService.searchPatientByRM(mrNumber);
  }

  @Get('my-patients/:userId')
  @AllowAnonymous() // Allow public access for now during development
  getByUserId(@Param('userId') userId: string) {
    return this.appointmentService.getByUserId(userId);
  }
}
