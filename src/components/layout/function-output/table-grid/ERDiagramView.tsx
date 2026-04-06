import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Database, Link2, LocateFixed, RefreshCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SchemaGraph } from "@/types";

const NODE_WIDTH = 280;
const HEADER_HEIGHT = 34;
const ROW_HEIGHT = 22;
const COLUMN_GAP = 120;
const ROW_GAP = 52;
const VIEWPORT_PADDING = 48;

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
	const dragRef = useRef<{
		startX: number;
		startY: number;
		originX: number;
		originY: number;
	} | null>(null);
	const [viewport, setViewport] = useState({ x: 32, y: 32, scale: 1 });
	const [isPanning, setIsPanning] = useState(false);

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

		return {
			nodes,
			width: maxWidth,
			height: maxHeight,
		};
	}, [graph, currentTableName]);

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

	const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		dragRef.current = {
			startX: event.clientX,
			startY: event.clientY,
			originX: viewport.x,
			originY: viewport.y,
		};
		setIsPanning(true);
	}, [viewport.x, viewport.y]);

	const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
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

	const zoomBy = useCallback((factor: number) => {
		setViewport((current) => ({
			...current,
			scale: clamp(current.scale * factor, 0.45, 2.2),
		}));
	}, []);

	return (
		<div className="h-full flex flex-col bg-background">
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

			<div
				ref={containerRef}
				className={cn(
					"relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border)/0.4)_1px,transparent_0)] [background-size:24px_24px]",
					isPanning ? "cursor-grabbing" : "cursor-grab",
				)}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={stopPanning}
				onMouseLeave={stopPanning}
				onWheel={handleWheel}
			>
				<div
					className="absolute left-0 top-0 origin-top-left"
					style={{
						width: Math.max(layout.width + VIEWPORT_PADDING * 2, 640),
						height: Math.max(layout.height + VIEWPORT_PADDING * 2, 420),
						transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
					}}
				>
					<svg
						className="absolute inset-0 overflow-visible pointer-events-none"
						width={Math.max(layout.width + VIEWPORT_PADDING * 2, 640)}
						height={Math.max(layout.height + VIEWPORT_PADDING * 2, 420)}
						viewBox={`0 0 ${Math.max(layout.width + VIEWPORT_PADDING * 2, 640)} ${Math.max(layout.height + VIEWPORT_PADDING * 2, 420)}`}
					>
						{graph.relationships.map((relation) => {
							const source = layout.nodes.get(tableKey(relation.sourceTable, relation.sourceSchema));
							const target = layout.nodes.get(tableKey(relation.targetTable, relation.targetSchema));
							if (!source || !target) return null;

							const sourceIndex = source.columns.findIndex(
								(column) => column.name === relation.sourceColumns[0],
							);
							const targetIndex = target.columns.findIndex(
								(column) => column.name === relation.targetColumns[0],
							);
							const fromLeft = target.x < source.x;
							const startX = source.x + (fromLeft ? 0 : source.width);
							const endX = target.x + (fromLeft ? target.width : 0);
							const startY =
								source.y +
								HEADER_HEIGHT +
								(sourceIndex >= 0 ? sourceIndex : 0) * ROW_HEIGHT +
								ROW_HEIGHT / 2;
							const endY =
								target.y +
								HEADER_HEIGHT +
								(targetIndex >= 0 ? targetIndex : 0) * ROW_HEIGHT +
								ROW_HEIGHT / 2;
							const direction = fromLeft ? -1 : 1;
							const delta = Math.max(56, Math.abs(endX - startX) * 0.45);
							const isActive =
								source.name === currentTableName || target.name === currentTableName;

							return (
								<path
									key={`${relation.name}-${source.key}-${target.key}`}
									d={`M ${startX} ${startY} C ${startX + delta * direction} ${startY}, ${endX - delta * direction} ${endY}, ${endX} ${endY}`}
									fill="none"
									stroke={isActive ? "hsl(var(--primary))" : "hsl(var(--border))"}
									strokeOpacity={isActive ? 0.85 : 0.7}
									strokeWidth={isActive ? 2.4 : 1.4}
									strokeDasharray={isActive ? undefined : "5 5"}
								/>
							);
						})}
					</svg>

					{[...layout.nodes.values()].map((node) => {
						const isCurrent = node.name === currentTableName;
						return (
							<button
								key={node.key}
								type="button"
								onMouseDown={(event) => event.stopPropagation()}
								onClick={() => onTableSelect(node.name)}
								className={cn(
									"absolute rounded-xl border text-left overflow-hidden shadow-sm transition-all",
									isCurrent
										? "border-primary/45 bg-card ring-2 ring-primary/20 shadow-lg"
										: "border-border/70 bg-card/95 hover:border-primary/30 hover:shadow-md",
								)}
								style={{
									left: node.x,
									top: node.y,
									width: node.width,
									minHeight: node.height,
								}}
							>
								<div
									className={cn(
										"px-3 py-2 border-b flex items-center gap-2",
										isCurrent ? "bg-primary/8 border-primary/15" : "bg-muted/35 border-border/70",
									)}
								>
									<Database
										size={12}
										className={cn(
											isCurrent ? "text-primary" : "text-accent-blue/65",
										)}
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
								<div className="divide-y divide-border/40">
									{node.columns.map((column) => {
										const isPrimary = column.isPrimary;
										const isForeign = graph.relationships.some((relation) =>
											relation.sourceTable === node.name &&
											(relation.sourceSchema ?? "default") === (node.schema ?? "default") &&
											relation.sourceColumns.includes(column.name),
										);
										return (
											<div
												key={column.name}
												className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono hover:bg-row-hover transition-colors"
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
												<span className="flex-1 min-w-0 truncate text-foreground/88">
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
