import { Logger } from '@nestjs/common';
import { Knex } from 'knex';

export class MonitoringModule {
  constructor(private db: Knex, private logger: Logger) {}

  async getConnectionStatus(): Promise<{
    connected: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      await this.db.raw('SELECT 1');
      const latency = Date.now() - startTime;
      return { connected: true, latency };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  async getBookingStats(date?: string): Promise<{
    totalBookings: number;
    byStatus: Record<string, number>;
    byPoli: Record<string, number>;
    byPaymentType: Record<string, number>;
  }> {
    try {
      const query = this.db('reg_periksa');

      if (date) {
        query.where('tgl_registrasi', date);
      } else {
        // Today's stats
        const today = new Date().toISOString().split('T')[0];
        query.where('tgl_registrasi', today);
      }

      const bookings = await query.select('*');

      const stats = {
        totalBookings: bookings.length,
        byStatus: {} as Record<string, number>,
        byPoli: {} as Record<string, number>,
        byPaymentType: {} as Record<string, number>,
      };

      bookings.forEach(booking => {
        // Count by status
        stats.byStatus[booking.stts] = (stats.byStatus[booking.stts] || 0) + 1;

        // Count by poli
        stats.byPoli[booking.kd_poli] = (stats.byPoli[booking.kd_poli] || 0) + 1;

        // Count by payment type
        stats.byPaymentType[booking.kd_pj] = (stats.byPaymentType[booking.kd_pj] || 0) + 1;
      });

      return stats;
    } catch (error) {
      this.logger.error('Error getting booking stats', error);
      return {
        totalBookings: 0,
        byStatus: {},
        byPoli: {},
        byPaymentType: {},
      };
    }
  }
}