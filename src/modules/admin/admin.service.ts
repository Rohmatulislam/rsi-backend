import { Injectable } from '@nestjs/common';
import { AppointmentService } from '../appointment/appointment.service';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly appointmentService: AppointmentService,
    private readonly prisma: PrismaService,
  ) { }

  /**
   * Get dashboard statistics
   * Returns overall booking counts and metrics
   */
  async getDashboardStats() {
    const allAppointments = await this.appointmentService.getAllAppointments();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return {
      totalBookings: allAppointments.length,
      scheduledBookings: allAppointments.filter(app => app.status === 'scheduled').length,
      completedBookings: allAppointments.filter(app => app.status === 'completed').length,
      cancelledBookings: allAppointments.filter(app => app.status === 'cancelled').length,
      todayBookings: allAppointments.filter(app =>
        new Date(app.appointmentDate) >= today
      ).length,
      weekBookings: allAppointments.filter(app =>
        new Date(app.appointmentDate) >= weekAgo
      ).length,
      monthBookings: allAppointments.filter(app =>
        new Date(app.appointmentDate) >= monthAgo
      ).length,
    };
  }

  /**
   * Get booking trends for charts
   * @param period - 'day' (last 7 days) | 'week' (last 8 weeks) | 'month' (last 12 months) | 'year' (last 12 months)
   */
  async getBookingTrends(period: 'day' | 'week' | 'month' | 'year' = 'week') {
    const appointments = await this.prisma.appointment.findMany({
      select: {
        appointmentDate: true,
        status: true,
      },
      orderBy: {
        appointmentDate: 'asc',
      },
    });

    const now = new Date();
    const trends: Array<{
      date: string;
      count: number;
      scheduled: number;
      completed: number;
      cancelled: number;
    }> = [];

    if (period === 'day') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const dayAppointments = appointments.filter(app => {
          const appDate = new Date(app.appointmentDate);
          return appDate >= date && appDate < nextDay;
        });

        trends.push({
          date: date.toISOString().split('T')[0],
          count: dayAppointments.length,
          scheduled: dayAppointments.filter(a => a.status === 'scheduled').length,
          completed: dayAppointments.filter(a => a.status === 'completed').length,
          cancelled: dayAppointments.filter(a => a.status === 'cancelled').length,
        });
      }
    } else if (period === 'week') {
      // Last 8 weeks
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + i * 7));
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const weekAppointments = appointments.filter(app => {
          const appDate = new Date(app.appointmentDate);
          return appDate >= weekStart && appDate < weekEnd;
        });

        trends.push({
          date: weekStart.toISOString().split('T')[0],
          count: weekAppointments.length,
          scheduled: weekAppointments.filter(a => a.status === 'scheduled').length,
          completed: weekAppointments.filter(a => a.status === 'completed').length,
          cancelled: weekAppointments.filter(a => a.status === 'cancelled').length,
        });
      }
    } else if (period === 'month' || period === 'year') {
      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

        const monthAppointments = appointments.filter(app => {
          const appDate = new Date(app.appointmentDate);
          return appDate >= monthStart && appDate < monthEnd;
        });

        trends.push({
          date: monthStart.toISOString().split('T')[0],
          count: monthAppointments.length,
          scheduled: monthAppointments.filter(a => a.status === 'scheduled').length,
          completed: monthAppointments.filter(a => a.status === 'completed').length,
          cancelled: monthAppointments.filter(a => a.status === 'cancelled').length,
        });
      }
    }

    return trends;
  }

  /**
   * Get top doctors by booking count
   * @param limit - number of top doctors to return (default 10)
   */
  async getTopDoctors(limit: number = 10) {
    const appointments = await this.prisma.appointment.findMany({
      select: {
        doctorId: true,
        doctor: {
          select: {
            id: true,
            name: true,
            specialization: true,
            imageUrl: true,
          },
        },
      },
    });

    // Group by doctor and count
    const doctorCounts = appointments.reduce((acc, app) => {
      const doctorId = app.doctorId;
      if (!acc[doctorId]) {
        acc[doctorId] = {
          doctorId: app.doctor.id,
          doctorName: app.doctor.name,
          specialty: app.doctor.specialization || 'Umum',
          imageUrl: app.doctor.imageUrl,
          bookingCount: 0,
        };
      }
      acc[doctorId].bookingCount++;
      return acc;
    }, {} as Record<string, any>);

    // Convert to array and sort by booking count
    const topDoctors = Object.values(doctorCounts)
      .sort((a: any, b: any) => b.bookingCount - a.bookingCount)
      .slice(0, limit);

    return topDoctors;
  }

  /**
   * Get recent bookings
   * @param limit - number of recent bookings to return (default 20)
   */
  async getRecentBookings(limit: number = 20) {
    const appointments = await this.prisma.appointment.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        patientName: true,
        appointmentDate: true,
        status: true,
        createdAt: true,
        doctor: {
          select: {
            name: true,
            specialization: true,
          },
        },
      },
    });

    return appointments.map(app => ({
      id: app.id,
      patientName: app.patientName,
      doctorName: app.doctor.name,
      specialty: app.doctor.specialization,
      appointmentDate: app.appointmentDate,
      status: app.status,
      createdAt: app.createdAt,
    }));
  }

  /**
   * Get appointment report within date range
   * Legacy method - kept for backward compatibility
   */
  async getAppointmentReport(startDate?: Date, endDate?: Date) {
    let appointments = await this.appointmentService.getAllAppointments();

    if (startDate && endDate) {
      appointments = appointments.filter(app =>
        app.appointmentDate >= startDate && app.appointmentDate <= endDate
      );
    }

    const report = {
      total: appointments.length,
      byStatus: {
        scheduled: appointments.filter(app => app.status === 'scheduled').length,
        completed: appointments.filter(app => app.status === 'completed').length,
        cancelled: appointments.filter(app => app.status === 'cancelled').length,
      },
      byDoctor: appointments.reduce((acc, app) => {
        const doctorName = app.doctor.name;
        acc[doctorName] = (acc[doctorName] || 0) + 1;
        return acc;
      }, {}),
      appointments: appointments,
    };

    return report;
  }
}