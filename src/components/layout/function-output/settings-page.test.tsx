import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { SettingsPage } from "@/components/layout/function-output/settings-page";
import * as fontsModule from "@/lib/fonts";
import * as licenseModule from "@/lib/license";
import { tauriApi } from "@/lib/tauri-api";
import { useAppStore } from "@/store/useAppStore";
import { renderWithProviders, resetAppStore } from "../../../../tests/test-utils";

describe("SettingsPage", () => {
  beforeEach(() => {
    resetAppStore();
    vi.spyOn(tauriApi, "getAppDataDir").mockResolvedValue("/Users/test/Library/Application Support/db-connect");
    vi.spyOn(fontsModule, "getSystemFonts").mockResolvedValue([
      { value: ".dbFontSans", label: "System UI Font (Default)", isMono: false },
      { value: ".dbFontMono", label: "DB Mono (Default)", isMono: true },
    ]);
    vi.spyOn(licenseModule, "licenseGetStored").mockResolvedValue(null);
    vi.spyOn(tauriApi, "aiGetCredentialStatus").mockResolvedValue({
      provider: "openrouter",
      authMode: "api_key",
      configured: false,
      maskedKey: null,
    });
  });

  it("should navigate back to the workspace", async () => {
    const user = userEvent.setup();
    const setActiveView = vi.spyOn(useAppStore.getState(), "setActiveView");

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByLabelText("Back to workspace"));

    expect(setActiveView).toHaveBeenCalledWith("main");
  });

  it("should update AI provider settings and clear local storage data", async () => {
    const user = userEvent.setup();
    const clearAllHistory = vi.spyOn(useAppStore.getState(), "clearAllHistory");
    const clearAllSavedQueries = vi.spyOn(useAppStore.getState(), "clearAllSavedQueries");

    useAppStore.setState({
      queryHistory: [
        { id: "h-1", sql: "select 1", executedAt: 1, executionTimeMs: 1, rowCount: 1, connectionId: "conn-1" },
      ],
      savedQueries: [
        { id: "sq-1", name: "Users", sql: "select * from users", createdAt: 1 },
      ],
    });

    renderWithProviders(<SettingsPage />);

    await user.click(screen.getByRole("tab", { name: "AI" }));
    expect(await screen.findByText("Assistant preferences")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Storage" }));
    expect(await screen.findByText("Local data")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear history" }));
    await user.click((await screen.findAllByRole("button", { name: /^Clear history$/i })).at(-1)!);
    await user.click(screen.getByRole("button", { name: /Clear saved queries/i }));
    await user.click(screen.getByRole("button", { name: "Clear queries" }));

    expect(clearAllHistory).toHaveBeenCalled();
    expect(clearAllSavedQueries).toHaveBeenCalled();
  });

  it("should render license empty state when no license is stored", async () => {
    renderWithProviders(<SettingsPage onActivate={vi.fn()} />);

    await userEvent.setup().click(screen.getByRole("tab", { name: "License" }));

    await waitFor(() => {
      expect(screen.getByText("License not activated")).toBeInTheDocument();
    });
  });
});
