import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/store/useAppStore";

export function renderWithProviders(ui: ReactElement, options?: { wrapper?: ({ children }: { children: ReactNode }) => ReactElement }) {
  const Wrapper = options?.wrapper ?? (({ children }: { children: ReactNode }) => <TooltipProvider>{children}</TooltipProvider>);
  return render(ui, { wrapper: Wrapper });
}

export function resetAppStore() {
  useAppStore.setState(useAppStore.getInitialState(), true);
}
