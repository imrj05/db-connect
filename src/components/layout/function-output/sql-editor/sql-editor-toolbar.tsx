import { useRef } from "react";
import { Play, Loader2, Search, AlignLeft, BookmarkPlus, Check, X, Eye, Bot, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SqlEditorToolbar({
	isLoading,
	hasSql,
	saveOpen,
	saveName,
	aiEnabled,
	aiConfigured,
	statementCount,
	onPreview,
	onExecute,
	onRunAll,
	onExplain,
	onFormat,
	onSaveOpen,
	onAiOpen,
	onSaveNameChange,
	onSaveConfirm,
	onSaveCancel,
}: {
	isLoading: boolean;
	hasSql: boolean;
	saveOpen: boolean;
	saveName: string;
	aiEnabled: boolean;
	aiConfigured: boolean;
	statementCount?: number;
	onPreview: () => void;
	onExecute: (sql?: string) => void | Promise<void>;
	onRunAll?: () => void | Promise<void>;
	onExplain: () => void | Promise<void>;
	onFormat: () => void;
	onSaveOpen: () => void;
	onAiOpen: () => void;
	onSaveNameChange: (name: string) => void;
	onSaveConfirm: () => void;
	onSaveCancel: () => void;
}) {
	const saveInputRef = useRef<HTMLInputElement>(null);

	return (
		<div className="h-10 bg-background border-t border-border flex items-center justify-between px-3 shrink-0 select-none gap-2">
			<div className="flex items-center gap-1.5">
				<Button
					variant="ghost"
					size="sm"
					onClick={onAiOpen}
					className="h-7 text-[11px] font-medium gap-1.5 text-accent-blue/80 hover:text-accent-blue"
				>
					<Bot size={11} />
					AI
					<span
						className={cn(
							"ml-0.5 inline-flex h-4 items-center rounded-sm px-1 text-[8px] font-bold tracking-wider",
						aiEnabled && aiConfigured
							? "bg-accent-green/12 text-accent-green"
							: "bg-warning/12 text-warning",
						)}
					>
						{aiEnabled && aiConfigured ? "READY" : "SETUP"}
					</span>
				</Button>
				<Button
					variant="ghost"
					size="sm"
					disabled={!hasSql}
					onClick={onPreview}
					className="h-7 text-[11px] font-medium gap-1.5 text-muted-foreground/60 hover:text-foreground"
				>
					<Eye size={11} />
					Preview
				</Button>
				<Button
					onClick={() => onExecute()}
					disabled={isLoading || !hasSql}
					variant="outline"
					size="sm"
					className={cn(
						"h-7 text-[11px] font-semibold gap-2 border-border/60 bg-surface-elevated/90",
						!isLoading && hasSql
							? "text-accent-green border-primary/40 hover:border-primary/70 hover:bg-surface-3 hover:text-accent-green"
							: "text-muted-foreground/40",
					)}
				>
					{isLoading ? (
						<Loader2 className="size-3 animate-spin" />
					) : (
						<Play size={11} className="fill-current" />
					)}
					Run
					<span className="text-[10px] font-mono text-muted-foreground/60">Cmd+Enter</span>
				</Button>
				{/* Feature 5: Run All button for multi-statement SQL */}
				{(statementCount ?? 0) > 1 && onRunAll && (
					<Button
						onClick={() => void onRunAll()}
						disabled={isLoading || !hasSql}
						variant="outline"
						size="sm"
						className={cn(
							"h-7 text-[11px] font-semibold gap-2 border-border/60 bg-surface-elevated/90",
							!isLoading && hasSql
								? "text-accent-blue border-accent-blue/40 hover:border-accent-blue/70 hover:bg-surface-3"
								: "text-muted-foreground/40",
						)}
					>
						<ListOrdered size={11} />
						Run All ({statementCount})
					</Button>
				)}
				<Button
					variant="ghost"
					size="sm"
					disabled={isLoading || !hasSql}
					onClick={onExplain}
					className="h-7 text-[11px] font-medium gap-1.5 text-muted-foreground/60 hover:text-foreground"
				>
					<Search size={11} />
					Explain
				</Button>
				<Button
					variant="ghost"
					size="sm"
					disabled={!hasSql}
					onClick={onFormat}
					className="h-7 text-[11px] font-medium gap-1.5 text-muted-foreground/60 hover:text-foreground"
				>
					<AlignLeft size={11} />
					Format
				</Button>
			</div>
			{/* Save query inline UI */}
			<div className="flex items-center gap-1 ml-auto">
				{saveOpen ? (
					<>
						<Input
							ref={saveInputRef}
							value={saveName}
							onChange={(e) => onSaveNameChange(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") onSaveConfirm();
								if (e.key === "Escape") onSaveCancel();
							}}
							placeholder="Query name…"
							className="h-6 text-[11px] font-mono w-36"
							autoFocus
						/>
						<Button
							variant="ghost"
							size="icon-xs"
							onClick={onSaveConfirm}
							disabled={!saveName.trim() || !hasSql}
							className="size-6 text-accent-green"
						>
							<Check size={10} />
						</Button>
						<Button
							variant="ghost"
							size="icon-xs"
							onClick={onSaveCancel}
							className="size-6 text-muted-foreground/40"
						>
							<X size={10} />
						</Button>
					</>
				) : (
					<Button
						variant="ghost"
						size="xs"
						onClick={onSaveOpen}
						disabled={!hasSql}
						className="h-6 text-[10px] font-medium text-muted-foreground/55 gap-1"
					>
						<BookmarkPlus size={10} />
						Save
					</Button>
				)}
			</div>
		</div>
	);
}
