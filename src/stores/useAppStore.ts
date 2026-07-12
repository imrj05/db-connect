import { create } from "zustand";
import { THEME_KEY, loadSettings, saveSettings } from "./lib/persistence";
import { createConnectionSlice, type ConnectionSlice } from "./slices/connection-slice";
import { createWorkspaceSlice, type WorkspaceSlice } from "./slices/workspace-slice";
import { createQuerySlice, type QuerySlice } from "./slices/query-slice";
import { createTableSlice, type TableSlice } from "./slices/table-slice";
import { createUiSlice, type UiSlice } from "./slices/ui-slice";
import { createSettingsSlice, type SettingsSlice } from "./slices/settings-slice";

// Re-exported for consumers that historically imported these from the store
export type { AppSettings, EditorThemeOption, RecentTable } from "./types";

export type AppState = ConnectionSlice &
  WorkspaceSlice &
  QuerySlice &
  TableSlice &
  UiSlice &
  SettingsSlice;

export const useAppStore = create<AppState>()((...a) => ({
  ...createConnectionSlice(...a),
  ...createWorkspaceSlice(...a),
  ...createQuerySlice(...a),
  ...createTableSlice(...a),
  ...createUiSlice(...a),
  ...createSettingsSlice(loadSettings, saveSettings)(...a),
}));

// Apply initial theme class to <html> at module load time (before first React render)
const _initialTheme = (localStorage.getItem(THEME_KEY) as "dark" | "light") ?? "dark";
if (_initialTheme === "dark") {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}
