import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { ResultsGrid } from "@/components/layout/function-output/sql-editor/results-grid";
import { useAppStore } from "@/store/useAppStore";
import { renderWithProviders, resetAppStore } from "../../../../../tests/test-utils";

describe("ResultsGrid", () => {
  beforeEach(() => {
    resetAppStore();
    useAppStore.setState({
      connections: [{ id: "conn-1", name: "Analytics", prefix: "analytics", type: "postgresql", database: "analytics" }],
      connectedIds: ["conn-1"],
      selectedDatabases: { "conn-1": "analytics" },
    });
  });

  it("should show a success empty state when a query returns no rows", () => {
    renderWithProviders(
      <ResultsGrid
        queryResult={{ columns: [], rows: [], executionTimeMs: 15 }}
        tables={[]}
        connectionId="conn-1"
        onResizeStart={vi.fn()}
      />,
    );

    expect(screen.getByText(/Executed successfully/i)).toBeInTheDocument();
  });

  it("should sort tabular results when clicking a column header", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ResultsGrid
        queryResult={{
          columns: ["name", "age"],
          rows: [
            { name: "Bob", age: 34 },
            { name: "Alice", age: 29 },
          ],
          executionTimeMs: 15,
        }}
        tables={[{ name: "users", columns: [{ name: "age", dataType: "int", nullable: false, isPrimary: false, isUnique: false, defaultValue: null, extra: null }] }]}
        connectionId="conn-1"
        onResizeStart={vi.fn()}
      />,
    );

    await user.click(screen.getByText("name"));

    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Alice");
    expect(screen.getByText("INT")).toBeInTheDocument();
  });

  it("should render explain plans for explain-like result sets", () => {
    renderWithProviders(
      <ResultsGrid
        queryResult={{
          columns: ["QUERY PLAN"],
          rows: [{ "QUERY PLAN": "Seq Scan on users" }],
          executionTimeMs: 4,
        }}
        tables={[]}
        connectionId="conn-1"
        onResizeStart={vi.fn()}
      />,
    );

    expect(screen.getByText("Query Plan")).toBeInTheDocument();
    expect(screen.getByText(/1 full scan/i)).toBeInTheDocument();
  });
});
