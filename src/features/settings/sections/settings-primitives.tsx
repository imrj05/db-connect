import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
    Card as BaseCard,
    CardAction as BaseCardAction,
    CardContent as BaseCardContent,
    CardHeader as BaseCardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { EditorThemeOption } from "@/stores/useAppStore";

// Re-exported so section files pull card title/description from one place.
export { CardDescription, CardTitle } from "@/components/ui/card";

export const SETTINGS_FIELD_CLASS = "gap-4 border-b border-border/50 pb-4 last:border-0 last:pb-0";
export const SETTINGS_CONTROL_CLASS = "flex w-full min-w-0 shrink-0 justify-start";
export const SETTINGS_CONTENT_WIDTH_CLASS = "flex w-full min-w-0 flex-col gap-6";
export const SETTINGS_WIDE_CONTROL_CLASS = "w-full";

export const EDITOR_DARK_THEMES: { value: EditorThemeOption; label: string }[] = [
    { value: "dark-one-dark", label: "One Dark" },
    { value: "dark-monokai", label: "Monokai" },
    { value: "dark-palenight", label: "Palenight" },
    { value: "dark-dracula", label: "Dracula" },
];

export const EDITOR_LIGHT_THEMES: { value: EditorThemeOption; label: string }[] = [
    { value: "light-github", label: "GitHub Light" },
    { value: "light-solarized", label: "Solarized Light" },
    { value: "light-white-pine", label: "White Pine" },
    { value: "light-soft-white", label: "Soft White" },
];

export const QUERY_SQL_SIZE_OPTIONS = [
    { value: 262_144, label: "256 KB" },
    { value: 524_288, label: "512 KB" },
    { value: 1_048_576, label: "1 MB" },
    { value: 5_242_880, label: "5 MB" },
    { value: 10_485_760, label: "10 MB" },
];

export const QUERY_ROW_LIMIT_OPTIONS = [1_000, 5_000, 10_000, 50_000, 100_000];

export function formatBytes(bytes: number): string {
    const match = QUERY_SQL_SIZE_OPTIONS.find((option) => option.value === bytes);
    if (match) return match.label;
    if (bytes >= 1_048_576) return `${Number((bytes / 1_048_576).toFixed(1))} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} bytes`;
}

export function getPlanBadgeClass(plan: string) {
    switch (plan.toLowerCase()) {
        case "pro":
            return "border-primary/20 bg-primary/10 text-primary";
        case "starter":
            return "border-accent/30 bg-accent/50 text-accent-foreground";
        case "lifetime":
            return "border-warning/20 bg-warning/10 text-warning";
        default:
            return "border-border bg-muted text-muted-foreground";
    }
}

export function Card({ className, ...props }: ComponentProps<typeof BaseCard>) {
    return (
        <BaseCard
            className={cn("w-full min-w-0 border border-border bg-card py-0 ring-0 shadow-none", className)}
            {...props}
        />
    );
}

export function CardHeader({ className, ...props }: ComponentProps<typeof BaseCardHeader>) {
    return (
        <BaseCardHeader
            className={cn("border-b border-border px-4 py-5", className)}
            {...props}
        />
    );
}

export function CardContent({ className, ...props }: ComponentProps<typeof BaseCardContent>) {
    return <BaseCardContent className={cn("px-4 py-5", className)} {...props} />;
}

export function CardAction({ className, ...props }: ComponentProps<typeof BaseCardAction>) {
    return <BaseCardAction className={cn("self-start", className)} {...props} />;
}

export function FontPicker({
    fonts,
    value,
    fallbackStack,
    defaultAlias,
    defaultAliasStack,
    placeholder,
    onSelect,
    className,
}: {
    fonts: { value: string; label: string; isMono: boolean }[];
    value: string;
    fallbackStack: string;
    defaultAlias: string;
    defaultAliasStack: string;
    placeholder: string;
    onSelect: (value: string) => void;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const id = requestAnimationFrame(() => {
            const selectedItem = listRef.current?.querySelector<HTMLElement>("[data-font-selected='true']");
            selectedItem?.scrollIntoView({ block: "nearest" });
        });

        return () => cancelAnimationFrame(id);
    }, [open]);

    const displayLabel = value === defaultAlias
        ? fonts.find((font) => font.value === defaultAlias)?.label ?? defaultAlias
        : fonts.find((font) => font.value === value)?.label ?? value;

    const displayStack = value === defaultAlias
        ? defaultAliasStack
        : `"${value}", ${fallbackStack}`;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-8 w-full justify-between text-sm font-normal", className)}>
                    <span className="truncate" style={{ fontFamily: displayStack }}>
                        {displayLabel}
                    </span>
                    <ChevronDown data-icon="inline-end" className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] p-0">
                <div ref={listRef}>
                    <Command>
                        <CommandInput placeholder={placeholder} />
                        <CommandList className="max-h-60">
                            <CommandEmpty>No fonts found.</CommandEmpty>
                            <CommandGroup>
                                {fonts.map((font) => {
                                    const isSelected = value === font.value;
                                    const fontStack = font.value === defaultAlias
                                        ? defaultAliasStack
                                        : `"${font.value}", ${fallbackStack}`;

                                    return (
                                        <CommandItem
                                            key={font.value}
                                            value={font.value}
                                            onSelect={() => {
                                                onSelect(font.value);
                                                setOpen(false);
                                            }}
                                            data-font-selected={isSelected ? "true" : undefined}
                                        >
                                            <span style={{ fontFamily: fontStack }}>{font.label}</span>
                                            {isSelected ? <Check className="ml-auto" /> : null}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </div>
            </PopoverContent>
        </Popover>
    );
}
