// ── ControlLabel — the one canonical stacked-form label (P3) ───────────────────
// `FieldLabel` is built for checkbox/radio-group labels; form-control rows across
// the connection dialog previously rolled two local FormLabel copies with
// uppercase + 10px bold tracking, which clashed with the rest of the card's
// sentence-case 12px labels. ControlLabel is the single replacement: 11px
// sentence case, medium weight, muted — consistent with design-system.md.

import * as React from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function ControlLabel({
    className,
    required,
    children,
    ...props
}: React.ComponentProps<typeof Label> & { required?: boolean }) {
    return (
        <Label
            className={cn(
                "mb-1.5 block text-[11px] font-medium leading-tight text-muted-foreground",
                className,
            )}
            {...props}
        >
            {children}
            {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
    )
}