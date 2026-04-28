import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Check,
	Database,
	Download,
	Filter,
	GripVertical,
	Image as ImageIcon,
	Link2,
	LocateFixed,
	RefreshCcw,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { SchemaGraph } from "@/types";

const NODE_WIDTH = 280;
const HEADER_HEIGHT = 34;
const ROW_HEIGHT = 22;
const COLUMN_GAP = 120;
const ROW_GAP = 52;
const VIEWPORT_PADDING = 48;
const DRAG_THRESHOLD = 4; // px — below this, mousedown+up counts as click

type LayoutNode = {
	key: string;
	name: string;
	schema?: string;
	columns: SchemaGraph["tables"][number]["columns"];
	x: number;
	y: number;
	width: number;
	height: number;
	degree: number;
};

function tableKey(name: string, schema?: string) {
	return `${schema ?? "default"}::${name}`;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

// XML-safe text escaper for SVG export
function escapeXml(value: string): string {
	return value.replace(/[<>&"']/g, (ch) => {
		switch (ch) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			case '"':
				return "&quot;";
			case "'":
				return "&apos;";
			default:
				return ch;
		}
	});
}

// Trigger a browser download for a Blob.
function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	// Defer revoke so the browser can finish the download.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Resolve a CSS color (handles `var(--name)` & token names) on a live element.
function resolveCssColor(probe: HTMLElement, color: string): string {
	probe.style.color = "";
	probe.style.color = color;
	const computed = getComputedStyle(probe).color;
	return computed || color;
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
	const palette: ExportPalette = {
		background: get("hsl(var(--background))"),
		card: get("hsl(var(--card))"),
		cardHeader: get("hsl(var(--muted) / 0.35)"),
		cardHeaderActive: get("hsl(var(--primary) / 0.08)"),
		border: get("hsl(var(--border))"),
		borderActive: get("hsl(var(--primary) / 0.45)"),
		foreground: get("hsl(var(--foreground))"),
		mutedForeground: get("hsl(var(--muted-foreground) / 0.55)"),
		primary: get("hsl(var(--primary))"),
		accentBlue: get("var(--color-accent-blue)"),
		accentOrange: get("var(--color-accent-orange)"),
		relationStroke: get("var(--color-accent-blue)"),
		relationStrokeActive: get("var(--color-accent-green)"),
	};
	reference.removeChild(probe);
	return palette;
}

// Build a self-contained SVG string for the diagram.
// `nodes` already contains effective positions (incl. user drags).
function buildDiagramSvg(opts: {
	graph: SchemaGraph;
	nodes: LayoutNode[];
	currentTableName?: string;
	palette: ExportPalette;
	margin?: number;
}): { svg: string; width: number; height: number } {
	const { graph, nodes, currentTableName, palette } = opts;
	const margin = opts.margin ?? 64;

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const n of nodes) {
		minX = Math.min(minX, n.x);
		minY = Math.min(minY, n.y);
		maxX = Math.max(maxX, n.x + n.width);
		maxY = Math.max(maxY, n.y + n.height);
	}
	if (!isFinite(minX)) {
		minX = 0;
		minY = 0;
		maxX = 320;
		maxY = 240;
	}

	const offsetX = margin - minX;
	const offsetY = margin - minY;
	const width = Math.ceil(maxX - minX + margin * 2);
	const height = Math.ceil(maxY - minY + margin * 2);

	const nodeByKey = new Map<string, LayoutNode>();
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

		const sourceIndex = source.columns.findIndex(
			(col) => col.name === relation.sourceColumns[0],
		);
		const targetIndex = target.columns.findIndex(
			(col) => col.name === relation.targetColumns[0],
		);

		const fromLeft = target.x < source.x;
		const startX =
			(source.x + offsetX) + (fromLeft ? 0 : source.width);
		const endX = (target.x + offsetX) + (fromLeft ? target.width : 0);
		const startY =
			(source.y + offsetY) + HEADER_HEIGHT +
			(sourceIndex >= 0 ? sourceIndex : 0) * ROW_HEIGHT + ROW_HEIGHT / 2 + 6;
		const endY =
			(target.y + offsetY) + HEADER_HEIGHT +
			(targetIndex >= 0 ? targetIndex : 0) * ROW_HEIGHT + ROW_HEIGHT / 2 + 6;
		const direction = fromLeft ? -1 : 1;
		const delta = Math.max(56, Math.abs(endX - startX) * 0.45);
		const isActive =
			source.name === currentTableName || target.name === currentTableName;
		const stroke = isActive ? palette.relationStrokeActive : palette.relationStroke;
		const strokeWidth = isActive ? 2.5 : 1.8;

		const path =
			`M ${startX} ${startY} ` +
			`C ${startX + delta * direction} ${startY}, ` +
			`${endX - delta * direction} ${endY}, ` +
			`${endX} ${endY}`;

		parts.push(
			`<path d="${path}" fill="none" stroke="${escapeXml(palette.background)}" stroke-width="${strokeWidth + 4}" stroke-opacity="0.35" stroke-linecap="round"/>`,
		);
		parts.push(
			`<path d="${path}" fill="none" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`,
		);
		parts.push(
			`<polygon points="${endX - 8},${endY - 5} ${endX},${endY} ${endX - 8},${endY + 5}" fill="${escapeXml(stroke)}"/>`,
		);
		parts.push(
			`<circle cx="${startX}" cy="${startY}" r="4" fill="${escapeXml(stroke)}"/>`,
		);
		parts.push(
			`<circle cx="${endX}" cy="${endY}" r="4" fill="${escapeXml(stroke)}"/>`,
		);
	}

	// Cards
	for (const node of nodes) {
		const x = node.x + offsetX;
		const y = node.y + offsetY;
		const isCurrent = node.name === currentTableName;
		const headerFill = isCurrent ? palette.cardHeaderActive : palette.cardHeader;
		const stroke = isCurrent ? palette.borderActive : palette.border;

		parts.push(
			`<rect x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="12" ry="12" fill="${escapeXml(palette.card)}" stroke="${escapeXml(stroke)}" stroke-width="${isCurrent ? 1.5 : 1}"/>`,
		);
		// Header band
		parts.push(
			`<path d="M ${x + 12} ${y} H ${x + node.width - 12} A 12 12 0 0 1 ${x + node.width} ${y + 12} V ${y + HEADER_HEIGHT} H ${x} V ${y + 12} A 12 12 0 0 1 ${x + 12} ${y} Z" fill="${escapeXml(headerFill)}"/>`,
		);
		parts.push(
			`<line x1="${x}" y1="${y + HEADER_HEIGHT}" x2="${x + node.width}" y2="${y + HEADER_HEIGHT}" stroke="${escapeXml(palette.border)}" stroke-width="1"/>`,
		);
		// Title
		parts.push(
			`<text x="${x + 30}" y="${y + 21}" font-size="11" font-weight="700" fill="${escapeXml(palette.foreground)}">${escapeXml(node.name)}</text>`,
		);
		// Subtitle: schema · N links
		parts.push(
			`<text x="${x + 30}" y="${y + 31}" font-size="9" fill="${escapeXml(palette.mutedForeground)}">${escapeXml((node.schema ?? "default") + " · " + node.degree + " link" + (node.degree === 1 ? "" : "s"))}</text>`,
		);

		// Columns
		for (let i = 0; i < node.columns.length; i++) {
			const col = node.columns[i];
			const rowY = y + HEADER_HEIGHT + i * ROW_HEIGHT;
			const cy = rowY + ROW_HEIGHT / 2;
			const isPrimary = !!col.isPrimary;
			const isForeign = fkBySource.has(`${node.schema ?? "default"}::${node.name}::${col.name}`);
			// Row separator
			if (i > 0) {
				parts.push(
					`<line x1="${x + 8}" y1="${rowY}" x2="${x + node.width - 8}" y2="${rowY}" stroke="${escapeXml(palette.border)}" stroke-opacity="0.5" stroke-width="0.5"/>`,
				);
			}
			// Bullet
			const bulletFill = isPrimary
				? palette.accentOrange
				: isForeign
					? palette.accentBlue
					: palette.border;
			parts.push(
				`<circle cx="${x + 14}" cy="${cy}" r="3" fill="${escapeXml(bulletFill)}"/>`,
			);
			// Name (truncate at ~22 chars to keep within card)
			const nameText = col.name.length > 22 ? col.name.slice(0, 21) + "…" : col.name;
			parts.push(
				`<text x="${x + 24}" y="${cy + 3.5}" font-size="10" fill="${escapeXml(palette.foreground)}">${escapeXml(nameText)}</text>`,
			);
			// Type
			const typeText = col.dataType ?? "";
			parts.push(
				`<text x="${x + node.width - 10}" y="${cy + 3.5}" font-size="9" fill="${escapeXml(palette.mutedForeground)}" text-anchor="end">${escapeXml(typeText)}</text>`,
			);
			// PK/FK badges
			let badgeRight = node.width - 10 - Math.min(60, typeText.length * 5.5) - 6;
			if (isForeign) {
				parts.push(
					`<rect x="${x + badgeRight - 16}" y="${cy - 6.5}" width="16" height="11" rx="2" ry="2" fill="${escapeXml(palette.accentBlue)}" fill-opacity="0.12" stroke="${escapeXml(palette.accentBlue)}" stroke-opacity="0.25"/>`,
				);
				parts.push(
					`<text x="${x + badgeRight - 8}" y="${cy + 2}" font-size="7" font-weight="800" fill="${escapeXml(palette.accentBlue)}" text-anchor="middle">FK</text>`,
				);
				badgeRight -= 20;
			}
			if (isPrimary) {
				parts.push(
					`<rect x="${x + badgeRight - 16}" y="${cy - 6.5}" width="16" height="11" rx="2" ry="2" fill="${escapeXml(palette.accentOrange)}" fill-opacity="0.12" stroke="${escapeXml(palette.accentOrange)}" stroke-opacity="0.25"/>`,
				);
				parts.push(
					`<text x="${x + badgeRight - 8}" y="${cy + 2}" font-size="7" font-weight="800" fill="${escapeXml(palette.accentOrange)}" text-anchor="middle">PK</text>`,
				);
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

	// ── Canvas pan ──────────────────────────────────────────────────────────
	const dragRef = useRef<{
		startX: number;
		startY: number;
		originX: number;
		originY: number;
	} | null>(null);
	const [viewport, setViewport] = useState({ x: 32, y: 32, scale: 1 });
	const [isPanning, setIsPanning] = useState(false);

	// Keep a ref to viewport.scale so window-level drag handlers can read it
	// without needing it in their closure deps (avoids stale reads at any zoom).
	const viewportScaleRef = useRef(1);
	useEffect(() => {
		viewportScaleRef.current = viewport.scale;
	}, [viewport.scale]);

	// ── Node drag ───────────────────────────────────────────────────────────
	const nodeDragRef = useRef<{
		nodeKey: string;
		startMouseX: number;
		startMouseY: number;
		startNodeX: number;
		startNodeY: number;
		hasMoved: boolean;
	} | null>(null);
	// Persists "did this mousedown turn into a drag?" across the mouseup → click gap
	const nodeWasDraggedRef = useRef(false);

	const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
	const [draggingNodeKey, setDraggingNodeKey] = useState<string | null>(null);

	// Reset positions whenever the graph changes (e.g. refresh)
	useEffect(() => {
		setNodePositions(new Map());
	}, [graph]);

	// Attach window-level mousemove/mouseup while a node drag is active so the
	// drag keeps working even when the cursor leaves the canvas container.
	useEffect(() => {
		if (!draggingNodeKey) return;

		const onWindowMove = (e: MouseEvent) => {
			const ref = nodeDragRef.current;
			if (!ref) return;
			const dx = e.clientX - ref.startMouseX;
			const dy = e.clientY - ref.startMouseY;
			// Cross the threshold → mark as a real drag
			if (!ref.hasMoved && dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
				ref.hasMoved = true;
				nodeWasDraggedRef.current = true;
			}
			if (ref.hasMoved) {
				// Convert screen-space delta → canvas-space delta
				const scale = viewportScaleRef.current;
				setNodePositions((prev) => {
					const next = new Map(prev);
					next.set(ref.nodeKey, {
						x: ref.startNodeX + dx / scale,
						y: ref.startNodeY + dy / scale,
					});
					return next;
				});
			}
		};

		const onWindowUp = () => {
			nodeDragRef.current = null;
			setDraggingNodeKey(null);
		};

		window.addEventListener("mousemove", onWindowMove);
		window.addEventListener("mouseup", onWindowUp);
		return () => {
			window.removeEventListener("mousemove", onWindowMove);
			window.removeEventListener("mouseup", onWindowUp);
		};
	}, [draggingNodeKey]);

	// ── Schema filter ───────────────────────────────────────────────────────
	const allSchemas = useMemo(() => {
		const set = new Set<string>();
		for (const t of graph.tables) set.add(t.schema ?? "default");
		return [...set].sort((a, b) => a.localeCompare(b));
	}, [graph]);

	// Selected schemas — null means "all" (default).
	const [selectedSchemas, setSelectedSchemas] = useState<Set<string> | null>(null);

	// If the graph changes and the selection references gone schemas, reset.
	useEffect(() => {
		if (!selectedSchemas) return;
		const allSet = new Set(allSchemas);
		for (const s of selectedSchemas) {
			if (!allSet.has(s)) {
				setSelectedSchemas(null);
				return;
			}
		}
	}, [allSchemas, selectedSchemas]);

	const filteredGraph = useMemo<SchemaGraph>(() => {
		if (!selectedSchemas || selectedSchemas.size === 0 || allSchemas.length <= 1) {
			return graph;
		}
		const tables = graph.tables.filter((t) =>
			selectedSchemas.has(t.schema ?? "default"),
		);
		const visibleKeys = new Set(tables.map((t) => tableKey(t.name, t.schema)));
		const relationships = graph.relationships.filter(
			(r) =>
				visibleKeys.has(tableKey(r.sourceTable, r.sourceSchema)) &&
				visibleKeys.has(tableKey(r.targetTable, r.targetSchema)),
		);
		return { tables, relationships };
	}, [graph, selectedSchemas, allSchemas.length]);

	const toggleSchema = useCallback(
		(schema: string) => {
			setSelectedSchemas((prev) => {
				const base = prev ?? new Set(allSchemas);
				const next = new Set(base);
				if (next.has(schema)) next.delete(schema);
				else next.add(schema);
				// If all selected — collapse to null ("all")
				if (next.size === allSchemas.length) return null;
				return next;
			});
		},
		[allSchemas],
	);

	const selectAllSchemas = useCallback(() => setSelectedSchemas(null), []);

	const isSchemaSelected = useCallback(
		(schema: string) => !selectedSchemas || selectedSchemas.has(schema),
		[selectedSchemas],
	);

	const activeSchemaCount = selectedSchemas?.size ?? allSchemas.length;
	const isFiltered =
		!!selectedSchemas && selectedSchemas.size > 0 && selectedSchemas.size < allSchemas.length;

	// ── Layout (BFS) ────────────────────────────────────────────────────────
	const layout = useMemo(() => {
		const degreeMap = new Map<string, number>();
		const adjacency = new Map<string, Set<string>>();

		for (const table of filteredGraph.tables) {
			const key = tableKey(table.name, table.schema);
			adjacency.set(key, new Set());
			degreeMap.set(key, 0);
		}

		for (const relation of filteredGraph.relationships) {
			const sourceKey = tableKey(relation.sourceTable, relation.sourceSchema);
			const targetKey = tableKey(relation.targetTable, relation.targetSchema);
			adjacency.get(sourceKey)?.add(targetKey);
			adjacency.get(targetKey)?.add(sourceKey);
			degreeMap.set(sourceKey, (degreeMap.get(sourceKey) ?? 0) + 1);
			degreeMap.set(targetKey, (degreeMap.get(targetKey) ?? 0) + 1);
		}

		const sortedTables = [...filteredGraph.tables].sort((a, b) => {
			const aKey = tableKey(a.name, a.schema);
			const bKey = tableKey(b.name, b.schema);
			const aCurrent = a.name === currentTableName ? 1 : 0;
			const bCurrent = b.name === currentTableName ? 1 : 0;
			if (aCurrent !== bCurrent) return bCurrent - aCurrent;
			const degreeDiff = (degreeMap.get(bKey) ?? 0) - (degreeMap.get(aKey) ?? 0);
			if (degreeDiff !== 0) return degreeDiff;
			return a.name.localeCompare(b.name);
		});

		const root =
			sortedTables.find((table) => table.name === currentTableName) ??
			sortedTables[0];

		const layerMap = new Map<string, number>();
		const visited = new Set<string>();
		const queue: Array<{ key: string; layer: number }> = [];

		if (root) {
			const rootKey = tableKey(root.name, root.schema);
			queue.push({ key: rootKey, layer: 0 });
			visited.add(rootKey);
			layerMap.set(rootKey, 0);
		}

		while (queue.length > 0) {
			const current = queue.shift()!;
			const neighbors = [...(adjacency.get(current.key) ?? [])].sort((a, b) => {
				const aTable = filteredGraph.tables.find((table) => tableKey(table.name, table.schema) === a);
				const bTable = filteredGraph.tables.find((table) => tableKey(table.name, table.schema) === b);
				if (!aTable || !bTable) return a.localeCompare(b);
				return aTable.name.localeCompare(bTable.name);
			});

			for (const neighbor of neighbors) {
				if (visited.has(neighbor)) continue;
				visited.add(neighbor);
				layerMap.set(neighbor, current.layer + 1);
				queue.push({ key: neighbor, layer: current.layer + 1 });
			}
		}

		let trailingLayer = layerMap.size > 0 ? Math.max(...layerMap.values()) + 1 : 0;
		for (const table of sortedTables) {
			const key = tableKey(table.name, table.schema);
			if (layerMap.has(key)) continue;
			layerMap.set(key, trailingLayer);
			trailingLayer += 1;
		}

		const layers = new Map<number, typeof filteredGraph.tables>();
		for (const table of sortedTables) {
			const key = tableKey(table.name, table.schema);
			const layer = layerMap.get(key) ?? 0;
			const group = layers.get(layer) ?? [];
			group.push(table);
			layers.set(layer, group);
		}

		const nodes = new Map<string, LayoutNode>();
		let maxWidth = 0;
		let maxHeight = 0;

		for (const [layerIndex, tables] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
			let cursorY = 0;
			for (const table of tables) {
				const key = tableKey(table.name, table.schema);
				const height = HEADER_HEIGHT + table.columns.length * ROW_HEIGHT + 12;
				const x = layerIndex * (NODE_WIDTH + COLUMN_GAP);
				const y = cursorY;

				nodes.set(key, {
					key,
					name: table.name,
					schema: table.schema,
					columns: table.columns,
					x,
					y,
					width: NODE_WIDTH,
					height,
					degree: degreeMap.get(key) ?? 0,
				});

				cursorY += height + ROW_GAP;
				maxWidth = Math.max(maxWidth, x + NODE_WIDTH);
				maxHeight = Math.max(maxHeight, y + height);
			}
		}

		return { nodes, width: maxWidth, height: maxHeight };
	}, [filteredGraph, currentTableName]);

	// ── Viewport helpers ────────────────────────────────────────────────────
	const fitToView = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;
		const boundsWidth = Math.max(layout.width + VIEWPORT_PADDING * 2, 320);
		const boundsHeight = Math.max(layout.height + VIEWPORT_PADDING * 2, 240);
		const availableWidth = container.clientWidth - VIEWPORT_PADDING * 2;
		const availableHeight = container.clientHeight - VIEWPORT_PADDING * 2;
		const nextScale = clamp(
			Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight, 1),
			0.45,
			1.1,
		);
		setViewport({
			scale: nextScale,
			x: (container.clientWidth - boundsWidth * nextScale) / 2 + VIEWPORT_PADDING,
			y: (container.clientHeight - boundsHeight * nextScale) / 2 + VIEWPORT_PADDING,
		});
	}, [layout.height, layout.width]);

	useEffect(() => {
		const frame = requestAnimationFrame(() => fitToView());
		return () => cancelAnimationFrame(frame);
	}, [fitToView]);

	const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
		event.preventDefault();
		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) return;
		const pointerX = event.clientX - rect.left;
		const pointerY = event.clientY - rect.top;

		setViewport((current) => {
			const nextScale = clamp(
				current.scale * (event.deltaY > 0 ? 0.92 : 1.08),
				0.45,
				2.2,
			);
			const worldX = (pointerX - current.x) / current.scale;
			const worldY = (pointerY - current.y) / current.scale;
			return {
				scale: nextScale,
				x: pointerX - worldX * nextScale,
				y: pointerY - worldY * nextScale,
			};
		});
	}, []);

	const zoomBy = useCallback((factor: number) => {
		setViewport((current) => ({
			...current,
			scale: clamp(current.scale * factor, 0.45, 2.2),
		}));
	}, []);

	// ── Image export ────────────────────────────────────────────────────────
	const buildExportSvg = useCallback(() => {
		const reference = containerRef.current;
		if (!reference) return null;
		const palette = readPalette(reference);
		// Use effective node positions (apply user-drag overrides)
		const nodes = [...layout.nodes.values()].map((node) => {
			const override = nodePositions.get(node.key);
			return override
				? { ...node, x: override.x, y: override.y }
				: node;
		});
		return buildDiagramSvg({
			graph: filteredGraph,
			nodes,
			currentTableName,
			palette,
		});
	}, [layout.nodes, nodePositions, filteredGraph, currentTableName]);

	const exportFilename = useCallback(
		(ext: string) => {
			const stem = currentTableName ? `er-diagram-${currentTableName}` : "er-diagram";
			const stamp = new Date().toISOString().slice(0, 10);
			return `${stem}-${stamp}.${ext}`;
		},
		[currentTableName],
	);

	const handleExportSvg = useCallback(() => {
		try {
			const out = buildExportSvg();
			if (!out) return;
			const blob = new Blob([out.svg], { type: "image/svg+xml;charset=utf-8" });
			downloadBlob(blob, exportFilename("svg"));
			toast.success("ER diagram exported as SVG");
		} catch (err) {
			console.error(err);
			toast.error("Failed to export SVG");
		}
	}, [buildExportSvg, exportFilename]);

	const handleExportPng = useCallback(async () => {
		try {
			const out = buildExportSvg();
			if (!out) return;
			const blob = await rasterizeSvg(out.svg, out.width, out.height, 2);
			downloadBlob(blob, exportFilename("png"));
			toast.success("ER diagram exported as PNG");
		} catch (err) {
			console.error(err);
			toast.error("Failed to export PNG");
		}
	}, [buildExportSvg, exportFilename]);

	// ── Canvas pan handlers ─────────────────────────────────────────────────
	const handleCanvasMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		dragRef.current = {
			startX: event.clientX,
			startY: event.clientY,
			originX: viewport.x,
			originY: viewport.y,
		};
		setIsPanning(true);
	}, [viewport.x, viewport.y]);

	const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
		if (!dragRef.current) return;
		const deltaX = event.clientX - dragRef.current.startX;
		const deltaY = event.clientY - dragRef.current.startY;
		setViewport((current) => ({
			...current,
			x: dragRef.current!.originX + deltaX,
			y: dragRef.current!.originY + deltaY,
		}));
	}, []);

	const stopPanning = useCallback(() => {
		dragRef.current = null;
		setIsPanning(false);
	}, []);

	// ── Node drag handler ───────────────────────────────────────────────────
	const handleNodeMouseDown = useCallback((event: React.MouseEvent, node: LayoutNode) => {
		event.stopPropagation(); // prevent canvas pan from starting
		if (event.button !== 0) return;
		nodeWasDraggedRef.current = false;
		const override = nodePositions.get(node.key);
		nodeDragRef.current = {
			nodeKey: node.key,
			startMouseX: event.clientX,
			startMouseY: event.clientY,
			startNodeX: override?.x ?? node.x,
			startNodeY: override?.y ?? node.y,
			hasMoved: false,
		};
		setDraggingNodeKey(node.key);
	}, [nodePositions]);

	// ── Helpers ──────────────────────────────────────────────────────────────
	const svgW = Math.max(layout.width + VIEWPORT_PADDING * 2, 640);
	const svgH = Math.max(layout.height + VIEWPORT_PADDING * 2, 420);

	return (
		<div className="h-full flex flex-col bg-background">
			{/* Toolbar */}
			<div className="h-10 shrink-0 border-b border-border px-3 flex items-center justify-between bg-card/80 backdrop-blur-sm">
				<div className="flex items-center gap-3 min-w-0">
					<div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/55">
						<Link2 size={11} className="text-accent-blue/60" />
						ER Diagram
					</div>
					<span className="text-[10px] font-mono text-muted-foreground/40">
						{filteredGraph.tables.length}
						{isFiltered ? `/${graph.tables.length}` : ""} tables
					</span>
					<span className="text-[10px] font-mono text-muted-foreground/30">
						{filteredGraph.relationships.length} relations
					</span>
					{filteredGraph.relationships.length === 0 && (
						<span className="text-[10px] font-mono text-muted-foreground/45 truncate">
							No foreign keys found. Showing schema map only.
						</span>
					)}
				</div>
				<div className="flex items-center gap-1 shrink-0">
					{allSchemas.length > 1 && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="xs"
									className={cn(
										"h-6 px-2 gap-1.5 text-[10px] font-mono",
										isFiltered
											? "text-primary hover:text-primary"
											: "text-muted-foreground/60 hover:text-foreground",
									)}
								>
									<Filter size={11} />
									<span>
										{isFiltered
											? `${activeSchemaCount}/${allSchemas.length} schemas`
											: "All schemas"}
									</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="min-w-[200px]">
								<DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
									Filter by schema
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onSelect={(e) => {
										e.preventDefault();
										selectAllSchemas();
									}}
									className="text-[11px] font-mono"
								>
									<Check
										size={12}
										className={cn(
											"mr-2",
											!isFiltered ? "opacity-100 text-primary" : "opacity-0",
										)}
									/>
									All schemas
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								{allSchemas.map((schema) => {
									const checked = isSchemaSelected(schema);
									return (
										<DropdownMenuItem
											key={schema}
											onSelect={(e) => {
												e.preventDefault();
												toggleSchema(schema);
											}}
											className="text-[11px] font-mono"
										>
											<Check
												size={12}
												className={cn(
													"mr-2",
													checked ? "opacity-100 text-primary" : "opacity-0",
												)}
											/>
											{schema}
										</DropdownMenuItem>
									);
								})}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon-xs"
								className="text-muted-foreground/50 hover:text-foreground"
								title="Export diagram"
							>
								<Download size={11} />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-[180px]">
							<DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
								Export diagram
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onSelect={(e) => {
									e.preventDefault();
									void handleExportPng();
								}}
								className="text-[11px] font-mono"
							>
								<ImageIcon size={12} className="mr-2 text-accent-blue/70" />
								PNG image
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={(e) => {
									e.preventDefault();
									handleExportSvg();
								}}
								className="text-[11px] font-mono"
							>
								<Download size={12} className="mr-2 text-accent-blue/70" />
								SVG vector
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={() => zoomBy(1.12)}
						className="text-muted-foreground/50 hover:text-foreground"
					>
						<ZoomIn size={11} />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={() => zoomBy(0.9)}
						className="text-muted-foreground/50 hover:text-foreground"
					>
						<ZoomOut size={11} />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={fitToView}
						className="text-muted-foreground/50 hover:text-foreground"
					>
						<LocateFixed size={11} />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={onRetry}
						disabled={isRefreshing}
						className="text-muted-foreground/50 hover:text-foreground"
					>
						<RefreshCcw size={11} className={cn(isRefreshing && "animate-spin")} />
					</Button>
				</div>
			</div>

			{/* Canvas */}
			<div
				ref={containerRef}
				className={cn(
					"relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border)/0.4)_1px,transparent_0)] bg-size-[24px_24px]",
					draggingNodeKey ? "cursor-grabbing select-none" : isPanning ? "cursor-grabbing" : "cursor-grab",
				)}
				onMouseDown={handleCanvasMouseDown}
				onMouseMove={handleCanvasMouseMove}
				onMouseUp={stopPanning}
				onMouseLeave={stopPanning}
				onWheel={handleWheel}
			>
				<div
					className="absolute left-0 top-0 origin-top-left"
					style={{
						width: svgW,
						height: svgH,
						transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
					}}
				>
					{/* Table cards */}
					{[...layout.nodes.values()].map((node) => {
						const pos = nodePositions.get(node.key) ?? { x: node.x, y: node.y };
						const isCurrent = node.name === currentTableName;
						const isDragging = draggingNodeKey === node.key;
						return (
							<button
								key={node.key}
								type="button"
								onMouseDown={(event) => handleNodeMouseDown(event, node)}
								onClick={() => {
									if (!nodeWasDraggedRef.current) {
										onTableSelect(node.name);
									}
								}}
								className={cn(
									"absolute rounded-xl border text-left overflow-hidden shadow-sm select-none",
									isDragging
										? "cursor-grabbing shadow-2xl z-10 transition-none"
										: "cursor-grab transition-shadow",
									isCurrent
										? "border-primary/45 bg-card ring-2 ring-primary/20 shadow-lg"
										: "border-border/70 bg-card/95 hover:border-primary/30 hover:shadow-md",
								)}
								style={{
									left: pos.x,
									top: pos.y,
									width: node.width,
									minHeight: node.height,
								}}
							>
								{/* Card header */}
								<div
									className={cn(
										"px-2 py-2 border-b flex items-center gap-2",
										isCurrent ? "bg-primary/8 border-primary/15" : "bg-muted/35 border-border/70",
									)}
								>
									<GripVertical
										size={11}
										className="text-muted-foreground/25 shrink-0"
									/>
									<Database
										size={12}
										className={cn(isCurrent ? "text-primary" : "text-accent-blue/65")}
									/>
									<div className="min-w-0 flex-1">
										<div className="text-[11px] font-bold font-mono text-foreground truncate">
											{node.name}
										</div>
										<div className="text-[9px] font-mono text-muted-foreground/45 truncate">
											{node.schema ?? "default"} · {node.degree} link{node.degree === 1 ? "" : "s"}
										</div>
									</div>
								</div>

								{/* Column rows */}
								<div className="divide-y divide-border/40">
									{node.columns.map((column) => {
										const isPrimary = column.isPrimary;
										const isForeign = filteredGraph.relationships.some(
											(relation) =>
												relation.sourceTable === node.name &&
												(relation.sourceSchema ?? "default") === (node.schema ?? "default") &&
												relation.sourceColumns.includes(column.name),
										);
										const isConnectedToActive =
											currentTableName != null &&
											filteredGraph.relationships.some(
												(r) =>
													(r.sourceTable === node.name &&
														r.sourceColumns.includes(column.name) &&
														r.targetTable === currentTableName) ||
													(r.targetTable === node.name &&
														r.targetColumns.includes(column.name) &&
														r.sourceTable === currentTableName),
											);
										return (
											<div
												key={column.name}
												className={cn(
													"flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono transition-colors",
													isConnectedToActive
														? "bg-primary/5"
														: "hover:bg-row-hover",
												)}
											>
												<span
													className={cn(
														"w-1.5 h-1.5 rounded-full shrink-0",
														isPrimary
															? "bg-accent-orange"
															: isForeign
																? "bg-accent-blue"
																: "bg-border",
													)}
												/>
												<span
													className={cn(
														"flex-1 min-w-0 truncate",
														isConnectedToActive ? "text-primary font-semibold" : "text-foreground/88",
													)}
												>
													{column.name}
												</span>
												<div className="flex items-center gap-1 shrink-0">
													{isPrimary && (
														<span className="px-1 py-0.5 rounded bg-accent-orange/10 border border-accent-orange/20 text-[8px] font-black uppercase tracking-wider text-accent-orange">
															PK
														</span>
													)}
													{isForeign && (
														<span className="px-1 py-0.5 rounded bg-accent-blue/10 border border-accent-blue/20 text-[8px] font-black uppercase tracking-wider text-accent-blue">
															FK
														</span>
													)}
													<span className="text-[9px] text-muted-foreground/40">
														{column.dataType}
													</span>
												</div>
											</div>
										);
									})}
								</div>
							</button>
						);
					})}

					{/* Relationship connectors - rendered after cards so lines appear on top */}
					<svg
						className="absolute inset-0 overflow-visible pointer-events-none"
						width={svgW}
						height={svgH}
						viewBox={`0 0 ${svgW} ${svgH}`}
						style={{ zIndex: 20 }}
					>
						{filteredGraph.relationships.map((relation) => {
							const source = layout.nodes.get(tableKey(relation.sourceTable, relation.sourceSchema));
							const target = layout.nodes.get(tableKey(relation.targetTable, relation.targetSchema));
							if (!source || !target) return null;

							const srcOv = nodePositions.get(source.key);
							const tgtOv = nodePositions.get(target.key);
							const srcX = srcOv?.x ?? source.x;
							const srcY = srcOv?.y ?? source.y;
							const tgtX = tgtOv?.x ?? target.x;
							const tgtY = tgtOv?.y ?? target.y;

							const sourceIndex = source.columns.findIndex(
								(col) => col.name === relation.sourceColumns[0],
							);
							const targetIndex = target.columns.findIndex(
								(col) => col.name === relation.targetColumns[0],
							);

							const fromLeft = tgtX < srcX;
							const startX = srcX + (fromLeft ? 0 : source.width);
							const endX = tgtX + (fromLeft ? target.width : 0);

							const startY =
								srcY + HEADER_HEIGHT + (sourceIndex >= 0 ? sourceIndex : 0) * ROW_HEIGHT + ROW_HEIGHT / 2 + 6;
							const endY =
								tgtY + HEADER_HEIGHT + (targetIndex >= 0 ? targetIndex : 0) * ROW_HEIGHT + ROW_HEIGHT / 2 + 6;

							const direction = fromLeft ? -1 : 1;
							const delta = Math.max(56, Math.abs(endX - startX) * 0.45);
							const isActive =
								source.name === currentTableName || target.name === currentTableName;

							const strokeColor = isActive ? "var(--color-accent-green)" : "var(--color-accent-blue)";
							const strokeWidth = isActive ? 2.5 : 1.8;

							const pathD = `M ${startX} ${startY} C ${startX + delta * direction} ${startY}, ${endX - delta * direction} ${endY}, ${endX} ${endY}`;

							return (
								<g key={`${relation.name}-${source.key}-${target.key}`}>
									<path
										d={pathD}
										fill="none"
										strokeLinecap="round"
										style={{ stroke: "var(--background)", strokeWidth: strokeWidth + 4, opacity: 0.35 }}
									/>
									<path
										d={pathD}
										fill="none"
										strokeLinecap="round"
										style={{ stroke: strokeColor, strokeWidth }}
									/>
									<polygon
										points={`${endX - 8},${endY - 5} ${endX},${endY} ${endX - 8},${endY + 5}`}
										style={{ fill: strokeColor }}
									/>
									<circle cx={startX} cy={startY} r={4} style={{ fill: strokeColor }} />
									<circle cx={endX} cy={endY} r={4} style={{ fill: strokeColor }} />
								</g>
							);
						})}
					</svg>
				</div>
			</div>
		</div>
	);
}
