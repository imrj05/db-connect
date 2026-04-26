import {
  buildConnectionFunctions,
  filterFunctions,
  findFunctionBySignature,
  sanitizePrefix,
  suggestPrefix,
  toSnakeCase,
} from "@/lib/db-functions";
import type { ConnectionConfig, TableInfo } from "@/types";

describe("db-functions", () => {
  it("should convert mixed-case names to snake_case", () => {
    expect(toSnakeCase("MyTable.Name")).toBe("my_table_name");
    expect(toSnakeCase("battingAvg")).toBe("batting_avg");
  });

  it("should sanitize prefixes and fall back when empty", () => {
    expect(sanitizePrefix(" 123 Prod.DB! ")).toBe("prod_db");
    expect(sanitizePrefix("___")).toBe("conn");
  });

  it("should suggest prefixes from connection names", () => {
    expect(suggestPrefix("Production Analytics")).toBe("production_analytics");
  });

  it("should build utility functions and collision-safe table shortcuts", () => {
    const connection: ConnectionConfig = {
      id: "conn-1",
      name: "Analytics",
      prefix: "analytics",
      type: "postgresql",
    };
    const tables: TableInfo[] = [
      { name: "Order Items" },
      { name: "order_items" },
    ];

    const functions = buildConnectionFunctions(connection, tables);

    expect(functions.slice(0, 5).map((fn) => fn.type)).toEqual([
      "list",
      "src",
      "query",
      "execute",
      "tbl",
    ]);
    expect(functions[5]?.callSignature).toBe("analytics_order_items()");
    expect(functions[6]?.callSignature).toBe("analytics_order_items_2()");
  });

  it("should filter by signature, description, table name, and prefix", () => {
    const connection: ConnectionConfig = {
      id: "conn-1",
      name: "Analytics",
      prefix: "analytics",
      type: "postgresql",
    };
    const functions = buildConnectionFunctions(connection, [{ name: "users" }]);

    expect(filterFunctions(functions, "browse users").map((fn) => fn.type)).toContain("table");
    expect(filterFunctions(functions, "analytics")).toHaveLength(functions.length);
    expect(filterFunctions(functions, "query(sql)")[0]?.type).toBe("query");
  });

  it("should find functions by exact signature", () => {
    const connection: ConnectionConfig = {
      id: "conn-1",
      name: "Analytics",
      prefix: "analytics",
      type: "postgresql",
    };
    const functions = buildConnectionFunctions(connection, [{ name: "users" }]);

    expect(findFunctionBySignature(functions, "analytics_users()")?.tableName).toBe("users");
  });
});
