import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DB_LOGO as DB_LOGOS } from "@/lib/db-ui";

const DATABASE_ENGINES = [
	{ id: "postgresql", label: "PostgreSQL", description: "Advanced open source RDBMS" },
	{ id: "mysql",      label: "MySQL",      description: "Most popular open source DB" },
	{ id: "sqlite",     label: "SQLite",     description: "Lightweight embedded database" },
	{ id: "mongodb",    label: "MongoDB",    description: "Flexible document database" },
	{ id: "redis",      label: "Redis",      description: "In-memory data structure store" },
] as const;

export { DATABASE_ENGINES };

export function EngineSelector({
	selectedType,
	onSelect,
}: {
	selectedType: string;
	onSelect: (id: string) => void;
}) {
	const activeEngine = DATABASE_ENGINES.find((e) => e.id === selectedType) ?? DATABASE_ENGINES[0];

	return (
		<div className="w-52 shrink-0 bg-muted/20 border-r border-border flex flex-col">
			{/* Panel header */}
			<div className="h-16 px-4 flex items-end pb-3.5 border-b border-border">
				<span className="text-[10px] font-semibold text-muted-foreground/55">
					Engine
				</span>
			</div>

			{/* Engine list */}
			<div className="flex-1 p-2.5 space-y-1 overflow-y-auto">
				{DATABASE_ENGINES.map((engine) => {
					const isActive = selectedType === engine.id;
					const Logo = DB_LOGOS[engine.id];
					return (
						<button
							key={engine.id}
							onClick={() => onSelect(engine.id)}
							className={cn(
							"w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors text-left group",
								isActive
									? "bg-card border border-border shadow-sm"
									: "border border-transparent hover:bg-muted/50",
							)}
						>
							<div className={cn(
								"size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
								isActive ? "bg-muted" : "bg-muted/40 opacity-50 group-hover:opacity-75",
							)}>
								<Logo className={cn("text-base", isActive ? "text-foreground" : "text-muted-foreground")} />
							</div>

							<div className="min-w-0 flex-1">
								<div className={cn(
									"text-[11px] font-semibold leading-none",
									isActive ? "text-foreground" : "text-muted-foreground",
								)}>
									{engine.label}
								</div>
								<div className="text-[9px] text-muted-foreground/40 mt-0.5 leading-tight truncate">
									{engine.description}
								</div>
							</div>

							{isActive && (
								<ChevronRight size={11} className="shrink-0 text-muted-foreground/40" />
							)}
						</button>
					);
				})}
			</div>

			{/* Panel footer */}
			<div className="p-3.5 border-t border-border">
				<div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/40">
					{(() => {
						const Logo = DB_LOGOS[activeEngine.id];
						return <Logo className="text-sm text-muted-foreground/60 shrink-0" />;
					})()}
					<span className="text-[10px] font-semibold text-muted-foreground/60 truncate">
						{activeEngine.label}
					</span>
				</div>
			</div>
		</div>
	);
}
