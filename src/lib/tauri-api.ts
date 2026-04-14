import { invoke } from "@tauri-apps/api/core";
import { ConnectionConfig, ExportOptions, ImportOptions, ImportResult, QueryHistoryEntry, QueryResult, SavedQuery, SchemaGraph, TableInfo, TableStructure } from "@/types";

export const tauriApi = {
  // ── DB driver ──────────────────────────────────────────────────────────────

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

  async getSchemaGraph(id: string, database: string, schema?: string): Promise<SchemaGraph> {
    return await invoke("get_schema_graph", { id, database, schema: schema ?? null });
  },

  async switchDatabase(id: string, database: string): Promise<void> {
    await invoke("switch_database", { id, database });
  },

  async dumpDatabase(id: string, database: string, schema?: string, includeData: boolean = true): Promise<string> {
    return await invoke("dump_database", { id, database, schema: schema ?? null, includeData });
  },

  // ── App info ───────────────────────────────────────────────────────────────

  async getAppDataDir(): Promise<string> {
    return await invoke("get_app_data_dir");
  },

  // ── Storage (SQLite + encrypted passwords) ─────────────────────────────────

  async storageLoadConnections(): Promise<ConnectionConfig[]> {
    return await invoke("storage_load_connections");
  },

  async storageSaveConnection(connection: ConnectionConfig): Promise<void> {
    await invoke("storage_save_connection", { connection });
  },

  async storageDeleteConnection(id: string): Promise<void> {
    await invoke("storage_delete_connection", { id });
  },

  async storageLoadQueries(): Promise<SavedQuery[]> {
    return await invoke("storage_load_queries");
  },

  async storageSaveQuery(query: SavedQuery): Promise<void> {
    await invoke("storage_save_query", { query });
  },

  async storageDeleteQuery(id: string): Promise<void> {
    await invoke("storage_delete_query", { id });
  },

  async storageLoadHistory(): Promise<QueryHistoryEntry[]> {
    return await invoke("storage_load_history");
  },

  async storageSaveHistoryEntry(entry: QueryHistoryEntry): Promise<void> {
    await invoke("storage_save_history_entry", { entry });
  },

  async storageClearHistory(connectionId: string): Promise<void> {
    await invoke("storage_clear_history", { connectionId });
  },

  async storageClearAllHistory(): Promise<void> {
    await invoke("storage_clear_all_history");
  },

  // ── Import / Export ────────────────────────────────────────────────────────

  async exportConnections(opts: ExportOptions): Promise<string> {
    return await invoke("export_connections", { opts });
  },

  async importConnections(content: string, opts: ImportOptions): Promise<ImportResult> {
    return await invoke("import_connections", { content, opts });
  },

  async parseConnectionUri(uri: string): Promise<ConnectionConfig> {
    return await invoke("parse_connection_uri", { uri });
  },

  async checkExportProtected(content: string): Promise<boolean> {
    return await invoke("check_export_protected", { content });
  },

  async saveFileDialog(
    defaultName: string,
    filters: Array<{ name: string; extensions: string[] }>
  ): Promise<string | null> {
    const { save } = await import("@tauri-apps/plugin-dialog");
    return await save({ defaultPath: defaultName, filters });
  },

  async openFileDialog(
    filters: Array<{ name: string; extensions: string[] }>
  ): Promise<string | null> {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({ multiple: false, filters });
    if (typeof result === "string") return result;
    if (Array.isArray(result)) return result[0] ?? null;
    return null;
  },

  async writeTextFile(path: string, content: string): Promise<void> {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(path, content);
  },

  async readTextFile(path: string): Promise<string> {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    return await readTextFile(path);
  },
};
