import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TableGridView } from "@/components/layout/function-output/table-grid-view";
import { tauriApi } from "@/lib/tauri-api";
import { useAppStore } from "@/store/useAppStore";
import { renderWithProviders, resetAppStore } from "./test-utils";
import type { ConnectionFunction, TableStructure } from "@/types";

const emptyStructure: TableStructure = { columns: [], indexes: [] };

describe("schema-aware table structure loading", () => {
  beforeEach(() => {
    resetAppStore();
  });

  it("passes the postgresql database as schema context from table-grid-view", async () => {
    const getTableStructureSpy = vi
      .spyOn(tauriApi, "getTableStructure")
      .mockResolvedValue(emptyStructure);

    vi.spyOn(tauriApi, "getSchemaGraph").mockResolvedValue({
      tables: [],
      relationships: [],
    });

    useAppStore.setState((state) => ({
      ...state,
      connections: [{ id: "pg-1", name: "Postgres", prefix: "pg", type: "postgresql", database: "analytics" }],
      selectedDatabases: { "pg-1": "analytics" },
      connectionFunctions: { "pg-1": { analytics: [] } },
    }));

    const fn: ConnectionFunction = {
      id: "pg-1_users",
      name: "pg_users()",
      callSignature: "pg_users()",
      prefix: "pg",
      connectionId: "pg-1",
      type: "table",
      tableName: "users",
      description: "Browse users",
    };

    renderWithProviders(
      <TableGridView
        fn={fn}
        queryResult={{ columns: [], rows: [], executionTimeMs: 1 }}
        isLoading={false}
        onPageChange={() => {}}
        page={0}
        database="analytics"
      />,
    );

    await waitFor(() => {
      expect(getTableStructureSpy).toHaveBeenCalledWith("pg-1", "analytics", "users", "analytics");
    });
  });

  it("passes cached table schema from loadTableColumns", async () => {
    const getTableStructureSpy = vi
      .spyOn(tauriApi, "getTableStructure")
      .mockResolvedValue({
        columns: [
          {
            name: "id",
            dataType: "integer",
            nullable: false,
            isPrimary: true,
            isUnique: true,
            defaultValue: null,
            extra: null,
          },
        ],
        indexes: [],
      });

    useAppStore.setState((state) => ({
      ...state,
      selectedDatabases: { conn1: "analytics" },
      connectionTables: {
        conn1: {
          analytics: [{ name: "users", schema: "reporting" }],
        },
      },
    }));

    await useAppStore.getState().loadTableColumns("conn1", "users");

    expect(getTableStructureSpy).toHaveBeenCalledWith("conn1", "analytics", "users", "reporting");
    expect(useAppStore.getState().connectionTables.conn1.analytics[0].columns).toEqual([
      {
        name: "id",
        dataType: "integer",
        nullable: false,
        isPrimary: true,
        isUnique: true,
        defaultValue: null,
        extra: null,
      },
    ]);
  });
});
