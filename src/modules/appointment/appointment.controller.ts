import { Controller, Post, Body, Delete, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) { }

  @Post()
  @AllowAnonymous() // Allow public booking for now
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentService.create(createAppointmentDto);
  }

  @Delete(':id')
  cancel(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.appointmentService.cancel(id);
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
}
