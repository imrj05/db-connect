import React from "react";
import {
    SiPostgresql,
    SiMysql,
    SiSqlite,
    SiMongodb,
    SiRedis,
} from "react-icons/si";

/**
 * Canonical DB logo components — used by Sidebar, TitleBar, FunctionOutput,
 * CommandPalette, ConnectionDialog, Onboarding.
 */
export const DB_LOGO: Record<string, React.FC<{ className?: string }>> = {
    postgresql: ({ className }) => <SiPostgresql className={className} />,
    mysql:      ({ className }) => <SiMysql      className={className} />,
    sqlite:     ({ className }) => <SiSqlite     className={className} />,
    mongodb:    ({ className }) => <SiMongodb    className={className} />,
    redis:      ({ className }) => <SiRedis      className={className} />,
};

/**
 * Tailwind text-color class per DB type.
 */
export const DB_COLOR: Record<string, string> = {
    postgresql: "text-blue-400",
    mysql:      "text-cyan-400",
    sqlite:     "text-slate-400",
    mongodb:    "text-emerald-400",
    redis:      "text-red-400",
};

/**
 * Array form used by the Onboarding component's DB logo row.
 * Uses slightly brighter shades for the larger display context.
 */
export const DB_LOGOS_ARRAY: {
    Icon: React.FC<{ className?: string }>;
    color: string;
    label: string;
}[] = [
    { Icon: SiPostgresql, color: "text-blue-500",    label: "PostgreSQL" },
    { Icon: SiMysql,      color: "text-cyan-500",    label: "MySQL"      },
    { Icon: SiSqlite,     color: "text-slate-400",   label: "SQLite"     },
    { Icon: SiMongodb,    color: "text-emerald-500", label: "MongoDB"    },
    { Icon: SiRedis,      color: "text-red-500",     label: "Redis"      },
];
