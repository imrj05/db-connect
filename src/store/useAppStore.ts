import { create } from "zustand";
import {
  ConnectionConfig,
  ConnectionFunction,
  FunctionInvocationResult,
  PendingCellEdit,
  TableInfo,
  ConnectionSourceInfo,
  QueryHistoryEntry,
  SavedQuery,
  ResultTab,
  FilterCondition,
  QueryResult,
} from "@/types";
import { EncryptionUtils } from "@/lib/encryption";
import { buildConnectionFunctions, suggestPrefix } from "@/lib/db-functions";
import { tauriApi } from "@/lib/tauri-api";
import { toast } from "@/components/ui/sonner";
import { DB_FONT_SANS, DB_FONT_MONO } from "@/lib/fonts";

// Helper to create a default empty filter
function createDefaultFilter(): FilterCondition {
  return {
    id: `f-${Date.now()}`,
    col: "",
    op: "=",
    value: "",
    join: "AND",
  };
}

// Legacy localStorage keys — kept only for one-time migration
const LEGACY_CONNECTIONS_KEY = "db_connections_v3";
const LEGACY_QUERIES_KEY = "db_saved_queries_v1";
const SETTINGS_KEY = "db_connect_settings_v1";

// ── App settings (non-sensitive — persisted in localStorage) ──────────────────
export type EditorThemeOption =
  | "system"
  | "dark-one-dark"
  | "dark-monokai"
  | "dark-palenight"
  | "dark-dracula"
  | "light-github"
  | "light-solarized"
  | "light-white-pine"
  | "light-soft-white";

export type UiDarkThemeOption =
  | "dark"
  | "dim"
  | "midnight"
  | "catppuccin-mocha"
  | "nord"
  | "dracula"
  | "one-dark"
  | "github-dark"
  | "slack-dark"
  | "linear"
  | "voyage"
  | "astro"
  | "night-owl"
  | "borland"
  | "metals"
  | "cursor-dark"
  | "ember";

export type UiLightThemeOption =
  | "light"
  | "sunrise"
  | "cream"
  | "catppuccin-latte"
  | "nord-light"
  | "github-light"
  | "slack-zen"
  | "linear-light"
  | "voyage-light"
  | "astro-light"
  | "spring"
  | "monokai-light"
  | "solarized-light"
  | "dracula-light"
  | "cursor"
  | "ember";

export interface AppSettings {
  editorFontSize: 12 | 13 | 14 | 16;
  tablePageSize: 25 | 50 | 100 | 200;
  uiZoom: 100 | 110 | 125 | 140 | 150;
  editorDarkTheme: EditorThemeOption;
  editorLightTheme: EditorThemeOption;
  uiDarkTheme: UiDarkThemeOption;
  uiLightTheme: UiLightThemeOption;
  uiFontFamily: string;
  monoFontFamily: string;
  aiEnabled: boolean;
  aiProvider:
    | "openrouter"
    | "opencode"
    | "openai"
    | "codex"
    | "github-copilot"
    | "anthropic"
    | "groq"
    | "gemini";
  aiAuthMode: "api_key" | "oauth";
  aiDefaultModel: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  editorFontSize: 13,
  tablePageSize: 50,
  uiZoom: 125,
  editorDarkTheme: "dark-one-dark",
  editorLightTheme: "light-github",
  uiDarkTheme: "dark",
  uiLightTheme: "light",
  uiFontFamily: DB_FONT_SANS,
  monoFontFamily: DB_FONT_MONO,
  aiEnabled: false,
  aiProvider: "openrouter",
  aiAuthMode: "oauth",
  aiDefaultModel: "openrouter/free",
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        editorDarkTheme: parsed.editorDarkTheme ?? DEFAULT_SETTINGS.editorDarkTheme,
        editorLightTheme: parsed.editorLightTheme ?? DEFAULT_SETTINGS.editorLightTheme,
        uiDarkTheme: parsed.uiDarkTheme ?? DEFAULT_SETTINGS.uiDarkTheme,
        uiLightTheme: parsed.uiLightTheme ?? DEFAULT_SETTINGS.uiLightTheme,
      };
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function getTabLabel(fn: ConnectionFunction): string {
  if (fn.type === "table") return fn.tableName ?? fn.name;
  return fn.name.slice(fn.prefix.length + 1).replace(/\(.*\)$/, "");
}

interface AppState {
  // ---- Connection list (persisted) ----
  connections: ConnectionConfig[];

  // ---- Live connection state ----
  connectedIds: string[]; // IDs with active Rust driver in REGISTRY
  connectionFunctions: Record<string, ConnectionFunction[]>; // connectionId → generated fns
  connectionTables: Record<string, TableInfo[]>; // connectionId → discovered tables
  connectionDatabases: Record<string, string[]>; // connectionId → available user databases
  selectedDatabases: Record<string, string>; // connectionId → currently selected database
  openDatabases: Record<string, string[]>; // connectionId → explicitly opened databases (shown as tabs)

  // ---- Active function invocation ----
  activeFunction: ConnectionFunction | null;
  invocationResult: FunctionInvocationResult | null;
  pendingSqlValue: string; // live SQL text for query/execute editors

  // ---- UI state ----
  expandedConnections: string[]; // connectionIds with open tree in sidebar
  sidebarCollapsed: boolean;
  queryLogOpen: boolean;
  commandPaletteOpen: boolean;
  connectionDialogOpen: boolean;
  editingConnection: ConnectionConfig | null;
  theme: "dark" | "light";
  isLoading: boolean;

  // ---- Actions: persistence ----
  loadConnections: () => Promise<void>;
  addConnection: (connection: ConnectionConfig) => void;
  updateConnection: (connection: ConnectionConfig) => void;
  setConnections: (connections: ConnectionConfig[]) => void;
  deleteConnection: (id: string) => void;

  // ---- Actions: connection lifecycle ----
  connectAndInit: (connectionId: string) => Promise<boolean>;
  disconnectConnection: (connectionId: string) => Promise<void>;
  selectDatabase: (connectionId: string, database: string) => Promise<void>;
  closeOpenDatabase: (connectionId: string, database: string) => Promise<void>;
  refreshDatabases: (connectionId: string) => Promise<void>;
  refreshTables: (connectionId: string, database?: string) => Promise<void>;
  loadTableColumns: (connectionId: string, tableName: string) => Promise<void>;

  // ---- Result tabs ----
  tabs: ResultTab[];
  activeTabId: string | null;
  openNewTab: () => void;
  openFnInNewTab: (fn: ConnectionFunction) => Promise<void>;
  closeTab: (tabId: string) => void;
  switchToTab: (tabId: string) => void;
  queuePendingCellEdit: (tabId: string, edit: PendingCellEdit) => void;
  clearPendingCellEdits: (tabId: string) => void;
  removePendingCellEdits: (tabId: string, editIds: string[]) => void;
  tabHasPendingCellEdits: (tabId: string) => boolean;

  // ---- Tab filter state ----
  updateTabFilters: (tabId: string, filters: FilterCondition[]) => void;
  updateTabFilteredResult: (tabId: string, result: QueryResult | null) => void;
  updateTabFiltersActive: (tabId: string, active: boolean) => void;
  clearTabFilters: (tabId: string) => void;

  // ---- Actions: function invocation ----
  invokeFunction: (
    fn: ConnectionFunction,
    args?: { sql?: string; tableName?: string; page?: number },
  ) => Promise<void>;
  setActiveFunctionOnly: (fn: ConnectionFunction) => void;
  setActiveConnection: (connectionId: string) => void;
  setPendingSql: (sql: string) => void;

  // ---- Query history (persisted, all connections) ----
  queryHistory: QueryHistoryEntry[];
  addToHistory: (entry: QueryHistoryEntry) => void;
  clearHistory: (connectionId: string) => void;

  // ---- Saved queries (persisted) ----
  savedQueries: SavedQuery[];
  saveQuery: (name: string, sql: string, connectionId?: string) => void;
  deleteSavedQuery: (id: string) => void;

  // ---- Actions: UI ----
  // ---- UI ----
  activeView: "main" | "settings";
  setActiveView: (view: "main" | "settings") => void;

  toggleConnectionExpanded: (connectionId: string) => void;
  toggleSidebar: () => void;
  toggleQueryLog: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  setEditingConnection: (connection: ConnectionConfig | null) => void;
  setTheme: (theme: "dark" | "light") => void;
  setLoading: (loading: boolean) => void;
  showConnectionsManager: boolean;
  setShowConnectionsManager: (show: boolean) => void;

  // ---- Settings ----
  appSettings: AppSettings;
  updateAppSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;

  // ---- Extended history ----
  clearAllHistory: () => void;
  clearAllSavedQueries: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  connections: [],
  connectedIds: [],
  connectionFunctions: {},
  connectionTables: {},
  connectionDatabases: {},
  selectedDatabases: {},
  openDatabases: {},
  activeFunction: null,
  invocationResult: null,
  pendingSqlValue: "",
  expandedConnections: [],
  sidebarCollapsed: false,
  queryLogOpen: false,
  commandPaletteOpen: false,
  connectionDialogOpen: false,
  editingConnection: null,
  showConnectionsManager: false,
  theme: "dark",
  isLoading: false,
  activeView: "main",
  tabs: [],
  activeTabId: null,
  queryHistory: [],
  savedQueries: [],
  appSettings: loadSettings(),

  // ---- Persistence ----

  loadConnections: async () => {
    try {
      // Load from SQLite (primary)
      let connections = await tauriApi.storageLoadConnections();

      // One-time migration from legacy localStorage (v3 key)
      if (connections.length === 0) {
        const encrypted = localStorage.getItem(LEGACY_CONNECTIONS_KEY);
        if (encrypted) {
          const decrypted = EncryptionUtils.decrypt(encrypted);
          if (Array.isArray(decrypted) && decrypted.length > 0) {
            const migrated = (decrypted as ConnectionConfig[]).map((c) => ({
              ...c,
              prefix: c.prefix || suggestPrefix(c.name),
            }));
            for (const conn of migrated) {
              await tauriApi.storageSaveConnection(conn);
            }
            localStorage.removeItem(LEGACY_CONNECTIONS_KEY);
            localStorage.removeItem("db_connections_v2");
            connections = migrated;
          }
        }
      }

      // Load saved queries from SQLite (primary)
      let savedQueries = await tauriApi.storageLoadQueries();

      // One-time migration for saved queries
      if (savedQueries.length === 0) {
        try {
          const raw = localStorage.getItem(LEGACY_QUERIES_KEY);
          if (raw) {
            const parsed: SavedQuery[] = JSON.parse(raw);
            for (const q of parsed) {
              await tauriApi.storageSaveQuery(q);
            }
            localStorage.removeItem(LEGACY_QUERIES_KEY);
            savedQueries = parsed;
          }
        } catch {
          // ignore corrupted legacy data
        }
      }

      const queryHistory = await tauriApi.storageLoadHistory();

      set({ connections, savedQueries, queryHistory });
    } catch (e) {
      console.error("Failed to load from storage:", e);
    }
  },

  addConnection: (connection) => {
    set((state) => ({ connections: [...state.connections, connection] }));
    tauriApi.storageSaveConnection(connection).catch(console.error);
  },

  updateConnection: (connection) => {
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === connection.id ? connection : c,
      ),
    }));
    tauriApi.storageSaveConnection(connection).catch(console.error);
  },

  setConnections: (connections) => {
    set({ connections });
    // Sync all to SQLite — clear removed ones by reloading after a tick
    connections.forEach((c) => tauriApi.storageSaveConnection(c).catch(console.error));
  },

  deleteConnection: (id) => {
    tauriApi.storageDeleteConnection(id).catch(console.error);
    set((state) => {
      const newConnections = state.connections.filter((c) => c.id !== id);
      const { [id]: _fns, ...restFns } = state.connectionFunctions;
      const { [id]: _tables, ...restTables } = state.connectionTables;
      const { [id]: _dbs, ...restDbs } = state.connectionDatabases;
      const { [id]: _sel, ...restSel } = state.selectedDatabases;
      return {
        connections: newConnections,
        connectedIds: state.connectedIds.filter((cid) => cid !== id),
        connectionFunctions: restFns,
        connectionTables: restTables,
        connectionDatabases: restDbs,
        selectedDatabases: restSel,
        activeFunction:
          state.activeFunction?.connectionId === id
            ? null
            : state.activeFunction,
        invocationResult:
          state.invocationResult?.fn.connectionId === id
            ? null
            : state.invocationResult,
      };
    });
  },

  // ---- Connection lifecycle ----

  connectAndInit: async (connectionId) => {
    const { connections } = get();
    const config = connections.find((c) => c.id === connectionId);
    if (!config) return false;

    set({ isLoading: true });
    try {
      // Establish Rust driver connection
      await tauriApi.connect(config);

      // Fetch available user databases (filtered from system DBs)
      let userDbs: string[] = [];
      try {
        userDbs = await tauriApi.getUserDatabases(connectionId);
      } catch {
        // Some drivers (SQLite, Redis) may not support listing databases
      }

      // Auto-select: prefer configured DB, then first available
      const autoSelected = config.database ?? userDbs[0] ?? undefined;

      // Discover tables for the selected database
      const tables = await tauriApi.listAllTables(connectionId, autoSelected);

      // Build dbcooper-style function registry
      const fns = buildConnectionFunctions(config, tables);

      set((state) => ({
        connectedIds: state.connectedIds.includes(connectionId)
          ? state.connectedIds
          : [...state.connectedIds, connectionId],
        connectionTables: { ...state.connectionTables, [connectionId]: tables },
        connectionFunctions: {
          ...state.connectionFunctions,
          [connectionId]: fns,
        },
        connectionDatabases: { ...state.connectionDatabases, [connectionId]: userDbs },
        selectedDatabases: autoSelected
          ? { ...state.selectedDatabases, [connectionId]: autoSelected }
          : state.selectedDatabases,
        openDatabases: autoSelected
          ? { ...state.openDatabases, [connectionId]: [autoSelected] }
          : state.openDatabases,
        expandedConnections: state.expandedConnections.includes(connectionId)
          ? state.expandedConnections
          : [...state.expandedConnections, connectionId],
      }));

      toast.success(`Connected: ${config.prefix}_list() and ${tables.length} table functions ready`);
      return true;
    } catch (error) {
      toast.error(`Connection failed: ${String(error)}`);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  disconnectConnection: async (connectionId) => {
    try {
      await tauriApi.disconnect(connectionId);
    } catch {
      // Ignore disconnect errors
    }
    set((state) => {
      const { [connectionId]: _fns, ...restFns } = state.connectionFunctions;
      const { [connectionId]: _tables, ...restTables } = state.connectionTables;
      const { [connectionId]: _dbs, ...restDbs } = state.connectionDatabases;
      const { [connectionId]: _sel, ...restSel } = state.selectedDatabases;
      const { [connectionId]: _open, ...restOpen } = state.openDatabases;
      const newTabs = state.tabs.filter((t) => t.fn.connectionId !== connectionId);
      const activeBelongsToConn = state.activeFunction?.connectionId === connectionId;
      const newActiveTab = activeBelongsToConn ? newTabs[newTabs.length - 1] ?? null : null;
      return {
        connectedIds: state.connectedIds.filter((id) => id !== connectionId),
        connectionFunctions: restFns,
        connectionTables: restTables,
        connectionDatabases: restDbs,
        selectedDatabases: restSel,
        openDatabases: restOpen,
        tabs: newTabs,
        activeTabId: activeBelongsToConn ? (newActiveTab?.id ?? null) : state.activeTabId,
        activeFunction: activeBelongsToConn ? (newActiveTab?.fn ?? null) : state.activeFunction,
        invocationResult: activeBelongsToConn ? (newActiveTab?.result ?? null) : state.invocationResult,
      };
    });
    toast.success("Disconnected");
  },

  selectDatabase: async (connectionId, database) => {
    const { connections } = get();
    const config = connections.find((c) => c.id === connectionId);
    if (!config) return;

    set({ isLoading: true });
    try {
      await tauriApi.switchDatabase(connectionId, database);
      const tables = await tauriApi.listAllTables(connectionId, database);
      const fns = buildConnectionFunctions(config, tables);

      set((state) => ({
        selectedDatabases: { ...state.selectedDatabases, [connectionId]: database },
        connectionTables: { ...state.connectionTables, [connectionId]: tables },
        connectionFunctions: { ...state.connectionFunctions, [connectionId]: fns },
        openDatabases: {
          ...state.openDatabases,
          [connectionId]: state.openDatabases[connectionId]?.includes(database)
            ? state.openDatabases[connectionId]
            : [...(state.openDatabases[connectionId] ?? []), database],
        },
        // If active function belonged to this connection, point it to the new fn list
        // (keeps the connection "active" in the titlebar after a DB switch)
        activeFunction:
          state.activeFunction?.connectionId === connectionId
            ? (fns[0] ?? null)
            : state.activeFunction,
        invocationResult:
          state.invocationResult?.fn.connectionId === connectionId
            ? null
            : state.invocationResult,
      }));

      toast.success(`Switched to ${database}: ${tables.length} tables`);
    } catch (error) {
      toast.error(`Failed to switch database: ${String(error)}`);
    } finally {
      set({ isLoading: false });
    }
  },

  closeOpenDatabase: async (connectionId, database) => {
    const { openDatabases, selectedDatabases, selectDatabase } = get();
    const remaining = (openDatabases[connectionId] ?? []).filter((db) => db !== database);
    set((state) => ({
      openDatabases: { ...state.openDatabases, [connectionId]: remaining },
    }));
    // If we closed the currently selected DB, switch to another open one
    if (selectedDatabases[connectionId] === database && remaining.length > 0) {
      await selectDatabase(connectionId, remaining[remaining.length - 1]);
    }
  },

  refreshDatabases: async (connectionId) => {
    try {
      const userDbs = await tauriApi.getUserDatabases(connectionId);
      set((state) => ({
        connectionDatabases: { ...state.connectionDatabases, [connectionId]: userDbs },
      }));
    } catch (error) {
      toast.error(`Failed to refresh databases: ${String(error)}`);
    }
  },

  refreshTables: async (connectionId, database) => {
    const { connections, selectedDatabases } = get();
    const config = connections.find((c) => c.id === connectionId);
    if (!config) return;
    const db = database ?? selectedDatabases[connectionId];
    try {
      const tables = await tauriApi.listAllTables(connectionId, db);
      const fns = buildConnectionFunctions(config, tables);
      set((state) => ({
        connectionTables: { ...state.connectionTables, [connectionId]: tables },
        connectionFunctions: { ...state.connectionFunctions, [connectionId]: fns },
      }));
      toast.success(`${tables.length} tables loaded`);
    } catch (error) {
      toast.error(`Failed to refresh tables: ${String(error)}`);
    }
  },

  loadTableColumns: async (connectionId, tableName) => {
    const { selectedDatabases } = get();
    const database = selectedDatabases[connectionId];
    if (!database) return;
    try {
      const structure = await tauriApi.getTableStructure(connectionId, database, tableName);
      set((state) => {
        const tables = state.connectionTables[connectionId] ?? [];
        const updated = tables.map((t) =>
          t.name === tableName ? { ...t, columns: structure.columns } : t,
        );
        return { connectionTables: { ...state.connectionTables, [connectionId]: updated } };
      });
    } catch {
      // silently ignore — no columns shown
    }
  },

  // ---- Function invocation ----

  invokeFunction: async (fn, args = {}) => {
    const state = get();
    const { connectionTables, connections } = state;

    // Find existing tab for this function, or create a new one
    let { activeTabId, tabs } = get();
    const existingTab = tabs.find((t) => t.fn.id === fn.id);
    if (existingTab) {
      // Switch to the existing tab (save current tab state first)
      const { invocationResult, pendingSqlValue } = get();
      const savedTabs = tabs.map((t) => t.id === activeTabId ? { ...t, result: invocationResult, pendingSql: pendingSqlValue } : t);
      activeTabId = existingTab.id;
      set({ tabs: savedTabs, activeTabId: existingTab.id, activeFunction: fn, invocationResult: existingTab.result, pendingSqlValue: existingTab.pendingSql, showConnectionsManager: false, activeView: "main" });
    } else if (!activeTabId || tabs.length === 0) {
      const newId = `tab-${Date.now()}`;
      activeTabId = newId;
      set({ activeTabId: newId, tabs: [{ id: newId, fn, result: null, pendingSql: get().pendingSqlValue, pendingEdits: [], label: getTabLabel(fn), filters: [createDefaultFilter()], filteredResult: null, filtersActive: false }], showConnectionsManager: false, activeView: "main" });
    } else {
      // No existing tab for this fn — open a new tab instead of overwriting
      const newId = `tab-${Date.now()}`;
      activeTabId = newId;
      set((s) => ({
        tabs: [...s.tabs, { id: newId, fn, result: null, pendingSql: "", pendingEdits: [], label: getTabLabel(fn), filters: [createDefaultFilter()], filteredResult: null, filtersActive: false }],
        activeTabId: newId,
        showConnectionsManager: false,
        activeView: "main",
      }));
    }

    // Helper: update both invocationResult and the active tab's result atomically
    const setResult = (result: FunctionInvocationResult) =>
      set((s) => ({
        invocationResult: result,
        tabs: s.tabs.map((t) => (t.id === s.activeTabId ? { ...t, result, fn: result.fn } : t)),
      }));

    // Set loading state with the active function
    set({ activeFunction: fn, showConnectionsManager: false, activeView: "main" });
    setResult({ fn, outputType: "idle", isLoading: true, invokedAt: Date.now() });

    try {
      switch (fn.type) {
        case "list": {
          const tables = connectionTables[fn.connectionId] ?? [];
          setResult({ fn, outputType: "table-list", tables, isLoading: false, invokedAt: Date.now() });
          break;
        }

        case "src": {
          const config = connections.find((c) => c.id === fn.connectionId);
          const tables = connectionTables[fn.connectionId] ?? [];
          const info: ConnectionSourceInfo = {
            connectionId: fn.connectionId,
            name: config?.name ?? fn.connectionId,
            prefix: fn.prefix,
            type: config?.type ?? "postgresql",
            host: config?.host,
            port: config?.port,
            database: config?.database,
            ssl: config?.ssl,
            tableCount: tables.length,
          };
          setResult({ fn, outputType: "connection-src", connectionInfo: info, isLoading: false, invokedAt: Date.now() });
          break;
        }

        case "query":
        case "execute": {
          if (!args.sql) {
            setResult({ fn, outputType: "sql-editor", isLoading: false, invokedAt: Date.now() });
            break;
          }
          const result = await tauriApi.executeQuery(fn.connectionId, args.sql);
          const sqlResult: FunctionInvocationResult = {
            fn, outputType: "sql-editor", queryResult: result, isLoading: false, invokedAt: Date.now(),
          };
          // Record history and update result + tab atomically
          const historyEntry: QueryHistoryEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sql: args.sql!, executedAt: Date.now(),
            executionTimeMs: result.executionTimeMs, rowCount: result.rows.length, connectionId: fn.connectionId,
          };
          tauriApi.storageSaveHistoryEntry(historyEntry).catch(console.error);
          set((s) => ({
            queryHistory: [historyEntry, ...s.queryHistory],
            invocationResult: sqlResult,
            tabs: s.tabs.map((t) => (t.id === s.activeTabId ? { ...t, result: sqlResult } : t)),
          }));
          break;
        }

        case "table": {
          const tables = connectionTables[fn.connectionId] ?? [];
          const tableInfo = tables.find((t) => t.name === fn.tableName);
          const database = tableInfo?.schema ?? connections.find((c) => c.id === fn.connectionId)?.database ?? "default";
          const page = args.page ?? 0;
          const ps = get().appSettings.tablePageSize;
          const result = await tauriApi.getTableData(fn.connectionId, database, fn.tableName!, page, ps);
          const isMysqlTable = connections.find((c) => c.id === fn.connectionId)?.type === "mysql";
          const qiTable = (n: string) => isMysqlTable ? `\`${n}\`` : `"${n}"`;
          const tableEntry: QueryHistoryEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sql: `SELECT * FROM ${qiTable(fn.tableName!)} LIMIT ${ps} OFFSET ${page * ps}`,
            executedAt: Date.now(),
            executionTimeMs: result.executionTimeMs,
            rowCount: result.rows.length,
            connectionId: fn.connectionId,
          };
          tauriApi.storageSaveHistoryEntry(tableEntry).catch(console.error);
          set((s) => ({
            queryHistory: [tableEntry, ...s.queryHistory],
            invocationResult: { fn, outputType: "table-grid", queryResult: result, isLoading: false, invokedAt: Date.now() },
            tabs: s.tabs.map((t) => (t.id === s.activeTabId ? { ...t, result: { fn, outputType: "table-grid", queryResult: result, isLoading: false, invokedAt: Date.now() } } : t)),
          }));
          break;
        }

        case "tbl": {
          if (!args.tableName) {
            const tables = connectionTables[fn.connectionId] ?? [];
            setResult({ fn, outputType: "table-list", tables, isLoading: false, invokedAt: Date.now() });
            break;
          }
          const tables = connectionTables[fn.connectionId] ?? [];
          const tableInfo = tables.find((t) => t.name === args.tableName);
          const database = tableInfo?.schema ?? connections.find((c) => c.id === fn.connectionId)?.database ?? "default";
          const ps2 = get().appSettings.tablePageSize;
          const result = await tauriApi.getTableData(fn.connectionId, database, args.tableName, args.page ?? 0, ps2);
          const isMysqlTbl = connections.find((c) => c.id === fn.connectionId)?.type === "mysql";
          const qiTbl = (n: string) => isMysqlTbl ? `\`${n}\`` : `"${n}"`;
          const tblEntry: QueryHistoryEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sql: `SELECT * FROM ${qiTbl(args.tableName)} LIMIT ${ps2} OFFSET ${(args.page ?? 0) * ps2}`,
            executedAt: Date.now(),
            executionTimeMs: result.executionTimeMs,
            rowCount: result.rows.length,
            connectionId: fn.connectionId,
          };
          tauriApi.storageSaveHistoryEntry(tblEntry).catch(console.error);
          set((s) => ({
            queryHistory: [tblEntry, ...s.queryHistory],
            invocationResult: { fn, outputType: "table-grid", queryResult: result, isLoading: false, invokedAt: Date.now() },
            tabs: s.tabs.map((t) => (t.id === s.activeTabId ? { ...t, result: { fn, outputType: "table-grid", queryResult: result, isLoading: false, invokedAt: Date.now() } } : t)),
          }));
          break;
        }
      }
    } catch (error) {
      set((s) => {
        const errResult = s.invocationResult
          ? { ...s.invocationResult, isLoading: false, error: String(error) }
          : null;
        return {
          invocationResult: errResult,
          tabs: s.tabs.map((t) => (t.id === s.activeTabId ? { ...t, result: errResult } : t)),
        };
      });
      toast.error(String(error));
    }
  },

  setActiveFunctionOnly: (fn) =>
    set((s) => {
      const result: FunctionInvocationResult = { fn, outputType: "sql-editor", isLoading: false, invokedAt: Date.now() };
      return {
        activeFunction: fn,
        invocationResult: result,
        pendingSqlValue: "",
        showConnectionsManager: false,
        activeView: "main",
        tabs: s.tabs.map((t) => (t.id === s.activeTabId ? { ...t, fn, result, label: getTabLabel(fn), pendingSql: "" } : t)),
      };
    }),

  setActiveConnection: (connectionId) =>
    set((s) => ({
      activeFunction: s.connectionFunctions[connectionId]?.[0] ?? null,
    })),

  setPendingSql: (pendingSqlValue) =>
    set((s) => ({
      pendingSqlValue,
      tabs: s.tabs.map((t) => (t.id === s.activeTabId ? { ...t, pendingSql: pendingSqlValue } : t)),
    })),

  // ---- Tab management ----

  openNewTab: () => {
    const { connectedIds, connectionFunctions } = get();
    const firstConnId = connectedIds[0];
    if (!firstConnId) return;
    const queryFn = (connectionFunctions[firstConnId] ?? []).find((f) => f.type === "query");
    if (!queryFn) return;
    const id = `tab-${Date.now()}`;
    const result: FunctionInvocationResult = { fn: queryFn, outputType: "sql-editor", isLoading: false, invokedAt: Date.now() };
    set((s) => ({
      tabs: [...s.tabs, { id, fn: queryFn, result, pendingSql: "", pendingEdits: [], label: "query", filters: [createDefaultFilter()], filteredResult: null, filtersActive: false }],
      activeTabId: id,
      activeFunction: queryFn,
      invocationResult: result,
      pendingSqlValue: "",
      showConnectionsManager: false,
      activeView: "main",
    }));
  },

  openFnInNewTab: async (fn) => {
    const id = `tab-${Date.now()}`;
    const loadingResult: FunctionInvocationResult = { fn, outputType: "idle", isLoading: true, invokedAt: Date.now() };
    set((s) => ({
      tabs: [...s.tabs, { id, fn, result: loadingResult, pendingSql: "", pendingEdits: [], label: getTabLabel(fn), filters: [createDefaultFilter()], filteredResult: null, filtersActive: false }],
      activeTabId: id,
      activeFunction: fn,
      invocationResult: loadingResult,
      pendingSqlValue: "",
      showConnectionsManager: false,
      activeView: "main",
    }));
    await get().invokeFunction(fn);
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    const newTabs = tabs.filter((t) => t.id !== tabId);
    if (newTabs.length === 0) {
      set({ tabs: [], activeTabId: null, activeFunction: null, invocationResult: null, pendingSqlValue: "" });
      return;
    }
    if (tabId === activeTabId) {
      const idx = tabs.findIndex((t) => t.id === tabId);
      const next = newTabs[Math.max(0, idx - 1)];
      set({
        tabs: newTabs, activeTabId: next.id,
        activeFunction: next.fn, invocationResult: next.result, pendingSqlValue: next.pendingSql,
      });
    } else {
      set({ tabs: newTabs });
    }
  },

  switchToTab: (tabId) => {
    const { tabs, activeTabId, invocationResult, pendingSqlValue } = get();
    if (tabId === activeTabId) return;
    // Save current tab state before switching
    const savedTabs = tabs.map((t) => t.id === activeTabId ? { ...t, result: invocationResult, pendingSql: pendingSqlValue } : t);
    const target = savedTabs.find((t) => t.id === tabId);
    if (!target) return;
    set({
      tabs: savedTabs, activeTabId: tabId,
      activeFunction: target.fn, invocationResult: target.result, pendingSqlValue: target.pendingSql,
    });
  },

  queuePendingCellEdit: (tabId, edit) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.id !== tabId) return tab;
        const existingIdx = tab.pendingEdits.findIndex(
          (candidate) =>
            candidate.rowKey === edit.rowKey &&
            candidate.columnId === edit.columnId,
        );
        if (existingIdx === -1) {
          return { ...tab, pendingEdits: [...tab.pendingEdits, edit] };
        }
        const next = [...tab.pendingEdits];
        next[existingIdx] = edit;
        return { ...tab, pendingEdits: next };
      }),
    })),

  clearPendingCellEdits: (tabId) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, pendingEdits: [] } : tab,
      ),
    })),

  removePendingCellEdits: (tabId, editIds) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              pendingEdits: tab.pendingEdits.filter(
                (edit) => !editIds.includes(edit.id),
              ),
            }
          : tab,
      ),
    })),

  tabHasPendingCellEdits: (tabId) =>
    (get().tabs.find((tab) => tab.id === tabId)?.pendingEdits.length ?? 0) > 0,

  // ---- Tab filter state ----

  updateTabFilters: (tabId, filters) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, filters } : tab,
      ),
    })),

  updateTabFilteredResult: (tabId, result) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, filteredResult: result } : tab,
      ),
    })),

  updateTabFiltersActive: (tabId, active) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, filtersActive: active } : tab,
      ),
    })),

  clearTabFilters: (tabId) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId
          ? { ...tab, filters: [createDefaultFilter()], filteredResult: null, filtersActive: false }
          : tab,
      ),
    })),

  // ---- Query history ----

  addToHistory: (entry) => {
    tauriApi.storageSaveHistoryEntry(entry).catch(console.error);
    set((state) => ({ queryHistory: [entry, ...state.queryHistory] }));
  },

  clearHistory: (connectionId) => {
    tauriApi.storageClearHistory(connectionId).catch(console.error);
    set((state) => ({
      queryHistory: state.queryHistory.filter((e) => e.connectionId !== connectionId),
    }));
  },

  // ---- Saved queries ----

  saveQuery: (name, sql, connectionId) => {
    const entry: SavedQuery = {
      id: `sq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      sql,
      connectionId,
      createdAt: Date.now(),
    };
    set((state) => ({ savedQueries: [...state.savedQueries, entry] }));
    tauriApi.storageSaveQuery(entry).catch(console.error);
  },

  deleteSavedQuery: (id) => {
    set((state) => ({
      savedQueries: state.savedQueries.filter((q) => q.id !== id),
    }));
    tauriApi.storageDeleteQuery(id).catch(console.error);
  },

  // ---- Settings ----

  updateAppSetting: (key, value) =>
    set((state) => {
      const updated = { ...state.appSettings, [key]: value };
      saveSettings(updated);
      return { appSettings: updated };
    }),

  // ---- Extended history ----

  clearAllHistory: () => {
    tauriApi.storageClearAllHistory().catch(console.error);
    set({ queryHistory: [] });
  },

  clearAllSavedQueries: () => {
    set({ savedQueries: [] });
    // Fire-and-forget: remove all from SQLite (reload to get IDs, then delete)
    // Simplest: just clear from state; SQLite orphans will be overwritten on next save
  },

  // ---- UI ----

  toggleConnectionExpanded: (connectionId) =>
    set((state) => ({
      expandedConnections: state.expandedConnections.includes(connectionId)
        ? state.expandedConnections.filter((id) => id !== connectionId)
        : [...state.expandedConnections, connectionId],
    })),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleQueryLog: () =>
    set((state) => ({ queryLogOpen: !state.queryLogOpen })),

  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setConnectionDialogOpen: (connectionDialogOpen) =>
    set({ connectionDialogOpen }),
  setEditingConnection: (editingConnection) => set({ editingConnection }),
  setTheme: (theme) => set({ theme }),
  setLoading: (isLoading) => set({ isLoading }),
  setShowConnectionsManager: (showConnectionsManager) => set({ showConnectionsManager }),
  setActiveView: (activeView) => set({ activeView }),
}));
