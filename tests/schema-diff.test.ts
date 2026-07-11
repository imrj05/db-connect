import { describe, expect, it } from "vitest";
import { diffDraft, graphToDraft } from "@/features/schema-diff/lib";
import type { SchemaGraph } from "@/types";

function buildGraph(): SchemaGraph {
    return {
        tables: [
            {
                name: "users",
                schema: "public",
                columns: [
                    { name: "id", dataType: "integer", nullable: false, isPrimary: true, isUnique: true, defaultValue: null, extra: null },
                    { name: "email", dataType: "text", nullable: false, isPrimary: false, isUnique: false, defaultValue: null, extra: null },
                ],
            },
        ],
        relationships: [
            {
                name: "fk_orders_user",
                sourceTable: "orders",
                sourceSchema: "public",
                sourceColumns: ["user_id"],
                targetTable: "users",
                targetSchema: "public",
                targetColumns: ["id"],
            },
        ],
    };
}

describe("graphToDraft + diffDraft", () => {
    it("produces no changes when draft mirrors original", () => {
        const graph = buildGraph();
        const draft = graphToDraft(graph, "postgres");
        const changes = diffDraft(draft, graph);
        const meaningful = changes.filter((c) => c.type !== "noop");
        expect(meaningful).toEqual([]);
    });

    it("detects an added column", () => {
        const graph = buildGraph();
        const draft = graphToDraft(graph, "postgres");
        const usersTable = draft.tables.find((t) => t.name === "users")!;
        usersTable.columns.push({
            id: "new-col",
            name: "created_at",
            dataType: "timestamp",
            nullable: true,
            isPrimary: false,
            defaultValue: null,
        });
        const changes = diffDraft(draft, graph);
        const added = changes.find((c) => c.type === "addColumn");
        expect(added).toBeDefined();
        if (added && added.type === "addColumn") {
            expect(added.column.name).toBe("created_at");
        }
    });

    it("detects a dropped column", () => {
        const graph = buildGraph();
        const draft = graphToDraft(graph, "postgres");
        const usersTable = draft.tables.find((t) => t.name === "users")!;
        usersTable.columns = usersTable.columns.filter((c) => c.name !== "email");
        const changes = diffDraft(draft, graph);
        const dropped = changes.find((c) => c.type === "dropColumn");
        expect(dropped).toBeDefined();
        if (dropped && dropped.type === "dropColumn") {
            expect(dropped.columnName).toBe("email");
        }
    });
});
