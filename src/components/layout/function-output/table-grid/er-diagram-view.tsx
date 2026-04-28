import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Background,
	Controls,
	MiniMap,
	ReactFlow,
	type Connection,
	type Edge,
	type Node,
	type OnConnect,
	useEdgesState,
	useNodesState,
	MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "@/components/ui/sonner";
import { tauriApi } from "@/lib/tauri-api";
import { useAppStore } from "@/store/useAppStore";
import { SchemaGraph } from "@/types";
import { TableNode, type TableNodeData } from "./er-diagram-nodes/table-node";
import { FkEdge } from "./er-diagram-nodes/fk-edge";
import { ERDiagramToolbar } from "./er-diagram-toolbar";
import { ERDiagramSaveDialog } from "./er-diagram-save-dialog";
import {
	graphToDraft,
	diffDraft,
	generateDdl,
	categorizeChanges,
} from "@/lib/schema-diff";
import type {
	DraftColumn,
	DraftForeignKey,
	DraftIndex,
	DraftTable,
	SchemaDraft,
	SchemaChange,
	CategorizedChanges,
	DdlStatement,
} from "@/lib/schema-diff/types";

// ── Constants ────────────────────────────────────────────────────────────────

const NODE_WIDTH = 280;
const COLUMN_GAP = 120;
const ROW_GAP = 52;

const DIAGRAM_POSITIONS_KEY = "db_connect_diagram_positions_v1";

const nodeTypes = { "table-node": TableNode };
const edgeTypes = { "fk-edge": FkEdge };

// ── Export helpers (preserved from original) ─────────────────────────────────

const HEADER_HEIGHT = 34;
const ROW_HEIGHT = 22;

function escapeXml(value: string): string {
	return value.replace(/[<>&"']/g, (ch) => {
		switch (ch) {
			case "<": return "&lt;";
			case ">": return "&gt;";
			case "&": return "&amp;";
			case '"': return "&quot;";
			case "'": return "&apos;";
			default: return ch;
		}
	});
}

const _colorNormalizeCanvas: HTMLCanvasElement | null =
	typeof document !== "undefined" ? document.createElement("canvas") : null;
const _colorNormalizeCtx = _colorNormalizeCanvas?.getContext("2d") ?? null;

function normalizeColor(input: string): string {
	if (!_colorNormalizeCtx) return input;
	try {
		_colorNormalizeCtx.fillStyle = "#000";
		_colorNormalizeCtx.fillStyle = input;
		const out = _colorNormalizeCtx.fillStyle;
		return typeof out === "string" && out.length > 0 ? out : input;
	} catch {
		return input;
	}
}

function resolveCssColor(probe: HTMLElement, color: string): string {
	probe.style.color = "";
	probe.style.color = color;
	const computed = getComputedStyle(probe).color || color;
	return normalizeColor(computed);
}

type ExportPalette = {
	background: string;
	card: string;
	cardHeader: string;
	cardHeaderActive: string;
	border: string;
	borderActive: string;
	foreground: string;
	mutedForeground: string;
	primary: string;
	accentBlue: string;
	accentOrange: string;
	relationStroke: string;
	relationStrokeActive: string;
};

function readPalette(reference: HTMLElement): ExportPalette {
	const probe = document.createElement("span");
	probe.style.position = "absolute";
	probe.style.opacity = "0";
	probe.style.pointerEvents = "none";
	reference.appendChild(probe);
	const get = (c: string) => resolveCssColor(probe, c);
	const mix = (token: string, pct: number) =>
		`color-mix(in oklch, var(${token}) ${pct}%, transparent)`;
	const palette: ExportPalette = {
		background: get("var(--background)"),
		card: get("var(--card)"),
		cardHeader: get(mix("--muted", 35)),
		cardHeaderActive: get(mix("--primary", 8)),
		border: get("var(--border)"),
		borderActive: get(mix("--primary", 45)),
		foreground: get("var(--foreground)"),
		mutedForeground: get(mix("--muted-foreground", 55)),
		primary: get("var(--primary)"),
		accentBlue: get("var(--color-accent-blue)"),
		accentOrange: get("var(--color-accent-orange)"),
		relationStroke: get("var(--color-accent-blue)"),
		relationStrokeActive: get("var(--color-accent-green)"),
	};
	reference.removeChild(probe);
	return palette;
}

type LayoutNodeForExport = {
	key: string;
	name: string;
	schema?: string;
	columns: { name: string; dataType?: string; isPrimary?: boolean }[];
	x: number;
	y: number;
	width: number;
	height: number;
	degree: number;
};

function tableKey(name: string, schema?: string) {
	return `${schema ?? "default"}::${name}`;
}

function buildDiagramSvg(opts: {
	graph: SchemaGraph;
	nodes: LayoutNodeForExport[];
	currentTableName?: string;
	palette: ExportPalette;
	margin?: number;
}): { svg: string; width: number; height: number } {
	const { graph, nodes, currentTableName, palette } = opts;
	const margin = opts.margin ?? 64;

	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (const n of nodes) {
		minX = Math.min(minX, n.x);
		minY = Math.min(minY, n.y);
		maxX = Math.max(maxX, n.x + n.width);
		maxY = Math.max(maxY, n.y + n.height);
	}
	if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 320; maxY = 240; }

	const offsetX = margin - minX;
	const offsetY = margin - minY;
	const width = Math.ceil(maxX - minX + margin * 2);
	const height = Math.ceil(maxY - minY + margin * 2);

	const nodeByKey = new Map<string, LayoutNodeForExport>();
	for (const n of nodes) nodeByKey.set(n.key, n);

	const fkBySource = new Set<string>();
	for (const r of graph.relationships) {
		const sk = `${r.sourceSchema ?? "default"}::${r.sourceTable}`;
		for (const c of r.sourceColumns) fkBySource.add(`${sk}::${c}`);
	}

	const parts: string[] = [];
	parts.push(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">`,
	);
	parts.push(
		`<rect x="0" y="0" width="${width}" height="${height}" fill="${escapeXml(palette.background)}"/>`,
	);

	// Relationships first so cards sit on top
	for (const relation of graph.relationships) {
		const sk = `${relation.sourceSchema ?? "default"}::${relation.sourceTable}`;
		const tk = `${relation.targetSchema ?? "default"}::${relation.targetTable}`;
		const source = nodeByKey.get(sk);
		const target = nodeByKey.get(tk);
		if (!source || !target) continue;

		const sourceIndex = source.columns.findIndex((col) => col.name === relation.sourceColumns[0]);
		const targetIndex = target.columns.findIndex((col) => col.name === relation.targetColumns[0]);

		const fromLeft = target.x < source.x;
		const startX = (source.x + offsetX) + (fromLeft ? 0 : source.width);
		const endX = (target.x + offsetX) + (fromLeft ? target.width : 0);
		const startY = (source.y + offsetY) + HEADER_HEIGHT + (sourceIndex >= 0 ? sourceIndex : 0) * ROW_HEIGHT + ROW_HEIGHT / 2 + 6;
		const endY = (target.y + offsetY) + HEADER_HEIGHT + (targetIndex >= 0 ? targetIndex : 0) * ROW_HEIGHT + ROW_HEIGHT / 2 + 6;
		const direction = fromLeft ? -1 : 1;
		const delta = Math.max(56, Math.abs(endX - startX) * 0.45);
		const isActive = source.name === currentTableName || target.name === currentTableName;
		const stroke = isActive ? palette.relationStrokeActive : palette.relationStroke;
		const strokeWidth = isActive ? 2.5 : 1.8;

		const path = `M ${startX} ${startY} C ${startX + delta * direction} ${startY}, ${endX - delta * direction} ${endY}, ${endX} ${endY}`;
		parts.push(`<path d="${path}" fill="none" stroke="${escapeXml(palette.background)}" stroke-width="${strokeWidth + 4}" stroke-opacity="0.35" stroke-linecap="round"/>`);
		parts.push(`<path d="${path}" fill="none" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`);
		parts.push(`<polygon points="${endX - 8},${endY - 5} ${endX},${endY} ${endX - 8},${endY + 5}" fill="${escapeXml(stroke)}"/>`);
		parts.push(`<circle cx="${startX}" cy="${startY}" r="4" fill="${escapeXml(stroke)}"/>`);
		parts.push(`<circle cx="${endX}" cy="${endY}" r="4" fill="${escapeXml(stroke)}"/>`);
	}

	// Cards
	for (const node of nodes) {
		const x = node.x + offsetX;
		const y = node.y + offsetY;
		const isCurrent = node.name === currentTableName;
		const headerFill = isCurrent ? palette.cardHeaderActive : palette.cardHeader;
		const stroke = isCurrent ? palette.borderActive : palette.border;

		parts.push(`<rect x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="12" ry="12" fill="${escapeXml(palette.card)}" stroke="${escapeXml(stroke)}" stroke-width="${isCurrent ? 1.5 : 1}"/>`);
		parts.push(`<path d="M ${x + 12} ${y} H ${x + node.width - 12} A 12 12 0 0 1 ${x + node.width} ${y + 12} V ${y + HEADER_HEIGHT} H ${x} V ${y + 12} A 12 12 0 0 1 ${x + 12} ${y} Z" fill="${escapeXml(headerFill)}"/>`);
		parts.push(`<line x1="${x}" y1="${y + HEADER_HEIGHT}" x2="${x + node.width}" y2="${y + HEADER_HEIGHT}" stroke="${escapeXml(palette.border)}" stroke-width="1"/>`);
		parts.push(`<text x="${x + 30}" y="${y + 21}" font-size="11" font-weight="700" fill="${escapeXml(palette.foreground)}">${escapeXml(node.name)}</text>`);
		parts.push(`<text x="${x + 30}" y="${y + 31}" font-size="9" fill="${escapeXml(palette.mutedForeground)}">${escapeXml((node.schema ?? "default") + " · " + node.degree + " link" + (node.degree === 1 ? "" : "s"))}</text>`);

		for (let i = 0; i < node.columns.length; i++) {
			const col = node.columns[i];
			const rowY = y + HEADER_HEIGHT + i * ROW_HEIGHT;
			const cy = rowY + ROW_HEIGHT / 2;
			const isPrimary = !!col.isPrimary;
			const isForeign = fkBySource.has(`${node.schema ?? "default"}::${node.name}::${col.name}`);
			if (i > 0) parts.push(`<line x1="${x + 8}" y1="${rowY}" x2="${x + node.width - 8}" y2="${rowY}" stroke="${escapeXml(palette.border)}" stroke-opacity="0.5" stroke-width="0.5"/>`);
			const bulletFill = isPrimary ? palette.accentOrange : isForeign ? palette.accentBlue : palette.border;
			parts.push(`<circle cx="${x + 14}" cy="${cy}" r="3" fill="${escapeXml(bulletFill)}"/>`);
			const nameText = col.name.length > 22 ? col.name.slice(0, 21) + "…" : col.name;
			parts.push(`<text x="${x + 24}" y="${cy + 3.5}" font-size="10" fill="${escapeXml(palette.foreground)}">${escapeXml(nameText)}</text>`);
			const typeText = col.dataType ?? "";
			parts.push(`<text x="${x + node.width - 10}" y="${cy + 3.5}" font-size="9" fill="${escapeXml(palette.mutedForeground)}" text-anchor="end">${escapeXml(typeText)}</text>`);
			let badgeRight = node.width - 10 - Math.min(60, typeText.length * 5.5) - 6;
			if (isForeign) {
				parts.push(`<rect x="${x + badgeRight - 16}" y="${cy - 6.5}" width="16" height="11" rx="2" ry="2" fill="${escapeXml(palette.accentBlue)}" fill-opacity="0.12" stroke="${escapeXml(palette.accentBlue)}" stroke-opacity="0.25"/>`);
				parts.push(`<text x="${x + badgeRight - 8}" y="${cy + 2}" font-size="7" font-weight="800" fill="${escapeXml(palette.accentBlue)}" text-anchor="middle">FK</text>`);
				badgeRight -= 20;
			}
			if (isPrimary) {
				parts.push(`<rect x="${x + badgeRight - 16}" y="${cy - 6.5}" width="16" height="11" rx="2" ry="2" fill="${escapeXml(palette.accentOrange)}" fill-opacity="0.12" stroke="${escapeXml(palette.accentOrange)}" stroke-opacity="0.25"/>`);
				parts.push(`<text x="${x + badgeRight - 8}" y="${cy + 2}" font-size="7" font-weight="800" fill="${escapeXml(palette.accentOrange)}" text-anchor="middle">PK</text>`);
			}
		}
	}
	parts.push(`</svg>`);
	return { svg: parts.join(""), width, height };
}

async function rasterizeSvg(svg: string, width: number, height: number, scale = 2): Promise<Blob> {
	const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	try {
		const img = new Image();
		img.crossOrigin = "anonymous";
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error("Failed to load SVG for rasterization"));
			img.src = url;
		});
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(width * scale));
		canvas.height = Math.max(1, Math.round(height * scale));
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas 2D context unavailable");
		ctx.scale(scale, scale);
		ctx.drawImage(img, 0, 0, width, height);
		return await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
				"image/png",
			);
		});
	} finally {
		URL.revokeObjectURL(url);
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid(): string {
	return `rf-${Date.now()}-${++_idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadPositions(connectionId: string, database: string): Record<string, { x: number; y: number }> {
	try {
		const raw = localStorage.getItem(DIAGRAM_POSITIONS_KEY);
		if (!raw) return {};
		const all = JSON.parse(raw) as Record<string, Record<string, { x: number; y: number }>>;
		return all[`${connectionId}:${database}`] ?? {};
	} catch {
		return {};
	}
}

function savePositions(connectionId: string, database: string, positions: Record<string, { x: number; y: number }>) {
	try {
		const raw = localStorage.getItem(DIAGRAM_POSITIONS_KEY);
		const all: Record<string, Record<string, { x: number; y: number }>> = raw
			? JSON.parse(raw)
			: {};
		all[`${connectionId}:${database}`] = positions;
		localStorage.setItem(DIAGRAM_POSITIONS_KEY, JSON.stringify(all));
	} catch { /* ignore */ }
}

// ── Main component ──────────────────────────────────────────────────────────

export function ERDiagramView({
	graph,
	currentTableName,
	onTableSelect,
	onRetry,
	isRefreshing = false,
}: {
	graph: SchemaGraph;
	currentTableName?: string;
	onTableSelect: (tableName: string) => void;
	onRetry: () => void;
	isRefreshing?: boolean;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const rfInstanceRef = useRef<any>(null);

	const appSettings = useAppStore((s) => s.appSettings);
	const connections = useAppStore((s) => s.connections);
	const activeFunction = useAppStore((s) => s.activeFunction);
	const selectedDatabases = useAppStore((s) => s.selectedDatabases);

	const experimentalEnabled = appSettings.experimentalSchemaEditor ?? false;

	const connectionId = activeFunction?.connectionId ?? "";
	const database = connectionId ? (selectedDatabases[connectionId] ?? "") : "";
	const connection = connections.find((c) => c.id === connectionId);
	const engine = (connection?.type as "postgresql" | "mysql" | "sqlite") ?? "postgresql";
	// Normalize engine names
	const normalizedEngine: "postgres" | "mysql" | "sqlite" =
		engine === "postgresql" ? "postgres" : engine as "postgres" | "mysql" | "sqlite";

	// ── State ──────────────────────────────────────────────────────────────────
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState<SchemaDraft | null>(null);
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [ddlStatements, setDdlStatements] = useState<DdlStatement[]>([]);
	const [categorized, setCategorized] = useState<CategorizedChanges | null>(null);
	const [orderedChanges, setOrderedChanges] = useState<SchemaChange[]>([]);
	const [isRunning, setIsRunning] = useState(false);

	// Schema filter
	const allSchemas = useMemo(() => {
		const set = new Set<string>();
		for (const t of graph.tables) set.add(t.schema ?? "default");
		return [...set].sort((a, b) => a.localeCompare(b));
	}, [graph]);
	const [selectedSchemas, setSelectedSchemas] = useState<Set<string> | null>(null);

	useEffect(() => {
		if (!selectedSchemas) return;
		const allSet = new Set(allSchemas);
		for (const s of selectedSchemas) {
			if (!allSet.has(s)) { setSelectedSchemas(null); return; }
		}
	}, [allSchemas, selectedSchemas]);

	const filteredGraph = useMemo<SchemaGraph>(() => {
		if (!selectedSchemas || selectedSchemas.size === 0 || allSchemas.length <= 1) return graph;
		const tables = graph.tables.filter((t) => selectedSchemas.has(t.schema ?? "default"));
		const visibleKeys = new Set(tables.map((t) => tableKey(t.name, t.schema)));
		const relationships = graph.relationships.filter(
			(r) => visibleKeys.has(tableKey(r.sourceTable, r.sourceSchema)) &&
				visibleKeys.has(tableKey(r.targetTable, r.targetSchema)),
		);
		return { tables, relationships };
	}, [graph, selectedSchemas, allSchemas.length]);

	const toggleSchema = useCallback((schema: string) => {
		setSelectedSchemas((prev) => {
			const base = prev ?? new Set(allSchemas);
			const next = new Set(base);
			if (next.has(schema)) next.delete(schema); else next.add(schema);
			if (next.size === allSchemas.length) return null;
			return next;
		});
	}, [allSchemas]);
	const selectAllSchemas = useCallback(() => setSelectedSchemas(null), []);
	const isSchemaSelected = useCallback(
		(schema: string) => !selectedSchemas || selectedSchemas.has(schema),
		[selectedSchemas],
	);
	const activeSchemaCount = selectedSchemas?.size ?? allSchemas.length;
	const isFiltered = !!selectedSchemas && selectedSchemas.size > 0 && selectedSchemas.size < allSchemas.length;

	// ── Build layout nodes ────────────────────────────────────────────────────

	const degreeMap = useMemo(() => {
		const map = new Map<string, number>();
		for (const t of filteredGraph.tables) {
			map.set(tableKey(t.name, t.schema), 0);
		}
		for (const r of filteredGraph.relationships) {
			const sk = tableKey(r.sourceTable, r.sourceSchema);
			const tk = tableKey(r.targetTable, r.targetSchema);
			map.set(sk, (map.get(sk) ?? 0) + 1);
			map.set(tk, (map.get(tk) ?? 0) + 1);
		}
		return map;
	}, [filteredGraph]);

	// Create BFS layout for initial node positions
	const bfsLayout = useMemo(() => {
		const adjacency = new Map<string, Set<string>>();
		for (const t of filteredGraph.tables) {
			adjacency.set(tableKey(t.name, t.schema), new Set());
		}
		for (const r of filteredGraph.relationships) {
			const sk = tableKey(r.sourceTable, r.sourceSchema);
			const tk = tableKey(r.targetTable, r.targetSchema);
			adjacency.get(sk)?.add(tk);
			adjacency.get(tk)?.add(sk);
		}

		const sortedTables = [...filteredGraph.tables].sort((a, b) => {
			const aKey = tableKey(a.name, a.schema);
			const bKey = tableKey(b.name, b.schema);
			const aCurr = a.name === currentTableName ? 1 : 0;
			const bCurr = b.name === currentTableName ? 1 : 0;
			if (aCurr !== bCurr) return bCurr - aCurr;
			return ((degreeMap.get(bKey) ?? 0) - (degreeMap.get(aKey) ?? 0)) || a.name.localeCompare(b.name);
		});

		const root = sortedTables.find((t) => t.name === currentTableName) ?? sortedTables[0];
		const layerMap = new Map<string, number>();
		const visited = new Set<string>();
		if (root) {
			const rk = tableKey(root.name, root.schema);
			const queue: Array<{ key: string; layer: number }> = [{ key: rk, layer: 0 }];
			visited.add(rk);
			layerMap.set(rk, 0);
			while (queue.length > 0) {
				const cur = queue.shift()!;
				for (const nb of [...(adjacency.get(cur.key) ?? [])].sort()) {
					if (visited.has(nb)) continue;
					visited.add(nb);
					layerMap.set(nb, cur.layer + 1);
					queue.push({ key: nb, layer: cur.layer + 1 });
				}
			}
		}
		let trailing = layerMap.size > 0 ? Math.max(...layerMap.values()) + 1 : 0;
		for (const t of sortedTables) {
			const key = tableKey(t.name, t.schema);
			if (layerMap.has(key)) continue;
			layerMap.set(key, trailing++);
		}

		const layers = new Map<number, (typeof filteredGraph.tables)[number][]>();
		for (const t of sortedTables) {
			const layer = layerMap.get(tableKey(t.name, t.schema)) ?? 0;
			const grp = layers.get(layer) ?? [];
			grp.push(t);
			layers.set(layer, grp);
		}

		const positions: Record<string, { x: number; y: number }> = {};
		for (const [layerIdx, tbls] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
			let cursorY = 0;
			for (const tbl of tbls) {
				const h = 34 + tbl.columns.length * 22 + 12;
				const key = tableKey(tbl.name, tbl.schema);
				positions[key] = { x: layerIdx * (NODE_WIDTH + COLUMN_GAP), y: cursorY };
				cursorY += h + ROW_GAP;
			}
		}
		return positions;
	}, [filteredGraph, currentTableName, degreeMap]);

	// Load persisted positions (only when not editing)
	const persistedPositions = useMemo(() => {
		if (!connectionId || !database) return {};
		return loadPositions(connectionId, database);
	}, [connectionId, database]);

	// ── Convert filteredGraph to React Flow nodes/edges ───────────────────────

	const { rfNodes, rfEdges } = useMemo(() => {
		const tblMap = new Map<string, (typeof filteredGraph.tables)[number]>();
		for (const t of filteredGraph.tables) {
			const k = tableKey(t.name, t.schema);
			tblMap.set(k, t);
		}

		const fkSourceSet = new Set<string>();
		for (const r of filteredGraph.relationships) {
			const sk = tableKey(r.sourceTable, r.sourceSchema);
			for (const c of r.sourceColumns) fkSourceSet.add(`${sk}::${c}`);
		}

		const fkSourceMapByTable = new Map<string, Map<string, boolean>>();

		const nodes: Node[] = filteredGraph.tables.map((t) => {
			const key = tableKey(t.name, t.schema);
			const pos = persistedPositions[key] ?? bfsLayout[key] ?? { x: 0, y: 0 };
			const degree = degreeMap.get(key) ?? 0;
			const colMap = new Map<string, boolean>();
			for (const c of t.columns) {
				colMap.set(c.name, fkSourceSet.has(`${key}::${c.name}`));
			}

			// Convert ColumnInfo[] to DraftColumn[]
			const draftCols: DraftColumn[] = t.columns.map((c) => ({
				id: `orig-${key}-${c.name}`,
				name: c.name,
				dataType: c.dataType,
				nullable: c.nullable,
				isPrimary: c.isPrimary,
				defaultValue: c.defaultValue,
			}));

			fkSourceMapByTable.set(key, colMap);

			return {
				id: key,
				type: "table-node",
				position: pos,
				data: {
					label: t.name,
					schema: t.schema,
					columns: draftCols,
					indexes: [],
					degree,
					isEditing: false,
					isCurrent: t.name === currentTableName,
					fkRelations: [],
					fkSourceMap: colMap,
					engine: normalizedEngine,
				} satisfies TableNodeData,
				draggable: !isEditing,
			};
		});

		const edges: Edge[] = filteredGraph.relationships.map((r) => {
			const sk = tableKey(r.sourceTable, r.sourceSchema);
			const tk = tableKey(r.targetTable, r.targetSchema);
			return {
				id: r.name || `${sk}-${tk}-${r.sourceColumns[0]}`,
				source: sk,
				target: tk,
				type: "fk-edge",
				animated: false,
				markerEnd: { type: MarkerType.ArrowClosed, color: "var(--color-accent-blue)" },
				data: { label: r.name, isSelected: false },
			};
		});

		return { rfNodes: nodes, rfEdges: edges };
	}, [filteredGraph, bfsLayout, persistedPositions, degreeMap, currentTableName, isEditing, normalizedEngine]);

	// ── React Flow state ──────────────────────────────────────────────────────
	const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes as any);
	const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges as any);

	// Update when graph changes
	useEffect(() => {
		setNodes(rfNodes as any);
		setEdges(rfEdges as any);
	}, [rfNodes, rfEdges, setNodes, setEdges]);

	// ── Build draft when entering edit mode ───────────────────────────────────
	const enterEditMode = useCallback(() => {
		const d = graphToDraft(filteredGraph, normalizedEngine);
		setDraft(d);
		setIsEditing(true);

		// Update nodes to edit mode
		setNodes((nds) =>
			nds.map((n) => {
				const dt = d.tables.find((t) => t.name === (n.data as TableNodeData).label);
				if (!dt) return n;
				const fkSourceSet = new Map<string, boolean>();
				for (const fk of d.foreignKeys) {
					if (fk.sourceTableId === dt.id) {
						for (const c of fk.sourceColumns) {
							const col = dt.columns.find((cc) => cc.name === c);
							if (col) fkSourceSet.set(col.id, true);
						}
					}
				}
				return {
					...n,
					draggable: true,
					data: {
						...n.data,
						label: dt.name,
						columns: dt.columns,
						indexes: dt.indexes,
						isEditing: true,
						fkRelations: d.foreignKeys,
						fkSourceMap: fkSourceSet,
						onUpdateTable: (patch: { name?: string; columns?: DraftColumn[]; indexes?: DraftIndex[] }) => {
							setDraft((prev) => {
								if (!prev) return prev;
								return {
									...prev,
									tables: prev.tables.map((t) =>
										t.id === dt.id
											? {
												...t,
												name: patch.name ?? t.name,
												columns: patch.columns ?? t.columns,
												indexes: patch.indexes ?? t.indexes,
											}
											: t,
									),
								};
							});
						},
						onDeleteTable: () => {
							setDraft((prev) => {
								if (!prev) return prev;
								return {
									...prev,
									tables: prev.tables.filter((t) => t.id !== dt.id),
									foreignKeys: prev.foreignKeys.filter(
										(fk) => fk.sourceTableId !== dt.id && fk.targetTableId !== dt.id,
									),
								};
							});
						},
						onStartFKDrag: (_tableId: string, _columnId: string) => {
							/* handled at React Flow level */
						},
					},
				};
			}),
		);

		// Add FK edges (editable)
		setEdges(
			d.foreignKeys.map((fk) => {
				const srcT = d.tables.find((t) => t.id === fk.sourceTableId);
				const tgtT = d.tables.find((t) => t.id === fk.targetTableId);
				const srcKey = tableKey(srcT?.name ?? "", srcT?.schema);
				const tgtKey = tableKey(tgtT?.name ?? "", tgtT?.schema);
				return {
					id: fk.id,
					source: srcKey,
					target: tgtKey,
					type: "fk-edge",
					animated: false,
					markerEnd: { type: MarkerType.ArrowClosed, color: "var(--color-accent-blue)" },
					data: { label: fk.name, isSelected: false },
				};
			}),
		);
	}, [filteredGraph, normalizedEngine, setNodes, setEdges]);

	// ── Exit edit mode ────────────────────────────────────────────────────────
	const exitEditMode = useCallback(() => {
		setIsEditing(false);
		setDraft(null);
		// Revert to read-only nodes/edges
		setNodes(rfNodes as any);
		setEdges(rfEdges as any);
	}, [rfNodes, rfEdges, setNodes, setEdges]);

	// Discard changes
	const handleDiscard = useCallback(() => {
		exitEditMode();
		toast.info("Changes discarded");
	}, [exitEditMode]);

	// ── Save: compute diff and show dialog ────────────────────────────────────
	const computeAndShowSave = useCallback(() => {
		if (!draft) return;
		const changes = diffDraft(draft, filteredGraph);
		if (changes.length === 0) {
			toast.info("No changes to save");
			return;
		}
		const cat = categorizeChanges(changes);
		const result = generateDdl(changes, normalizedEngine);
		setOrderedChanges(changes);
		setCategorized(cat);
		setDdlStatements(result.statements);
		setSaveDialogOpen(true);

		// If no destructive changes and user used shortcut, could skip dialog
		// but we always show for now for safety
	}, [draft, filteredGraph, normalizedEngine]);

	// ── Run migration ─────────────────────────────────────────────────────────
	const handleRunMigration = useCallback(async () => {
		if (orderedChanges.length === 0) return;
		setIsRunning(true);

		try {
			const result = generateDdl(orderedChanges, normalizedEngine);
			const connId = connectionId;
			const db = database;
			const timeout = appSettings.queryTimeoutSecs || 30;

			if (result.useTransaction && (normalizedEngine === "postgres" || normalizedEngine === "sqlite")) {
				// Transactional: BEGIN → statements → COMMIT
				const allSql = ["BEGIN;", ...result.statements.map((s) => s.sql), "COMMIT;"].join("\n");
				await tauriApi.executeQuery(connId, allSql, timeout, db);
			} else if (normalizedEngine === "mysql") {
				// MySQL: run sequentially, best-effort
				for (const stmt of result.statements) {
					await tauriApi.executeQuery(connId, stmt.sql, timeout, db);
				}
			} else {
				// Fallback: run all as batch
				const allSql = result.statements.map((s) => s.sql).join("\n");
				await tauriApi.executeQuery(connId, allSql, timeout, db);
			}

			toast.success("Schema changes applied", {
				description: `${result.statements.length} statement(s) executed`,
			});
			setSaveDialogOpen(false);
			exitEditMode();
			// Refresh the graph
			onRetry();
		} catch (err: any) {
			console.error("Migration failed:", err);
			toast.error("Migration failed", {
				description: err?.toString?.() ?? String(err),
			});
		} finally {
			setIsRunning(false);
		}
	}, [orderedChanges, normalizedEngine, connectionId, database, appSettings.queryTimeoutSecs, exitEditMode, onRetry]);

	// Sync edge deletions back to draft (FK removal)
	useEffect(() => {
		if (!isEditing || !draft) return;
		const edgeIds = new Set(edges.map((e) => e.id));
		const staleFks = draft.foreignKeys.filter((fk) => !edgeIds.has(fk.id));
		if (staleFks.length > 0) {
			setDraft((prev) => {
				if (!prev) return prev;
				return {
					...prev,
					foreignKeys: prev.foreignKeys.filter((fk) => edgeIds.has(fk.id)),
				};
			});
		}
	}, [edges, isEditing, draft]);

	// Sync node deletions back to draft (table removal)
	useEffect(() => {
		if (!isEditing || !draft) return;
		const nodeKeys = new Set(nodes.map((n) => n.id));
		const staleTables = draft.tables.filter((t) => !nodeKeys.has(tableKey(t.name, t.schema)));
		if (staleTables.length > 0) {
			setDraft((prev) => {
				if (!prev) return prev;
				const staleIds = new Set(staleTables.map((t) => t.id));
				return {
					...prev,
					tables: prev.tables.filter((t) => !staleIds.has(t.id)),
					foreignKeys: prev.foreignKeys.filter(
						(fk) => !staleIds.has(fk.sourceTableId) && !staleIds.has(fk.targetTableId),
					),
				};
			});
		}
	}, [nodes, isEditing, draft]);

	// ── Add table ─────────────────────────────────────────────────────────────
	const handleAddTable = useCallback(() => {
		if (!draft) return;
		// Find a unique name
		const existingNames = new Set(draft.tables.map((t) => t.name));
		let suffix = 1;
		let name = "new_table_1";
		while (existingNames.has(name)) {
			suffix++;
			name = `new_table_${suffix}`;
		}
		const newTable: DraftTable = {
			id: uid(),
			name,
			schema: undefined,
			columns: [
				{
					id: uid(),
					name: "id",
					dataType: normalizedEngine === "postgres" ? "serial" : normalizedEngine === "mysql" ? "int" : "integer",
					nullable: false,
					isPrimary: true,
					defaultValue: null,
				},
			],
			indexes: [],
			isNew: true,
		};
		const updated = { ...draft, tables: [...draft.tables, newTable] };
		setDraft(updated);

		// Add node to React Flow
		const key = tableKey(name, newTable.schema);
		setNodes((nds) => [
			...nds,
			{
				id: key,
				type: "table-node",
				position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
				draggable: true,
				data: {
					label: name,
					schema: newTable.schema,
					columns: newTable.columns,
					indexes: newTable.indexes,
					degree: 0,
					isEditing: true,
					isCurrent: false,
					fkRelations: [],
					fkSourceMap: new Map(),
					engine: normalizedEngine,
					onUpdateTable: (patch: { name?: string; columns?: DraftColumn[]; indexes?: DraftIndex[] }) => {
						setDraft((prev) => {
							if (!prev) return prev;
							return {
								...prev,
								tables: prev.tables.map((t) =>
									t.id === newTable.id
										? { ...t, name: patch.name ?? t.name, columns: patch.columns ?? t.columns, indexes: patch.indexes ?? t.indexes }
										: t,
								),
							};
						});
					},
					onDeleteTable: () => {
						setDraft((prev) => {
							if (!prev) return prev;
							return {
								...prev,
								tables: prev.tables.filter((t) => t.id !== newTable.id),
							};
						});
					},
					onStartFKDrag: () => {},
				} satisfies TableNodeData,
			} as any,
		]);

		toast.success(`Added table: ${name}`);
	}, [draft, normalizedEngine, setNodes]);

	// ── Connect (FK) handler ──────────────────────────────────────────────────
	const onConnect: OnConnect = useCallback(
		(connection: Connection) => {
			if (!draft || !isEditing) return;
			// Only allow connections in edit mode
			const { source, target, sourceHandle, targetHandle } = connection;
			if (!source || !target || !sourceHandle || !targetHandle) return;

			// Parse handles: "col-source-<colId>" / "col-target-<colId>"
			const srcColId = sourceHandle.replace("col-source-", "");
			const tgtColId = targetHandle.replace("col-target-", "");

			const srcTable = draft.tables.find((t) => tableKey(t.name, t.schema) === source);
			const tgtTable = draft.tables.find((t) => tableKey(t.name, t.schema) === target);
			if (!srcTable || !tgtTable) return;

			const srcCol = srcTable.columns.find((c) => c.id === srcColId);
			const tgtCol = tgtTable.columns.find((c) => c.id === tgtColId);
			if (!srcCol || !tgtCol) return;

			const fkName = `fk_${srcTable.name}_${tgtTable.name}_${srcCol.name}`;
			const newFk: DraftForeignKey = {
				id: uid(),
				name: fkName,
				sourceTableId: srcTable.id,
				sourceColumns: [srcCol.name],
				targetTableId: tgtTable.id,
				targetColumns: [tgtCol.name],
			};

			setDraft((prev) => {
				if (!prev) return prev;
				return { ...prev, foreignKeys: [...prev.foreignKeys, newFk] };
			});

			// Add edge
			setEdges((eds) => [
				...eds,
				{
					id: newFk.id,
					source,
					target,
					type: "fk-edge",
					animated: false,
					markerEnd: { type: MarkerType.ArrowClosed, color: "var(--color-accent-blue)" },
					data: { label: fkName, isSelected: false },
				},
			]);
		},
		[draft, isEditing, setEdges],
	);

	// ── Export ────────────────────────────────────────────────────────────────
	const buildExportSvg = useCallback(() => {
		const reference = containerRef.current;
		if (!reference) return null;
		const palette = readPalette(reference);

		// Convert React Flow nodes to LayoutNodeForExport shape
		const exportNodes: LayoutNodeForExport[] = nodes.map((n) => {
			const data = n.data as TableNodeData | undefined;
			return {
				key: n.id,
				name: data?.label ?? n.id,
				schema: data?.schema,
				columns: (data?.columns ?? []).map((c) => ({
					name: c.name,
					dataType: c.dataType,
					isPrimary: c.isPrimary,
				})),
				x: n.position.x,
				y: n.position.y,
				width: 280,
				height: 34 + (data?.columns?.length ?? 0) * 22 + 12,
				degree: data?.degree ?? 0,
			};
		});

		return buildDiagramSvg({
			graph: filteredGraph,
			nodes: exportNodes,
			currentTableName,
			palette,
		});
	}, [nodes, filteredGraph, currentTableName]);

	const exportFilename = useCallback(
		(ext: string) => {
			const stem = currentTableName ? `er-diagram-${currentTableName}` : "er-diagram";
			const stamp = new Date().toISOString().slice(0, 10);
			return `${stem}-${stamp}.${ext}`;
		},
		[currentTableName],
	);

	const handleExportSvg = useCallback(async () => {
		try {
			const out = buildExportSvg();
			if (!out) return;
			const defaultDir = appSettings.diagramExportDir || undefined;
			const filename = exportFilename("svg");
			const target = await tauriApi.saveFileDialogIn(defaultDir ?? null, filename, [
				{ name: "SVG image", extensions: ["svg"] },
			]);
			if (!target) return;
			await tauriApi.writeTextFile(target, out.svg);
			toast.success("ER diagram saved", { description: target });
		} catch (err) {
			console.error(err);
			toast.error("Failed to export SVG");
		}
	}, [buildExportSvg, exportFilename, appSettings.diagramExportDir]);

	const handleExportPng = useCallback(async () => {
		try {
			const out = buildExportSvg();
			if (!out) return;
			const blob = await rasterizeSvg(out.svg, out.width, out.height, 2);
			const defaultDir = appSettings.diagramExportDir || undefined;
			const filename = exportFilename("png");
			const target = await tauriApi.saveFileDialogIn(defaultDir ?? null, filename, [
				{ name: "PNG image", extensions: ["png"] },
			]);
			if (!target) return;
			const buffer = new Uint8Array(await blob.arrayBuffer());
			await tauriApi.writeBinaryFile(target, buffer);
			toast.success("ER diagram saved", { description: target });
		} catch (err) {
			console.error(err);
			toast.error("Failed to export PNG");
		}
	}, [buildExportSvg, exportFilename, appSettings.diagramExportDir]);

	// ── Keyboard shortcuts ────────────────────────────────────────────────────
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault();
				if (isEditing && draft) {
					const changes = diffDraft(draft, filteredGraph);
					if (changes.length === 0) {
						toast.info("No changes to save");
						return;
					}
					const cat = categorizeChanges(changes);
					if (!cat.hasDestructive) {
						// Apply now shortcut: skip review for non-destructive changes
						setOrderedChanges(changes);
						setCategorized(cat);
						const result = generateDdl(changes, normalizedEngine);
						setDdlStatements(result.statements);
						// Still show dialog since we want user confirmation
						setSaveDialogOpen(true);
					} else {
						// Force preview for destructive changes
						const result = generateDdl(changes, normalizedEngine);
						setOrderedChanges(changes);
						setCategorized(cat);
						setDdlStatements(result.statements);
						setSaveDialogOpen(true);
					}
				}
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isEditing, draft, filteredGraph, normalizedEngine]);

	// ── Has changes check ─────────────────────────────────────────────────────
	const hasChanges = useMemo(() => {
		if (!draft) return false;
		const changes = diffDraft(draft, filteredGraph);
		return changes.length > 0;
	}, [draft, filteredGraph]);

	// ── Persist positions on node drag end ────────────────────────────────────
	const handleNodeDragStop = useCallback(
		(_event: any, _node: any) => {
			if (isEditing || !connectionId || !database) return;
			// Debounced save
			const positions: Record<string, { x: number; y: number }> = {};
			// Need to read current nodes; use a timeout to get fresh state
			setTimeout(() => {
				setNodes((currentNodes) => {
					for (const n of currentNodes) {
						positions[n.id] = { x: n.position.x, y: n.position.y };
					}
					savePositions(connectionId, database, positions);
					return currentNodes;
				});
			}, 100);
		},
		[isEditing, connectionId, database, setNodes],
	);

	return (
		<div className="h-full flex flex-col bg-background" ref={containerRef}>
			{/* Toolbar */}
			<ERDiagramToolbar
				totalTables={graph.tables.length}
				filteredTables={filteredGraph.tables.length}
				totalRelations={filteredGraph.relationships.length}
				allSchemas={allSchemas}
				selectedSchemas={selectedSchemas}
				isFiltered={isFiltered}
				activeSchemaCount={activeSchemaCount}
				isEditing={isEditing}
				experimentalEnabled={experimentalEnabled}
				isRefreshing={isRefreshing}
				hasChanges={hasChanges}
				onToggleEdit={() => {
					if (isEditing) {
						exitEditMode();
					} else {
						enterEditMode();
					}
				}}
				onAddTable={handleAddTable}
				onSave={computeAndShowSave}
				onDiscard={handleDiscard}
				onSchemaToggle={toggleSchema}
				onSelectAllSchemas={selectAllSchemas}
				onExportPng={handleExportPng}
				onExportSvg={handleExportSvg}
				onZoomIn={() => rfInstanceRef.current?.zoomIn?.()}
				onZoomOut={() => rfInstanceRef.current?.zoomOut?.()}
				onFit={() => rfInstanceRef.current?.fitView?.()}
				onRetry={onRetry}
				isSchemaSelected={isSchemaSelected}
			/>

			{/* React Flow canvas */}
			<div className="flex-1">
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onConnect={onConnect}
					onNodeDragStop={handleNodeDragStop}
					onNodeClick={(_event, node) => {
						if (!isEditing && node.data && (node.data as any).label) {
							onTableSelect((node.data as any).label);
						}
					}}
					nodeTypes={nodeTypes as any}
					edgeTypes={edgeTypes as any}
					fitView
					onInit={(instance) => {
						rfInstanceRef.current = instance;
					}}
					minZoom={0.2}
					maxZoom={3}
					defaultEdgeOptions={{
						type: "fk-edge",
						animated: false,
					}}
					connectionLineStyle={{
						stroke: "var(--color-accent-blue)",
						strokeWidth: 2,
						strokeDasharray: "6 3",
					}}
					deleteKeyCode={isEditing ? "Delete" : null}
					multiSelectionKeyCode={isEditing ? "Shift" : null}
					selectionOnDrag={isEditing}
					panOnDrag={!isEditing}
					selectNodesOnDrag={isEditing}
					className="bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border)/0.4)_1px,transparent_0)] bg-[length:24px_24px]"
				>
					<Background color="hsl(var(--border))" gap={24} />
					<Controls position="bottom-right" className="!bg-card !border !border-border !rounded-lg" />
					<MiniMap
						position="bottom-left"
						className="!bg-card !border !border-border !rounded-lg"
						nodeColor={(n) => {
							const data = n.data as TableNodeData | undefined;
							if (data?.isCurrent) return "var(--primary)";
							return "var(--color-accent-blue)";
						}}
					/>
				</ReactFlow>
			</div>

			{/* Save dialog */}
			<ERDiagramSaveDialog
				open={saveDialogOpen}
				onClose={() => setSaveDialogOpen(false)}
				onRun={handleRunMigration}
				categorized={categorized ?? { creates: [], drops: [], alters: [], renames: [], hasDestructive: false }}
				ddlStatements={ddlStatements}
				isRunning={isRunning}
				engine={normalizedEngine}
			/>
		</div>
	);
}
