import { create } from "zustand";
import {
  ConnectionConfig,
  ConnectionFunction,
  FunctionInvocationResult,
  TableInfo,
  ConnectionSourceInfo,
} from "@/types";
import { EncryptionUtils } from "@/lib/encryption";
import { buildConnectionFunctions, suggestPrefix } from "@/lib/db-functions";
import { tauriApi } from "@/lib/tauri-api";
import { toast } from "sonner";

const STORAGE_KEY = "db_connections_v3";

interface AppState {
  // ---- Connection list (persisted) ----
  connections: ConnectionConfig[];

  // ---- Live connection state ----
  connectedIds: string[]; // IDs with active Rust driver in REGISTRY
  connectionFunctions: Record<string, ConnectionFunction[]>; // connectionId → generated fns
  connectionTables: Record<string, TableInfo[]>; // connectionId → discovered tables
  connectionDatabases: Record<string, string[]>; // connectionId → available user databases
  selectedDatabases: Record<string, string>; // connectionId → currently selected database

  // ---- Active function invocation ----
  activeFunction: ConnectionFunction | null;
  invocationResult: FunctionInvocationResult | null;
  pendingSqlValue: string; // live SQL text for query/execute editors

  // ---- UI state ----
  expandedConnections: string[]; // connectionIds with open tree in sidebar
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  connectionDialogOpen: boolean;
  editingConnection: ConnectionConfig | null;
  theme: "dark" | "light";
  isLoading: boolean;

  // ---- Actions: persistence ----
  loadConnections: () => void;
  addConnection: (connection: ConnectionConfig) => void;
  updateConnection: (connection: ConnectionConfig) => void;
  setConnections: (connections: ConnectionConfig[]) => void;
  deleteConnection: (id: string) => void;

  // ---- Actions: connection lifecycle ----
  connectAndInit: (connectionId: string) => Promise<void>;
  disconnectConnection: (connectionId: string) => Promise<void>;
  selectDatabase: (connectionId: string, database: string) => Promise<void>;

  // ---- Actions: function invocation ----
  invokeFunction: (
    fn: ConnectionFunction,
    args?: { sql?: string; tableName?: string; page?: number },
  ) => Promise<void>;
  setActiveFunctionOnly: (fn: ConnectionFunction) => void;
  setPendingSql: (sql: string) => void;

  // ---- Actions: UI ----
  toggleConnectionExpanded: (connectionId: string) => void;
  toggleSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  setEditingConnection: (connection: ConnectionConfig | null) => void;
  setTheme: (theme: "dark" | "light") => void;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  connections: [],
  connectedIds: [],
  connectionFunctions: {},
  connectionTables: {},
  connectionDatabases: {},
  selectedDatabases: {},
  activeFunction: null,
  invocationResult: null,
  pendingSqlValue: "",
  expandedConnections: [],
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  connectionDialogOpen: false,
  editingConnection: null,
  theme: "dark",
  isLoading: false,

  // ---- Persistence ----

  loadConnections: () => {
    // Try new v3 key first
    const encrypted = localStorage.getItem(STORAGE_KEY);
    if (encrypted) {
      const decrypted = EncryptionUtils.decrypt(encrypted);
      if (decrypted) {
        set({ connections: decrypted });
        return;
      }
    }
    // Migration: try old v2 key, auto-generate prefixes for old records
    const oldEncrypted = localStorage.getItem("db_connections_v2");
    if (oldEncrypted) {
      const oldDecrypted = EncryptionUtils.decrypt(oldEncrypted);
      if (oldDecrypted) {
        const migrated = (oldDecrypted as ConnectionConfig[]).map((c) => ({
          ...c,
          prefix: c.prefix || suggestPrefix(c.name),
        }));
        const newEncrypted = EncryptionUtils.encrypt(migrated);
        localStorage.setItem(STORAGE_KEY, newEncrypted);
        set({ connections: migrated });
      }
    }
  },

  addConnection: (connection) =>
    set((state) => {
      const newConnections = [...state.connections, connection];
      localStorage.setItem(STORAGE_KEY, EncryptionUtils.encrypt(newConnections));
      return { connections: newConnections };
    }),

  updateConnection: (connection) =>
    set((state) => {
      const newConnections = state.connections.map((c) =>
        c.id === connection.id ? connection : c,
      );
      localStorage.setItem(STORAGE_KEY, EncryptionUtils.encrypt(newConnections));
      return { connections: newConnections };
    }),

  setConnections: (connections) => {
    localStorage.setItem(STORAGE_KEY, EncryptionUtils.encrypt(connections));
    set({ connections });
  },

  deleteConnection: (id) =>
    set((state) => {
      const newConnections = state.connections.filter((c) => c.id !== id);
      localStorage.setItem(STORAGE_KEY, EncryptionUtils.encrypt(newConnections));
      // Clean up live state for this connection
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
    }),

  // ---- Connection lifecycle ----

  connectAndInit: async (connectionId) => {
    const { connections } = get();
    const config = connections.find((c) => c.id === connectionId);
    if (!config) return;

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
        expandedConnections: state.expandedConnections.includes(connectionId)
          ? state.expandedConnections
          : [...state.expandedConnections, connectionId],
      }));

      toast.success(`Connected: ${config.prefix}_list() and ${tables.length} table functions ready`);
    } catch (error) {
      toast.error(`Connection failed: ${String(error)}`);
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
      return {
        connectedIds: state.connectedIds.filter((id) => id !== connectionId),
        connectionFunctions: restFns,
        connectionTables: restTables,
        connectionDatabases: restDbs,
        selectedDatabases: restSel,
        activeFunction:
          state.activeFunction?.connectionId === connectionId
            ? null
            : state.activeFunction,
        invocationResult:
          state.invocationResult?.fn.connectionId === connectionId
            ? null
            : state.invocationResult,
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
      const tables = await tauriApi.listAllTables(connectionId, database);
      const fns = buildConnectionFunctions(config, tables);

      set((state) => ({
        selectedDatabases: { ...state.selectedDatabases, [connectionId]: database },
        connectionTables: { ...state.connectionTables, [connectionId]: tables },
        connectionFunctions: { ...state.connectionFunctions, [connectionId]: fns },
        // Clear active function/result if it belonged to this connection
        activeFunction:
          state.activeFunction?.connectionId === connectionId
            ? null
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

  // ---- Function invocation ----

  invokeFunction: async (fn, args = {}) => {
    const state = get();
    const { connectionTables, connections } = state;

    // Set loading state with the active function
    set({
      activeFunction: fn,
      invocationResult: {
        fn,
        outputType: "idle",
        isLoading: true,
        invokedAt: Date.now(),
      },
    });

    try {
      switch (fn.type) {
        case "list": {
          const tables = connectionTables[fn.connectionId] ?? [];
          set({
            invocationResult: {
              fn,
              outputType: "table-list",
              tables,
              isLoading: false,
              invokedAt: Date.now(),
            },
          });
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
          set({
            invocationResult: {
              fn,
              outputType: "connection-src",
              connectionInfo: info,
              isLoading: false,
              invokedAt: Date.now(),
            },
          });
          break;
        }

        case "query":
        case "execute": {
          // If no SQL provided, show editor (user types SQL then runs)
          if (!args.sql) {
            set({
              invocationResult: {
                fn,
                outputType: "sql-editor",
                isLoading: false,
                invokedAt: Date.now(),
              },
            });
            break;
          }
          const result = await tauriApi.executeQuery(fn.connectionId, args.sql);
          set({
            invocationResult: {
              fn,
              outputType: "sql-editor",
              queryResult: result,
              isLoading: false,
              invokedAt: Date.now(),
            },
          });
          break;
        }

        case "table": {
          const tables = connectionTables[fn.connectionId] ?? [];
          // Determine the database/schema for this table
          const tableInfo = tables.find((t) => t.name === fn.tableName);
          const database =
            tableInfo?.schema ??
            connections.find((c) => c.id === fn.connectionId)?.database ??
            "default";
          const page = args.page ?? 0;
          const result = await tauriApi.getTableData(
            fn.connectionId,
            database,
            fn.tableName!,
            page,
            50,
          );
          set({
            invocationResult: {
              fn,
              outputType: "table-grid",
              queryResult: result,
              isLoading: false,
              invokedAt: Date.now(),
            },
          });
          break;
        }

        case "tbl": {
          if (!args.tableName) {
            // Show table list to pick from
            const tables = connectionTables[fn.connectionId] ?? [];
            set({
              invocationResult: {
                fn,
                outputType: "table-list",
                tables,
                isLoading: false,
                invokedAt: Date.now(),
              },
            });
            break;
          }
          const tables = connectionTables[fn.connectionId] ?? [];
          const tableInfo = tables.find((t) => t.name === args.tableName);
          const database =
            tableInfo?.schema ??
            connections.find((c) => c.id === fn.connectionId)?.database ??
            "default";
          const result = await tauriApi.getTableData(
            fn.connectionId,
            database,
            args.tableName,
            args.page ?? 0,
            50,
          );
          set({
            invocationResult: {
              fn,
              outputType: "table-grid",
              queryResult: result,
              isLoading: false,
              invokedAt: Date.now(),
            },
          });
          break;
        }
      }
    } catch (error) {
      set((s) => ({
        invocationResult: s.invocationResult
          ? { ...s.invocationResult, isLoading: false, error: String(error) }
          : null,
      }));
      toast.error(String(error));
    }
  },

  setActiveFunctionOnly: (fn) =>
    set({
      activeFunction: fn,
      invocationResult: {
        fn,
        outputType: "sql-editor",
        isLoading: false,
        invokedAt: Date.now(),
      },
      pendingSqlValue: "",
    }),

  setPendingSql: (pendingSqlValue) => set({ pendingSqlValue }),

  // ---- UI ----

  toggleConnectionExpanded: (connectionId) =>
    set((state) => ({
      expandedConnections: state.expandedConnections.includes(connectionId)
        ? state.expandedConnections.filter((id) => id !== connectionId)
        : [...state.expandedConnections, connectionId],
    })),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setConnectionDialogOpen: (connectionDialogOpen) =>
    set({ connectionDialogOpen }),
  setEditingConnection: (editingConnection) => set({ editingConnection }),
  setTheme: (theme) => set({ theme }),
  setLoading: (isLoading) => set({ isLoading }),
}));
