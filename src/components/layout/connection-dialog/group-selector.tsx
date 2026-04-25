import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GROUP_PRESETS } from "@/components/layout/connection-dialog-modal";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
		<div className="flex flex-col gap-2">
			<ToggleGroup
				type="single"
				value={GROUP_PRESETS.find((preset) => preset.id === group)?.id ?? ""}
				onValueChange={(value) => {
					onChange(value || undefined);
					setCustomGroup("");
				}}
				variant="outline"
				size="sm"
				spacing={1}
				className="flex w-full flex-wrap"
			>
				{GROUP_PRESETS.map(({ id, label, icon: Icon, activeClass }) => (
					<ToggleGroupItem
						key={id}
						value={id}
						className={cn(
							"gap-1.5 px-2.5 text-xs font-medium capitalize",
							activeClass,
							"data-[state=off]:border-border/60 data-[state=off]:bg-transparent data-[state=off]:text-muted-foreground/60 data-[state=off]:hover:border-border data-[state=off]:hover:text-foreground"
						)}
					>
						<Icon data-icon="inline-start" className="size-3" />
						{label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			{/* Custom group input */}
			<div className="relative">
				<Input
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
						"h-8 pr-8 text-xs",
						"placeholder:text-muted-foreground/35",
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
