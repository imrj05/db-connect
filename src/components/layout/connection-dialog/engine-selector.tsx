import { cn } from "@/lib/utils";
import { DB_LOGO as DB_LOGOS, DB_COLOR } from "@/lib/db-ui";

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
	return (
		<div className="shrink-0 border-b border-border-subtle bg-card px-4 py-2">
			<div className="grid grid-cols-5 gap-1.5">
			{DATABASE_ENGINES.map((engine) => {
				const isActive = selectedType === engine.id;
				const Logo = DB_LOGOS[engine.id];
				return (
					<button
						key={engine.id}
						type="button"
						onClick={() => onSelect(engine.id)}
						className={cn(
							"group relative flex min-w-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left transition-colors",
							isActive
								? "border-primary/30 bg-primary/8 text-foreground"
								: "border-border-subtle bg-surface-elevated text-muted-foreground/62 hover:border-border hover:bg-surface-hover hover:text-foreground/80",
						)}
					>
					<Logo
						className={cn(
							"shrink-0 text-lg transition-opacity",
							DB_COLOR[engine.id],
							isActive ? "opacity-100" : "opacity-40 group-hover:opacity-70",
						)}
					/>
						<div className="min-w-0">
							<span className={cn(
								"block truncate text-xs font-semibold leading-none",
								isActive ? "text-foreground" : "text-muted-foreground/70 group-hover:text-foreground/80",
							)}>
								{engine.label}
							</span>
							<span className="mt-0.5 hidden truncate text-[10px] text-muted-foreground/48 xl:block">
								{engine.description}
							</span>
						</div>
						{isActive && (
							<span className="absolute inset-x-3 bottom-0 h-px bg-primary" />
						)}
					</button>
				);
			})}
			</div>
		</div>
	);
}
