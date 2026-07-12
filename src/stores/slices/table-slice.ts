import type { StateCreator } from "zustand";
import type { PinnedTable } from "@/types";
import type { RecentTable } from "../types";
import {
  RECENT_TABLES_MAX,
  loadPinnedTables,
  loadRecentTables,
  savePinnedTables,
  saveRecentTables,
} from "../lib/persistence";
import type { AppState } from "../useAppStore";

export interface TableSlice {
  // ---- Pinned tables ----
  pinnedTables: PinnedTable[];
  pinTable: (connectionId: string, tableName: string, schemaName?: string) => void;
  unpinTable: (connectionId: string, tableName: string) => void;
  isTablePinned: (connectionId: string, tableName: string) => boolean;

  // ---- Recent tables ----
  recentTables: RecentTable[]; // recently opened tables, persisted
  recordRecentTable: (connectionId: string, tableName: string, schema?: string) => void;
  clearRecentTables: () => void;
}

export const createTableSlice: StateCreator<AppState, [], [], TableSlice> = (set, get) => ({
  pinnedTables: loadPinnedTables(),
  recentTables: loadRecentTables(),

  pinTable: (connectionId, tableName, schemaName) =>
    set((state) => {
      if (state.pinnedTables.some((p) => p.connectionId === connectionId && p.tableName === tableName)) return {};
      const updated = [...state.pinnedTables, { connectionId, tableName, schemaName, pinnedAt: Date.now() }];
      savePinnedTables(updated);
      return { pinnedTables: updated };
    }),

  unpinTable: (connectionId, tableName) =>
    set((state) => {
      const updated = state.pinnedTables.filter((p) => !(p.connectionId === connectionId && p.tableName === tableName));
      savePinnedTables(updated);
      return { pinnedTables: updated };
    }),

  isTablePinned: (connectionId, tableName) =>
    get().pinnedTables.some((p) => p.connectionId === connectionId && p.tableName === tableName),

  recordRecentTable: (connectionId, tableName, schema) => {
    set((state) => {
      const filtered = state.recentTables.filter(
        (r) => !(r.connectionId === connectionId && r.tableName === tableName && r.schema === schema),
      );
      const next: RecentTable[] = [
        { connectionId, tableName, schema, openedAt: Date.now() },
        ...filtered,
      ].slice(0, RECENT_TABLES_MAX);
      saveRecentTables(next);
      return { recentTables: next };
    });
  },

  clearRecentTables: () => {
    saveRecentTables([]);
    set({ recentTables: [] });
  },
});
