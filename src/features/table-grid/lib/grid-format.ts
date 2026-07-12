import type { TableStructure } from "@/types";

export const DEFAULT_FIXED_COLUMN_WIDTH = 150;
export const MIN_COLUMN_WIDTH = 72;
export const MAX_CONTENT_FIT_COLUMN_WIDTH = 420;
export const CONTENT_FIT_CHAR_WIDTH_PX = 8;
export const CONTENT_FIT_CELL_PADDING_PX = 36;

export function toDisplayString(value: unknown): string {
    if (value === null) return "[NULL]";
    if (value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

export function simplifyDataType(type: string): string {
    const t = type.toLowerCase();
    if (t.includes("json")) return "JSON";
    if (t.includes("bool")) return "BOOL";
    if (t.includes("timestamp") || t.includes("datetime")) return "TS";
    if (t.includes("date") || t.includes("time")) return "DATE";
    if (t.includes("uuid")) return "UUID";
    if (t.includes("int") || t.includes("serial")) return "INT";
    if (t.includes("numeric") || t.includes("decimal") || t.includes("float") || t.includes("double") || t.includes("real")) return "NUM";
    if (t.includes("char") || t.includes("text") || t.includes("string")) return "TEXT";
    if (t.includes("blob") || t.includes("binary") || t.includes("byte")) return "BIN";
    return type.replace(/\(.*\)/, "").toUpperCase().slice(0, 7);
}

export function toEditString(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

export function getContentFitLength(value: unknown) {
    return toDisplayString(value).replace(/\s+/g, " ").length;
}

export function normalizeQueuedValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

export function buildPendingRowKey(
    primaryKeyValues: Record<string, unknown>,
    pkColumns: string[],
) {
    return JSON.stringify(
        pkColumns.map((col) => [col, primaryKeyValues[col] ?? null]),
    );
}

export type ColumnEditMeta = {
    isPrimary: boolean;
    isNullable: boolean;
    isGeneratedLike: boolean;
};

const GENERATED_COLUMN_PATTERN =
    /\b(auto_increment|autoincrement|identity|generated|virtual|stored|sequence|read-only)\b/i;
const SERIAL_COLUMN_PATTERN = /\b(smallserial|serial|bigserial)\b/i;

export function buildColumnEditMeta(
    column: TableStructure["columns"][number],
): ColumnEditMeta {
    const extra = column.extra ?? "";
    const dataType = column.dataType ?? "";

    return {
        isPrimary: column.isPrimary,
        isNullable: column.nullable,
        isGeneratedLike:
            GENERATED_COLUMN_PATTERN.test(extra) ||
            SERIAL_COLUMN_PATTERN.test(dataType),
    };
}
