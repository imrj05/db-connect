import { create } from "zustand";
import { ConnectionConfig, QueryResult, TableInfo } from "@/types";
import { EncryptionUtils } from "@/lib/encryption";

const STORAGE_KEY = "db_connections_v2";

interface QueryTab {
	id: string;
	name: string;
	query: string;
	type: "query" | "table";
	tableName?: string;
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
	theme: "dark" | "light";
	isLoading: boolean;
	activeTable: string | null;
	connectionDialogOpen: boolean;

	// Actions
	setConnections: (connections: ConnectionConfig[]) => void;
	addConnection: (connection: ConnectionConfig) => void;
	deleteConnection: (id: string) => void;
	loadConnections: () => void;
	setActiveConnection: (connection: ConnectionConfig | null) => void;
	setActiveDatabase: (database: string | null) => void;
	setActiveSchema: (schema: string | null) => void;
	setDatabases: (databases: string[]) => void;
	setTables: (tables: TableInfo[]) => void;
	setLoading: (loading: boolean) => void;
	setActiveTable: (table: string | null) => void;
	setConnectionDialogOpen: (open: boolean) => void;
	addQueryTab: () => void;
	openTableTab: (tableName: string) => void;
	closeQueryTab: (id: string) => void;
	setActiveTabId: (id: string | null) => void;
	updateTabQuery: (id: string, query: string) => void;
	setTabResults: (id: string, results: QueryResult) => void;
	toggleSidebar: () => void;
	toggleRightPanel: () => void;
	setCommandPaletteOpen: (open: boolean) => void;
	setTheme: (theme: "dark" | "light") => void;
}

export const useAppStore = create<AppState>((set) => ({
	connections: [],
	activeConnection: null,
	activeDatabase: null,
	activeSchema: null,
	databases: [],
	tables: [],
	queryTabs: [{ id: "1", name: "Query 1", query: "", type: "query" }],
	activeTabId: "1",
	sidebarCollapsed: false,
	commandPaletteOpen: false,
	theme: "dark",
	isLoading: false,
	activeTable: null,
	connectionDialogOpen: false,

	setConnections: (connections) => {
		const encrypted = EncryptionUtils.encrypt(connections);
		localStorage.setItem(STORAGE_KEY, encrypted);
		set({ connections });
	},

	addConnection: (connection) =>
		set((state) => {
			const newConnections = [...state.connections, connection];
			const encrypted = EncryptionUtils.encrypt(newConnections);
			localStorage.setItem(STORAGE_KEY, encrypted);
			return { connections: newConnections };
		}),

	deleteConnection: (id) =>
		set((state) => {
			const newConnections = state.connections.filter((c) => c.id !== id);
			const encrypted = EncryptionUtils.encrypt(newConnections);
			localStorage.setItem(STORAGE_KEY, encrypted);
			return {
				connections: newConnections,
				activeConnection:
					state.activeConnection?.id === id
						? null
						: state.activeConnection,
			};
		}),

	loadConnections: () => {
		const encrypted = localStorage.getItem(STORAGE_KEY);
		if (encrypted) {
			const decrypted = EncryptionUtils.decrypt(encrypted);
			if (decrypted) {
				set({ connections: decrypted });
			}
		}
	},

	setActiveConnection: (activeConnection) =>
		set({
			activeConnection,
			activeDatabase: null,
			activeSchema: null,
			databases: [],
			tables: [],
			activeTable: null,
		}),
	setActiveDatabase: (activeDatabase) =>
		set({ activeDatabase, activeSchema: null, tables: [] }),
	setActiveSchema: (activeSchema) => set({ activeSchema, tables: [] }),
	setDatabases: (databases) => set({ databases }),
	setTables: (tables) => set({ tables }),
	setLoading: (isLoading) => set({ isLoading }),
	setActiveTable: (activeTable) => set({ activeTable }),
	setConnectionDialogOpen: (connectionDialogOpen) =>
		set({ connectionDialogOpen }),

	addQueryTab: () =>
		set((state) => {
			const id = Math.random().toString(36).substring(7);
			return {
				queryTabs: [
					...state.queryTabs,
					{
						id,
						name: `Query ${state.queryTabs.length + 1}`,
						query: "",
						type: "query",
					},
				],
				activeTabId: id,
			};
		}),

	openTableTab: (tableName) =>
		set((state) => {
			const existingTab = state.queryTabs.find(
				(t) => t.type === "table" && t.tableName === tableName,
			);
			if (existingTab) {
				return { activeTabId: existingTab.id };
			}

			const id = Math.random().toString(36).substring(7);
			return {
				queryTabs: [
					...state.queryTabs,
					{
						id,
						name: tableName,
						query: `SELECT * FROM ${tableName} LIMIT 100`,
						type: "table",
						tableName,
					},
				],
				activeTabId: id,
			};
		}),

	closeQueryTab: (id) =>
		set((state) => {
			const newTabs = state.queryTabs.filter((tab) => tab.id !== id);
			return {
				queryTabs:
					newTabs.length > 0
						? newTabs
						: [
								{
									id: "1",
									name: "Query 1",
									query: "",
									type: "query",
								},
							],
				activeTabId:
					state.activeTabId === id
						? newTabs[0]?.id || "1"
						: state.activeTabId,
			};
		}),

	setActiveTabId: (activeTabId) => set({ activeTabId }),

	updateTabQuery: (id, query) =>
		set((state) => ({
			queryTabs: state.queryTabs.map((tab) =>
				tab.id === id ? { ...tab, query } : tab,
			),
		})),

	setTabResults: (id, results) =>
		set((state) => ({
			queryTabs: state.queryTabs.map((tab) =>
				tab.id === id ? { ...tab, results } : tab,
			),
		})),

	toggleSidebar: () =>
		set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
	toggleRightPanel: () => {}, // No-op
	setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
	setTheme: (theme) => set({ theme }),
}));
