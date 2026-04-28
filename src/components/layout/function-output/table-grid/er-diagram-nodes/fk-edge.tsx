import { memo } from "react";
import {
	BaseEdge,
	EdgeLabelRenderer,
	getSmoothStepPath,
	type EdgeProps,
} from "@xyflow/react";

export type FkEdgeData = {
	label?: string;
	isSelected?: boolean;
};

function FkEdgeComponent({
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	data,
	markerEnd,
	selected,
}: EdgeProps) {
	const [edgePath, labelX, labelY] = getSmoothStepPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
		borderRadius: 12,
	});

	const isActive = selected || data?.isSelected;

	return (
		<>
			{/* Shadow/glow path */}
			<BaseEdge
				path={edgePath}
				style={{
					stroke: "var(--background)",
					strokeWidth: (isActive ? 2.5 : 1.8) + 4,
					opacity: 0.35,
					strokeLinecap: "round",
				}}
			/>
			{/* Main path */}
			<BaseEdge
				path={edgePath}
				markerEnd={markerEnd}
				style={{
					stroke: isActive
						? "var(--color-accent-green)"
						: "var(--color-accent-blue)",
					strokeWidth: isActive ? 2.5 : 1.8,
					strokeLinecap: "round",
				}}
			/>
			{/* Label */}
			{data?.label && (
				<EdgeLabelRenderer>
					<div
						className="absolute text-[8px] font-mono text-muted-foreground/60 bg-card/80 px-1 py-0.5 rounded pointer-events-none nodrag nopan"
						style={{
							transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
						}}
					>
						{String(data.label)}
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
}

export const FkEdge = memo(FkEdgeComponent);
