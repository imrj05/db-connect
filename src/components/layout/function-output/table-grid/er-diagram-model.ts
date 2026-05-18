import type { SchemaGraph } from "@/types";

export const NODE_WIDTH = 280;
export const COLUMN_GAP = 120;
export const ROW_GAP = 52;
export const HEADER_HEIGHT = 34;
export const ROW_HEIGHT = 22;

const DIAGRAM_POSITIONS_KEY = "db_connect_diagram_positions_v1";

export function tableKey(name: string, schema?: string) {
	return `${schema ?? "default"}::${name}`;
}

export function loadPositions(connectionId: string, database: string): Record<string, { x: number; y: number }> {
	try {
		const raw = localStorage.getItem(DIAGRAM_POSITIONS_KEY);
		if (!raw) return {};
		const all = JSON.parse(raw) as Record<string, Record<string, { x: number; y: number }>>;
		return all[`${connectionId}:${database}`] ?? {};
	} catch {
		return {};
	}
}

export function savePositions(connectionId: string, database: string, positions: Record<string, { x: number; y: number }>) {
	try {
		const raw = localStorage.getItem(DIAGRAM_POSITIONS_KEY);
		const all: Record<string, Record<string, { x: number; y: number }>> = raw
			? JSON.parse(raw)
			: {};
		all[`${connectionId}:${database}`] = positions;
		localStorage.setItem(DIAGRAM_POSITIONS_KEY, JSON.stringify(all));
	} catch { /* ignore */ }
}

export function clearPositions(connectionId: string, database: string) {
	try {
		const raw = localStorage.getItem(DIAGRAM_POSITIONS_KEY);
		if (!raw) return;
		const all = JSON.parse(raw) as Record<string, Record<string, { x: number; y: number }>>;
		delete all[`${connectionId}:${database}`];
		localStorage.setItem(DIAGRAM_POSITIONS_KEY, JSON.stringify(all));
	} catch { /* ignore */ }
}

export function buildDegreeMap(graph: SchemaGraph) {
	const map = new Map<string, number>();
	for (const t of graph.tables) {
		map.set(tableKey(t.name, t.schema), 0);
	}
	for (const r of graph.relationships) {
		const sk = tableKey(r.sourceTable, r.sourceSchema);
		const tk = tableKey(r.targetTable, r.targetSchema);
		map.set(sk, (map.get(sk) ?? 0) + 1);
		map.set(tk, (map.get(tk) ?? 0) + 1);
	}
	return map;
}

export function buildBfsLayout(graph: SchemaGraph, currentTableKey?: string) {
	const degreeMap = buildDegreeMap(graph);
	const adjacency = new Map<string, Set<string>>();
	for (const t of graph.tables) {
		adjacency.set(tableKey(t.name, t.schema), new Set());
	}
	for (const r of graph.relationships) {
		const sk = tableKey(r.sourceTable, r.sourceSchema);
		const tk = tableKey(r.targetTable, r.targetSchema);
		adjacency.get(sk)?.add(tk);
		adjacency.get(tk)?.add(sk);
	}

	const sortedTables = [...graph.tables].sort((a, b) => {
		const aKey = tableKey(a.name, a.schema);
		const bKey = tableKey(b.name, b.schema);
		const aCurr = aKey === currentTableKey ? 1 : 0;
		const bCurr = bKey === currentTableKey ? 1 : 0;
		if (aCurr !== bCurr) return bCurr - aCurr;
		return ((degreeMap.get(bKey) ?? 0) - (degreeMap.get(aKey) ?? 0)) || a.name.localeCompare(b.name);
	});

	const root = sortedTables.find((t) => tableKey(t.name, t.schema) === currentTableKey) ?? sortedTables[0];
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

	const layers = new Map<number, (typeof graph.tables)[number][]>();
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
			const h = HEADER_HEIGHT + tbl.columns.length * ROW_HEIGHT + 12;
			const key = tableKey(tbl.name, tbl.schema);
			positions[key] = { x: layerIdx * (NODE_WIDTH + COLUMN_GAP), y: cursorY };
			cursorY += h + ROW_GAP;
		}
	}

	return { positions, degreeMap };
}
