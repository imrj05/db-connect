import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import ConnectionDialog from "@/components/layout/connection-dialog-modal";
import { tauriApi } from "@/lib/tauri-api";
import { useAppStore } from "@/store/useAppStore";
import { renderWithProviders, resetAppStore } from "../../../tests/test-utils";

describe("ConnectionDialog", () => {
  beforeEach(() => {
    resetAppStore();
  });

  it("should auto-generate a prefix from the connection name and save the connection", async () => {
    const user = userEvent.setup();
    const addConnection = vi.spyOn(useAppStore.getState(), "addConnection");

    renderWithProviders(<ConnectionDialog onClose={vi.fn()} mode="page" />);

    await user.click(screen.getByRole("button", { name: /Continue to details/i }));
    await user.type(screen.getByPlaceholderText("e.g. Production Analytics"), "Production Analytics");

    await waitFor(() => {
      expect(screen.getByDisplayValue("production_analytics")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(addConnection).toHaveBeenCalledWith(expect.objectContaining({
      name: "Production Analytics",
      prefix: "production_analytics",
    }));
  });

  it("should parse a connection URI and populate the form", async () => {
    const user = userEvent.setup();
    vi.spyOn(tauriApi, "parseConnectionUri").mockResolvedValue({
      id: "parsed-1",
      name: "Warehouse",
      prefix: "warehouse",
      type: "postgresql",
      host: "db.example.com",
      port: 5432,
      database: "warehouse",
      user: "postgres",
    });

    renderWithProviders(<ConnectionDialog onClose={vi.fn()} mode="page" />);

    await user.type(screen.getByPlaceholderText("postgresql://user:pass@host:5432/db"), "postgresql://postgres@db.example.com:5432/warehouse");
    await user.click(screen.getByRole("button", { name: /Parse/i }));
    await user.click(screen.getByRole("tab", { name: /Details/i }));

    expect(await screen.findByDisplayValue("Warehouse")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("warehouse")).toHaveLength(2);
  });

  it("should test a connection using a temporary config", async () => {
    const user = userEvent.setup();
    const connectSpy = vi.spyOn(tauriApi, "connect").mockResolvedValue();
    const disconnectSpy = vi.spyOn(tauriApi, "disconnect").mockResolvedValue();

    renderWithProviders(<ConnectionDialog onClose={vi.fn()} mode="page" />);

    await user.click(screen.getByRole("button", { name: /Continue to details/i }));
    await user.type(screen.getByPlaceholderText("e.g. Production Analytics"), "QA DB");
    await user.click(screen.getByRole("button", { name: /^Test$/i }));

    await waitFor(() => {
      expect(connectSpy).toHaveBeenCalled();
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});
