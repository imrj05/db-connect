import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GROUP_PRESETS } from "@/components/layout/ConnectionDialog";

export function GroupSelector({
	group,
	onChange,
}: {
	group: string | undefined;
	onChange: (group: string | undefined) => void;
}) {
	const [customGroup, setCustomGroup] = useState(
		group && !GROUP_PRESETS.find((p) => p.id === group) ? group : "",
	);

	return (
		<div className="space-y-2">
			{/* Preset pills */}
			<div className="flex flex-wrap gap-1.5">
				{GROUP_PRESETS.map(({ id, label, icon: Icon, activeClass }) => {
					const isActive = group === id;
					return (
						<button
							key={id}
							type="button"
							onClick={() => {
								onChange(isActive ? undefined : id);
								setCustomGroup("");
							}}
							className={cn(
								"flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-all",
								isActive
									? activeClass
									: "border-border/60 text-muted-foreground/60 hover:border-border hover:text-foreground bg-transparent",
							)}
						>
							<Icon size={11} />
							{label}
						</button>
					);
				})}
			</div>
			{/* Custom group input */}
			<div className="relative">
				<input
					type="text"
					placeholder="Custom group…"
					value={
						group && !GROUP_PRESETS.find((p) => p.id === group)
							? group
							: customGroup
					}
					onChange={(e) => {
						const val = e.target.value;
						setCustomGroup(val);
						onChange(val || undefined);
					}}
					onFocus={() => {
						if (GROUP_PRESETS.find((p) => p.id === group)) {
							onChange(undefined);
						}
					}}
					className={cn(
						"w-full h-8 px-3 rounded-md border bg-transparent text-xs outline-none transition-colors",
						"placeholder:text-muted-foreground/35 text-foreground",
						"border-border/60 focus:border-border",
					)}
				/>
				{customGroup && !GROUP_PRESETS.find((p) => p.id === group) && group && (
					<button
						type="button"
						onClick={() => {
							setCustomGroup("");
							onChange(undefined);
						}}
						className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
					>
						<X size={11} />
					</button>
				)}
			</div>
		</div>
	);
}
