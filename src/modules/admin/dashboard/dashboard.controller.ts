import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminService } from '../admin.service';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('admin/dashboard')
@UseGuards(AdminGuard)
export class DashboardController {
  constructor(private readonly adminService: AdminService) { }

  /**
   * Get dashboard statistics
   * Returns total bookings, by status, and by period
   */
  @Get('stats')
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  /**
   * Get booking trends for charts
   * @query period - 'day' | 'week' | 'month' | 'year'
   */
  @Get('booking-trends')
  async getBookingTrends(@Query('period') period?: 'day' | 'week' | 'month' | 'year') {
    return this.adminService.getBookingTrends(period || 'week');
  }

  /**
   * Get top doctors by booking count
   * @query limit - number of doctors to return (default 10)
   */
  @Get('top-doctors')
  async getTopDoctors(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getTopDoctors(parsedLimit);
  }

  /**
   * Get recent bookings
   * @query limit - number of bookings to return (default 20)
   */
  @Get('recent-bookings')
  async getRecentBookings(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.adminService.getRecentBookings(parsedLimit);
  }
}