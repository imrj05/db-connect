// ── App settings (non-sensitive — persisted in localStorage) ──────────────────
export type EditorThemeOption =
  | "system"
  | "dark-one-dark"
  | "dark-monokai"
  | "dark-palenight"
  | "dark-dracula"
  | "light-github"
  | "light-solarized"
  | "light-white-pine"
  | "light-soft-white";

export interface AppSettings {
  editorFontSize: 12 | 13 | 14 | 16;
  editorWordWrap: boolean;
  editorTabSize: 2 | 4;
  tablePageSize: 25 | 50 | 100 | 200;
  uiZoom: 100 | 110 | 125 | 140 | 150;
  editorDarkTheme: EditorThemeOption;
  editorLightTheme: EditorThemeOption;
  uiFontFamily: string;
  monoFontFamily: string;
  rowDensity: "compact" | "default" | "comfortable";
  queryTimeoutSecs: number;
  queryMaxSqlBytes: number;
  queryMaxResultRows: number;
  /** Default directory used as the starting location in the Save dialog when exporting diagrams/images. Empty string means "no preference" (use OS default). */
  diagramExportDir: string;
  /** Enable experimental schema editor in the ER diagram view. */
  experimentalSchemaEditor: boolean;
  /** Send crash and error reports to the configured reporting server. */
  errorReportingEnabled: boolean;
  /** Send coarse anonymous product telemetry to the configured reporting server. */
  anonymousTelemetryEnabled: boolean;
}

export interface RecentTable {
  connectionId: string;
  tableName: string;
  schema?: string;
  openedAt: number;
}

export interface LayoutState {
  sidebarCollapsed: boolean;
  dbTabsCollapsed: boolean;
  queryLogOpen: boolean;
}
