import { Database } from "lucide-react";
import { ConnectionFunction, TableInfo } from "@/types";

export function TableListView({
	fn,
	tables,
	onTableClick,
}: {
	fn: ConnectionFunction;
	tables: TableInfo[];
	onTableClick: (tableName: string) => void;
}) {
	return (
		<div className="h-full flex flex-col bg-background overflow-hidden">
			<div className="h-9 px-4 flex items-center border-b border-border shrink-0">
				<span className="font-mono text-[11px] text-accent-blue font-bold">
					{fn.callSignature
						.slice(fn.prefix.length + 1)
						.replace(/\(.*$/, "")}
				</span>
				<span className="ml-auto text-[10px] font-mono text-muted-foreground/40">
					{tables.length} tables
				</span>
			</div>
			<div className="flex-1 overflow-auto scrollbar-thin">
				<table className="w-full text-[11px] font-mono">
					<thead className="sticky top-0 bg-card">
						<tr>
							<th className="h-8 px-4 text-left font-bold text-muted-foreground border-b border-border">
								Table
							</th>
							<th className="h-8 px-4 text-left font-bold text-muted-foreground border-b border-border">
								Schema / DB
							</th>
						</tr>
					</thead>
					<tbody>
						{tables.map((t) => (
							<tr
								key={`${t.schema}-${t.name}`}
								onClick={() => onTableClick(t.name)}
								className="hover:bg-primary/10 cursor-pointer transition-colors border-b border-border group"
							>
								<td className="h-8 px-4 text-foreground/90">
									<div className="flex items-center gap-2">
										<Database
											size={11}
											className="text-accent-blue/50 shrink-0"
										/>
										<span className="group-hover:text-accent-blue transition-colors">
											{t.name}
										</span>
									</div>
								</td>
								<td className="h-8 px-4 text-muted-foreground/50">
									{t.schema ?? "—"}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
