import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { QueryHistoryPanel } from "@/components/layout/function-output/sql-editor/query-history-panel";
import { renderWithProviders } from "../../../../../tests/test-utils";

describe("QueryHistoryPanel", () => {
  it("should filter queries by search and status", async () => {
    const user = userEvent.setup();
    const onSelectQuery = vi.fn();

    renderWithProviders(
      <QueryHistoryPanel
        history={[
          {
            id: "1",
            sql: "select * from users",
            executedAt: Date.now(),
            executionTimeMs: 12,
            rowCount: 2,
            connectionId: "conn-1",
            status: "success",
          },
          {
            id: "2",
            sql: "delete from users",
            executedAt: Date.now(),
            executionTimeMs: 9,
            rowCount: 0,
            connectionId: "conn-1",
            status: "error",
            errorMessage: "permission denied",
          },
        ]}
        connections={[{ id: "conn-1", name: "Analytics" }]}
        onSelectQuery={onSelectQuery}
        onClearHistory={vi.fn()}
        onDeleteEntry={vi.fn()}
        onSaveQuery={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("Filter by SQL..."), "delete");
    await user.click(screen.getByRole("button", { name: "error" }));

    expect(screen.getByText("delete from users")).toBeInTheDocument();
    expect(screen.queryByText("select * from users")).not.toBeInTheDocument();
  });

  it("should copy SQL and call action callbacks", async () => {
    const user = userEvent.setup();
    const onDeleteEntry = vi.fn();
    const onSaveQuery = vi.fn();
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    renderWithProviders(
      <QueryHistoryPanel
        history={[
          {
            id: "1",
            sql: "select * from users",
            executedAt: Date.now(),
            executionTimeMs: 12,
            rowCount: 2,
            connectionId: "conn-1",
            status: "success",
          },
        ]}
        connections={[{ id: "conn-1", name: "Analytics" }]}
        onSelectQuery={vi.fn()}
        onClearHistory={vi.fn()}
        onDeleteEntry={onDeleteEntry}
        onSaveQuery={onSaveQuery}
      />,
    );

    const item = screen.getByText("select * from users").closest("div[class*='group']");
    await user.hover(item!);
    await user.click(screen.getByTitle("Copy SQL"));
    await user.click(screen.getByTitle("Save query"));
    await user.click(screen.getByTitle("Delete"));

    expect(writeTextSpy).toHaveBeenCalledWith("select * from users");
    expect(onSaveQuery).toHaveBeenCalledWith("select * from users");
    expect(onDeleteEntry).toHaveBeenCalledWith("1");
  });
});
