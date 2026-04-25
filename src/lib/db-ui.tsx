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
 * Actual brand hex colors per DB type (Simple Icons canonical values).
 * Applied directly to SVG icons via currentColor so they show their
 * real brand identity in the engine selector, sidebar, and title bar.
 *
 * SQLite uses a brightened variant (#0F80CC) because the canonical
 * brand navy (#003B57) is invisible on dark backgrounds.
 */
export const DB_COLOR: Record<string, string> = {
    postgresql: "text-[#336791]",
    mysql:      "text-[#4479A1]",
    sqlite:     "text-[#0F80CC]",
    mongodb:    "text-[#47A248]",
    redis:      "text-[#FF4438]",
};

/**
 * Array form used by the onboarding screen's DB logo row.
 */
export const DB_LOGOS_ARRAY: {
    Icon: React.FC<{ className?: string }>;
    color: string;
    label: string;
}[] = [
    { Icon: SiPostgresql, color: "text-[#336791]", label: "PostgreSQL" },
    { Icon: SiMysql,      color: "text-[#4479A1]", label: "MySQL"      },
    { Icon: SiSqlite,     color: "text-[#0F80CC]", label: "SQLite"     },
    { Icon: SiMongodb,    color: "text-[#47A248]", label: "MongoDB"    },
    { Icon: SiRedis,      color: "text-[#FF4438]", label: "Redis"      },
];
