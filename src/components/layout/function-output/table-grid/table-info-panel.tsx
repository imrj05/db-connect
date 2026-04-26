import { useMemo } from "react";
import { Key, Hash, Link2, Database, AlertCircle, CheckCircle2, List } from "lucide-react";
import { TableStructure, ForeignKeyRelation } from "@/types";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

function TypeBadge({ type }: { type: string }) {
	const short = type
		.replace(/\(.*\)/, "")
		.replace(/unsigned/i, "")
		.trim()
		.toUpperCase()
		.slice(0, 7);
	return (
		<span className="shrink-0 rounded-[3px] border border-border/60 bg-muted/50 px-1 py-px text-[8px] font-mono text-muted-foreground/70 leading-none">
			{short}
		</span>
	);
}

export function TableInfoPanel({
	structure,
	fkRelations,
	tableName,
	rowCount,
}: {
	structure: TableStructure | null;
	fkRelations: ForeignKeyRelation[];
	tableName: string;
	rowCount: number;
}) {
	const pkColumns = useMemo(
		() => structure?.columns.filter((c) => c.isPrimary).map((c) => c.name) ?? [],
		[structure],
	);
	const fkColumnNames = useMemo(
		() =>
			new Set(
				fkRelations
				.filter((r) => r.sourceTable === tableName)
				.flatMap((r) => r.sourceColumns),
		),
		[fkRelations, tableName],
	);

	if (!structure) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/30">
				<Database size={18} />
				<p className="text-[10px]">No structure loaded</p>
			</div>
		);
	}

	const outgoingFKs = fkRelations.filter((r) => r.sourceTable === tableName);
	const incomingFKs = fkRelations.filter((r) => r.targetTable === tableName);

	return (
		<ScrollArea className="h-full">
			<div className="p-3 space-y-4 text-[11px]">
				{/* Summary */}
				<div className="grid grid-cols-2 gap-2">
					{[
						{ label: "Columns", value: structure.columns.length, icon: <List size={10} /> },
						{ label: "Rows (page)", value: rowCount, icon: <Hash size={10} /> },
						{ label: "Primary Keys", value: pkColumns.length, icon: <Key size={10} /> },
						{ label: "Indexes", value: structure.indexes.length, icon: <Database size={10} /> },
					].map(({ label, value, icon }) => (
						<div
							key={label}
							className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2"
						>
							<div className="flex items-center gap-1 text-muted-foreground/60 mb-0.5">
								{icon}
								<span className="text-[9px] uppercase tracking-wider">{label}</span>
							</div>
							<span className="text-[14px] font-bold text-foreground/80">{value}</span>
						</div>
					))}
				</div>

				{/* Columns */}
				<div>
					<p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50 mb-1.5">
						Columns
					</p>
					<div className="rounded-md border border-border/60 overflow-hidden">
						{structure.columns.map((col, i) => (
							<div
								key={col.name}
								className={cn(
									"flex items-center gap-1.5 px-2.5 py-1.5",
									i < structure.columns.length - 1 && "border-b border-border/40",
								)}
							>
								{/* Icon */}
								{col.isPrimary ? (
									<Key size={9} className="shrink-0 text-accent-yellow" />
								) : fkColumnNames.has(col.name) ? (
									<Link2 size={9} className="shrink-0 text-accent-blue/70" />
								) : (
									<span className="w-[9px] shrink-0" />
								)}
								{/* Name */}
								<span
									className={cn(
										"flex-1 min-w-0 truncate font-medium",
										col.isPrimary
											? "text-accent-yellow"
											: fkColumnNames.has(col.name)
											? "text-accent-blue/90"
											: "text-foreground/85",
									)}
								>
									{col.name}
								</span>
								{/* Badges */}
								<div className="flex items-center gap-1 shrink-0">
									{col.isPrimary && (
										<span className="rounded-[3px] border border-accent-yellow/30 bg-accent-yellow/10 px-1 py-px text-[8px] font-bold text-accent-yellow leading-none">
											PK
										</span>
									)}
									{fkColumnNames.has(col.name) && (
										<span className="rounded-[3px] border border-accent-blue/30 bg-accent-blue/10 px-1 py-px text-[8px] font-bold text-accent-blue leading-none">
											FK
										</span>
									)}
									{col.isUnique && !col.isPrimary && (
										<span className="rounded-[3px] border border-accent-purple/30 bg-accent-purple/10 px-1 py-px text-[8px] font-bold text-accent-purple leading-none">
											UQ
										</span>
									)}
									{col.nullable ? (
										<AlertCircle size={8} className="text-muted-foreground/30" />
									) : (
										<CheckCircle2 size={8} className="text-accent-green/50" />
									)}
									<TypeBadge type={col.dataType} />
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Indexes */}
				{structure.indexes.length > 0 && (
					<div>
						<p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50 mb-1.5">
							Indexes
						</p>
						<div className="rounded-md border border-border/60 overflow-hidden">
							{structure.indexes.map((idx, i) => (
								<div
									key={idx.name}
									className={cn(
										"px-2.5 py-1.5",
										i < structure.indexes.length - 1 && "border-b border-border/40",
									)}
								>
									<div className="flex items-center gap-1.5">
										<span className="font-medium text-foreground/80 truncate flex-1">
											{idx.name}
										</span>
										{idx.unique && (
											<span className="rounded-[3px] border border-accent-purple/30 bg-accent-purple/10 px-1 py-px text-[8px] font-bold text-accent-purple leading-none shrink-0">
												UNIQUE
											</span>
										)}
									</div>
									<p className="text-[9px] text-muted-foreground/50 mt-0.5 font-mono">
										{idx.columns.join(", ")}
									</p>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Foreign Keys */}
				{(outgoingFKs.length > 0 || incomingFKs.length > 0) && (
					<div>
						<p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50 mb-1.5">
							Foreign Keys
						</p>
						<div className="space-y-1">
							{outgoingFKs.map((fk) => (
								<div
									key={fk.name}
									className="rounded-md border border-accent-blue/20 bg-accent-blue/5 px-2.5 py-1.5"
								>
									<div className="flex items-center gap-1 text-accent-blue/80 mb-0.5">
										<Link2 size={9} />
										<span className="text-[9px] font-bold uppercase tracking-wider">
											→ {fk.targetTable}
										</span>
									</div>
									<p className="text-[9px] font-mono text-muted-foreground/60">
										{fk.sourceColumns.join(", ")} → {fk.targetColumns.join(", ")}
									</p>
								</div>
							))}
							{incomingFKs.map((fk) => (
								<div
									key={fk.name}
									className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-1.5"
								>
									<div className="flex items-center gap-1 text-muted-foreground/60 mb-0.5">
										<Link2 size={9} />
										<span className="text-[9px] font-bold uppercase tracking-wider">
											← {fk.sourceTable}
										</span>
									</div>
									<p className="text-[9px] font-mono text-muted-foreground/50">
										{fk.sourceColumns.join(", ")} → {fk.targetColumns.join(", ")}
									</p>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</ScrollArea>
	);
}
