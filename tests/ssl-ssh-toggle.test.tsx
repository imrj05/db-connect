import { screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

import ConnectionDialog from "@/components/layout/connection-dialog-modal";
import { renderWithProviders, resetAppStore } from "./test-utils";
import { useAppStore } from "@/store/useAppStore";

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

/** Helper: render the edit dialog with Advanced Options expanded. */
function renderEditDialog() {
    resetAppStore();
    useAppStore.setState({ connections: [stubConn] });
    renderWithProviders(
        <ConnectionDialog initialData={stubConn} onClose={() => {}} mode="modal" />,
    );
    // Open the "Advanced Options" collapsible so SSL/SSH toggles are visible.
    const advancedTrigger = screen.getByText("Advanced Options");
    fireEvent.click(advancedTrigger);
}

describe("ConnectionDialog SSL/SSH toggle", () => {
    it("toggling SSL does not throw and updates formData", () => {
        renderEditDialog();

        const sslLabel = screen.getByText("SSL / TLS Encryption");
        const sslToggle = sslLabel.closest('[role="button"]') as HTMLElement;
        expect(sslToggle).toBeTruthy();

        // Click the SSL toggle — this should not throw
        expect(() => fireEvent.click(sslToggle)).not.toThrow();

        // The Switch should now be checked (ssl: true)
        const sslSwitch = sslToggle.querySelector('[role="switch"]') as HTMLElement;
        expect(sslSwitch).toBeTruthy();
        expect(sslSwitch).toHaveAttribute("data-state", "checked");
    });

    it("toggling SSH does not throw and updates formData", () => {
        renderEditDialog();

        const sshLabel = screen.getByText("SSH Tunnel");
        const sshToggle = sshLabel.closest('[role="button"]') as HTMLElement;
        expect(sshToggle).toBeTruthy();

        // Click the SSH toggle — this should not throw
        expect(() => fireEvent.click(sshToggle)).not.toThrow();

        // The Switch should now be checked (sshEnabled: true)
        const sshSwitch = sshToggle.querySelector('[role="switch"]') as HTMLElement;
        expect(sshSwitch).toBeTruthy();
        expect(sshSwitch).toHaveAttribute("data-state", "checked");
    });

    it("toggling SSL then SSH does not throw", () => {
        renderEditDialog();

        const sslToggle = screen.getByText("SSL / TLS Encryption").closest('[role="button"]') as HTMLElement;
        const sshToggle = screen.getByText("SSH Tunnel").closest('[role="button"]') as HTMLElement;

        expect(() => {
            fireEvent.click(sslToggle);
            fireEvent.click(sshToggle);
        }).not.toThrow();
    });
});

