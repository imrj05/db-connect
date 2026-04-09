import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Database, GripVertical, Link2, LocateFixed, RefreshCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
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

	// ── Layout (BFS) ────────────────────────────────────────────────────────
	const layout = useMemo(() => {
		const degreeMap = new Map<string, number>();
		const adjacency = new Map<string, Set<string>>();

		for (const table of graph.tables) {
			const key = tableKey(table.name, table.schema);
			adjacency.set(key, new Set());
			degreeMap.set(key, 0);
		}

		for (const relation of graph.relationships) {
			const sourceKey = tableKey(relation.sourceTable, relation.sourceSchema);
			const targetKey = tableKey(relation.targetTable, relation.targetSchema);
			adjacency.get(sourceKey)?.add(targetKey);
			adjacency.get(targetKey)?.add(sourceKey);
			degreeMap.set(sourceKey, (degreeMap.get(sourceKey) ?? 0) + 1);
			degreeMap.set(targetKey, (degreeMap.get(targetKey) ?? 0) + 1);
		}

		const sortedTables = [...graph.tables].sort((a, b) => {
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
				const aTable = graph.tables.find((table) => tableKey(table.name, table.schema) === a);
				const bTable = graph.tables.find((table) => tableKey(table.name, table.schema) === b);
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

		const layers = new Map<number, typeof graph.tables>();
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
	}, [graph, currentTableName]);

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
						{graph.tables.length} tables
					</span>
					<span className="text-[10px] font-mono text-muted-foreground/30">
						{graph.relationships.length} relations
					</span>
					{graph.relationships.length === 0 && (
						<span className="text-[10px] font-mono text-muted-foreground/45 truncate">
							No foreign keys found. Showing schema map only.
						</span>
					)}
				</div>
				<div className="flex items-center gap-1 shrink-0">
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
					{/* Relationship connectors */}
					<svg
						className="absolute inset-0 overflow-visible pointer-events-none"
						width={svgW}
						height={svgH}
						viewBox={`0 0 ${svgW} ${svgH}`}
					>
						{graph.relationships.map((relation) => {
							const source = layout.nodes.get(tableKey(relation.sourceTable, relation.sourceSchema));
							const target = layout.nodes.get(tableKey(relation.targetTable, relation.targetSchema));
							if (!source || !target) return null;

							// Use user-dragged position if available, fall back to layout position
							const srcOv = nodePositions.get(source.key);
							const tgtOv = nodePositions.get(target.key);
							const srcX = srcOv?.x ?? source.x;
							const srcY = srcOv?.y ?? source.y;
							const tgtX = tgtOv?.x ?? target.x;
							const tgtY = tgtOv?.y ?? target.y;

							// Find the specific FK/PK column row within each table
							const sourceIndex = source.columns.findIndex(
								(col) => col.name === relation.sourceColumns[0],
							);
							const targetIndex = target.columns.findIndex(
								(col) => col.name === relation.targetColumns[0],
							);

							// Which side of each table the connector exits from
							const fromLeft = tgtX < srcX;
							const startX = srcX + (fromLeft ? 0 : source.width);
							const endX = tgtX + (fromLeft ? target.width : 0);

							// Y is anchored to the midpoint of the specific column row
							const startY =
								srcY + HEADER_HEIGHT + (sourceIndex >= 0 ? sourceIndex : 0) * ROW_HEIGHT + ROW_HEIGHT / 2;
							const endY =
								tgtY + HEADER_HEIGHT + (targetIndex >= 0 ? targetIndex : 0) * ROW_HEIGHT + ROW_HEIGHT / 2;

							const direction = fromLeft ? -1 : 1;
							const delta = Math.max(56, Math.abs(endX - startX) * 0.45);
							const isActive =
								source.name === currentTableName || target.name === currentTableName;

							const strokeColor = isActive ? "hsl(var(--primary))" : "hsl(var(--border))";
							const strokeOpacity = isActive ? 0.85 : 0.65;

							return (
								<g key={`${relation.name}-${source.key}-${target.key}`}>
									<path
										d={`M ${startX} ${startY} C ${startX + delta * direction} ${startY}, ${endX - delta * direction} ${endY}, ${endX} ${endY}`}
										fill="none"
										stroke={strokeColor}
										strokeOpacity={strokeOpacity}
										strokeWidth={isActive ? 2.4 : 1.4}
										strokeDasharray={isActive ? undefined : "5 5"}
									/>
									{/* Endpoint dots — visually anchor the line to the row */}
									<circle cx={startX} cy={startY} r={3.5} fill={strokeColor} opacity={strokeOpacity} />
									<circle cx={endX} cy={endY} r={3.5} fill={strokeColor} opacity={strokeOpacity} />
								</g>
							);
						})}
					</svg>

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
									// nodeWasDraggedRef persists beyond mouseup, so it's still set here
									if (!nodeWasDraggedRef.current) {
										onTableSelect(node.name);
									}
								}}
								className={cn(
									"absolute rounded-xl border text-left overflow-hidden shadow-sm select-none",
									// Only apply layout transitions when not dragging — prevents the
									// card lagging behind the cursor due to CSS position transitions
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
										const isForeign = graph.relationships.some(
											(relation) =>
												relation.sourceTable === node.name &&
												(relation.sourceSchema ?? "default") === (node.schema ?? "default") &&
												relation.sourceColumns.includes(column.name),
										);
										// Highlight columns that are connected to the active table
										const isConnectedToActive =
											currentTableName != null &&
											graph.relationships.some(
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
				</div>
			</div>
		</div>
	);
}
