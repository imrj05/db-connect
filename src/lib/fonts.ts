import { invoke } from "@tauri-apps/api/core";

// ── Special built-in font aliases ─────────────────────────────────────────────
// These work like Zed's ".SystemUIFont" / ".ZedMono" — they are virtual names
// that resolve to well-known font stacks instead of being passed to the OS.
export const DB_FONT_SANS = ".dbFontSans";
export const DB_FONT_MONO = ".dbFontMono";

// The actual CSS font-family stacks each alias resolves to
export const DB_FONT_SANS_STACK =
    `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif`;
export const DB_FONT_MONO_STACK =
    `"JetBrains Mono", "IBM Plex Mono", "SF Mono", "Cascadia Code", ui-monospace, Menlo, Monaco, Consolas, monospace`;

const BUILTIN_SANS: FontEntry = {
    value: DB_FONT_SANS,
    label: "System UI Font (Default)",
    isMono: false,
};

const BUILTIN_MONO: FontEntry = {
    value: DB_FONT_MONO,
    label: "DB Mono (Default)",
    isMono: true,
};

const monoPatterns = [
    "mono",
    "code",
    "consolas",
    "consola",
    "menlo",
    "monaco",
    "fira code",
    "jetbrains",
    "hack",
    "source code",
    "inconsolata",
    "cascadia",
    "anonymo",
    "space mono",
    "victor mono",
    "fira mono",
    "droid",
    "oxygen mono",
    "courier",
    "terminal",
    "fixedsys",
    "ibm plex mono",
    "commit mono",
    "berkeley mono",
    "input mono",
    "iosevka",
    "recursive",
];

function isMono(family: string): boolean {
    const lower = family.toLowerCase();
    return monoPatterns.some(p => lower.includes(p));
}

export interface FontEntry {
    value: string;
    label: string;
    isMono: boolean;
}

/**
 * Returns all font families installed on the system by invoking the
 * Rust `get_system_fonts` command, which uses CoreText (macOS),
 * DirectWrite (Windows), or Fontconfig (Linux) — the same strategy Zed uses.
 *
 * Falls back to an empty list if the invoke fails (e.g. in browser dev mode).
 */
export async function getSystemFonts(): Promise<FontEntry[]> {
    let families: string[] = [];

    try {
        families = await invoke<string[]>("get_system_fonts");
    } catch (e) {
        console.warn("[fonts] get_system_fonts invoke failed:", e);
        return [];
    }

    if (!families || families.length === 0) return [BUILTIN_SANS, BUILTIN_MONO];

    const systemFonts = families.map(family => ({
        value: family,
        label: family,
        isMono: isMono(family),
    }));

    // Prepend the built-in aliases so they always appear at the top
    const sansFonts = [BUILTIN_SANS, ...systemFonts.filter(f => !f.isMono)];
    const monoFonts = [BUILTIN_MONO, ...systemFonts.filter(f => f.isMono)];

    return [...sansFonts, ...monoFonts];
}
