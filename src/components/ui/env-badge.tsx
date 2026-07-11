// ── EnvBadge — the one sanctioned environment badge (DESIGN.md §7, §8) ──────────
//
// Renders a compact uppercase badge colored by the env-safety tokens
// (--env-prod / --env-staging / --env-local), NOT by hardcoded Tailwind reds.
// This is the replacement for the bespoke `border-red-500/40 bg-red-500/15`
// PROD badge that previously lived in the title bar and bypassed the palette.
//
// Non-prod environments render a solid, static badge — no animation. Severe
// prod signal gets a single static warning glyph; we deliberately do NOT use
// animate-pulse here (see DESIGN.md §1, "Motion 2/10"): a pulsing red badge
// induces anxiety without adding information.

import { TriangleAlert } from "lucide-react";
import type { EnvKind } from "@/lib/env-safety";
import { envMeta } from "@/lib/env-safety";
import { cn } from "@/lib/utils";

export interface EnvBadgeProps {
    env: EnvKind;
    /** Show a warning glyph (prod only by default). */
    icon?: boolean;
    /** Override the label; defaults to the env's short label (PROD/STG/LCL). */
    label?: string;
    className?: string;
}

export function EnvBadge({ env, icon = false, label, className }: EnvBadgeProps) {
    const meta = envMeta(env);

    // Token-driven colors via CSS variables on the element itself, so the badge
    // follows palette changes automatically — no hardcoded Tailwind reds.
    const style = {
        color: `var(--env-${env})`,
        borderColor: `color-mix(in oklch, var(--env-${env}) 45%, transparent)`,
        backgroundColor: `color-mix(in oklch, var(--env-${env}) 15%, transparent)`,
    } as const;

    return (
        <span
            className={cn("inline-flex h-[18px] items-center rounded-sm border px-1.5 text-[10px] font-bold uppercase tracking-[0.12em] leading-none shrink-0 px-2 font-bold", className)}
            style={style}
            title={`${meta.label} environment`}
        >
            {icon && env === "prod" && <TriangleAlert size={9} className="shrink-0" />}
            {label ?? meta.label}
        </span>
    );
}