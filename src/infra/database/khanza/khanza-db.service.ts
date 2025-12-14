import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import knex, { Knex } from 'knex';

@Injectable()
export class KhanzaDBService {
  private readonly logger = new Logger(KhanzaDBService.name);
  public db: Knex;

  constructor(private configService: ConfigService) {
    this.db = knex({
      client: 'mysql2',
      connection: {
        host: this.configService.get<string>('KHANZA_DB_HOST', 'localhost'),
        port: this.configService.get<number>('KHANZA_DB_PORT', 3306),
        user: this.configService.get<string>('KHANZA_DB_USER', 'root'),
        password: this.configService.get<string>('KHANZA_DB_PASSWORD', ''),
        database: this.configService.get<string>('KHANZA_DB_NAME', 'sik'),
      },
      pool: { min: 0, max: 7 },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.db.raw('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database connection failed', error);
      return false;
    }
  }
}