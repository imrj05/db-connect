import { toast } from "sonner";
import type {
  ConnectionFunction,
  FilterCondition,
  PinnedTable,
  ResultTab,
  WorkspaceSnapshot,
} from "@/types";
import { tauriApi } from "@/lib/tauri-api";
import { DB_FONT_SANS, DB_FONT_MONO } from "@/lib/fonts";
import type { AppSettings, LayoutState, RecentTable } from "../types";

// Legacy localStorage keys — kept only for one-time migration
export const LEGACY_CONNECTIONS_KEY = "db_connections_v3";
export const LEGACY_QUERIES_KEY = "db_saved_queries_v1";
export const SETTINGS_KEY = "db_connect_settings_v1";
export const THEME_KEY = "db_connect_theme_v1";
export const LAYOUT_KEY = "db_connect_layout_v1";
export const PINNED_TABLES_KEY = "db_connect_pinned_tables_v1";
export const RECENT_TABLES_KEY = "db_connect_recent_tables_v1";
export const RECENT_TABLES_MAX = 10;

export const DEFAULT_SETTINGS: AppSettings = {
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

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        editorDarkTheme: parsed.editorDarkTheme ?? DEFAULT_SETTINGS.editorDarkTheme,
        editorLightTheme: parsed.editorLightTheme ?? DEFAULT_SETTINGS.editorLightTheme,
      };
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadRecentTables(): RecentTable[] {
  try {
    const raw = localStorage.getItem(RECENT_TABLES_KEY);
    if (raw) return JSON.parse(raw) as RecentTable[];
  } catch { /* ignore */ }
  return [];
}

export function saveRecentTables(tables: RecentTable[]) {
  try {
    localStorage.setItem(RECENT_TABLES_KEY, JSON.stringify(tables.slice(0, RECENT_TABLES_MAX)));
  } catch { /* ignore */ }
}

export function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) return { ...{ sidebarCollapsed: false, dbTabsCollapsed: false, queryLogOpen: false }, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { sidebarCollapsed: false, dbTabsCollapsed: false, queryLogOpen: false };
}

export function saveLayout(l: LayoutState) {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(l));
}

export function loadPinnedTables(): PinnedTable[] {
  try {
    const raw = localStorage.getItem(PINNED_TABLES_KEY);
    if (raw) return JSON.parse(raw) as PinnedTable[];
  } catch { /* ignore */ }
  return [];
}

export function savePinnedTables(tables: PinnedTable[]) {
  localStorage.setItem(PINNED_TABLES_KEY, JSON.stringify(tables));
}

// Helper to create a default empty filter
export function createDefaultFilter(): FilterCondition {
  return {
    id: `f-${Date.now()}`,
    col: "",
    op: "=",
    value: "",
    join: "AND",
  };
}

export function getTabLabel(fn: ConnectionFunction): string {
  if (fn.type === "table") return fn.tableName ?? fn.name;
  return fn.name.slice(fn.prefix.length + 1).replace(/\(.*\)$/, "");
}

const textEncoder = new TextEncoder();

export function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${Number((bytes / 1_048_576).toFixed(1))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

export function validateSqlSize(sql: string, maxBytes: number): boolean {
  const actualBytes = textEncoder.encode(sql).length;
  if (actualBytes <= maxBytes) return true;
  toast.error(`Query is ${formatBytes(actualBytes)}, above your ${formatBytes(maxBytes)} safety limit.`);
  return false;
}

// ── Workspace persistence ──────────────────────────────────────────────────────
interface WorkspaceSnapshotSource {
  activeFunction: ConnectionFunction | null;
  activeTabId: string | null;
  selectedDatabases: Record<string, string>;
  tabs: ResultTab[];
  pendingSqlValue: string;
}

let _workspaceSaveTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleWorkspaceSave(getState: () => WorkspaceSnapshotSource) {
  if (_workspaceSaveTimer) clearTimeout(_workspaceSaveTimer);
  _workspaceSaveTimer = setTimeout(() => {
    const s = getState();
    const snapshot: WorkspaceSnapshot = {
      activeConnectionId: s.activeFunction?.connectionId ?? null,
      activeTabId: s.activeTabId,
      selectedDatabases: s.selectedDatabases,
      tabs: s.tabs.map((t) => ({
        id: t.id,
        fnId: t.fn.id,
        label: t.label,
        pendingSql: t.id === s.activeTabId ? s.pendingSqlValue : t.pendingSql,
      })),
      savedAt: Date.now(),
    };
    tauriApi.storageSaveWorkspace(JSON.stringify(snapshot)).catch(console.error);
  }, 500);
}
