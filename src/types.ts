export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'mongodb' | 'redis';

export interface ConnectionConfig {
  id: string;
  name: string;
  type: DatabaseType;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  schema?: string;
  ssl?: boolean;
  uri?: string; // For MongoDB or connection strings
}

export interface TableInfo {
  name: string;
  schema?: string;
  columns?: ColumnInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimary: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: any[];
  executionTimeMs: number;
  error?: string;
}

export interface RedisKey {
  key: string;
  type: 'string' | 'list' | 'set' | 'zset' | 'hash' | 'none';
}

export interface MongoCollection {
  name: string;
}
