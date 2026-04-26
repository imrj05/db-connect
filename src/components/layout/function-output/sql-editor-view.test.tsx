import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { SqlEditorView } from "@/components/layout/function-output/sql-editor-view";
import { tauriApi } from "@/lib/tauri-api";
import { useAppStore } from "@/store/useAppStore";
import type { ConnectionFunction } from "@/types";
import { renderWithProviders, resetAppStore } from "../../../../tests/test-utils";

const fn: ConnectionFunction = {
  id: "conn-1_query",
  name: "analytics_query(sql)",
  callSignature: "analytics_query(sql)",
  prefix: "analytics",
  connectionId: "conn-1",
  type: "query",
  description: "Execute a SQL query and return results",
};

describe("SqlEditorView", () => {
  beforeEach(() => {
    resetAppStore();
    useAppStore.setState({
      theme: "dark",
      connections: [{ id: "conn-1", name: "Analytics", prefix: "analytics", type: "postgresql" }],
      queryHistory: [
        { id: "h-1", sql: "select * from users", executedAt: Date.now(), executionTimeMs: 5, rowCount: 1, connectionId: "conn-1", status: "success" },
      ],
      savedQueries: [
        { id: "sq-1", name: "Users", sql: "select * from users", connectionId: "conn-1", createdAt: 1 },
      ],
      appSettings: {
        ...useAppStore.getState().appSettings,
        aiEnabled: true,
      },
    });
    vi.spyOn(tauriApi, "aiGetCredentialStatus").mockResolvedValue({
      provider: "openrouter",
      authMode: "api_key",
      configured: true,
      maskedKey: "sk-or-***",
    });
  });

  it("should switch panels, load saved SQL, and save queries", async () => {
    const user = userEvent.setup();
    const onSqlChange = vi.fn();
    const saveQuery = vi.spyOn(useAppStore.getState(), "saveQuery");

    renderWithProviders(
      <SqlEditorView
        fn={fn}
        isLoading={false}
        pendingSql="select 1;"
        onSqlChange={onSqlChange}
        onExecute={vi.fn()}
        onExplain={vi.fn()}
        tables={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Saved/i }));
    await user.hover(screen.getByText("Users").closest("div[class*='group']")!);
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(onSqlChange).toHaveBeenCalledWith("select * from users");

    await user.click(screen.getByRole("button", { name: /^Editor$/i }));
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await user.type(screen.getByPlaceholderText("Query name…"), "Recent Users");
    await user.keyboard("{Enter}");

    expect(saveQuery).toHaveBeenCalledWith("Recent Users", "select 1;", "conn-1");
  });

  it("should dispatch execution and explanation actions from toolbar controls", async () => {
    const user = userEvent.setup();
    const onExecute = vi.fn();
    const onExplain = vi.fn();

    renderWithProviders(
      <SqlEditorView
        fn={fn}
        isLoading={false}
        pendingSql="select 1; select 2;"
        onSqlChange={vi.fn()}
        onExecute={onExecute}
        onExplain={onExplain}
        tables={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Run All \(2\)/i }));
    await user.click(screen.getByRole("button", { name: /Explain/i }));

    expect(onExecute).toHaveBeenCalled();
    expect(onExplain).toHaveBeenCalled();
  });

  it("should react to palette-load-sql events for the active connection", async () => {
    const onSqlChange = vi.fn();

    renderWithProviders(
      <SqlEditorView
        fn={fn}
        isLoading={false}
        pendingSql=""
        onSqlChange={onSqlChange}
        onExecute={vi.fn()}
        onExplain={vi.fn()}
        tables={[]}
      />,
    );

    window.dispatchEvent(new CustomEvent("palette-load-sql", { detail: { sql: "select 42", connectionId: "conn-1" } }));

    await waitFor(() => {
      expect(onSqlChange).toHaveBeenCalledWith("select 42");
    });
  });
});
