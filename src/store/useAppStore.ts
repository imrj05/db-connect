import { create } from 'zustand';
import { ConnectionConfig, QueryResult, TableInfo } from '@/types';

interface QueryTab {
  id: string;
  name: string;
  query: string;
  results?: QueryResult;
}

interface AppState {
  connections: ConnectionConfig[];
  activeConnection: ConnectionConfig | null;
  activeDatabase: string | null;
  activeSchema: string | null;
  databases: string[];
  tables: TableInfo[];
  queryTabs: QueryTab[];
  activeTabId: string | null;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  theme: 'dark' | 'light';
  isLoading: boolean;
  activeTable: string | null;
  connectionDialogOpen: boolean;

  // Actions
  setConnections: (connections: ConnectionConfig[]) => void;
  setActiveConnection: (connection: ConnectionConfig | null) => void;
  setActiveDatabase: (database: string | null) => void;
  setActiveSchema: (schema: string | null) => void;
  setDatabases: (databases: string[]) => void;
  setTables: (tables: TableInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setActiveTable: (table: string | null) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  addQueryTab: () => void;
  closeQueryTab: (id: string) => void;
  setActiveTabId: (id: string | null) => void;
  updateTabQuery: (id: string, query: string) => void;
  setTabResults: (id: string, results: QueryResult) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useAppStore = create<AppState>((set) => ({
  connections: [],
  activeConnection: null,
  activeDatabase: null,
  activeSchema: null,
  databases: [],
  tables: [],
  queryTabs: [{ id: '1', name: 'Query 1', query: '' }],
  activeTabId: '1',
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  theme: 'dark',
  isLoading: false,
  activeTable: null,
  connectionDialogOpen: false,

  setConnections: (connections) => set({ connections }),
  setActiveConnection: (activeConnection) => set({ activeConnection, activeDatabase: null, activeSchema: null, databases: [], tables: [] }),
  setActiveDatabase: (activeDatabase) => set({ activeDatabase, activeSchema: null, tables: [] }),
  setActiveSchema: (activeSchema) => set({ activeSchema, tables: [] }),
  setDatabases: (databases) => set({ databases }),
  setTables: (tables) => set({ tables }),
  setLoading: (isLoading) => set({ isLoading }),
  setActiveTable: (activeTable) => set({ activeTable }),
  setConnectionDialogOpen: (connectionDialogOpen) => set({ connectionDialogOpen }),
  
  addQueryTab: () => set((state) => {
    const id = Math.random().toString(36).substring(7);
    return {
      queryTabs: [...state.queryTabs, { id, name: `Query ${state.queryTabs.length + 1}`, query: '' }],
      activeTabId: id,
    };
  }),

  closeQueryTab: (id) => set((state) => {
    const newTabs = state.queryTabs.filter((tab) => tab.id !== id);
    return {
      queryTabs: newTabs.length > 0 ? newTabs : [{ id: '1', name: 'Query 1', query: '' }],
      activeTabId: state.activeTabId === id ? (newTabs[0]?.id || '1') : state.activeTabId,
    };
  }),

  setActiveTabId: (activeTabId) => set({ activeTabId }),
  
  updateTabQuery: (id, query) => set((state) => ({
    queryTabs: state.queryTabs.map((tab) => tab.id === id ? { ...tab, query } : tab),
  })),

  setTabResults: (id, results) => set((state) => ({
    queryTabs: state.queryTabs.map((tab) => tab.id === id ? { ...tab, results } : tab),
  })),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleRightPanel: () => {}, // No-op
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setTheme: (theme) => set({ theme }),
}));
