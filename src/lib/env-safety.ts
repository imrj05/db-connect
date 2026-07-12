// ── Ambient Safety System (DESIGN.md §1, §7) ──────────────────────────────────
//
// The active connection's environment drives a persistent 2px window top border
// plus env badges/CTAs, so the user can never lose track of WHERE they are:
//   prod     → red    (highest stakes)
//   staging  → amber  (modifying caution)
//   local    → green  (safe to experiment)
//
// Environment is resolved from the connection's `group` id. Groups that are not
// explicitly prod/staging are treated as local (safe), matching the documented
// "default to safe" intent.

export type EnvKind = "prod" | "staging" | "local";

export interface EnvMeta {
    kind: EnvKind;
    /** CSS var reference for this env's token, e.g. var(--env-prod). */
    colorVar: string;
    /** Short uppercase label for badges. */
    label: string;
}

const ENV_MAP: Record<EnvKind, EnvMeta> = {
    prod: { kind: "prod", colorVar: "var(--env-prod)", label: "PROD" },
    staging: { kind: "staging", colorVar: "var(--env-staging)", label: "STG" },
    local: { kind: "local", colorVar: "var(--env-local)", label: "LCL" },
};

// Group ids (from GROUP_PRESETS in features/connections/lib/groups.ts) → env.
// "dev" and "testing" are local-class environments (safe to experiment).
const GROUP_TO_ENV: Record<string, EnvKind> = {
    prod: "prod",
    staging: "staging",
    local: "local",
    dev: "local",
    testing: "local",
};

/**
 * Resolve the environment for a connection from its group id.
 * Returns null when there is no group — callers should treat null as "no active
 * env signal" rather than defaulting to green, so the safety system never lies
 * ("safe" by default is worse than no signal).
 */
export function resolveEnv(group?: string): EnvKind | null {
    if (!group) return null;
    const g = group.toLowerCase();
    return GROUP_TO_ENV[g] ?? null;
}

export function envMeta(kind: EnvKind): EnvMeta {
    return ENV_MAP[kind];
}

/**
 * The CSS value to apply to `--env-color` for a given env, or `transparent`
 * when there is no active env (no connection / unknown group).
 */
export function envColorValue(kind: EnvKind | null): string {
    return kind ? ENV_MAP[kind].colorVar : "transparent";
}