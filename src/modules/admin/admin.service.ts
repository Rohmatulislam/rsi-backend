import { Injectable } from '@nestjs/common';
import { AppointmentService } from '../appointment/appointment.service';

@Injectable()
export class AdminService {
  constructor(private readonly appointmentService: AppointmentService) {}

  async getDashboardStats() {
    // Get various statistics for the admin dashboard
    const totalAppointments = await this.appointmentService.getAllAppointments();
    const scheduledAppointments = totalAppointments.filter(app => app.status === 'scheduled');
    const completedAppointments = totalAppointments.filter(app => app.status === 'completed');
    const cancelledAppointments = totalAppointments.filter(app => app.status === 'cancelled');

    // Additional stats can be calculated here
    return {
      totalAppointments: totalAppointments.length,
      scheduledAppointments: scheduledAppointments.length,
      completedAppointments: completedAppointments.length,
      cancelledAppointments: cancelledAppointments.length,
      // Add more stats as needed
    };
  }

  async getAppointmentReport(startDate?: Date, endDate?: Date) {
    // Get appointments report within a date range
    let appointments = await this.appointmentService.getAllAppointments();

    if (startDate && endDate) {
      appointments = appointments.filter(app =>
        app.appointmentDate >= startDate && app.appointmentDate <= endDate
      );
    }

    // Group by date, doctor, status, etc.
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