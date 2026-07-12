import type React from "react";
import { Code2, FlaskConical, Globe, Laptop, TestTube } from "lucide-react";

/**
 * Connection group presets. The `id` values are the source of truth for
 * environment classification — `src/lib/env-safety.ts` maps these ids onto
 * prod/staging/local ambient-safety colors.
 */
export const GROUP_PRESETS: {
    id: string;
    label: string;
    icon: React.FC<{ size?: number; className?: string }>;
    color: string;
    activeClass: string;
}[] = [
        { id: "local", label: "local", icon: Laptop, color: "text-emerald-400", activeClass: "border-emerald-400/35 bg-emerald-400/12 text-emerald-300" },
        { id: "dev", label: "dev", icon: Code2, color: "text-yellow-400", activeClass: "border-yellow-400/35 bg-yellow-400/12 text-yellow-300" },
        { id: "staging", label: "staging", icon: FlaskConical, color: "text-amber-400", activeClass: "border-amber-400/35 bg-amber-400/12 text-amber-300" },
        { id: "prod", label: "prod", icon: Globe, color: "text-red-400", activeClass: "border-red-400/35 bg-red-400/12 text-red-300" },
        { id: "testing", label: "testing", icon: TestTube, color: "text-purple-400", activeClass: "border-purple-400/35 bg-purple-400/12 text-purple-300" },
    ];
