import type { StateCreator } from "zustand";
import type { AppSettings } from "../types";
import type { AppState } from "../useAppStore";

export interface SettingsSlice {
  appSettings: AppSettings;
  updateAppSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export const createSettingsSlice =
  (loadSettings: () => AppSettings, saveSettings: (s: AppSettings) => void): StateCreator<AppState, [], [], SettingsSlice> =>
  (set) => ({
    appSettings: loadSettings(),
    updateAppSetting: (key, value) =>
      set((state) => {
        const updated = { ...state.appSettings, [key]: value };
        saveSettings(updated);
        return { appSettings: updated };
      }),
  });
