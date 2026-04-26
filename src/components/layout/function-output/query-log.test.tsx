import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { QueryLog } from "@/components/layout/function-output/query-log";
import { renderWithProviders } from "../../../../tests/test-utils";

describe("QueryLog", () => {
  it("should show an empty state when no queries were executed", () => {
    renderWithProviders(
      <QueryLog entries={[]} showSyntax={false} onSyntaxToggle={vi.fn()} onClear={vi.fn()} />,
    );

    expect(screen.getByText("No queries executed yet")).toBeInTheDocument();
  });

  it("should toggle syntax highlighting and clear logs", async () => {
    const user = userEvent.setup();
    const onSyntaxToggle = vi.fn();
    const onClear = vi.fn();

    renderWithProviders(
      <QueryLog
        entries={[{ sql: "select * from users", executedAt: new Date("2026-01-01T00:00:00Z").getTime() }]}
        showSyntax={false}
        onSyntaxToggle={onSyntaxToggle}
        onClear={onClear}
      />,
    );

    expect(screen.getByText(/select \* from users/i)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByTitle("Clear logs"));

    expect(onSyntaxToggle).toHaveBeenCalledWith(true);
    expect(onClear).toHaveBeenCalled();
  });
});
