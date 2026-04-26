import { useState, useMemo } from "react";
import { Search, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import type { UserSnippet } from "@/types";

interface BuiltInSnippet {
	id: string;
	label: string;
	description: string;
	category: string;
	sql: string;
	builtIn: true;
}

type AnySnippet = BuiltInSnippet | (UserSnippet & { builtIn?: false });

const BUILT_IN_SNIPPETS: BuiltInSnippet[] = [
	// ── SELECT ──────────────────────────────────────────────────
	{
		id: "select-all", label: "SELECT *", description: "Select all columns from a table", category: "SELECT", builtIn: true,
		sql: `SELECT *\nFROM table_name\nLIMIT 100;`,
	},
	{
		id: "select-cols", label: "SELECT columns", description: "Select specific columns", category: "SELECT", builtIn: true,
		sql: `SELECT col1, col2, col3\nFROM table_name\nWHERE condition\nORDER BY col1 ASC\nLIMIT 100;`,
	},
	{
		id: "select-count", label: "COUNT rows", description: "Count rows with optional group", category: "SELECT", builtIn: true,
		sql: `SELECT COUNT(*) AS row_count\nFROM table_name\nWHERE condition;`,
	},
	{
		id: "select-distinct", label: "SELECT DISTINCT", description: "Select unique values", category: "SELECT", builtIn: true,
		sql: `SELECT DISTINCT col1\nFROM table_name\nORDER BY col1;`,
	},
	// ── JOINs ───────────────────────────────────────────────────
	{
		id: "inner-join", label: "INNER JOIN", description: "Join two tables on a key", category: "JOINs", builtIn: true,
		sql: `SELECT a.*, b.col\nFROM table_a a\nINNER JOIN table_b b ON a.id = b.a_id\nWHERE a.condition\nLIMIT 100;`,
	},
	{
		id: "left-join", label: "LEFT JOIN", description: "Left outer join", category: "JOINs", builtIn: true,
		sql: `SELECT a.*, b.col\nFROM table_a a\nLEFT JOIN table_b b ON a.id = b.a_id\nWHERE b.id IS NULL;`,
	},
	// ── Aggregation ─────────────────────────────────────────────
	{
		id: "group-by", label: "GROUP BY", description: "Aggregate with group by", category: "Aggregation", builtIn: true,
		sql: `SELECT col, COUNT(*) AS cnt, SUM(amount) AS total\nFROM table_name\nGROUP BY col\nHAVING COUNT(*) > 1\nORDER BY cnt DESC;`,
	},
	{
		id: "window-fn", label: "Window function", description: "ROW_NUMBER / RANK over partition", category: "Aggregation", builtIn: true,
		sql: `SELECT\n  *,\n  ROW_NUMBER() OVER (PARTITION BY col ORDER BY id DESC) AS rn\nFROM table_name;`,
	},
	// ── CTEs ────────────────────────────────────────────────────
	{
		id: "cte", label: "WITH (CTE)", description: "Common table expression", category: "CTEs", builtIn: true,
		sql: `WITH cte AS (\n  SELECT *\n  FROM table_name\n  WHERE condition\n)\nSELECT * FROM cte;`,
	},
	{
		id: "recursive-cte", label: "Recursive CTE", description: "Walk a tree / hierarchy", category: "CTEs", builtIn: true,
		sql: `WITH RECURSIVE tree AS (\n  SELECT id, parent_id, name, 0 AS depth\n  FROM table_name\n  WHERE parent_id IS NULL\n  UNION ALL\n  SELECT t.id, t.parent_id, t.name, r.depth + 1\n  FROM table_name t\n  JOIN tree r ON t.parent_id = r.id\n)\nSELECT * FROM tree ORDER BY depth;`,
	},
	// ── DML ─────────────────────────────────────────────────────
	{
		id: "insert", label: "INSERT INTO", description: "Insert a row", category: "DML", builtIn: true,
		sql: `INSERT INTO table_name (col1, col2)\nVALUES ('value1', 'value2');`,
	},
	{
		id: "update", label: "UPDATE", description: "Update rows", category: "DML", builtIn: true,
		sql: `UPDATE table_name\nSET col1 = 'new_value'\nWHERE id = 1;`,
	},
	{
		id: "delete", label: "DELETE", description: "Delete rows", category: "DML", builtIn: true,
		sql: `DELETE FROM table_name\nWHERE id = 1;`,
	},
	// ── Inspect ─────────────────────────────────────────────────
	{
		id: "show-tables", label: "List tables", description: "Show all tables (PG/MySQL/SQLite)", category: "Inspect", builtIn: true,
		sql: `-- PostgreSQL\nSELECT table_name FROM information_schema.tables\nWHERE table_schema = 'public';\n-- MySQL: SHOW TABLES;\n-- SQLite: SELECT name FROM sqlite_master WHERE type='table';`,
	},
	{
		id: "show-columns", label: "List columns", description: "Show columns of a table", category: "Inspect", builtIn: true,
		sql: `-- PostgreSQL / MySQL\nSELECT column_name, data_type, is_nullable\nFROM information_schema.columns\nWHERE table_name = 'your_table'\nORDER BY ordinal_position;`,
	},
	{
		id: "explain", label: "EXPLAIN", description: "Query execution plan", category: "Inspect", builtIn: true,
		sql: `EXPLAIN ANALYZE\nSELECT *\nFROM table_name\nWHERE condition;`,
	},
];

type NewSnippetForm = { label: string; description: string; category: string; sql: string };

export function SnippetsPanel({ onInsert }: { onInsert: (sql: string) => void }) {
	const { userSnippets, saveUserSnippet, deleteUserSnippet } = useAppStore();
	const [search, setSearch] = useState("");
	const [activeCategory, setActiveCategory] = useState<string | null>(null);
	const [showAdd, setShowAdd] = useState(false);
	const [form, setForm] = useState<NewSnippetForm>({ label: "", description: "", category: "Custom", sql: "" });
	const [saving, setSaving] = useState(false);

	const allSnippets: AnySnippet[] = useMemo(
		() => [...BUILT_IN_SNIPPETS, ...userSnippets.map((s) => ({ ...s, builtIn: false as const }))],
		[userSnippets],
	);

	const allCategories = useMemo(
		() => Array.from(new Set(allSnippets.map((s) => s.category))),
		[allSnippets],
	);

	const filtered = useMemo(() => {
		const q = search.toLowerCase();
		return allSnippets.filter((s) => {
			const matchCat = !activeCategory || s.category === activeCategory;
			const matchSearch =
				!q ||
				s.label.toLowerCase().includes(q) ||
				s.description.toLowerCase().includes(q) ||
				s.category.toLowerCase().includes(q);
			return matchCat && matchSearch;
		});
	}, [search, activeCategory, allSnippets]);

	const handleSave = async () => {
		if (!form.label.trim() || !form.sql.trim()) return;
		setSaving(true);
		try {
			await saveUserSnippet({ label: form.label.trim(), description: form.description.trim(), category: form.category.trim() || "Custom", sql: form.sql.trim() });
			setForm({ label: "", description: "", category: "Custom", sql: "" });
			setShowAdd(false);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="flex flex-col h-full bg-background">
			{/* Search + add button */}
			<div className="px-2 py-2 border-b border-border shrink-0 flex gap-1.5">
				<div className="relative flex-1">
					<Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search snippets…"
						className="h-6 pl-7 text-[11px] bg-surface-3 border-border/60"
					/>
				</div>
				<Button
					size="icon"
					variant="ghost"
					className="h-6 w-6 shrink-0 text-muted-foreground/50 hover:text-foreground"
					onClick={() => setShowAdd((v) => !v)}
				>
					{showAdd ? <X size={11} /> : <Plus size={11} />}
				</Button>
			</div>

			{/* Add snippet form */}
			{showAdd && (
				<div className="px-2 py-2 border-b border-border shrink-0 flex flex-col gap-1.5 bg-surface-2">
					<Input
						value={form.label}
						onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
						placeholder="Label *"
						className="h-6 text-[11px]"
					/>
					<Input
						value={form.description}
						onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
						placeholder="Description"
						className="h-6 text-[11px]"
					/>
					<Input
						value={form.category}
						onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
						placeholder="Category"
						className="h-6 text-[11px]"
					/>
					<textarea
						value={form.sql}
						onChange={(e) => setForm((f) => ({ ...f, sql: e.target.value }))}
						placeholder="SQL *"
						rows={4}
						className="resize-none rounded-md border border-border/60 bg-surface-3 px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
					/>
					<div className="flex justify-end gap-1">
						<Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setShowAdd(false)}>Cancel</Button>
						<Button size="sm" className="h-6 text-[11px]" onClick={handleSave} disabled={saving || !form.label.trim() || !form.sql.trim()}>
							{saving ? "Saving…" : "Save"}
						</Button>
					</div>
				</div>
			)}

			{/* Category pills */}
			<div className="flex gap-1 px-2 py-1.5 border-b border-border shrink-0 flex-wrap">
				<button
					onClick={() => setActiveCategory(null)}
					className={cn(
						"px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide transition-colors",
						!activeCategory ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground hover:bg-surface-3",
					)}
				>
					All
				</button>
				{allCategories.map((cat) => (
					<button
						key={cat}
						onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
						className={cn(
							"px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide transition-colors",
							activeCategory === cat ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground hover:bg-surface-3",
						)}
					>
						{cat}
					</button>
				))}
			</div>

			{/* Snippet list */}
			<div className="flex-1 overflow-y-auto scrollbar-thin">
				{filtered.length === 0 ? (
					<div className="flex items-center justify-center h-16 text-[11px] text-muted-foreground/40">
						No snippets match
					</div>
				) : (
					<div className="p-1.5 space-y-px">
						{filtered.map((snippet) => (
							<div
								key={snippet.id}
								className="group relative w-full flex items-center justify-between gap-2 rounded-md px-2.5 py-2 hover:bg-surface-3 transition-colors"
							>
								<button
									className="flex-1 text-left flex items-center justify-between gap-2 min-w-0"
									onClick={() => onInsert(snippet.sql)}
								>
									<div className="min-w-0">
										<div className="flex items-center gap-1.5">
											<span className="text-[11px] font-mono font-semibold text-foreground/85 truncate">
												{snippet.label}
											</span>
											<span className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground/40 shrink-0">
												{snippet.category}
											</span>
											{!snippet.builtIn && (
												<span className="text-[8px] font-semibold uppercase tracking-wide text-primary/50 shrink-0">custom</span>
											)}
										</div>
										<div className="text-[10px] text-muted-foreground/55 truncate mt-px">
											{snippet.description}
										</div>
									</div>
									<ChevronRight size={10} className="shrink-0 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
								</button>
								{!snippet.builtIn && (
									<button
										onClick={(e) => { e.stopPropagation(); deleteUserSnippet(snippet.id); }}
										className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
									>
										<Trash2 size={10} />
									</button>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
