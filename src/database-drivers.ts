import { ConnectionConfig, QueryResult, TableInfo } from './types';

export interface IDriver {
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  getDatabases(): Promise<string[]>;
  getSchemas(database: string): Promise<string[]>;
  getTables(database: string, schema?: string): Promise<TableInfo[]>;
  getColumns(database: string, table: string, schema?: string): Promise<any[]>;
  runQuery(query: string): Promise<QueryResult>;
  getTableData(table: string, options: { page: number, pageSize: number }): Promise<QueryResult>;
}

export abstract class BaseDriver implements IDriver {
  abstract connect(config: ConnectionConfig): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getDatabases(): Promise<string[]>;
  abstract getSchemas(database: string): Promise<string[]>;
  abstract getTables(database: string, schema?: string): Promise<TableInfo[]>;
  abstract getColumns(database: string, table: string, schema?: string): Promise<any[]>;
  abstract runQuery(query: string): Promise<QueryResult>;
  abstract getTableData(table: string, options: { page: number, pageSize: number }): Promise<QueryResult>;
}
