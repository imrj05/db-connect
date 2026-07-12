import { Kbd } from "@/components/ui/kbd";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "./settings-primitives";

const KEYBINDINGS: { combo: string; action: string; category: string }[] = [
    { combo: "⌘K", action: "Search / Command palette", category: "Global" },
    { combo: "⌘T", action: "Open a new tab", category: "Global" },
    { combo: "⌘W", action: "Close active tab", category: "Global" },
    { combo: "⌘,", action: "Open Settings", category: "Global" },
    { combo: "⌘B", action: "Show / hide sidebar", category: "Global" },
    { combo: "⌘⇧L", action: "Show / hide query log", category: "Global" },
    { combo: "⌘⇧M", action: "Manage connections", category: "Global" },
    { combo: "⌘⇧D", action: "Switch to next database", category: "Global" },
    { combo: "⌘↵", action: "Execute SQL query", category: "Editor" },
    { combo: "⌘F", action: "Search cells in table", category: "Table" },
    { combo: "⌘Z", action: "Undo cell edit", category: "Table" },
    { combo: "⌘D", action: "Clone row", category: "Table" },
    { combo: "⌘C", action: "Copy cell value", category: "Table" },
    { combo: "⌘V", action: "Paste cell value", category: "Table" },
];

export function KeybindingsSection() {
    const grouped = KEYBINDINGS.reduce<Record<string, typeof KEYBINDINGS>>((acc, kb) => {
        (acc[kb.category] ??= []).push(kb);
        return acc;
    }, {});

    return (
        <div className="flex flex-col gap-6">
            {Object.entries(grouped).map(([category, bindings]) => (
                <Card key={category}>
                    <CardHeader>
                        <CardTitle>{category}</CardTitle>
                        <CardDescription>
                            Keyboard shortcuts for {category.toLowerCase()} actions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-1">
                            {bindings.map((kb) => (
                                <div
                                    key={kb.combo}
                                    className="flex items-center justify-between rounded-md px-3 py-2.5 transition-colors hover:bg-muted/50"
                                >
                                    <span className="text-sm text-foreground/80">{kb.action}</span>
                                    <Kbd className="text-[11px]">{kb.combo}</Kbd>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}
            <Card>
                <CardHeader>
                    <CardTitle>Note</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">
                        On Windows and Linux, use <Kbd className="text-[11px]">Ctrl</Kbd> in place of <Kbd className="text-[11px]">⌘</Kbd>.
                        Keybindings are currently built-in and not user-customizable.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
