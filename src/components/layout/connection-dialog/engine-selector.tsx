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
		<div className="flex shrink-0 border-b border-border-subtle bg-surface-2">
			{DATABASE_ENGINES.map((engine, i) => {
				const isActive = selectedType === engine.id;
				const Logo = DB_LOGOS[engine.id];
				return (
					<button
						key={engine.id}
						type="button"
						onClick={() => onSelect(engine.id)}
						className={cn(
							"group relative flex flex-1 flex-col items-center gap-1.5 py-3 px-2 text-center transition-colors",
							i < DATABASE_ENGINES.length - 1 && "border-r border-border-subtle",
							isActive
								? "bg-surface-1 text-foreground"
								: "bg-surface-2 text-muted-foreground/60 hover:bg-surface-hover hover:text-foreground/80",
						)}
					>
					<Logo
						className={cn(
							"text-xl transition-opacity",
							DB_COLOR[engine.id],
							isActive ? "opacity-100" : "opacity-40 group-hover:opacity-70",
						)}
					/>
						<span className={cn(
							"text-xs font-medium leading-none",
							isActive ? "text-foreground" : "text-muted-foreground/60 group-hover:text-foreground/80",
						)}>
							{engine.label}
						</span>
						{isActive && (
							<span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
						)}
					</button>
				);
			})}
		</div>
	);
}
