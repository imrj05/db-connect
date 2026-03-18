import { useState } from "react";
import {
    SiPostgresql,
    SiMysql,
    SiSqlite,
    SiMongodb,
    SiRedis,
} from "react-icons/si";
import {
    Table2,
    Zap,
    Search,
    Download,
    Filter,
    TerminalSquare,
    ChevronRight,
    Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ONBOARDING_KEY = "db_connect_onboarding_done";

// ── Feature cards shown on step 2 ─────────────────────────────────────────────

const FEATURES = [
    {
        icon: <Table2 size={16} />,
        color: "text-accent-blue bg-accent-blue/10",
        title: "Browse Tables",
        desc: "Explore rows, sort columns, paginate large datasets.",
    },
    {
        icon: <TerminalSquare size={16} />,
        color: "text-accent-green bg-accent-green/10",
        title: "SQL Editor",
        desc: "Write and run queries with syntax highlighting and autocomplete.",
    },
    {
        icon: <Filter size={16} />,
        color: "text-accent-purple bg-accent-purple/10",
        title: "Visual Filters",
        desc: "Build WHERE conditions without writing SQL.",
    },
    {
        icon: <Download size={16} />,
        color: "text-accent-orange bg-accent-orange/10",
        title: "Import & Export",
        desc: "Load CSV / JSON into any table. Export results instantly.",
    },
    {
        icon: <Zap size={16} />,
        color: "text-yellow-500 bg-yellow-500/10",
        title: "Inline Editing",
        desc: "Double-click any cell to edit. Changes generate UPDATE SQL.",
    },
    {
        icon: <Search size={16} />,
        color: "text-pink-500 bg-pink-500/10",
        title: "Command Palette",
        desc: "Jump to any table or query with ⌘K.",
    },
] as const;

const DB_LOGOS = [
    { Icon: SiPostgresql, color: "text-blue-500",    label: "PostgreSQL" },
    { Icon: SiMysql,      color: "text-cyan-500",    label: "MySQL"      },
    { Icon: SiSqlite,     color: "text-slate-400",   label: "SQLite"     },
    { Icon: SiMongodb,    color: "text-emerald-500",  label: "MongoDB"    },
    { Icon: SiRedis,      color: "text-red-500",      label: "Redis"      },
];

// ── Steps ─────────────────────────────────────────────────────────────────────

function StepWelcome() {
    return (
        <div className="flex flex-col items-center text-center gap-8">
            {/* DB logos orbit */}
            <div className="relative flex items-center justify-center size-32">
                {/* Center icon */}
                <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Table2 size={28} className="text-primary" />
                </div>
                {/* Orbiting DB logos */}
                {DB_LOGOS.map(({ Icon, color, label }, i) => {
                    const angle = (i / DB_LOGOS.length) * 360;
                    const rad = (angle * Math.PI) / 180;
                    const r = 52;
                    const x = Math.cos(rad) * r;
                    const y = Math.sin(rad) * r;
                    return (
                        <div
                            key={label}
                            className="absolute size-8 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm"
                            style={{ transform: `translate(${x}px, ${y}px)` }}
                        >
                            <Icon className={cn("text-[14px]", color)} />
                        </div>
                    );
                })}
            </div>

            <div className="space-y-2">
                <h1 className="text-2xl font-black tracking-tight text-foreground">
                    Welcome to DB Connect
                </h1>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                    A fast, minimal database client for PostgreSQL, MySQL, SQLite,
                    MongoDB and Redis — built for developers.
                </p>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/50">
                {DB_LOGOS.map(({ label }) => (
                    <span key={label} className="font-mono">
                        {label}
                    </span>
                )).reduce<React.ReactNode[]>((acc, el, i) => {
                    if (i > 0) acc.push(<span key={`dot-${i}`} className="size-0.5 rounded-full bg-muted-foreground/30" />);
                    acc.push(el);
                    return acc;
                }, [])}
            </div>
        </div>
    );
}

function StepFeatures() {
    return (
        <div className="flex flex-col items-center gap-6">
            <div className="text-center space-y-1.5">
                <h2 className="text-xl font-black tracking-tight text-foreground">
                    Everything you need
                </h2>
                <p className="text-sm text-muted-foreground">
                    Built for speed. Designed to stay out of your way.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                {FEATURES.map((f) => (
                    <div
                        key={f.title}
                        className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
                    >
                        <div className={cn("size-7 rounded-lg flex items-center justify-center", f.color)}>
                            {f.icon}
                        </div>
                        <div>
                            <p className="text-[12px] font-bold text-foreground leading-tight">
                                {f.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground/70 leading-snug mt-0.5">
                                {f.desc}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StepConnect({ onConnect }: { onConnect: () => void }) {
    return (
        <div className="flex flex-col items-center text-center gap-8">
            <div className="size-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Plus size={32} className="text-emerald-500" />
            </div>

            <div className="space-y-2">
                <h2 className="text-xl font-black tracking-tight text-foreground">
                    Connect your first database
                </h2>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                    Add a connection to get started. Your credentials are encrypted
                    and stored locally — never sent anywhere.
                </p>
            </div>

            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                <Button
                    className="w-full h-10 text-[12px] font-bold uppercase tracking-widest gap-2"
                    onClick={onConnect}
                >
                    <Plus size={14} />
                    Add Database Connection
                </Button>

                <div className="flex items-center gap-4 text-[10px] text-muted-foreground/40">
                    {["Encrypted locally", "No cloud sync", "Open source"].map((t, i) => (
                        <span key={t} className="flex items-center gap-1">
                            {i > 0 && <span className="size-0.5 rounded-full bg-muted-foreground/25" />}
                            {t}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Main Onboarding component ─────────────────────────────────────────────────

interface OnboardingProps {
    onDone: () => void;
    onOpenConnectionDialog: () => void;
}

export function Onboarding({ onDone, onOpenConnectionDialog }: OnboardingProps) {
    const [step, setStep] = useState(0);
    const STEPS = 3;

    const dismiss = () => {
        localStorage.setItem(ONBOARDING_KEY, "1");
        onDone();
    };

    const handleConnect = () => {
        dismiss();
        onOpenConnectionDialog();
    };

    const next = () => {
        if (step < STEPS - 1) setStep(step + 1);
        else handleConnect();
    };

    const prev = () => {
        if (step > 0) setStep(step - 1);
    };

    const isLast = step === STEPS - 1;

    return (
        <div className="h-full flex flex-col items-center justify-center bg-background relative overflow-hidden px-6">
            {/* Subtle background grid */}
            <div
                className="absolute inset-0 opacity-[0.025] pointer-events-none"
                style={{
                    backgroundImage:
                        "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                }}
            />

            {/* Skip button */}
            <button
                onClick={dismiss}
                className="absolute top-4 right-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/30 hover:text-muted-foreground transition-colors"
            >
                Skip
            </button>

            {/* Step content */}
            <div
                key={step}
                className="flex flex-col items-center w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-300"
            >
                {step === 0 && <StepWelcome />}
                {step === 1 && <StepFeatures />}
                {step === 2 && <StepConnect onConnect={handleConnect} />}
            </div>

            {/* Bottom nav */}
            <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-5">
                {/* Progress dots */}
                <div className="flex items-center gap-1.5">
                    {Array.from({ length: STEPS }).map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setStep(i)}
                            className={cn(
                                "rounded-full transition-all duration-200",
                                i === step
                                    ? "w-5 h-1.5 bg-primary"
                                    : "w-1.5 h-1.5 bg-muted-foreground/20 hover:bg-muted-foreground/40",
                            )}
                        />
                    ))}
                </div>

                {/* Nav buttons */}
                <div className="flex items-center gap-3">
                    {step > 0 && (
                        <Button variant="ghost" size="sm" onClick={prev} className="h-8 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">
                            Back
                        </Button>
                    )}
                    {!isLast && (
                        <Button
                            size="sm"
                            onClick={next}
                            className="h-8 text-[11px] font-bold uppercase tracking-widest gap-1.5 min-w-24"
                        >
                            Next
                            <ChevronRight size={12} />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Guard: reads localStorage to decide if onboarding should show ─────────────

export function shouldShowOnboarding(hasConnections: boolean): boolean {
    if (hasConnections) return false;
    return !localStorage.getItem(ONBOARDING_KEY);
}
