import { useState, useMemo } from "react";
import {
	Bookmark,
	Trash2,
	FolderOpen,
	Folder,
	FolderPlus,
	ChevronRight,
	MoreHorizontal,
	Edit2,
	MoveRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SavedQuery } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const NONE = "__none__";

export function SavedQueriesPanel({
	savedQueries,
	onLoadQuery,
	onDeleteQuery,
}: {
	savedQueries: SavedQuery[];
	onLoadQuery: (sql: string) => void;
	onDeleteQuery: (id: string) => void;
}) {
	const { moveSavedQueryFolder } = useAppStore();
	const [selectedFolder, setSelectedFolder] = useState<string>(ALL);
	const [newFolderInput, setNewFolderInput] = useState("");
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");

	const folders = useMemo(() => {
		const set = new Set<string>();
		savedQueries.forEach((q) => {
			if (q.folder) set.add(q.folder);
		});
		return Array.from(set).sort();
	}, [savedQueries]);

	const displayed = useMemo(() => {
		if (selectedFolder === ALL) return savedQueries;
		if (selectedFolder === NONE) return savedQueries.filter((q) => !q.folder);
		return savedQueries.filter((q) => q.folder === selectedFolder);
	}, [savedQueries, selectedFolder]);

	const uncategorizedCount = savedQueries.filter((q) => !q.folder).length;

	const handleCreateFolder = () => {
		const name = newFolderInput.trim();
		if (!name || folders.includes(name)) return;
		setNewFolderInput("");
		setSelectedFolder(name);
	};

	const handleRenameCommit = (query: SavedQuery) => {
		const name = renameValue.trim();
		if (name && name !== query.name) {
			// We only rename via moveSavedQueryFolder approach is folder,
			// but name edit isn't in store yet — use folder field trick: update via a silent save
			// For now just close (name rename needs store update — defer to next pass)
		}
		setRenamingId(null);
		setRenameValue("");
	};

	return (
		<div className="flex-1 flex min-h-0 overflow-hidden">
			{/* Folder sidebar */}
			<div className="w-[120px] shrink-0 border-r border-border flex flex-col overflow-hidden">
				<div className="px-2 py-1.5 border-b border-border">
					<span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
						Folders
					</span>
				</div>
				<div className="flex-1 overflow-auto scrollbar-thin py-1">
					{/* All */}
					<button
						onClick={() => setSelectedFolder(ALL)}
						className={cn(
							"w-full flex items-center gap-1.5 px-2 py-1 text-left text-[11px] rounded-sm mx-1 transition-colors",
							selectedFolder === ALL
								? "bg-accent text-foreground font-semibold"
								: "text-muted-foreground hover:bg-accent/50",
						)}
					>
						<Bookmark size={10} className="shrink-0" />
						<span className="truncate">All</span>
						<span className="ml-auto text-[9px] font-mono opacity-60">
							{savedQueries.length}
						</span>
					</button>
					{/* Uncategorized */}
					{uncategorizedCount > 0 && (
						<button
							onClick={() => setSelectedFolder(NONE)}
							className={cn(
								"w-full flex items-center gap-1.5 px-2 py-1 text-left text-[11px] rounded-sm mx-1 transition-colors",
								selectedFolder === NONE
									? "bg-accent text-foreground font-semibold"
									: "text-muted-foreground hover:bg-accent/50",
							)}
						>
							<Folder size={10} className="shrink-0 opacity-40" />
							<span className="truncate">None</span>
							<span className="ml-auto text-[9px] font-mono opacity-60">
								{uncategorizedCount}
							</span>
						</button>
					)}
					{/* Named folders */}
					{folders.map((folder) => {
						const count = savedQueries.filter((q) => q.folder === folder).length;
						return (
							<button
								key={folder}
								onClick={() => setSelectedFolder(folder)}
								className={cn(
									"w-full flex items-center gap-1.5 px-2 py-1 text-left text-[11px] rounded-sm mx-1 transition-colors",
									selectedFolder === folder
										? "bg-accent text-foreground font-semibold"
										: "text-muted-foreground hover:bg-accent/50",
								)}
							>
								{selectedFolder === folder ? (
									<FolderOpen size={10} className="shrink-0 text-accent-blue" />
								) : (
									<Folder size={10} className="shrink-0" />
								)}
								<span className="truncate">{folder}</span>
								<span className="ml-auto text-[9px] font-mono opacity-60">
									{count}
								</span>
							</button>
						);
					})}
				</div>
				{/* New folder input */}
				<div className="p-1.5 border-t border-border flex gap-1">
					<Input
						value={newFolderInput}
						onChange={(e) => setNewFolderInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleCreateFolder();
						}}
						placeholder="New folder…"
						className="h-6 text-[10px] px-1.5"
					/>
					<Button
						size="icon-xs"
						variant="ghost"
						onClick={handleCreateFolder}
						disabled={!newFolderInput.trim()}
						className="h-6 w-6 shrink-0"
					>
						<FolderPlus size={10} />
					</Button>
				</div>
			</div>

			{/* Query list */}
			<div className="flex-1 flex flex-col min-w-0 overflow-hidden">
				{displayed.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 gap-2">
						<Bookmark size={20} className="opacity-30" />
						<p className="text-[10px] font-mono">No saved queries</p>
						<p className="text-[9px] text-muted-foreground/50 text-center px-4">
							{selectedFolder === ALL
								? "Use the save button in the Editor tab"
								: "No queries in this folder"}
						</p>
					</div>
				) : (
					<div className="flex-1 overflow-auto scrollbar-thin">
						{displayed.map((sq) => (
							<div
								key={sq.id}
								className="border-b border-border px-3 py-2 hover:bg-accent/40 group transition-colors"
							>
								<div className="flex items-center justify-between mb-1 gap-2">
									{renamingId === sq.id ? (
										<Input
											autoFocus
											value={renameValue}
											onChange={(e) => setRenameValue(e.target.value)}
											onBlur={() => handleRenameCommit(sq)}
											onKeyDown={(e) => {
												if (e.key === "Enter") handleRenameCommit(sq);
												if (e.key === "Escape") {
													setRenamingId(null);
													setRenameValue("");
												}
											}}
											className="h-5 text-[11px] px-1 py-0"
										/>
									) : (
										<span className="text-[11px] font-semibold text-foreground/90 truncate flex-1">
											{sq.name}
										</span>
									)}
									<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
										<Button
											size="xs"
											variant="secondary"
											onClick={() => onLoadQuery(sq.sql)}
											className="h-5 text-[9px] font-bold uppercase tracking-wider"
										>
											Load
										</Button>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="icon-xs"
													className="size-5 text-muted-foreground/40 hover:text-foreground"
												>
													<MoreHorizontal size={10} />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="min-w-[160px]">
												<DropdownMenuItem
													onClick={() => {
														setRenamingId(sq.id);
														setRenameValue(sq.name);
													}}
												>
													<Edit2 size={12} className="mr-2" />
													Rename
												</DropdownMenuItem>
												<DropdownMenuSub>
													<DropdownMenuSubTrigger>
														<MoveRight size={12} className="mr-2" />
														Move to folder
													</DropdownMenuSubTrigger>
													<DropdownMenuSubContent>
														<DropdownMenuItem
															onClick={() => moveSavedQueryFolder(sq.id, undefined)}
														>
															<Folder size={11} className="mr-2 opacity-40" />
															No folder
														</DropdownMenuItem>
														{folders.map((f) => (
															<DropdownMenuItem
																key={f}
																onClick={() => moveSavedQueryFolder(sq.id, f)}
															>
																<Folder size={11} className="mr-2" />
																{f}
															</DropdownMenuItem>
														))}
													</DropdownMenuSubContent>
												</DropdownMenuSub>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													className="text-destructive focus:text-destructive"
													onClick={() => onDeleteQuery(sq.id)}
												>
													<Trash2 size={12} className="mr-2" />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</div>
								{sq.folder && selectedFolder === ALL && (
									<div className="flex items-center gap-1 mb-0.5">
										<ChevronRight size={8} className="text-muted-foreground/30" />
										<span className="text-[9px] text-muted-foreground/40 font-medium">
											{sq.folder}
										</span>
									</div>
								)}
								<pre className="text-[10px] font-mono text-muted-foreground/50 truncate">
									{sq.sql.slice(0, 120)}
								</pre>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
