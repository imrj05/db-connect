import React from "react";
import {
    SiPostgresql,
    SiMysql,
    SiSqlite,
    SiMongodb,
    SiRedis,
} from "react-icons/si";

/**
 * Canonical DB logo components used across the layout shell,
 * function output surfaces, connection dialog modal, and onboarding screen.
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
    postgresql: "text-accent-blue",
    mysql:      "text-accent-purple",
    sqlite:     "text-muted-foreground",
    mongodb:    "text-accent-green",
    redis:      "text-accent-red",
};

/**
 * Array form used by the onboarding screen's DB logo row.
 * Uses slightly brighter shades for the larger display context.
 */
export const DB_LOGOS_ARRAY: {
    Icon: React.FC<{ className?: string }>;
    color: string;
    label: string;
}[] = [
    { Icon: SiPostgresql, color: "text-accent-blue",   label: "PostgreSQL" },
    { Icon: SiMysql,      color: "text-accent-purple", label: "MySQL"      },
    { Icon: SiSqlite,     color: "text-muted-foreground", label: "SQLite"     },
    { Icon: SiMongodb,    color: "text-accent-green",  label: "MongoDB"    },
    { Icon: SiRedis,      color: "text-accent-red",    label: "Redis"      },
];
