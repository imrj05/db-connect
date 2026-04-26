import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { TableListView } from "@/components/layout/function-output/table-list-view";
import type { ConnectionFunction } from "@/types";
import { renderWithProviders } from "../../../../tests/test-utils";

const fn: ConnectionFunction = {
  id: "conn-1_list",
  name: "analytics_list()",
  callSignature: "analytics_list()",
  prefix: "analytics",
  connectionId: "conn-1",
  type: "list",
  description: "List all available tables",
};

describe("TableListView", () => {
  it("should render table rows and call the click handler", async () => {
    const user = userEvent.setup();
    const onTableClick = vi.fn();

    renderWithProviders(
      <TableListView
        fn={fn}
        tables={[
          { name: "users", schema: "public" },
          { name: "orders", schema: "sales" },
        ]}
        onTableClick={onTableClick}
      />,
    );

    expect(screen.getByText("2 tables")).toBeInTheDocument();
    await user.click(screen.getByText("orders"));

    expect(onTableClick).toHaveBeenCalledWith("orders");
  });
});
