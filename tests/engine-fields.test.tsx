import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EngineFields } from "@/components/layout/connection-dialog/engine-fields";
import { renderWithProviders } from "./test-utils";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.ComponentProps<"div">) => <div {...props}>{children}</div>,
  },
}));

describe("EngineFields", () => {
  it("shows redis username, password, and db index fields", () => {
    const { container } = renderWithProviders(
      <EngineFields
        formData={{ type: "redis", host: "localhost", port: 6379, database: "0" }}
        showPassword={false}
        onTogglePassword={() => {}}
        onPatch={() => {}}
      />,
    );

    expect(screen.getByText("Username (optional)")).toBeInTheDocument();
    expect(screen.getByText("Password (optional)")).toBeInTheDocument();
    expect(screen.getByText("DB Index")).toBeInTheDocument();
    expect(container.querySelector('input[name="db-username"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="db-password"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="db-database"]')).toHaveAttribute("placeholder", "0");
    expect(screen.queryByText("Database Name")).not.toBeInTheDocument();
  });
});
