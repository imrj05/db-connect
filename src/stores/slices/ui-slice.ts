import type { StateCreator } from "zustand";
import type { ConnectionConfig } from "@/types";
import { THEME_KEY, loadLayout, saveLayout } from "../lib/persistence";
import type { AppState } from "../useAppStore";

export type AppView = "main" | "settings" | "new-connection" | "schema-diff";

export interface UiSlice {
  // ---- UI state ----
  expandedConnections: string[]; // connectionIds with open tree in sidebar
  sidebarCollapsed: boolean;
  dbTabsCollapsed: boolean;
  activeConnectionId: string | null; // which connection is selected in the connections panel
  queryLogOpen: boolean;
  commandPaletteOpen: boolean;
  connectionDialogOpen: boolean;
  editingConnection: ConnectionConfig | null;
  theme: "dark" | "light";
  isLoading: boolean;
  showConnectionsManager: boolean;
  activeView: AppView;

  // ---- Actions: UI ----
  toggleConnectionExpanded: (connectionId: string) => void;
  toggleSidebar: () => void;
  toggleDbTabs: () => void;
  setActiveConnectionId: (id: string | null) => void;
  toggleQueryLog: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  setEditingConnection: (connection: ConnectionConfig | null) => void;
  setTheme: (theme: "dark" | "light") => void;
  setLoading: (loading: boolean) => void;
  setShowConnectionsManager: (show: boolean) => void;
  setActiveView: (view: AppView) => void;
}

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set) => ({
  expandedConnections: [],
  ...loadLayout(),
  activeConnectionId: null,
  commandPaletteOpen: false,
  connectionDialogOpen: false,
  editingConnection: null,
  showConnectionsManager: false,
  theme: (localStorage.getItem(THEME_KEY) as "dark" | "light") ?? "dark",
  isLoading: false,
  activeView: "main",

  toggleConnectionExpanded: (connectionId) =>
    set((state) => ({
      expandedConnections: state.expandedConnections.includes(connectionId)
        ? state.expandedConnections.filter((id) => id !== connectionId)
        : [...state.expandedConnections, connectionId],
    })),

  toggleSidebar: () =>
    set((state) => {
      const updated = { sidebarCollapsed: !state.sidebarCollapsed };
      saveLayout({ sidebarCollapsed: updated.sidebarCollapsed, dbTabsCollapsed: state.dbTabsCollapsed, queryLogOpen: state.queryLogOpen });
      return updated;
    }),

  toggleDbTabs: () =>
    set((state) => {
      const updated = { dbTabsCollapsed: !state.dbTabsCollapsed };
      saveLayout({ sidebarCollapsed: state.sidebarCollapsed, dbTabsCollapsed: updated.dbTabsCollapsed, queryLogOpen: state.queryLogOpen });
      return updated;
    }),

  setActiveConnectionId: (id) => set((s) => ({
    activeConnectionId: id,
    activeFunction: id
      ? (Object.values(s.connectionFunctions[id] ?? {}).flat()[0] ?? s.activeFunction)
      : s.activeFunction,
  })),

  toggleQueryLog: () =>
    set((state) => {
      const updated = { queryLogOpen: !state.queryLogOpen };
      saveLayout({ sidebarCollapsed: state.sidebarCollapsed, dbTabsCollapsed: state.dbTabsCollapsed, queryLogOpen: updated.queryLogOpen });
      return updated;
    }),

  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setConnectionDialogOpen: (connectionDialogOpen) =>
    set({ connectionDialogOpen }),
  setEditingConnection: (editingConnection) => set({ editingConnection }),
  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    // Eagerly apply/remove the dark class so there's no timing gap waiting for React's useEffect
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    set({ theme });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setShowConnectionsManager: (showConnectionsManager) => set({ showConnectionsManager }),
  setActiveView: (activeView) => set({ activeView }),
});
