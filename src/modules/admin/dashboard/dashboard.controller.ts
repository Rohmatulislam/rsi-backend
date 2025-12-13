import { Controller, Get, Query } from '@nestjs/common';
import { AdminService } from '../admin.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth'; // In production, this should be protected

@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @AllowAnonymous() // In production, add proper authentication
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }
}