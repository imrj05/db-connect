import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { SavedQueriesPanel } from "@/components/layout/function-output/sql-editor/saved-queries-panel";
import { useAppStore } from "@/store/useAppStore";
import { renderWithProviders, resetAppStore } from "../../../../../tests/test-utils";

describe("SavedQueriesPanel", () => {
  beforeEach(() => {
    resetAppStore();
  });

  it("should filter saved queries by folder and load selected SQL", async () => {
    const user = userEvent.setup();
    const onLoadQuery = vi.fn();

    renderWithProviders(
      <SavedQueriesPanel
        savedQueries={[
          { id: "1", name: "All Users", sql: "select * from users", folder: "Reports", createdAt: 1 },
          { id: "2", name: "Active Users", sql: "select * from users where active = true", createdAt: 2 },
        ]}
        onLoadQuery={onLoadQuery}
        onDeleteQuery={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Reports/i }));
    expect(screen.getByText("All Users")).toBeInTheDocument();
    expect(screen.queryByText("Active Users")).not.toBeInTheDocument();

    const item = screen.getByText("All Users").closest("div[class*='group']");
    await user.hover(item!);
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(onLoadQuery).toHaveBeenCalledWith("select * from users");
  });

  it("should create folders locally and show empty state when no queries match", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <SavedQueriesPanel savedQueries={[]} onLoadQuery={vi.fn()} onDeleteQuery={vi.fn()} />,
    );

    await user.type(screen.getByPlaceholderText("New folder…"), "Favorites");
    await user.keyboard("{Enter}");

    expect(screen.getByText("No saved queries")).toBeInTheDocument();
  });

  it("should delete a saved query from the action menu", async () => {
    const user = userEvent.setup();
    const onDeleteQuery = vi.fn();

    renderWithProviders(
      <SavedQueriesPanel
        savedQueries={[
          { id: "1", name: "All Users", sql: "select * from users", folder: "Reports", createdAt: 1 },
          { id: "2", name: "Active Users", sql: "select * from users where active = true", createdAt: 2 },
        ]}
        onLoadQuery={vi.fn()}
        onDeleteQuery={onDeleteQuery}
      />,
    );

    const item = screen.getByText("Active Users").closest("div[class*='group']");
    await user.hover(item!);
    const menuTrigger = item?.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
    await user.click(menuTrigger);
    await user.click(await screen.findByText("Delete"));

    expect(onDeleteQuery).toHaveBeenCalledWith("2");
  });
});
