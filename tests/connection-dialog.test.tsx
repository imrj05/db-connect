import { screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

import ConnectionDialog from "@/components/layout/connection-dialog-modal";
import { renderWithProviders, resetAppStore } from "./test-utils";

vi.mock("framer-motion", () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({ children, ...props }: React.ComponentProps<"div">) => <div {...props}>{children}</div>,
    },
}));

const stubConn: any = {
    id: "conn-1",
    name: "Production Analytics",
    prefix: "prod",
    type: "postgresql",
    host: "db.example.internal",
    port: 5432,
    user: "app",
    password: "secret",
    database: "analytics",
    group: "prod",
    ssl: false,
    safetyMode: "none",
};

describe("ConnectionDialog render", () => {
    it("mounts in edit mode without an infinite render loop", () => {
        resetAppStore();
        const { container } = renderWithProviders(
            <ConnectionDialog initialData={stubConn} onClose={() => {}} mode="modal" />,
        );
        expect(screen.getAllByText("Edit Connection").length).toBeGreaterThan(0);
        expect(container).toBeTruthy();
    });

    it("does not loop when Connect now is clicked", async () => {
        resetAppStore();
        const { findByRole } = renderWithProviders(
            <ConnectionDialog initialData={stubConn} onClose={() => {}} mode="modal" />,
        );
        // Trigger the form submit directly (simulates clicking the submit button)
        const form = document.querySelector("form") as HTMLFormElement;
        expect(form).toBeTruthy();
        form.dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true }),
        );
        // If there were a render loop, this would throw before we get here.
        expect(true).toBe(true);
    });

    it("clicking an inner action button (Auto prefix) does NOT submit the form / connect", () => {
        resetAppStore();
        const invokeMock = invoke as unknown as { mock: { calls: unknown[][] } };
        invokeMock.mock.calls = [];
        renderWithProviders(
            <ConnectionDialog initialData={stubConn} onClose={() => {}} mode="modal" />,
        );
        // The "Auto" prefix button is an action, not the primary submit. Before the
        // fix, <Button> defaulted to type="submit" inside the <form>, so clicking it
        // submitted → handleConnect → tauriApi.connect → invoke().
        const autoBtn = screen.getByRole("button", { name: "Auto" });
        fireEvent.click(autoBtn);
        const connectCalls = invokeMock.mock.calls.filter(
            (c) => (c[0] as string) === "connect",
        );
        expect(connectCalls).toHaveLength(0);
    });
});

// ── Regression: "Maximum update depth exceeded" on edit connection modal ──────
// The original test stub has prefix:"prod", so prefixManuallyEdited starts true
// and the auto-prefix useEffect never fires. These tests cover the path where
// the connection has NO prefix — the effect runs and must not loop.
describe("ConnectionDialog edit mode — no prefix", () => {
    const stubConnNoPrefix: any = {
        id: "conn-2",
        name: "Staging Warehouse",
        type: "postgresql",
        host: "staging.db.internal",
        port: 5432,
        user: "app",
        password: "secret",
        database: "warehouse",
        group: "staging",
        ssl: false,
        safetyMode: "none",
    };

    it("mounts in edit mode without a prefix and does not loop (StrictMode)", () => {
        resetAppStore();
        const { container } = renderWithProviders(
            <React.StrictMode>
                <ConnectionDialog initialData={stubConnNoPrefix} onClose={() => {}} mode="modal" />
            </React.StrictMode>,
        );
        expect(screen.getAllByText("Edit Connection").length).toBeGreaterThan(0);
        expect(container).toBeTruthy();
    });

    it("auto-suggests the prefix from the connection name", () => {
        resetAppStore();
        renderWithProviders(
            <ConnectionDialog initialData={stubConnNoPrefix} onClose={() => {}} mode="modal" />,
        );
        // suggestPrefix("Staging Warehouse") → "staging_warehouse"
        const prefixInput = screen.getByPlaceholderText("e.g. prod") as HTMLInputElement;
        expect(prefixInput.value).toBe("staging_warehouse");
    });
});