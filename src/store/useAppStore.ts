import { create } from "zustand";
import {
  ConnectionConfig,
  ConnectionFunction,
  FunctionInvocationResult,
  PendingCellEdit,
  CellEditHistoryEntry,
  TableInfo,
  ConnectionSourceInfo,
   QueryHistoryEntry,
   SavedQuery,
   UserSnippet,
  ResultTab,
  FilterCondition,
  QueryResult,
  PinnedTable,
  WorkspaceSnapshot,
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

// ── Workspace persistence ──────────────────────────────────────────────────────
let _workspaceSaveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleWorkspaceSave(getState: () => AppState) {
  if (_workspaceSaveTimer) clearTimeout(_workspaceSaveTimer);
  _workspaceSaveTimer = setTimeout(() => {
    const s = getState();
    const snapshot: WorkspaceSnapshot = {
      activeConnectionId: s.activeFunction?.connectionId ?? null,
      activeTabId: s.activeTabId,
      selectedDatabases: s.selectedDatabases,
      tabs: s.tabs.map((t) => ({
        id: t.id,
        fnId: t.fn.id,
        label: t.label,
        pendingSql: t.id === s.activeTabId ? s.pendingSqlValue : t.pendingSql,
      })),
      savedAt: Date.now(),
    };
    tauriApi.storageSaveWorkspace(JSON.stringify(snapshot)).catch(console.error);
  }, 500);
}

// Legacy localStorage keys — kept only for one-time migration
const LEGACY_CONNECTIONS_KEY = "db_connections_v3";
const LEGACY_QUERIES_KEY = "db_saved_queries_v1";
const SETTINGS_KEY = "db_connect_settings_v1";
const THEME_KEY = "db_connect_theme_v1";
const LAYOUT_KEY = "db_connect_layout_v1";
const PINNED_TABLES_KEY = "db_connect_pinned_tables_v1";

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
  editorWordWrap: boolean;
  editorTabSize: 2 | 4;
  tablePageSize: 25 | 50 | 100 | 200;
  uiZoom: 100 | 110 | 125 | 140 | 150;
  editorDarkTheme: EditorThemeOption;
  editorLightTheme: EditorThemeOption;
  uiDarkTheme: UiDarkThemeOption;
  uiLightTheme: UiLightThemeOption;
  uiFontFamily: string;
  monoFontFamily: string;
  aiEnabled: boolean;
  rowDensity: "compact" | "default" | "comfortable";
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
  queryTimeoutSecs: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  editorFontSize: 13,
  editorWordWrap: false,
  editorTabSize: 2,
  tablePageSize: 50,
  uiZoom: 125,
  editorDarkTheme: "dark-one-dark",
  editorLightTheme: "light-github",
  uiDarkTheme: "dark",
  uiLightTheme: "light",
  uiFontFamily: DB_FONT_SANS,
  monoFontFamily: DB_FONT_MONO,
  aiEnabled: false,
  rowDensity: "default",
  aiProvider: "openrouter",
  aiAuthMode: "oauth",
  aiDefaultModel: "openrouter/free",
  queryTimeoutSecs: 30,
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

interface LayoutState { sidebarCollapsed: boolean; dbTabsCollapsed: boolean; queryLogOpen: boolean; }
function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) return { ...{ sidebarCollapsed: false, dbTabsCollapsed: false, queryLogOpen: false }, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { sidebarCollapsed: false, dbTabsCollapsed: false, queryLogOpen: false };
}
function saveLayout(l: LayoutState) {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(l));
}

function loadPinnedTables(): PinnedTable[] {
  try {
    const raw = localStorage.getItem(PINNED_TABLES_KEY);
    if (raw) return JSON.parse(raw) as PinnedTable[];
  } catch { /* ignore */ }
  return [];
}
function savePinnedTables(tables: PinnedTable[]) {
  localStorage.setItem(PINNED_TABLES_KEY, JSON.stringify(tables));
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
  connectionFunctions: Record<string, Record<string, ConnectionFunction[]>>; // connectionId → database → generated fns
  connectionTables: Record<string, Record<string, TableInfo[]>>; // connectionId → database → discovered tables
  connectionDatabases: Record<string, string[]>; // connectionId → available user databases
  selectedDatabases: Record<string, string>; // connectionId → currently selected database
  openDatabases: Record<string, string[]>; // connectionId → explicitly opened databases (shown as tabs)
  connectionLatency: Record<string, number | null>; // connectionId → last ping ms (null = unknown)
  connectionConnectedAt: Record<string, number>; // connectionId → timestamp (ms) when connected

  // ---- Active function invocation ----
  activeFunction: ConnectionFunction | null;
  invocationResult: FunctionInvocationResult | null;
  pendingSqlValue: string; // live SQL text for query/execute editors

  // ---- UI state ----
  expandedConnections: string[]; // connectionIds with open tree in sidebar
  sidebarCollapsed: boolean;
  dbTabsCollapsed: boolean;
  activeConnectionId: string | null; // which connection is selected in the connections panel
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
  closeOtherTabs: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  duplicateTab: (tabId: string) => void;
  reorderTabs: (fromId: string, toId: string) => void;
  switchToTab: (tabId: string) => void;
  queuePendingCellEdit: (tabId: string, edit: PendingCellEdit) => void;
  clearPendingCellEdits: (tabId: string) => void;
  removePendingCellEdits: (tabId: string, editIds: string[]) => void;
  tabHasPendingCellEdits: (tabId: string) => boolean;
  pushUndoEntry: (tabId: string, entry: CellEditHistoryEntry) => void;
  undoLastCellEdit: (tabId: string) => Promise<void>;

  // ---- Tab filter state ----
  updateTabFilters: (tabId: string, filters: FilterCondition[]) => void;
  updateTabFilteredResult: (tabId: string, result: QueryResult | null) => void;
  updateTabFiltersActive: (tabId: string, active: boolean) => void;
  clearTabFilters: (tabId: string) => void;

  // ---- Actions: function invocation ----
  invokeFunction: (
    fn: ConnectionFunction,
    args?: { sql?: string; tableName?: string; page?: number; pageSize?: number },
  ) => Promise<void>;
  setActiveFunctionOnly: (fn: ConnectionFunction) => void;
  clearActiveFunction: () => void;
  setActiveConnection: (connectionId: string) => void;
  setPendingSql: (sql: string) => void;
  clearInvocationError: () => void;

  runMultiStatementSql: (fn: ConnectionFunction, sql: string) => Promise<void>;
  pingConnectionHealth: (connectionId: string) => Promise<void>;

  // ---- Query history (persisted, all connections) ----
  queryHistory: QueryHistoryEntry[];
  addToHistory: (entry: QueryHistoryEntry) => void;
  clearHistory: (connectionId: string) => void;

  // ---- Saved queries (persisted) ----
  savedQueries: SavedQuery[];
  saveQuery: (name: string, sql: string, connectionId?: string, folder?: string) => void;
  moveSavedQueryFolder: (id: string, folder: string | undefined) => void;
  deleteSavedQuery: (id: string) => void;

  // ---- User snippets (persisted) ----
  userSnippets: UserSnippet[];
  saveUserSnippet: (snippet: Omit<UserSnippet, "id" | "createdAt">) => Promise<void>;
  deleteUserSnippet: (id: string) => Promise<void>;

  // ---- Internal ----
  _pendingWorkspaceSnapshot: WorkspaceSnapshot | null;

  // ---- Actions: UI ----
  // ---- UI ----
  activeView: "main" | "settings" | "new-connection" | "schema-diff";
  setActiveView: (view: "main" | "settings" | "new-connection" | "schema-diff") => void;

  toggleConnectionExpanded: (connectionId: string) => void;
  toggleSidebar: () => void;
  toggleDbTabs: () => void;
  setActiveConnectionId: (id: string | null) => void;
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
  deleteHistoryEntry: (id: string) => void;

  // ---- Pinned tables ----
  pinnedTables: PinnedTable[];
  pinTable: (connectionId: string, tableName: string, schemaName?: string) => void;
  unpinTable: (connectionId: string, tableName: string) => void;
  isTablePinned: (connectionId: string, tableName: string) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  connections: [],
  connectedIds: [],
  connectionFunctions: {},
  connectionTables: {},
  connectionDatabases: {},
  selectedDatabases: {},
  openDatabases: {},
  connectionLatency: {},
  connectionConnectedAt: {},
  activeFunction: null,
  invocationResult: null,
  pendingSqlValue: "",
  expandedConnections: [],
  ...loadLayout(),
  activeConnectionId: null,
  commandPaletteOpen: false,
  connectionDialogOpen: false,
  editingConnection: null,
  showConnectionsManager: false,
  theme: (localStorage.getItem(THEME_KEY) as "dark" | "light") ?? "dark",
  isLoading: false,
  activeView: "main",
  tabs: [],
  activeTabId: null,
  queryHistory: [],
  savedQueries: [],
  userSnippets: [],
  pinnedTables: loadPinnedTables(),
  appSettings: loadSettings(),
  _pendingWorkspaceSnapshot: null,

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
      const userSnippets = await tauriApi.storageLoadSnippets();

      // Load workspace snapshot — will be applied after connections are established
      let pendingWorkspaceSnapshot: WorkspaceSnapshot | null = null;
      try {
        const raw = await tauriApi.storageLoadWorkspace();
        if (raw) pendingWorkspaceSnapshot = JSON.parse(raw) as WorkspaceSnapshot;
      } catch { /* ignore parse errors */ }

      set({ connections, savedQueries, queryHistory, userSnippets, _pendingWorkspaceSnapshot: pendingWorkspaceSnapshot });
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
        connectionConnectedAt: state.connectionConnectedAt[connectionId]
          ? state.connectionConnectedAt
          : { ...state.connectionConnectedAt, [connectionId]: Date.now() },
        connectionTables: { ...state.connectionTables, [connectionId]: { ...(state.connectionTables[connectionId] ?? {}), [autoSelected ?? ""]: tables } },
        connectionFunctions: {
          ...state.connectionFunctions,
          [connectionId]: { ...(state.connectionFunctions[connectionId] ?? {}), [autoSelected ?? ""]: fns },
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
        activeConnectionId: connectionId,
      }));

      toast.success(`Connected: ${config.prefix}_list() and ${tables.length} table functions ready`);

      // Restore workspace snapshot for this connection (if any)
      const { _pendingWorkspaceSnapshot } = get();
      if (_pendingWorkspaceSnapshot && _pendingWorkspaceSnapshot.activeConnectionId === connectionId) {
        const snapshot = _pendingWorkspaceSnapshot;
        const allFns = fns; // already built above
        const restoredTabs: ResultTab[] = snapshot.tabs
          .map((t) => {
            const fn = allFns.find((f) => f.id === t.fnId);
            if (!fn) return null;
            const result: FunctionInvocationResult = { fn, outputType: fn.type === "query" || fn.type === "execute" ? "sql-editor" : "idle", isLoading: false, invokedAt: Date.now() };
            return { id: t.id, fn, result, pendingSql: t.pendingSql, pendingEdits: [], undoHistory: [], label: t.label, filters: [createDefaultFilter()], filteredResult: null, filtersActive: false } as ResultTab;
          })
          .filter((t): t is ResultTab => t !== null);
        if (restoredTabs.length > 0) {
          const activeTab = restoredTabs.find((t) => t.id === snapshot.activeTabId) ?? restoredTabs[restoredTabs.length - 1];
          set((s) => ({
            tabs: [...s.tabs, ...restoredTabs],
            activeTabId: activeTab.id,
            activeFunction: activeTab.fn,
            invocationResult: activeTab.result,
            pendingSqlValue: activeTab.pendingSql,
            _pendingWorkspaceSnapshot: null,
            selectedDatabases: { ...s.selectedDatabases, ...snapshot.selectedDatabases },
          }));

          // Re-invoke non-SQL tabs so their data is actually loaded (table/list/src tabs show nothing without this)
          const tabsToLoad = restoredTabs.filter((t) => t.fn.type !== "query" && t.fn.type !== "execute");
          for (const tab of tabsToLoad) {
            await get().invokeFunction(tab.fn);
          }

          // Restore focus to the originally active tab after all invocations
          const finalActiveTab = restoredTabs.find((t) => t.id === snapshot.activeTabId) ?? restoredTabs[restoredTabs.length - 1];
          set((s) => ({
            activeTabId: finalActiveTab.id,
            activeFunction: finalActiveTab.fn,
            invocationResult: s.tabs.find((t) => t.id === finalActiveTab.id)?.result ?? finalActiveTab.result,
            pendingSqlValue: finalActiveTab.pendingSql,
          }));
        } else {
          set({ _pendingWorkspaceSnapshot: null });
        }
      }

      // If the user triggered connect while on the new-connection page (either
      // from the page-mode dialog or from the edit modal opened via the sidebar),
      // navigate back to the main view so the page hides automatically.
      if (get().activeView === "new-connection") {
        set({ activeView: "main" });
      }

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
      const { [connectionId]: _lat, ...restLat } = state.connectionLatency;
      const { [connectionId]: _cat, ...restCat } = state.connectionConnectedAt;
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
        connectionLatency: restLat,
        connectionConnectedAt: restCat,
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
        connectionTables: { ...state.connectionTables, [connectionId]: { ...(state.connectionTables[connectionId] ?? {}), [database]: tables } },
        connectionFunctions: { ...state.connectionFunctions, [connectionId]: { ...(state.connectionFunctions[connectionId] ?? {}), [database]: fns } },
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
      const dbKey = db ?? "";
      set((state) => ({
        connectionTables: { ...state.connectionTables, [connectionId]: { ...(state.connectionTables[connectionId] ?? {}), [dbKey]: tables } },
        connectionFunctions: { ...state.connectionFunctions, [connectionId]: { ...(state.connectionFunctions[connectionId] ?? {}), [dbKey]: fns } },
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
      const tableSchema = (get().connectionTables[connectionId]?.[database] ?? []).find((t) => t.name === tableName)?.schema;
      const structure = await tauriApi.getTableStructure(connectionId, database, tableName, tableSchema);
      set((state) => {
        const dbTables = state.connectionTables[connectionId] ?? {};
        const tables = dbTables[database] ?? [];
        const updated = tables.map((t) =>
          t.name === tableName ? { ...t, columns: structure.columns } : t,
        );
        return { connectionTables: { ...state.connectionTables, [connectionId]: { ...dbTables, [database]: updated } } };
      });
    } catch {
      // silently ignore — no columns shown
    }
  },

  // ---- Function invocation ----

  invokeFunction: async (fn, args = {}) => {
    const state = get();
    const { connectionTables, connections } = state;
    // Helper: get flat table list for a connection (merge all databases)
    const getTablesForConn = (connId: string): TableInfo[] =>
      Object.values(connectionTables[connId] ?? {}).flat();

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
      set({ activeTabId: newId, tabs: [{ id: newId, fn, result: null, pendingSql: get().pendingSqlValue, pendingEdits: [], undoHistory: [], label: getTabLabel(fn), filters: [createDefaultFilter()], filteredResult: null, filtersActive: false }], showConnectionsManager: false, activeView: "main" });
    } else {
      // No existing tab for this fn — open a new tab instead of overwriting
      const newId = `tab-${Date.now()}`;
      activeTabId = newId;
      set((s) => ({
        tabs: [...s.tabs, { id: newId, fn, result: null, pendingSql: "", pendingEdits: [], undoHistory: [], label: getTabLabel(fn), filters: [createDefaultFilter()], filteredResult: null, filtersActive: false }],
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
          const tables = getTablesForConn(fn.connectionId);
          setResult({ fn, outputType: "table-list", tables, isLoading: false, invokedAt: Date.now() });
          break;
        }

        case "src": {
          const config = connections.find((c) => c.id === fn.connectionId);
          const tables = getTablesForConn(fn.connectionId);
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
          // Safety mode enforcement
          const conn = get().connections.find((c) => c.id === fn.connectionId);
          const safetyMode = conn?.safetyMode ?? "none";
          const isWriteSql = /^\s*(insert|update|delete|drop|truncate|alter|create|replace|merge|call|exec)\b/i.test(args.sql);
          if (safetyMode !== "none" && isWriteSql) {
            if (safetyMode === "read-only") {
              toast.error("Read-only connection — write queries are blocked.");
              setResult({ fn, outputType: "sql-editor", isLoading: false, invokedAt: Date.now() });
              break;
            } else if (safetyMode === "warn") {
              const confirmed = window.confirm(`⚠️ Safety warning\n\nThis connection is marked as "Warn on write".\n\nAre you sure you want to run this query?\n\n${args.sql.slice(0, 300)}`);
              if (!confirmed) {
                setResult({ fn, outputType: "sql-editor", isLoading: false, invokedAt: Date.now() });
                break;
              }
            }
          }
          const selectedDb = get().selectedDatabases[fn.connectionId];
          const result = await tauriApi.executeQuery(fn.connectionId, args.sql, get().appSettings.queryTimeoutSecs, selectedDb);
          const sqlResult: FunctionInvocationResult = {
            fn, outputType: "sql-editor", queryResult: result, isLoading: false, invokedAt: Date.now(),
          };
          // Record history and update result + tab atomically
          const historyEntry: QueryHistoryEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sql: args.sql!, executedAt: Date.now(),
            executionTimeMs: result.executionTimeMs, rowCount: result.rows.length, connectionId: fn.connectionId,
            status: 'success',
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
          // Use fn.schema (set at build-time from TableInfo.schema) so that tables
          // with the same name in different databases always use the correct one.
          const database = fn.schema ?? connections.find((c) => c.id === fn.connectionId)?.database ?? "default";
          const page = args.page ?? 0;
          const ps = args.pageSize ?? get().appSettings.tablePageSize;
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
            const tables = getTablesForConn(fn.connectionId);
            setResult({ fn, outputType: "table-list", tables, isLoading: false, invokedAt: Date.now() });
            break;
          }
          // Resolve the database: prefer an explicit schema match on the table, then fall back to selectedDatabase
          const tables = getTablesForConn(fn.connectionId);
          const tableInfo = tables.find((t) => t.name === args.tableName);
          const database = tableInfo?.schema ?? get().selectedDatabases[fn.connectionId] ?? connections.find((c) => c.id === fn.connectionId)?.database ?? "default";
          const ps2 = args.pageSize ?? get().appSettings.tablePageSize;
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const fallbackOutputType =
        fn.type === "table" || fn.type === "tbl"
          ? "table-grid"
          : fn.type === "src"
            ? "connection-src"
            : fn.type === "list"
              ? "table-list"
              : "sql-editor";

      // Record failed query in history if we had SQL
      if (fn.type === 'query' || fn.type === 'execute') {
        const sql = args.sql;
        if (sql) {
          const errEntry: QueryHistoryEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sql, executedAt: Date.now(),
            executionTimeMs: 0, rowCount: 0, connectionId: fn.connectionId,
            status: 'error', errorMessage,
          };
          tauriApi.storageSaveHistoryEntry(errEntry).catch(console.error);
          set((s) => ({ queryHistory: [errEntry, ...s.queryHistory] }));
        }
      }
      set((s) => {
        const errResult: FunctionInvocationResult = {
          ...(s.invocationResult ?? {}),
          fn,
          outputType: fallbackOutputType,
          isLoading: false,
          error: errorMessage,
          invokedAt: Date.now(),
        };
        return {
          invocationResult: errResult,
          tabs: s.tabs.map((t) => (t.id === s.activeTabId ? { ...t, result: errResult } : t)),
        };
      });
      toast.error(errorMessage);
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

  clearActiveFunction: () =>
    set({
      activeFunction: null,
      invocationResult: null,
      pendingSqlValue: "",
      activeView: "main",
    }),

  setActiveConnection: (connectionId) =>
    set((s) => ({
      activeConnectionId: connectionId,
      activeFunction: Object.values(s.connectionFunctions[connectionId] ?? {}).flat()[0] ?? null,
    })),

  setPendingSql: (pendingSqlValue) => {
    set((s) => ({
      pendingSqlValue,
      tabs: s.tabs.map((t) => (t.id === s.activeTabId ? { ...t, pendingSql: pendingSqlValue } : t)),
    }));
    scheduleWorkspaceSave(get);
  },

  clearInvocationError: () => {
    set((s) => {
      if (!s.invocationResult) return {};
      const fn = s.invocationResult.fn;
      const outputType = (
        fn.type === "query" || fn.type === "execute"
          ? "sql-editor"
          : fn.type === "table" || fn.type === "tbl"
            ? "table-grid"
            : fn.type === "src"
              ? "connection-src"
              : fn.type === "list"
                ? "table-list"
                : "sql-editor"
      ) as import("@/types").FunctionOutputType;
      const cleared = { ...s.invocationResult, error: undefined, outputType, isLoading: false };
      return {
        invocationResult: cleared,
        tabs: s.tabs.map((t) =>
          t.id === s.activeTabId ? { ...t, result: cleared } : t,
        ),
      };
    });
  },

  runMultiStatementSql: async (fn, sql) => {
    // Split on semicolons, strip comments, filter blanks
    const stmts = sql
      .split(/;/)
      .map((s) => s.replace(/--[^\n]*/g, "").trim())
      .filter(Boolean);

    if (stmts.length === 0) return;
    if (stmts.length === 1) {
      // Single statement — use normal invoke path
      await get().invokeFunction(fn, { sql: stmts[0] });
      return;
    }

    // Multi-statement: run first in current tab, rest in new tabs
    const now = Date.now();
    const currentTabId = get().activeTabId;

    // Create placeholder tabs for statements 2..N upfront so UI updates immediately
    const extraTabIds: string[] = [];
    set((s) => {
      const newTabs = stmts.slice(1).map((stmt, i) => {
        const id = `tab-${now + i + 1}`;
        extraTabIds.push(id);
        const loadingResult: FunctionInvocationResult = {
          fn, outputType: "sql-editor", isLoading: true, invokedAt: now + i + 1,
        };
        return {
          id,
          fn,
          result: loadingResult,
          pendingSql: stmt,
          pendingEdits: [] as import("../types").PendingCellEdit[],
          undoHistory: [],
          label: `stmt ${i + 2}`,
          filters: [createDefaultFilter()],
          filteredResult: null,
          filtersActive: false,
        };
      });
      return { tabs: [...s.tabs, ...newTabs] };
    });

    // Run all statements concurrently
    const runStmt = async (stmt: string, tabId: string) => {
      try {
        const selDb = get().selectedDatabases[fn.connectionId];
        const result = await tauriApi.executeQuery(fn.connectionId, stmt, get().appSettings.queryTimeoutSecs, selDb);
        const sqlResult: FunctionInvocationResult = {
          fn, outputType: "sql-editor", queryResult: result, isLoading: false, invokedAt: Date.now(),
        };
        const historyEntry: import("../types").QueryHistoryEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          sql: stmt, executedAt: Date.now(),
          executionTimeMs: result.executionTimeMs,
          rowCount: result.rows.length,
          connectionId: fn.connectionId,
          status: "success",
        };
        tauriApi.storageSaveHistoryEntry(historyEntry).catch(console.error);
        set((s) => ({
          queryHistory: [historyEntry, ...s.queryHistory],
          invocationResult: s.activeTabId === tabId ? sqlResult : s.invocationResult,
          tabs: s.tabs.map((t) => t.id === tabId ? { ...t, result: sqlResult } : t),
        }));
      } catch (err) {
        const errResult: FunctionInvocationResult = {
          fn, outputType: "sql-editor", isLoading: false, invokedAt: Date.now(),
          error: err instanceof Error ? err.message : String(err),
        };
        set((s) => ({
          invocationResult: s.activeTabId === tabId ? errResult : s.invocationResult,
          tabs: s.tabs.map((t) => t.id === tabId ? { ...t, result: errResult } : t),
        }));
      }
    };

    // First statement in the current tab
    const firstPromise = runStmt(stmts[0], currentTabId!);
    // Remaining statements in their new tabs
    const restPromises = stmts.slice(1).map((stmt, i) => runStmt(stmt, extraTabIds[i]));
    await Promise.all([firstPromise, ...restPromises]);
  },

  pingConnectionHealth: async (connectionId) => {
    try {
      const latencyMs = await tauriApi.pingConnection(connectionId);
      set((s) => ({ connectionLatency: { ...s.connectionLatency, [connectionId]: latencyMs } }));
    } catch {
      set((s) => ({ connectionLatency: { ...s.connectionLatency, [connectionId]: null } }));
    }
  },

  // ---- Tab management ----

  openNewTab: () => {
    const { connectedIds, connectionFunctions } = get();
    const firstConnId = connectedIds[0];
    if (!firstConnId) return;
    const queryFn = Object.values(connectionFunctions[firstConnId] ?? {}).flat().find((f) => f.type === "query");
    if (!queryFn) return;
    const id = `tab-${Date.now()}`;
    const result: FunctionInvocationResult = { fn: queryFn, outputType: "sql-editor", isLoading: false, invokedAt: Date.now() };
    set((s) => ({
      tabs: [...s.tabs, { id, fn: queryFn, result, pendingSql: "", pendingEdits: [], undoHistory: [], label: "query", filters: [createDefaultFilter()], filteredResult: null, filtersActive: false }],
      activeTabId: id,
      activeFunction: queryFn,
      invocationResult: result,
      pendingSqlValue: "",
      showConnectionsManager: false,
      activeView: "main",
    }));
    scheduleWorkspaceSave(get);
  },

  openFnInNewTab: async (fn) => {
    const id = `tab-${Date.now()}`;
    const loadingResult: FunctionInvocationResult = { fn, outputType: "idle", isLoading: true, invokedAt: Date.now() };
    set((s) => ({
      tabs: [...s.tabs, { id, fn, result: loadingResult, pendingSql: "", pendingEdits: [], undoHistory: [], label: getTabLabel(fn), filters: [createDefaultFilter()], filteredResult: null, filtersActive: false }],
      activeTabId: id,
      activeFunction: fn,
      invocationResult: loadingResult,
      pendingSqlValue: "",
      showConnectionsManager: false,
      activeView: "main",
    }));
    await get().invokeFunction(fn);
    scheduleWorkspaceSave(get);
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    const newTabs = tabs.filter((t) => t.id !== tabId);
    if (newTabs.length === 0) {
      set({ tabs: [], activeTabId: null, activeFunction: null, invocationResult: null, pendingSqlValue: "" });
      scheduleWorkspaceSave(get);
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
    scheduleWorkspaceSave(get);
  },

  closeOtherTabs: (tabId) => {
    const { tabs, activeTabId, pendingSqlValue } = get();
    const keep = tabs.find((t) => t.id === tabId);
    if (!keep) return;
    const savedTabs = tabs.map((t) => t.id === activeTabId ? { ...t, pendingSql: pendingSqlValue } : t);
    const target = savedTabs.find((t) => t.id === tabId)!;
    set({ tabs: [target], activeTabId: tabId, activeFunction: target.fn, invocationResult: target.result, pendingSqlValue: target.pendingSql });
    scheduleWorkspaceSave(get);
  },

  closeTabsToRight: (tabId) => {
    const { tabs, activeTabId, pendingSqlValue } = get();
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx < 0) return;
    const savedTabs = tabs.map((t) => t.id === activeTabId ? { ...t, pendingSql: pendingSqlValue } : t);
    const newTabs = savedTabs.slice(0, idx + 1);
    const activeStillExists = newTabs.some((t) => t.id === activeTabId);
    if (activeStillExists) {
      set({ tabs: newTabs });
    } else {
      const target = newTabs[newTabs.length - 1];
      set({ tabs: newTabs, activeTabId: target.id, activeFunction: target.fn, invocationResult: target.result, pendingSqlValue: target.pendingSql });
    }
    scheduleWorkspaceSave(get);
  },

  duplicateTab: (tabId) => {
    const { tabs, pendingSqlValue, activeTabId } = get();
    const src = tabs.find((t) => t.id === tabId);
    if (!src) return;
    const sql = tabId === activeTabId ? pendingSqlValue : src.pendingSql;
    const newId = `tab-${Date.now()}`;
    const newTab: ResultTab = { ...src, id: newId, pendingSql: sql, pendingEdits: [], undoHistory: [], filters: [createDefaultFilter()], filteredResult: null, filtersActive: false };
    const idx = tabs.findIndex((t) => t.id === tabId);
    const newTabs = [...tabs.slice(0, idx + 1), newTab, ...tabs.slice(idx + 1)];
    set({ tabs: newTabs, activeTabId: newId, activeFunction: newTab.fn, invocationResult: newTab.result, pendingSqlValue: sql });
    scheduleWorkspaceSave(get);
  },

  reorderTabs: (fromId, toId) => {
    const { tabs } = get();
    const fromIdx = tabs.findIndex((t) => t.id === fromId);
    const toIdx = tabs.findIndex((t) => t.id === toId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    const newTabs = [...tabs];
    const [moved] = newTabs.splice(fromIdx, 1);
    newTabs.splice(toIdx, 0, moved);
    set({ tabs: newTabs });
    scheduleWorkspaceSave(get);
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
    scheduleWorkspaceSave(get);
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

  pushUndoEntry: (tabId, entry) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId
          ? { ...tab, undoHistory: [...(tab.undoHistory ?? []), entry] }
          : tab,
      ),
    })),

  undoLastCellEdit: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.undoHistory?.length) {
      toast.info("Nothing to undo");
      return;
    }
    const entry = tab.undoHistory[tab.undoHistory.length - 1];
    try {
      const undoDb = get().selectedDatabases[entry.connectionId];
      await tauriApi.executeQuery(entry.connectionId, entry.reverseSql, undefined, undoDb);
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? { ...t, undoHistory: t.undoHistory.slice(0, -1) }
            : t,
        ),
      }));
      toast.success(`Undid: ${entry.tableName}.${entry.columnId}`);
    } catch (e) {
      toast.error(`Undo failed: ${String(e)}`);
    }
  },

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

   saveQuery: (name, sql, connectionId, folder) => {
    const entry: SavedQuery = {
      id: `sq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      sql,
      connectionId,
      folder,
      createdAt: Date.now(),
    };
    set((state) => ({ savedQueries: [...state.savedQueries, entry] }));
    tauriApi.storageSaveQuery(entry).catch(console.error);
  },
  moveSavedQueryFolder: (id, folder) => {
    set((state) => {
      const updated = state.savedQueries.map((q) =>
        q.id === id ? { ...q, folder } : q
      );
      const target = updated.find((q) => q.id === id);
      if (target) tauriApi.storageSaveQuery(target).catch(console.error);
      return { savedQueries: updated };
    });
  },

  deleteSavedQuery: (id) => {
    set((state) => ({
      savedQueries: state.savedQueries.filter((q) => q.id !== id),
    }));
    tauriApi.storageDeleteQuery(id).catch(console.error);
  },

  // ---- User snippets ----

  saveUserSnippet: async (snippetData) => {
    const snippet: UserSnippet = {
      ...snippetData,
      id: `snip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    await tauriApi.storageSaveSnippet(snippet);
    set((state) => ({ userSnippets: [...state.userSnippets, snippet] }));
  },

  deleteUserSnippet: async (id) => {
    await tauriApi.storageDeleteSnippet(id);
    set((state) => ({ userSnippets: state.userSnippets.filter((s) => s.id !== id) }));
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

  deleteHistoryEntry: (id) => {
    tauriApi.storageDeleteHistoryEntry(id).catch(console.error);
    set((state) => ({ queryHistory: state.queryHistory.filter((e) => e.id !== id) }));
  },

  clearAllSavedQueries: () => {
    const { savedQueries } = get();
    set({ savedQueries: [] });
    // Delete every query from SQLite
    savedQueries.forEach((q) => tauriApi.storageDeleteQuery(q.id).catch(console.error));
  },

  // ---- Pinned tables ----

  pinTable: (connectionId, tableName, schemaName) =>
    set((state) => {
      if (state.pinnedTables.some((p) => p.connectionId === connectionId && p.tableName === tableName)) return {};
      const updated = [...state.pinnedTables, { connectionId, tableName, schemaName, pinnedAt: Date.now() }];
      savePinnedTables(updated);
      return { pinnedTables: updated };
    }),

  unpinTable: (connectionId, tableName) =>
    set((state) => {
      const updated = state.pinnedTables.filter((p) => !(p.connectionId === connectionId && p.tableName === tableName));
      savePinnedTables(updated);
      return { pinnedTables: updated };
    }),

  isTablePinned: (connectionId, tableName) =>
    get().pinnedTables.some((p) => p.connectionId === connectionId && p.tableName === tableName),

  // ---- UI ----

  toggleConnectionExpanded: (connectionId) =>
    set((state) => ({
      expandedConnections: state.expandedConnections.includes(connectionId)
        ? state.expandedConnections.filter((id) => id !== connectionId)
        : [...state.expandedConnections, connectionId],
    })),

  toggleSidebar: () =>
    set((state) => {
      const updated = { sidebarCollapsed: !state.sidebarCollapsed };
      saveLayout({ sidebarCollapsed: updated.sidebarCollapsed, dbTabsCollapsed: state.dbTabsCollapsed, queryLogOpen: state.queryLogOpen });
      return updated;
    }),
  toggleDbTabs: () =>
    set((state) => {
      const updated = { dbTabsCollapsed: !state.dbTabsCollapsed };
      saveLayout({ sidebarCollapsed: state.sidebarCollapsed, dbTabsCollapsed: updated.dbTabsCollapsed, queryLogOpen: state.queryLogOpen });
      return updated;
    }),
  setActiveConnectionId: (id) => set((s) => ({
    activeConnectionId: id,
    activeFunction: id
      ? (Object.values(s.connectionFunctions[id] ?? {}).flat()[0] ?? s.activeFunction)
      : s.activeFunction,
  })),
  toggleQueryLog: () =>
    set((state) => {
      const updated = { queryLogOpen: !state.queryLogOpen };
      saveLayout({ sidebarCollapsed: state.sidebarCollapsed, dbTabsCollapsed: state.dbTabsCollapsed, queryLogOpen: updated.queryLogOpen });
      return updated;
    }),

  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setConnectionDialogOpen: (connectionDialogOpen) =>
    set({ connectionDialogOpen }),
  setEditingConnection: (editingConnection) => set({ editingConnection }),
  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    // Eagerly apply/remove the dark class so there's no timing gap waiting for React's useEffect
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    set({ theme });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setShowConnectionsManager: (showConnectionsManager) => set({ showConnectionsManager }),
  setActiveView: (activeView) => set({ activeView }),
}));

// Apply initial theme class to <html> at module load time (before first React render)
const _initialTheme = (localStorage.getItem(THEME_KEY) as "dark" | "light") ?? "dark";
if (_initialTheme === "dark") {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}
