import { DB_FONT_SANS, DB_FONT_MONO } from "@/lib/fonts";

export const DEFAULT_APP_SETTINGS = {
    editorFontSize: 13 as const,
    editorWordWrap: false,
    editorTabSize: 2 as const,
    tablePageSize: 50 as const,
    uiZoom: 125 as const,
    editorDarkTheme: "dark-one-dark" as const,
    editorLightTheme: "light-github" as const,
    uiFontFamily: DB_FONT_SANS,
    monoFontFamily: DB_FONT_MONO,
    rowDensity: "default" as const,
    queryTimeoutSecs: 30,
    queryMaxSqlBytes: 1_048_576,
    queryMaxResultRows: 10_000,
    diagramExportDir: "",
    experimentalSchemaEditor: false,
    errorReportingEnabled: true,
    anonymousTelemetryEnabled: false,
};

export function getDefaultSettings() {
    return DEFAULT_APP_SETTINGS;
}
