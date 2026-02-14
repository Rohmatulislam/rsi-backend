import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminService } from '../admin.service';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('admin/appointments')
export class AppointmentsController {
  constructor(private readonly adminService: AdminService) { }

  @Get('reports')
  @UseGuards(AdminGuard)
  getAppointmentReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.adminService.getAppointmentReport(start, end, search);
  }

  @UseGuards(AdminGuard)
  @Get('sync')
  async sync(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.adminService.syncAppointments(start, end);
  }
}