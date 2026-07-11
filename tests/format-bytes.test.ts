import { describe, expect, it } from "vitest";
import { formatBytes } from "@/lib/format";

describe("formatBytes", () => {
    it("returns bytes for tiny sizes", () => {
        expect(formatBytes(0)).toBe("0 bytes");
        expect(formatBytes(512)).toBe("512 bytes");
    });

    it("formats kilobytes and megabytes", () => {
        expect(formatBytes(1024)).toBe("1 KB");
        expect(formatBytes(5_242_880)).toBe("5 MB");
    });

    it("clamps to bytes when smaller than 1 KB after rounding", () => {
        expect(formatBytes(800)).toBe("800 bytes");
    });
});
