import { invoke } from "@tauri-apps/api/core";

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

    if (!families || families.length === 0) return [];

    return families.map(family => ({
        value: family,
        label: family,
        isMono: isMono(family),
    }));
}
