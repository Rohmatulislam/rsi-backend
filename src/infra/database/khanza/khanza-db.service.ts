import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import knex, { Knex } from 'knex';

@Injectable()
export class KhanzaDBService implements OnModuleDestroy {
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
        connectTimeout: 60000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        // Tambahkan ini untuk mysql2 driver agar otomatis reconnect jika memungkinkan
        decimalNumbers: true,
      },
      pool: {
        min: 0,
        max: 10,
        idleTimeoutMillis: 10000, // 10 detik agar cepat diputar
        acquireTimeoutMillis: 60000,
        createTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
        propagateCreateError: false,
        validate: (conn: any) => {
          return new Promise((resolve) => {
            conn.query('SELECT 1', (err: any) => {
              if (err) resolve(false);
              else resolve(true);
            });
          });
        },
        afterCreate: (conn: any, done: any) => {
          conn.on('error', (err: any) => {
            this.logger.error('MySQL Connection Error', err);
          });
          // Set timeout di sisi server MySQL agar tidak gampang putus
          conn.query('SET SESSION wait_timeout=28800, SESSION interactive_timeout=28800', (err: any) => {
            done(err, conn);
          });
        },
      } as any,
      acquireConnectionTimeout: 60000,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.db.raw('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database connection failed', error);
      try {
        const fs = require('fs');
        fs.appendFileSync('error-db-conn.log', `${new Date().toISOString()} - DB Connection Failed: ${(error as any).message}\n`);
      } catch (e) {
        // ignore
      }
      return false;
    }
  }

  async onModuleDestroy() {
    try {
      await this.db.destroy();
      this.logger.log('Khanza DB connection pool closed.');
    } catch (error) {
      this.logger.error('Error closing Khanza DB connection pool:', error);
    }
  }
}