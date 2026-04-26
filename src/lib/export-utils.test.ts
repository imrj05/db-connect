import {
  runExport,
  toCSV,
  toJSON,
  toMarkdown,
  toSQLInserts,
  toTSV,
} from "@/lib/export-utils";

describe("export-utils", () => {
  it("should quote CSV values that contain commas, quotes, or newlines", () => {
    const result = toCSV(["name", "notes"], [{ name: 'Ada, "Lovelace"', notes: "line1\nline2" }]);

    expect(result).toBe('name,notes\n"Ada, ""Lovelace""","line1\nline2"');
  });

  it("should replace tabs in TSV values", () => {
    expect(toTSV(["name"], [{ name: "Ada\tLovelace" }])).toBe("name\nAda Lovelace");
  });

  it("should pretty-print JSON rows", () => {
    expect(toJSON([{ id: 1 }])).toBe('[\n  {\n    "id": 1\n  }\n]');
  });

  it("should generate SQL inserts with escaped strings and nulls", () => {
    const result = toSQLInserts("users", ["name", "meta", "active", "score"], [
      { name: "O'Hara", meta: { plan: "pro" }, active: true, score: null },
    ]);

    expect(result).toContain("INSERT INTO `users` (`name`, `meta`, `active`, `score`)");
    expect(result).toContain("'O''Hara'");
    expect(result).toContain("'{\"plan\":\"pro\"}'");
    expect(result).toContain("true");
    expect(result).toContain("NULL");
  });

  it("should render markdown tables and escape pipes", () => {
    const result = toMarkdown(["name", "notes"], [{ name: "Ada|Bob", notes: "hello\nworld" }]);

    expect(result).toContain("| name | notes |");
    expect(result).toContain("Ada\\|Bob");
    expect(result).toContain("hello world");
  });

  it("should copy TSV to clipboard for clipboard exports", async () => {
    await runExport("clipboard-tsv", ["name"], [{ name: "Ada" }]);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("name\nAda");
  });
});
