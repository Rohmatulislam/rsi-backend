import { Injectable, Logger } from '@nestjs/common';
import { AppointmentService } from '../appointment/appointment.service';
import { PrismaService } from '../../infra/database/prisma.service';
import { KhanzaService } from '../../infra/database/khanza.service';
import { getStartOfTodayWita, formatWitaDate } from '../../infra/utils/date.utils';
import { AppointmentSyncService } from '../appointment/appointment-sync.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly appointmentService: AppointmentService,
    private readonly prisma: PrismaService,
    private readonly khanzaService: KhanzaService,
    private readonly appointmentSync: AppointmentSyncService,
  ) { }

  /**
   * Get dashboard statistics
   * Returns overall booking counts and metrics
   */
  async getDashboardStats() {
    const allAppointments = await this.appointmentService.getAllAppointments();

    // Use WITA dates
    const today = getStartOfTodayWita();

    // Rolling windows based on WITA today
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
      pendingReviews: await (this.prisma as any).doctorRating.count({
        where: { status: 'PENDING' }
      }),
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

    const now = getStartOfTodayWita(); // Anchor context to Today WITA
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
        // date is already 00:00 WITA

        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const dayAppointments = appointments.filter(app => {
          const appDate = new Date(app.appointmentDate);
          return appDate >= date && appDate < nextDay;
        });

        trends.push({
          date: formatWitaDate(date),
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
        // weekStart is 00:00 WITA

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const weekAppointments = appointments.filter(app => {
          const appDate = new Date(app.appointmentDate);
          return appDate >= weekStart && appDate < weekEnd;
        });

        trends.push({
          date: formatWitaDate(weekStart),
          count: weekAppointments.length,
          scheduled: weekAppointments.filter(a => a.status === 'scheduled').length,
          completed: weekAppointments.filter(a => a.status === 'completed').length,
          cancelled: weekAppointments.filter(a => a.status === 'cancelled').length,
        });
      }
    } else if (period === 'month' || period === 'year') {
      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        // Note: new Date(y, m, d) uses local system timezone.
        // We should construct monthStart carefully to be WITA.
        // But for month boundaries, maybe just getting YYYY-MM-01 string and creating WITA date is safer.

        // Simpler approach:
        const monthStart = new Date(now);
        monthStart.setMonth(monthStart.getMonth() - i);
        monthStart.setDate(1);
        // monthStart is now 1st of month at 00:00 WITA (inherited time from now)

        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        const monthAppointments = appointments.filter(app => {
          const appDate = new Date(app.appointmentDate);
          return appDate >= monthStart && appDate < monthEnd;
        });

        trends.push({
          date: formatWitaDate(monthStart),
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

    // Add average rating for each top doctor
    for (const doc of topDoctors) {
      const aggregate = await (this.prisma as any).doctorRating.aggregate({
        where: {
          doctorId: doc.doctorId,
          status: 'APPROVED',
        },
        _avg: {
          rating: true,
        },
      });
      doc.averageRating = aggregate._avg.rating || 0;
    }

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
   * Get appointment report within date range and search criteria
   */
  async getAppointmentReport(startDate?: Date, endDate?: Date, search?: string) {
    const where: any = {
      AND: []
    };

    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
      where.AND.push({ appointmentDate: dateFilter });
    }

    if (search) {
      where.AND.push({
        OR: [
          { patientName: { contains: search, mode: 'insensitive' } },
          { patientId: { contains: search, mode: 'insensitive' } },
          { poliCode: { contains: search, mode: 'insensitive' } },
          { doctor: { name: { contains: search, mode: 'insensitive' } } },
          { notes: { contains: search, mode: 'insensitive' } }
        ]
      });
    }

    // If AND is empty, remove it to avoid empty query issues
    if (where.AND.length === 0) {
      delete where.AND;
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        doctor: {
          select: {
            name: true,
            specialization: true,
            imageUrl: true,
            isActive: true,
            isStudying: true,
            isOnLeave: true
          }
        },
        notifications: {
          orderBy: {
            sentAt: 'desc'
          }
        }
      },
      orderBy: {
        appointmentDate: 'desc'
      }
    });

    // Fetch all polikliniks to map names
    const poliklinik = await this.khanzaService.poliklinikService.getPoliklinik();
    const poliMap = new Map(poliklinik.map((p: any) => [p.kd_poli, p.nm_poli]));

    const mappedAppointments = appointments.map((app: any) => ({
      ...app,
      poliName: poliMap.get(app.poliCode) || app.poliCode || '-'
    }));

    const report = {
      total: mappedAppointments.length,
      byStatus: {
        scheduled: mappedAppointments.filter(app => app.status === 'scheduled').length,
        completed: mappedAppointments.filter(app => app.status === 'completed').length,
        cancelled: mappedAppointments.filter(app => app.status === 'cancelled').length,
      },
      byDoctor: mappedAppointments.reduce((acc, app) => {
        const doctorName = app.doctor.name;
        acc[doctorName] = (acc[doctorName] || 0) + 1;
        return acc;
      }, {}),
      appointments: mappedAppointments,
    };

    return report;
  }

  async syncAppointments(startDate: Date, endDate: Date) {
    const doctors = await this.prisma.doctor.findMany({
      where: { kd_dokter: { not: null } },
      select: { kd_dokter: true }
    });

    const dates = [];
    let current = new Date(startDate);
    // Ensure we don't sync too many days at once (limit to 31 days)
    const limit = new Date(startDate);
    limit.setDate(limit.getDate() + 31);
    const finalEnd = endDate > limit ? limit : endDate;

    while (current <= finalEnd) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    let totalSynced = 0;
    for (const date of dates) {
      for (const doctor of doctors) {
        if (doctor.kd_dokter) {
          try {
            const count = await this.appointmentSync.syncRegistrations(doctor.kd_dokter, date);
            totalSynced += count || 0;
          } catch (error) {
            this.logger.error(`Failed to sync for doctor ${doctor.kd_dokter} on ${date}: ${error.message}`);
          }
        }
      }
    }

    return { success: true, totalSynced };
  }
}