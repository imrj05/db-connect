import { create } from 'zustand';
import { ConnectionConfig, QueryResult } from '@db-connect/types';

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
  queryTabs: QueryTab[];
  activeTabId: string | null;
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  theme: 'dark' | 'light';

  // Actions
  setConnections: (connections: ConnectionConfig[]) => void;
  setActiveConnection: (connection: ConnectionConfig | null) => void;
  setActiveDatabase: (database: string | null) => void;
  setActiveSchema: (schema: string | null) => void;
  addQueryTab: () => void;
  closeQueryTab: (id: string) => void;
  setActiveTabId: (id: string | null) => void;
  updateTabQuery: (id: string, query: string) => void;
  setTabResults: (id: string, results: QueryResult) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useAppStore = create<AppState>((set) => ({
  connections: [],
  activeConnection: null,
  activeDatabase: null,
  activeSchema: null,
  queryTabs: [{ id: '1', name: 'Query 1', query: '' }],
  activeTabId: '1',
  sidebarCollapsed: false,
  rightPanelOpen: true,
  theme: 'dark',

  setConnections: (connections) => set({ connections }),
  setActiveConnection: (activeConnection) => set({ activeConnection, activeDatabase: null, activeSchema: null }),
  setActiveDatabase: (activeDatabase) => set({ activeDatabase, activeSchema: null }),
  setActiveSchema: (activeSchema) => set({ activeSchema }),
  
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
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setTheme: (theme) => set({ theme }),
}));
