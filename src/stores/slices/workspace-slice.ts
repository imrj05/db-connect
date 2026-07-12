import type { StateCreator } from "zustand";
import { toast } from "sonner";
import type {
  CellEditHistoryEntry,
  ConnectionFunction,
  ConnectionSourceInfo,
  FilterCondition,
  FunctionInvocationResult,
  FunctionOutputType,
  PendingCellEdit,
  QueryHistoryEntry,
  QueryResult,
  ResultTab,
  TableInfo,
  WorkspaceSnapshot,
} from "@/types";
import { tauriApi } from "@/lib/tauri-api";
import {
  createDefaultFilter,
  formatBytes,
  getTabLabel,
  scheduleWorkspaceSave,
  validateSqlSize,
} from "../lib/persistence";
import type { AppState } from "../useAppStore";

export interface WorkspaceSlice {
  // ---- Active function invocation ----
  activeFunction: ConnectionFunction | null;
  invocationResult: FunctionInvocationResult | null;
  pendingSqlValue: string; // live SQL text for query/execute editors
  runningQueryIds: Record<string, string>;

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
  cancelActiveQuery: () => Promise<void>;

  runMultiStatementSql: (fn: ConnectionFunction, sql: string) => Promise<void>;

  // ---- Internal ----
  _pendingWorkspaceSnapshot: WorkspaceSnapshot | null;
}

export const createWorkspaceSlice: StateCreator<AppState, [], [], WorkspaceSlice> = (set, get) => ({
  activeFunction: null,
  invocationResult: null,
  pendingSqlValue: "",
  runningQueryIds: {},
  tabs: [],
  activeTabId: null,
  _pendingWorkspaceSnapshot: null,

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

    // Set loading state with the active function. Keep the SQL editor visible so users can cancel running queries.
    set({ activeFunction: fn, showConnectionsManager: false, activeView: "main" });
    setResult({
      fn,
      outputType: fn.type === "query" || fn.type === "execute" ? "sql-editor" : "idle",
      isLoading: true,
      invokedAt: Date.now(),
    });

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
          const settings = get().appSettings;
          if (!validateSqlSize(args.sql, settings.queryMaxSqlBytes)) {
            setResult({ fn, outputType: "sql-editor", isLoading: false, invokedAt: Date.now() });
            break;
          }
          const queryId = `query-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const tabIdForQuery = get().activeTabId;
          if (tabIdForQuery) {
            set((s) => ({ runningQueryIds: { ...s.runningQueryIds, [tabIdForQuery]: queryId } }));
          }
          const result = await tauriApi.executeQuery(
            fn.connectionId,
            args.sql,
            settings.queryTimeoutSecs,
            selectedDb,
            settings.queryMaxSqlBytes,
            settings.queryMaxResultRows,
            queryId,
          );
          if (tabIdForQuery) {
            set((s) => {
              const { [tabIdForQuery]: _done, ...rest } = s.runningQueryIds;
              return { runningQueryIds: rest };
            });
          }
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
          const settings = get().appSettings;
          if (fn.tableName) {
            get().recordRecentTable(fn.connectionId, fn.tableName, fn.schema);
          }
          const ps = args.pageSize ?? settings.tablePageSize;
          const result = await tauriApi.getTableData(fn.connectionId, database, fn.tableName!, page, ps, settings.queryMaxResultRows);
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
          const settings = get().appSettings;
          if (args.tableName) {
            get().recordRecentTable(fn.connectionId, args.tableName, tableInfo?.schema);
          }
          const ps2 = args.pageSize ?? settings.tablePageSize;
          const result = await tauriApi.getTableData(fn.connectionId, database, args.tableName, args.page ?? 0, ps2, settings.queryMaxResultRows);
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
      const activeTabIdForError = get().activeTabId;
      if (activeTabIdForError) {
        set((s) => {
          const { [activeTabIdForError]: _done, ...rest } = s.runningQueryIds;
          return { runningQueryIds: rest };
        });
      }
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
      ) as FunctionOutputType;
      const cleared = { ...s.invocationResult, error: undefined, outputType, isLoading: false };
      return {
        invocationResult: cleared,
        tabs: s.tabs.map((t) =>
          t.id === s.activeTabId ? { ...t, result: cleared } : t,
        ),
      };
    });
  },

  cancelActiveQuery: async () => {
    const { activeTabId, runningQueryIds } = get();
    if (!activeTabId) return;
    const queryId = runningQueryIds[activeTabId];
    if (!queryId) return;
    try {
      await tauriApi.cancelQuery(queryId);
      toast.success("Query cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      set((s) => {
        const { [activeTabId]: _done, ...rest } = s.runningQueryIds;
        const cleared = s.invocationResult
          ? { ...s.invocationResult, isLoading: false, error: undefined }
          : s.invocationResult;
        return {
          runningQueryIds: rest,
          invocationResult: cleared,
          tabs: s.tabs.map((t) => t.id === activeTabId && cleared ? { ...t, result: cleared } : t),
        };
      });
    }
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
          pendingEdits: [] as PendingCellEdit[],
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
        const settings = get().appSettings;
        if (!validateSqlSize(stmt, settings.queryMaxSqlBytes)) {
          throw new Error(`Query exceeds the configured ${formatBytes(settings.queryMaxSqlBytes)} safety limit.`);
        }
        const queryId = `query-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((s) => ({ runningQueryIds: { ...s.runningQueryIds, [tabId]: queryId } }));
        const result = await tauriApi.executeQuery(
          fn.connectionId,
          stmt,
          settings.queryTimeoutSecs,
          selDb,
          settings.queryMaxSqlBytes,
          settings.queryMaxResultRows,
          queryId,
        );
        set((s) => {
          const { [tabId]: _done, ...rest } = s.runningQueryIds;
          return { runningQueryIds: rest };
        });
        const sqlResult: FunctionInvocationResult = {
          fn, outputType: "sql-editor", queryResult: result, isLoading: false, invokedAt: Date.now(),
        };
        const historyEntry: QueryHistoryEntry = {
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
        set((s) => {
          const { [tabId]: _done, ...rest } = s.runningQueryIds;
          return { runningQueryIds: rest };
        });
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
});
