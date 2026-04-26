import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { ConnectionsHome } from "@/components/layout/function-output/connections-home";
import { renderWithProviders } from "../../../../tests/test-utils";

describe("ConnectionsHome", () => {
  it("should show the onboarding state when there are no saved connections", async () => {
    const user = userEvent.setup();
    const onNewConnection = vi.fn();

    renderWithProviders(
      <ConnectionsHome
        connections={[]}
        connectedIds={[]}
        onNewConnection={onNewConnection}
        onEdit={vi.fn()}
        onConnect={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /New Connection/i }));

    expect(screen.getByText("Create your first database connection")).toBeInTheDocument();
    expect(onNewConnection).toHaveBeenCalled();
  });

  it("should render saved connections and dispatch edit/connect actions", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();

    renderWithProviders(
      <ConnectionsHome
        connections={[
          {
            id: "conn-1",
            name: "Analytics",
            prefix: "analytics",
            type: "postgresql",
            host: "db.local",
            port: 5432,
            user: "postgres",
            database: "analytics",
            group: "prod",
          },
        ]}
        connectedIds={["conn-1"]}
        onNewConnection={vi.fn()}
        onEdit={onEdit}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
      />,
    );

    expect(screen.getByText("1 of 1 connected")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Edit Analytics"));
    await user.click(screen.getByLabelText("Disconnect Analytics"));
    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(onEdit).toHaveBeenCalled();
    expect(onDisconnect).toHaveBeenCalledWith("conn-1");
    expect(onConnect).toHaveBeenCalledWith("conn-1");
  });
});
