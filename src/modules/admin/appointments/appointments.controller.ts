import { Controller, Get, Query } from '@nestjs/common';
import { AdminService } from '../admin.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth'; // In production, this should be protected

@Controller('admin/appointments')
export class AppointmentsController {
  constructor(private readonly adminService: AdminService) {}

  @Get('reports')
  @AllowAnonymous() // In production, add proper authentication
  getAppointmentReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.adminService.getAppointmentReport(start, end);
  }
}