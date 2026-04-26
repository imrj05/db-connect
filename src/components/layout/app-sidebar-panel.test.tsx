import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import Sidebar from "@/components/layout/app-sidebar-panel";
import { tauriApi } from "@/lib/tauri-api";
import { useAppStore } from "@/store/useAppStore";
import { renderWithProviders, resetAppStore } from "../../../tests/test-utils";

describe("Sidebar", () => {
  beforeEach(() => {
    resetAppStore();
    vi.spyOn(tauriApi, "getAppDataDir").mockResolvedValue("/tmp");
  });

  it("should show saved connections when creating a new connection", () => {
    useAppStore.setState({
      activeView: "new-connection",
      connections: [{ id: "conn-1", name: "Analytics", prefix: "analytics", type: "postgresql", host: "db.local", port: 5432 }],
    });

    renderWithProviders(<Sidebar />);

    expect(screen.getByText("Saved Connections")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
  });

  it("should filter tables and toggle pinned items for the active connection", async () => {
    const user = userEvent.setup();

    useAppStore.setState({
      connections: [{ id: "conn-1", name: "Analytics", prefix: "analytics", type: "postgresql", database: "analytics" }],
      connectedIds: ["conn-1"],
      activeView: "main",
      activeFunction: {
        id: "conn-1_query",
        name: "analytics_query(sql)",
        callSignature: "analytics_query(sql)",
        prefix: "analytics",
        connectionId: "conn-1",
        type: "query",
        description: "query",
      },
      connectionFunctions: {
        "conn-1": [
          {
            id: "conn-1_table_users",
            name: "analytics_users()",
            callSignature: "analytics_users()",
            prefix: "analytics",
            connectionId: "conn-1",
            type: "table",
            tableName: "users",
            description: "Browse users table",
          },
          {
            id: "conn-1_table_orders",
            name: "analytics_orders()",
            callSignature: "analytics_orders()",
            prefix: "analytics",
            connectionId: "conn-1",
            type: "table",
            tableName: "orders",
            description: "Browse orders table",
          },
        ],
      },
      connectionTables: {
        "conn-1": [
          { name: "users", schema: "public", columns: [{ name: "id", dataType: "int", nullable: false, isPrimary: true, isUnique: true, defaultValue: null, extra: null }] },
          { name: "orders", schema: "sales" },
        ],
      },
      selectedDatabases: { "conn-1": "analytics" },
      openDatabases: { "conn-1": ["analytics"] },
    });

    renderWithProviders(<Sidebar />);

    await user.type(screen.getByPlaceholderText("Filter tables…"), "users");
    expect(screen.getByText("users")).toBeInTheDocument();
    expect(screen.queryByText("orders")).not.toBeInTheDocument();

    await user.hover(screen.getByText("users").closest("button")!);
    await user.click(screen.getByTitle("Pin table"));

    await waitFor(() => {
      expect(screen.getByText("Pinned")).toBeInTheDocument();
    });
  });

  it("should expose the schema grouping bug by collapsing non-public schemas into public", () => {
    useAppStore.setState({
      connections: [{ id: "conn-1", name: "Analytics", prefix: "analytics", type: "postgresql", database: "analytics" }],
      connectedIds: ["conn-1"],
      activeView: "main",
      activeFunction: {
        id: "conn-1_query",
        name: "analytics_query(sql)",
        callSignature: "analytics_query(sql)",
        prefix: "analytics",
        connectionId: "conn-1",
        type: "query",
        description: "query",
      },
      connectionFunctions: {
        "conn-1": [
          {
            id: "conn-1_table_orders",
            name: "analytics_orders()",
            callSignature: "analytics_orders()",
            prefix: "analytics",
            connectionId: "conn-1",
            type: "table",
            tableName: "orders",
            description: "Browse orders table",
          },
        ],
      },
      connectionTables: {
        "conn-1": [{ name: "orders", schema: "sales" }],
      },
      selectedDatabases: { "conn-1": "analytics" },
      openDatabases: { "conn-1": ["analytics"] },
    });

    renderWithProviders(<Sidebar />);

    expect(screen.getByText("orders")).toBeInTheDocument();
    expect(screen.queryByText("sales")).not.toBeInTheDocument();
  });
});
