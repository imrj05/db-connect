import type { StateCreator } from "zustand";
import { DB_FONT_SANS, DB_FONT_MONO } from "@/lib/fonts";
import type {
  AppSettings,
  EditorThemeOption,
} from "@/store/useAppStore";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  editorFontSize: 13,
  editorWordWrap: false,
  editorTabSize: 2,
  tablePageSize: 50,
  uiZoom: 125,
  editorDarkTheme: "dark-one-dark",
  editorLightTheme: "light-github",
  uiFontFamily: DB_FONT_SANS,
  monoFontFamily: DB_FONT_MONO,
  rowDensity: "default",
  queryTimeoutSecs: 30,
  queryMaxSqlBytes: 1_048_576,
  queryMaxResultRows: 10_000,
  diagramExportDir: "",
  experimentalSchemaEditor: false,
  errorReportingEnabled: true,
  anonymousTelemetryEnabled: false,
};

export interface SettingsSlice {
  appSettings: AppSettings;
  updateAppSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export const createSettingsSlice =
  (loadSettings: () => AppSettings, saveSettings: (s: AppSettings) => void): StateCreator<SettingsSlice, [], [], SettingsSlice> =>
  (set) => ({
    appSettings: loadSettings(),
    updateAppSetting: (key, value) =>
      set((state) => {
        const updated = { ...state.appSettings, [key]: value };
        saveSettings(updated);
        return { appSettings: updated };
      }),
  });

export type {
  AppSettings,
  EditorThemeOption,
};
