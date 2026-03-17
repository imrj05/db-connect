import { invoke } from "@tauri-apps/api/core";
import { ConnectionConfig, QueryResult, TableInfo, TableStructure } from "@/types";

export const tauriApi = {
  async connect(config: ConnectionConfig): Promise<void> {
    return await invoke("connect_database", { config });
  },

  async disconnect(id: string): Promise<void> {
    await invoke("disconnect_database", { id });
  },

  async getDatabases(id: string): Promise<string[]> {
    return await invoke("get_databases", { id });
  },

  async getTables(id: string, database: string, schema?: string): Promise<TableInfo[]> {
    return await invoke("get_tables", { id, database, schema });
  },

  async executeQuery(id: string, query: string): Promise<QueryResult> {
    return await invoke("execute_query", { id, query });
  },

  async getTableData(id: string, database: string, table: string, page: number = 0, pageSize: number = 50): Promise<QueryResult> {
    return await invoke("get_table_data", { id, database, table, page, pageSize });
  },

  async listAllTables(id: string, database?: string): Promise<TableInfo[]> {
    return await invoke("list_all_tables", { id, database: database ?? null });
  },

  async getUserDatabases(id: string): Promise<string[]> {
    return await invoke("get_user_databases", { id });
  },

  async getTableStructure(id: string, database: string, table: string, schema?: string): Promise<TableStructure> {
    return await invoke("get_table_structure", { id, database, table, schema: schema ?? null });
  },
};
