import { cn } from "@/lib/utils";
import { GROUP_PRESETS } from "@/components/layout/connection-dialog-modal";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function GroupSelector({
	group,
	onChange,
}: {
	group: string | undefined;
	onChange: (group: string | undefined) => void;
}) {
	return (
		<ToggleGroup
			type="single"
			value={GROUP_PRESETS.find((p) => p.id === group)?.id ?? ""}
			onValueChange={(value) => onChange(value || undefined)}
			variant="outline"
			size="sm"
			spacing={0}
			className="flex w-full"
		>
			{GROUP_PRESETS.map(({ id, label, icon: Icon, activeClass }) => (
				<ToggleGroupItem
					key={id}
					value={id}
					className={cn(
						"flex-1 gap-1.5 px-2.5 text-xs font-medium capitalize",
						activeClass,
						"data-[state=off]:border-border-subtle data-[state=off]:bg-transparent data-[state=off]:text-muted-foreground/60",
						"data-[state=off]:hover:bg-surface-hover data-[state=off]:hover:border-border data-[state=off]:hover:text-foreground/80",
					)}
				>
					<Icon data-icon="inline-start" className="size-3" />
					{label}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
