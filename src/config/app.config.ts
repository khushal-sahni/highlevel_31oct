import { Injectable } from '@nestjs/common';

const DEFAULT_PORT = 3000;

@Injectable()
export class AppConfig {
  readonly databaseUrl: string;
  readonly port: number;

  constructor() {
    this.databaseUrl = AppConfig.readDatabaseUrl();
    this.port = AppConfig.readPort();
  }

  private static readDatabaseUrl(): string {
    const value = process.env['DATABASE_URL'];
    if (value === undefined || value.length === 0) {
      throw new Error('DATABASE_URL is required');
    }
    return value;
  }

  private static readPort(): number {
    const raw = process.env['PORT'];
    if (raw === undefined || raw.length === 0) {
      return DEFAULT_PORT;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('PORT must be a positive integer');
    }
    return parsed;
  }
}
