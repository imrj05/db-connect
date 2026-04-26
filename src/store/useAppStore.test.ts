import { vi } from "vitest";
import { useAppStore } from "@/store/useAppStore";
import { tauriApi } from "@/lib/tauri-api";
import type { ConnectionConfig, ConnectionFunction } from "@/types";
import { resetAppStore } from "../../tests/test-utils";

const connection: ConnectionConfig = {
  id: "conn-1",
  name: "Analytics",
  prefix: "analytics",
  type: "postgresql",
  database: "analytics",
};

describe("useAppStore", () => {
  beforeEach(() => {
    resetAppStore();
    vi.restoreAllMocks();
  });

  it("should load persisted data from storage", async () => {
    vi.spyOn(tauriApi, "storageLoadConnections").mockResolvedValue([connection]);
    vi.spyOn(tauriApi, "storageLoadQueries").mockResolvedValue([
      { id: "sq-1", name: "Users", sql: "select * from users", createdAt: 1 },
    ]);
    vi.spyOn(tauriApi, "storageLoadHistory").mockResolvedValue([
      {
        id: "h-1",
        sql: "select 1",
        executedAt: 1,
        executionTimeMs: 10,
        rowCount: 1,
        connectionId: connection.id,
      },
    ]);
    vi.spyOn(tauriApi, "storageLoadSnippets").mockResolvedValue([
      { id: "sn-1", label: "Count", description: "count", category: "Custom", sql: "select count(*)", createdAt: 1 },
    ]);
    vi.spyOn(tauriApi, "storageLoadWorkspace").mockResolvedValue(null);

    await useAppStore.getState().loadConnections();

    const state = useAppStore.getState();
    expect(state.connections).toEqual([connection]);
    expect(state.savedQueries).toHaveLength(1);
    expect(state.queryHistory).toHaveLength(1);
    expect(state.userSnippets).toHaveLength(1);
  });

  it("should connect, initialize metadata, and generate functions", async () => {
    useAppStore.setState({ connections: [connection] });
    vi.spyOn(tauriApi, "connect").mockResolvedValue();
    vi.spyOn(tauriApi, "getUserDatabases").mockResolvedValue(["analytics", "archive"]);
    vi.spyOn(tauriApi, "listAllTables").mockResolvedValue([{ name: "users", schema: "public" }]);

    const connected = await useAppStore.getState().connectAndInit(connection.id);

    const state = useAppStore.getState();
    expect(connected).toBe(true);
    expect(state.connectedIds).toContain(connection.id);
    expect(state.selectedDatabases[connection.id]).toBe("analytics");
    expect(state.connectionFunctions[connection.id]?.map((fn) => fn.type)).toContain("table");
  });

  it("should record successful query executions in history and invocation state", async () => {
    const queryFn: ConnectionFunction = {
      id: "conn-1_query",
      name: "analytics_query(sql)",
      callSignature: "analytics_query(sql)",
      prefix: "analytics",
      connectionId: connection.id,
      type: "query",
      description: "Execute a SQL query and return results",
    };

    useAppStore.setState({ connections: [connection], activeTabId: null, tabs: [] });
    vi.spyOn(tauriApi, "executeQuery").mockResolvedValue({
      columns: ["id"],
      rows: [{ id: 1 }],
      executionTimeMs: 12,
    });
    const saveHistorySpy = vi.spyOn(tauriApi, "storageSaveHistoryEntry").mockResolvedValue();

    await useAppStore.getState().invokeFunction(queryFn, { sql: "select 1" });

    const state = useAppStore.getState();
    expect(state.invocationResult?.outputType).toBe("sql-editor");
    expect(state.invocationResult?.queryResult?.rows).toEqual([{ id: 1 }]);
    expect(state.queryHistory[0]?.status).toBe("success");
    expect(saveHistorySpy).toHaveBeenCalled();
  });

  it("should record failed query executions in history", async () => {
    const queryFn: ConnectionFunction = {
      id: "conn-1_query",
      name: "analytics_query(sql)",
      callSignature: "analytics_query(sql)",
      prefix: "analytics",
      connectionId: connection.id,
      type: "query",
      description: "Execute a SQL query and return results",
    };

    useAppStore.setState({ connections: [connection], activeTabId: null, tabs: [] });
    vi.spyOn(tauriApi, "executeQuery").mockRejectedValue(new Error("syntax error near FROM"));
    vi.spyOn(tauriApi, "storageSaveHistoryEntry").mockResolvedValue();

    await useAppStore.getState().invokeFunction(queryFn, { sql: "select from" });

    const state = useAppStore.getState();
    expect(state.queryHistory[0]?.status).toBe("error");
    expect(state.invocationResult?.error).toContain("syntax error near FROM");
  });

  it("should split multi-statement SQL and create extra tabs for each statement", async () => {
    const queryFn: ConnectionFunction = {
      id: "conn-1_query",
      name: "analytics_query(sql)",
      callSignature: "analytics_query(sql)",
      prefix: "analytics",
      connectionId: connection.id,
      type: "query",
      description: "Execute a SQL query and return results",
    };

    useAppStore.setState({
      connections: [connection],
      activeTabId: "tab-1",
      tabs: [
        {
          id: "tab-1",
          fn: queryFn,
          result: null,
          pendingSql: "",
          pendingEdits: [],
          undoHistory: [],
          label: "query",
          filters: [{ id: "f-1", col: "", op: "=", value: "", join: "AND" }],
          filteredResult: null,
          filtersActive: false,
        },
      ],
    });

    vi.spyOn(tauriApi, "executeQuery").mockImplementation(async (_id, sql) => ({
      columns: ["sql"],
      rows: [{ sql }],
      executionTimeMs: 5,
    }));
    vi.spyOn(tauriApi, "storageSaveHistoryEntry").mockResolvedValue();

    await useAppStore.getState().runMultiStatementSql(queryFn, "select 1; -- note\nselect 2;");

    const state = useAppStore.getState();
    expect(state.tabs).toHaveLength(2);
    expect(state.queryHistory).toHaveLength(2);
    expect(state.tabs[1]?.pendingSql).toBe("select 2");
  });

  it("should pin and unpin tables without creating duplicates", () => {
    const { pinTable, unpinTable, isTablePinned } = useAppStore.getState();

    pinTable(connection.id, "users", "public");
    pinTable(connection.id, "users", "public");

    expect(useAppStore.getState().pinnedTables).toHaveLength(1);
    expect(isTablePinned(connection.id, "users")).toBe(true);

    unpinTable(connection.id, "users");

    expect(useAppStore.getState().pinnedTables).toHaveLength(0);
  });
});
