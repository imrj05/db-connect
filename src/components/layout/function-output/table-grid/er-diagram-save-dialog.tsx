import { AlertTriangle, Check, ChevronDown, ChevronRight, Copy, Play, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CategorizedChanges, DdlStatement } from "@/lib/schema-diff/types";

type SaveDialogProps = {
	open: boolean;
	onClose: () => void;
	onRun: () => void;
	categorized: CategorizedChanges;
	ddlStatements: DdlStatement[];
	isRunning: boolean;
	engine: "postgres" | "mysql" | "sqlite";
};

export function ERDiagramSaveDialog({
	open,
	onClose,
	onRun,
	categorized,
	ddlStatements,
	isRunning,
	engine,
}: SaveDialogProps) {
	const [showSql, setShowSql] = useState(false);
	const [copied, setCopied] = useState(false);

	const allSql = ddlStatements.map((s) => s.sql).join("\n\n");

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(allSql);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// fallback
		}
	};

	const totalChanges =
		categorized.creates.length +
		categorized.drops.length +
		categorized.alters.length +
		categorized.renames.length;

	if (totalChanges === 0) {
		return (
			<Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>No changes detected</DialogTitle>
						<DialogDescription>
							The draft schema matches the current schema. Nothing to apply.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" size="sm" onClick={onClose}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						Review Schema Changes
						<Badge variant="outline" className="text-[10px] font-mono">
							{engine}
						</Badge>
					</DialogTitle>
					<DialogDescription>
						{totalChanges} change{totalChanges === 1 ? "" : "s"} detected.
						{categorized.hasDestructive && (
							<span className="text-destructive font-semibold ml-1">
								Destructive changes included!
							</span>
						)}
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-auto space-y-4 min-h-0">
					{/* Destructive warning */}
					{categorized.hasDestructive && (
						<div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
							<AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
							<div className="text-[11px] text-destructive/80">
								<p className="font-semibold">Warning: Destructive Changes</p>
								<p className="mt-0.5">
									Some changes will drop tables, columns, or foreign keys.
									{categorized.drops.length > 0 && (
										<span> This may result in data loss.</span>
									)}
									{categorized.alters.some((a) => a.change.type === "rebuildTable") && (
										<span> SQLite table rebuilds preserve data but drop and recreate the table.</span>
									)}
								</p>
							</div>
						</div>
					)}

					{/* Change categories */}
					<Sections
						label="Create"
						count={categorized.creates.length}
						color="text-accent-green"
						bg="bg-accent-green/10"
						items={categorized.creates.map((c) => c.description)}
					/>
					<Sections
						label="Drop"
						count={categorized.drops.length}
						color="text-destructive"
						bg="bg-destructive/10"
						items={categorized.drops.map((c) => c.description)}
					/>
					<Sections
						label="Alter"
						count={categorized.alters.length}
						color="text-accent-blue"
						bg="bg-accent-blue/10"
						items={categorized.alters.map((c) => c.description)}
					/>
					<Sections
						label="Rename"
						count={categorized.renames.length}
						color="text-accent-orange"
						bg="bg-accent-orange/10"
						items={categorized.renames.map((c) => c.description)}
					/>

					{/* SQL Preview */}
					<div>
						<button
							type="button"
							onClick={() => setShowSql(!showSql)}
							className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground/70 hover:text-foreground transition-colors"
						>
							{showSql ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
							Generated SQL ({ddlStatements.length} statement{ddlStatements.length === 1 ? "" : "s"})
						</button>
						{showSql && (
							<div className="mt-2 relative">
								<pre className="text-[10px] font-mono text-foreground/80 bg-muted/40 rounded-lg p-3 overflow-auto max-h-[300px] whitespace-pre-wrap break-all">
									{allSql || "-- No SQL generated"}
								</pre>
								<Button
									variant="ghost"
									size="icon-xs"
									onClick={handleCopy}
									className="absolute top-2 right-2"
									title="Copy SQL"
								>
									{copied ? <Check size={12} className="text-accent-green" /> : <Copy size={12} />}
								</Button>
							</div>
						)}
					</div>
				</div>

				<DialogFooter className="gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleCopy}
						className="gap-1"
					>
						<Copy size={12} />
						Copy SQL
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={onClose}
					>
						<X size={12} className="mr-1" />
						Cancel
					</Button>
					<Button
						size="sm"
						onClick={onRun}
						disabled={isRunning || totalChanges === 0}
						className={cn(
							"gap-1",
							categorized.hasDestructive
								? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
								: "",
						)}
					>
						<Play size={12} />
						{isRunning ? "Running..." : categorized.hasDestructive ? "Run (Destructive)" : "Run"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function Sections({
	label,
	count,
	color,
	bg,
	items,
}: {
	label: string;
	count: number;
	color: string;
	bg: string;
	items: string[];
}) {
	const [expanded, setExpanded] = useState(false);
	if (count === 0) return null;

	return (
		<div>
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex items-center gap-2 text-[11px] font-semibold transition-colors"
			>
				{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
				<span className={cn("rounded px-1.5 py-0.5 text-[10px]", bg, color)}>
					{label}
				</span>
				<span className="text-muted-foreground/60">{count} change{count === 1 ? "" : "s"}</span>
			</button>
			{expanded && (
				<ul className="mt-1 ml-5 space-y-0.5">
					{items.map((item, i) => (
						<li key={i} className="text-[10px] font-mono text-muted-foreground/70">
							{item}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
