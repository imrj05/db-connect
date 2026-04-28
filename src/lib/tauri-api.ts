import { invoke } from "@tauri-apps/api/core";
import { ConnectionConfig, ExportOptions, ImportOptions, ImportResult, QueryHistoryEntry, QueryResult, SavedQuery, SchemaGraph, TableInfo, TableStructure, UserSnippet } from "@/types";

// ── SQL dump import types & helpers ───────────────────────────────────────────

export interface ImportSqlResult {
    executed: number;
    skipped: number;
    errors: string[];
    detectedDbName: string | null;
    detectedFormat: string;
}

export type AiProvider =
  | "openrouter"
  | "opencode"
  | "openai"
  | "codex"
  | "github-copilot"
  | "anthropic"
  | "groq"
  | "gemini";

export interface AiCredentialStatus {
  provider: string;
  authMode: string;
  configured: boolean;
  maskedKey: string | null;
}

export interface OpenRouterOAuthBeginResult {
  flowId: string;
  authUrl: string;
  callbackUrl: string;
}

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterChatRequest {
  provider?: AiProvider;
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AiChatResponse {
  content: string;
  model?: string;
}

/** Detect dump format and database name from the first 2000 chars of a SQL file. */
export function detectSqlDumpFormat(content: string): {
    detectedFormat: string;
    detectedDbName: string | null;
} {
    const header = content.slice(0, 2000);
    let detectedFormat = "generic";
    if (header.includes("-- phpMyAdmin SQL Dump")) detectedFormat = "phpmyadmin";
    else if (header.includes("-- PostgreSQL database dump") || header.includes("SET client_encoding")) detectedFormat = "pg_dump";
    else if (header.includes("-- MySQL Workbench")) detectedFormat = "mysql_workbench";
    else if (header.includes("PRAGMA foreign_keys")) detectedFormat = "sqlite_cli";

    let detectedDbName: string | null = null;
    const useMatch = content.match(/^USE\s+[`"]?([^`";\s]+)[`"]?\s*;/im);
    if (useMatch) detectedDbName = useMatch[1];
    if (!detectedDbName) {
        const connectMatch = content.match(/^\\connect\s+(\S+)/im);
        if (connectMatch && connectMatch[1] !== "-") {
            // Strip surrounding quotes that pg_dump adds for mixed-case identifiers
            detectedDbName = connectMatch[1].replace(/^["'`]|["'`]$/g, "");
        }
    }
    if (!detectedDbName) {
        const createMatch = content.match(/CREATE\s+DATABASE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([^`";\s(]+)/i);
        if (createMatch) detectedDbName = createMatch[1];
    }
    return { detectedFormat, detectedDbName };
}

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

  async createDatabase(id: string, name: string): Promise<void> {
    return await invoke("create_database", { id, name });
  },

  async getTables(id: string, database: string, schema?: string): Promise<TableInfo[]> {
    return await invoke("get_tables", { id, database, schema });
  },

  async executeQuery(id: string, query: string, timeoutSecs?: number, database?: string): Promise<QueryResult> {
    return await invoke("execute_query", { id, query, timeoutSecs, database: database ?? null });
  },

  async pingConnection(id: string): Promise<number> {
    return await invoke("ping_connection", { id });
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

  async dumpDatabase(
    id: string,
    database: string,
    schema: string | null,
    includeData: boolean,
    includeIndexes: boolean,
    includeForeignKeys: boolean,
    createDatabase: boolean,
  ): Promise<string> {
    return await invoke("dump_database", {
      id,
      database,
      schema,
      includeData,
      includeIndexes,
      includeForeignKeys,
      createDatabase,
    });
  },

  async importSqlFile(
    id: string,
    sqlContent: string,
    targetDatabase: string | null,
    dropExisting: boolean,
    ignoreErrors: boolean,
  ): Promise<ImportSqlResult> {
    return await invoke("import_sql_file", {
      id,
      sqlContent,
      targetDatabase,
      dropExisting,
      ignoreErrors,
    });
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

  async storageLoadSnippets(): Promise<UserSnippet[]> {
    return await invoke("storage_load_snippets");
  },

  async storageSaveSnippet(snippet: UserSnippet): Promise<void> {
    await invoke("storage_save_snippet", { snippet });
  },

  async storageDeleteSnippet(id: string): Promise<void> {
    await invoke("storage_delete_snippet", { id });
  },

  async storageSaveWorkspace(snapshotJson: string): Promise<void> {
    await invoke("storage_save_workspace", { snapshotJson });
  },

  async storageLoadWorkspace(): Promise<string | null> {
    return await invoke("storage_load_workspace");
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

  async storageDeleteHistoryEntry(id: string): Promise<void> {
    await invoke("storage_delete_history_entry", { id });
  },

  // ── AI / OpenRouter ───────────────────────────────────────────────────────

  async aiGetCredentialStatus(provider: AiProvider): Promise<AiCredentialStatus> {
    return await invoke("ai_get_credential_status", { provider });
  },

  async aiSaveApiKey(provider: AiProvider, apiKey: string): Promise<AiCredentialStatus> {
    return await invoke("ai_save_api_key", { provider, apiKey });
  },

  async aiTestApiKey(provider: AiProvider, apiKey: string): Promise<void> {
    await invoke("ai_test_api_key", { provider, apiKey });
  },

  async aiClearCredential(provider: AiProvider): Promise<void> {
    await invoke("ai_clear_credential", { provider });
  },

  async aiChatCompletion(request: OpenRouterChatRequest & { provider: AiProvider }): Promise<AiChatResponse> {
    return await invoke("ai_chat_completion", { request });
  },

  // ── OpenRouter compatibility wrappers ─────────────────────────────────────

  async openrouterGetCredentialStatus(): Promise<AiCredentialStatus> {
    return await invoke("openrouter_get_credential_status");
  },

  async openrouterSaveApiKey(apiKey: string): Promise<AiCredentialStatus> {
    return await invoke("openrouter_save_api_key", { apiKey });
  },

  async openrouterTestApiKey(apiKey: string): Promise<void> {
    await invoke("openrouter_test_api_key", { apiKey });
  },

  async openrouterClearCredential(): Promise<void> {
    await invoke("openrouter_clear_credential");
  },

  async openrouterOauthBegin(): Promise<OpenRouterOAuthBeginResult> {
    return await invoke("openrouter_oauth_begin");
  },

  async openrouterOauthComplete(flowId: string): Promise<AiCredentialStatus> {
    return await invoke("openrouter_oauth_complete", { flowId });
  },

  async openrouterChatCompletion(request: OpenRouterChatRequest): Promise<AiChatResponse> {
    return await invoke("openrouter_chat_completion", { request });
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

  async writeBinaryFile(path: string, contents: Uint8Array): Promise<void> {
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(path, contents);
  },

  async pickDirectory(defaultPath?: string): Promise<string | null> {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({ directory: true, multiple: false, defaultPath });
    if (typeof result === "string") return result;
    if (Array.isArray(result)) return result[0] ?? null;
    return null;
  },

  async saveFileDialogIn(
    defaultDir: string | null,
    defaultName: string,
    filters: Array<{ name: string; extensions: string[] }>
  ): Promise<string | null> {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const defaultPath = defaultDir
      ? `${defaultDir.replace(/[/\\]+$/, "")}/${defaultName}`
      : defaultName;
    return await save({ defaultPath, filters });
  },

  async readTextFile(path: string): Promise<string> {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    return await readTextFile(path);
  },

  async openExternalUrl(url: string): Promise<void> {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  },
};
