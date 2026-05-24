import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

type Shortcut = { combo: string[]; label: string };
type Section = { title: string; items: Shortcut[] };

const SECTIONS: Section[] = [
    {
        title: "Navigation",
        items: [
            { combo: ["⌘", "K"], label: "Open command palette / search" },
            { combo: ["⌘", "B"], label: "Toggle sidebar" },
            { combo: ["⌘", ","], label: "Open settings" },
            { combo: ["⌘", "⇧", "M"], label: "Manage connections" },
            { combo: ["⌘", "⇧", "D"], label: "Switch database" },
            { combo: ["⌘", "⇧", "L"], label: "Toggle query log" },
        ],
    },
    {
        title: "Tabs",
        items: [
            { combo: ["⌘", "T"], label: "New tab" },
            { combo: ["⌘", "W"], label: "Close active tab" },
            { combo: ["⌘", "N"], label: "New connection" },
        ],
    },
    {
        title: "Editor & Grid",
        items: [
            { combo: ["⌘", "↵"], label: "Run query / save row" },
            { combo: ["⇧", "↵"], label: "Run query (alt)" },
            { combo: ["⌘", "S"], label: "Save (where applicable)" },
        ],
    },
    {
        title: "Help",
        items: [
            { combo: ["?"], label: "Show this dialog" },
            { combo: ["Esc"], label: "Close dialog / cancel" },
        ],
    },
];

export function ShortcutsHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Keyboard shortcuts</DialogTitle>
                    <DialogDescription>
                        On Windows and Linux, use <Kbd className="text-[11px]">Ctrl</Kbd> in place of <Kbd className="text-[11px]">⌘</Kbd>.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {SECTIONS.map((section) => (
                        <div key={section.title} className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {section.title}
                            </p>
                            <ul className="space-y-1.5">
                                {section.items.map((item) => (
                                    <li
                                        key={item.label}
                                        className="flex items-center justify-between gap-3 text-[12px]"
                                    >
                                        <span className="text-foreground/80">{item.label}</span>
                                        <KbdGroup>
                                            {item.combo.map((k) => (
                                                <Kbd key={k} className="text-[11px]">{k}</Kbd>
                                            ))}
                                        </KbdGroup>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
