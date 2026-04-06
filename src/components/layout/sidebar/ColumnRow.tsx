import { Key, Clock, Hash, AlignJustify, Braces, ToggleLeft } from "lucide-react";
import { ColumnInfo } from "@/types";

function ColumnIcon({ col }: { col: ColumnInfo }) {
	const t = col.dataType?.toLowerCase() ?? "";
	if (col.isPrimary)
		return <Key size={9} className="shrink-0 text-accent-orange/70" />;
	if (t.includes("timestamp") || t.includes("date") || t.includes("time"))
		return <Clock size={9} className="shrink-0 text-muted-foreground/40" />;
	if (t.includes("int") || t.includes("numeric") || t.includes("float") || t.includes("decimal") || t.includes("serial"))
		return <Hash size={9} className="shrink-0 text-muted-foreground/40" />;
	if (t.includes("bool"))
		return <ToggleLeft size={9} className="shrink-0 text-muted-foreground/40" />;
	if (t.includes("json"))
		return <Braces size={9} className="shrink-0 text-muted-foreground/40" />;
	return <AlignJustify size={9} className="shrink-0 text-muted-foreground/35" />;
}

export function ColumnRow({ col }: { col: ColumnInfo }) {
	return (
		<div className="flex items-center gap-1.5 h-[22px] pl-1 pr-2 text-muted-foreground/55 hover:text-muted-foreground transition-colors">
			<ColumnIcon col={col} />
			<span className="text-[10px] font-mono truncate flex-1">{col.name}</span>
			<span className="text-[9px] font-mono text-muted-foreground/30 shrink-0">
				{col.dataType}
			</span>
		</div>
	);
}
