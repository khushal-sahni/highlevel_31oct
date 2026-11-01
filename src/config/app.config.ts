import { Injectable } from '@nestjs/common';

const DEFAULT_PORT = 3110;
const DEFAULT_POOL_MAX = 10;
const DEFAULT_MAX_BULK = 50_000;
const DEFAULT_RESOLVE_PAGE = 2_000;
const DEFAULT_APPLY_CHUNK = 200;
const DEFAULT_PAUSE_MS = 50;
const DEFAULT_STALE_MS = 30_000;
const DEFAULT_FATAL = 5;
const DEFAULT_IN_FLIGHT = 4;
const DEFAULT_OPEN_JOBS = 8;
const PERMIT_BASE = 742_900; // Arbitrary namespace so advisory keys do not collide.

interface IJobInts {
  readonly port: number;
  readonly databasePoolMax: number;
  readonly resolvePageSize: number;
  readonly chunkPauseMs: number;
  readonly heartbeatStaleMs: number;
  readonly fatalErrorLimit: number;
}

@Injectable()
export class AppConfig {
  readonly databaseUrl: string;
  readonly port: number;
  readonly databasePoolMax: number;
  readonly resolvePageSize: number;
  readonly chunkPauseMs: number;
  readonly heartbeatStaleMs: number;
  readonly fatalErrorLimit: number;
  readonly permitBase: number;

  constructor() {
    const ints = AppConfig.readInts();
    this.databaseUrl = AppConfig.readRequired('DATABASE_URL');
    this.port = ints.port;
    this.databasePoolMax = ints.databasePoolMax;
    this.resolvePageSize = ints.resolvePageSize;
    this.chunkPauseMs = ints.chunkPauseMs;
    this.heartbeatStaleMs = ints.heartbeatStaleMs;
    this.fatalErrorLimit = ints.fatalErrorLimit;
    this.permitBase = PERMIT_BASE;
  }

  // Getters re-read env so tests can shrink chunk/cap after Nest constructs this.
  get maxBulkMoveSize(): number {
    return AppConfig.readInt('MAX_BULK_MOVE_SIZE', DEFAULT_MAX_BULK, 1);
  }

  get applyChunkSize(): number {
    return AppConfig.readInt('APPLY_CHUNK_SIZE', DEFAULT_APPLY_CHUNK, 1);
  }

  get maxInFlightChunks(): number {
    return AppConfig.readInt('MAX_IN_FLIGHT_CHUNKS', DEFAULT_IN_FLIGHT, 1);
  }

  get maxOpenJobsPerWorkspace(): number {
    return AppConfig.readInt('MAX_OPEN_JOBS_PER_WORKSPACE', DEFAULT_OPEN_JOBS, 1);
  }

  private static readInts(): IJobInts {
    return {
      port: AppConfig.readInt('PORT', DEFAULT_PORT, 1),
      databasePoolMax: AppConfig.readInt('DATABASE_POOL_MAX', DEFAULT_POOL_MAX, 1),
      resolvePageSize: AppConfig.readInt(
        'RESOLVE_PAGE_SIZE',
        DEFAULT_RESOLVE_PAGE,
        1,
      ),
      chunkPauseMs: AppConfig.readInt('CHUNK_PAUSE_MS', DEFAULT_PAUSE_MS, 0),
      heartbeatStaleMs: AppConfig.readInt(
        'HEARTBEAT_STALE_MS',
        DEFAULT_STALE_MS,
        1,
      ),
      fatalErrorLimit: AppConfig.readInt('FATAL_ERROR_LIMIT', DEFAULT_FATAL, 1),
    };
  }

  private static readRequired(name: string): string {
    const value = process.env[name];
    if (value === undefined || value.length === 0) {
      throw new Error(`${name} is required`);
    }
    return value;
  }

  private static readInt(name: string, fallback: number, min: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw.length === 0) {
      return fallback;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < min) {
      throw new Error(`${name} must be an integer >= ${min}`);
    }
    return parsed;
  }
}
