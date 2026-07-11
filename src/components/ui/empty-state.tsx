import type { ReactNode } from "react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    shortcut,
    className,
    iconClassName,
}: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
    shortcut?: string;
    className?: string;
    iconClassName?: string;
}) {
    return (
        <Empty
            className={cn(
                "flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-4 border-0 bg-transparent px-6 py-8 text-center",
                className,
            )}
        >
            <EmptyHeader className="items-center gap-3">
                {Icon && (
                    <EmptyMedia
                        variant="icon"
                        className={cn(
                            "size-12 rounded-xl border border-border-subtle bg-surface-2 text-foreground/55",
                            iconClassName,
                        )}
                    >
                        <Icon className="size-5" />
                    </EmptyMedia>
                )}
                <EmptyTitle className="text-[15px] font-semibold text-foreground">{title}</EmptyTitle>
                {description && (
                    <EmptyDescription className="max-w-sm text-[12px] leading-relaxed text-foreground/60">
                        {description}
                    </EmptyDescription>
                )}
                {shortcut && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/70">
                        <span>Shortcut:</span>
                        <Kbd className="text-[10px]">{shortcut}</Kbd>
                    </div>
                )}
            </EmptyHeader>
            {action && <EmptyContent className="mt-2">{action}</EmptyContent>}
        </Empty>
    );
}
