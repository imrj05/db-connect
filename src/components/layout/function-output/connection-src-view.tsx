import React from "react";
import { Hash, Database, Server, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionFunction } from "@/types";

interface ConnectionInfo {
	connectionId: string;
	name: string;
	prefix: string;
	type: string;
	host?: string;
	port?: number;
	database?: string;
	ssl?: boolean;
	tableCount: number;
}

function InfoCard({
	icon,
	label,
	value,
	mono = false,
	accent,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	mono?: boolean;
	accent?: "emerald" | "zinc";
}) {
	return (
		<div className="bg-card rounded-xl p-3 border border-border flex flex-col gap-1.5">
			<div className="flex items-center gap-1.5 text-muted-foreground/50">
				{icon}
				<span className="text-[9px] font-bold uppercase tracking-widest">
					{label}
				</span>
			</div>
			<span
				className={cn(
					"text-[12px] font-semibold",
					mono ? "font-mono" : "",
					accent === "emerald"
						? "text-accent-green"
						: accent === "zinc"
							? "text-muted-foreground"
							: "text-foreground",
				)}
			>
				{value}
			</span>
		</div>
	);
}

export function ConnectionSrcView({
	fn,
	info,
}: {
	fn: ConnectionFunction;
	info: ConnectionInfo;
}) {
	return (
		<div className="h-full flex flex-col bg-background overflow-hidden">
			<div className="h-9 px-4 flex items-center border-b border-border shrink-0">
				<span className="font-mono text-[11px] text-accent-blue font-bold">
					{fn.callSignature
						.slice(fn.prefix.length + 1)
						.replace(/\(.*$/, "")}
				</span>
			</div>
			<div className="flex-1 p-8 flex items-start justify-center">
				<div className="w-full max-w-lg space-y-4">
					{/* Connection name + type badge */}
					<div className="flex items-center gap-3">
						<div className="size-10 bg-primary rounded-xl flex items-center justify-center font-bold text-foreground text-[11px] shrink-0">
							{info.type.substring(0, 2).toUpperCase()}
						</div>
						<div>
							<h2 className="text-base font-bold text-foreground tracking-tight">
								{info.name}
							</h2>
							<p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
								{info.type}
							</p>
						</div>
					</div>
					{/* Info grid */}
					<div className="grid grid-cols-2 gap-3 pt-2">
						<InfoCard
							icon={<Hash size={14} />}
							label="Prefix"
							value={`${info.prefix}_`}
							mono
						/>
						<InfoCard
							icon={<Database size={14} />}
							label="Tables"
							value={String(info.tableCount)}
						/>
						{info.host && (
							<InfoCard
								icon={<Server size={14} />}
								label="Host"
								value={`${info.host}:${info.port ?? ""}`}
								mono
							/>
						)}
						{info.database && (
							<InfoCard
								icon={<Database size={14} />}
								label="Database"
								value={info.database}
								mono
							/>
						)}
						<InfoCard
							icon={<Lock size={14} />}
							label="SSL"
							value={info.ssl ? "Enabled" : "Disabled"}
							accent={info.ssl ? "emerald" : "zinc"}
						/>
					</div>
					{/* Generated functions preview */}
					<div className="pt-2">
						<p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">
							Generated Functions
						</p>
						<div className="bg-background rounded-xl p-4 border border-border">
							<div className="flex flex-col gap-1">
								{[
									`${info.prefix}_list()`,
									`${info.prefix}_src()`,
									`${info.prefix}_query(sql)`,
									`${info.prefix}_execute(sql)`,
									`${info.prefix}_tbl(table)`,
									`${info.prefix}_tableName() × ${info.tableCount}`,
								].map((fnStr) => (
									<span
										key={fnStr}
										className="text-[11px] font-mono text-muted-foreground/60"
									>
										{fnStr}
									</span>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
