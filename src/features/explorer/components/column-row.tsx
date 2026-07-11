import { Key, Clock, Hash, AlignJustify, Braces, ToggleLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColumnInfo } from "@/types";

function ColumnIcon({ col }: { col: ColumnInfo }) {
    const t = col.dataType?.toLowerCase() ?? "";
    if (col.isPrimary)
        return <Key size={9} className="shrink-0 text-amber-400/80" />;
    if (t.includes("timestamp") || t.includes("date") || t.includes("time"))
        return <Clock size={9} className="shrink-0 text-violet-400/60" />;
    if (t.includes("int") || t.includes("numeric") || t.includes("float") || t.includes("decimal") || t.includes("serial"))
        return <Hash size={9} className="shrink-0 text-blue-400/60" />;
    if (t.includes("bool"))
        return <ToggleLeft size={9} className="shrink-0 text-emerald-400/60" />;
    if (t.includes("json"))
        return <Braces size={9} className="shrink-0 text-orange-400/60" />;
    return <AlignJustify size={9} className="shrink-0 text-muted-foreground/35" />;
}

function typeShort(dataType: string): string {
    const t = dataType.toLowerCase();
    if (t.includes("varchar") || t.includes("character varying")) return "varchar";
    if (t.includes("timestamp")) return "ts";
    if (t.includes("bigint")) return "int8";
    if (t.includes("integer") || t === "int") return "int";
    if (t.includes("boolean") || t === "bool") return "bool";
    if (t.includes("jsonb")) return "jsonb";
    if (t.includes("json")) return "json";
    if (t.includes("serial")) return "serial";
    if (t.includes("float") || t.includes("double")) return "float";
    if (t.includes("decimal") || t.includes("numeric")) return "num";
    if (t.includes("uuid")) return "uuid";
    if (t.includes("text")) return "text";
    if (t.includes("blob")) return "blob";
    if (t.includes("real")) return "real";
    return t.length > 8 ? t.slice(0, 8) : t;
}

export function ColumnRow({ col, isLast }: { col: ColumnInfo; isLast?: boolean }) {
    return (
        <div className={cn(
            "group relative flex items-center gap-1.5 h-[24px] pl-3 pr-2 transition-colors",
            "text-muted-foreground/50 hover:text-foreground hover:bg-muted/30",
            col.isPrimary && "text-muted-foreground/70",
        )}>
            {/* Connector tick */}
            <div className={cn(
                "absolute left-0 top-1/2 w-2.5 border-t border-border/40",
                isLast && "-translate-y-px",
            )} />

            <ColumnIcon col={col} />

            <span className={cn(
                "text-[10px] font-mono truncate flex-1 min-w-0",
                col.isPrimary && "font-medium text-amber-400/90",
            )}>
                {col.name}
            </span>

            {/* Type badge */}
            <span className="shrink-0 text-[8.5px] font-mono text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
                {typeShort(col.dataType ?? "")}
            </span>

            {/* PK badge */}
            {col.isPrimary && (
                <span className="shrink-0 text-[7px] font-bold uppercase tracking-wide px-1 h-[12px] flex items-center rounded bg-amber-400/10 text-amber-400/70 border border-amber-400/20">
                    PK
                </span>
            )}
        </div>
    );
}
