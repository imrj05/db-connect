import type { StateCreator } from "zustand";
import type { QueryHistoryEntry, SavedQuery, UserSnippet } from "@/types";
import { tauriApi } from "@/lib/tauri-api";
import type { AppState } from "../useAppStore";

export interface QuerySlice {
  // ---- Query history (persisted, all connections) ----
  queryHistory: QueryHistoryEntry[];
  addToHistory: (entry: QueryHistoryEntry) => void;
  clearHistory: (connectionId: string) => void;
  clearAllHistory: () => void;
  deleteHistoryEntry: (id: string) => void;

  // ---- Saved queries (persisted) ----
  savedQueries: SavedQuery[];
  saveQuery: (name: string, sql: string, connectionId?: string, folder?: string) => void;
  moveSavedQueryFolder: (id: string, folder: string | undefined) => void;
  deleteSavedQuery: (id: string) => void;
  clearAllSavedQueries: () => void;

  // ---- User snippets (persisted) ----
  userSnippets: UserSnippet[];
  saveUserSnippet: (snippet: Omit<UserSnippet, "id" | "createdAt">) => Promise<void>;
  deleteUserSnippet: (id: string) => Promise<void>;
}

export const createQuerySlice: StateCreator<AppState, [], [], QuerySlice> = (set, get) => ({
  queryHistory: [],
  savedQueries: [],
  userSnippets: [],

  // ---- Query history ----

  addToHistory: (entry) => {
    tauriApi.storageSaveHistoryEntry(entry).catch(console.error);
    set((state) => ({ queryHistory: [entry, ...state.queryHistory] }));
  },

  clearHistory: (connectionId) => {
    tauriApi.storageClearHistory(connectionId).catch(console.error);
    set((state) => ({
      queryHistory: state.queryHistory.filter((e) => e.connectionId !== connectionId),
    }));
  },

  clearAllHistory: () => {
    tauriApi.storageClearAllHistory().catch(console.error);
    set({ queryHistory: [] });
  },

  deleteHistoryEntry: (id) => {
    tauriApi.storageDeleteHistoryEntry(id).catch(console.error);
    set((state) => ({ queryHistory: state.queryHistory.filter((e) => e.id !== id) }));
  },

  // ---- Saved queries ----

  saveQuery: (name, sql, connectionId, folder) => {
    const entry: SavedQuery = {
      id: `sq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      sql,
      connectionId,
      folder,
      createdAt: Date.now(),
    };
    set((state) => ({ savedQueries: [...state.savedQueries, entry] }));
    tauriApi.storageSaveQuery(entry).catch(console.error);
  },

  moveSavedQueryFolder: (id, folder) => {
    set((state) => {
      const updated = state.savedQueries.map((q) =>
        q.id === id ? { ...q, folder } : q
      );
      const target = updated.find((q) => q.id === id);
      if (target) tauriApi.storageSaveQuery(target).catch(console.error);
      return { savedQueries: updated };
    });
  },

  deleteSavedQuery: (id) => {
    set((state) => ({
      savedQueries: state.savedQueries.filter((q) => q.id !== id),
    }));
    tauriApi.storageDeleteQuery(id).catch(console.error);
  },

  clearAllSavedQueries: () => {
    const { savedQueries } = get();
    set({ savedQueries: [] });
    // Delete every query from SQLite
    savedQueries.forEach((q) => tauriApi.storageDeleteQuery(q.id).catch(console.error));
  },

  // ---- User snippets ----

  saveUserSnippet: async (snippetData) => {
    const snippet: UserSnippet = {
      ...snippetData,
      id: `snip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    await tauriApi.storageSaveSnippet(snippet);
    set((state) => ({ userSnippets: [...state.userSnippets, snippet] }));
  },

  deleteUserSnippet: async (id) => {
    await tauriApi.storageDeleteSnippet(id);
    set((state) => ({ userSnippets: state.userSnippets.filter((s) => s.id !== id) }));
  },
});
