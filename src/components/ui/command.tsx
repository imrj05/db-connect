import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "@/lib/utils"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { SearchIcon } from "lucide-react"
function Command({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
    return (
        <CommandPrimitive
            data-slot="command"
            className={cn(
                "flex size-full flex-col overflow-hidden bg-card text-foreground",
                className
            )}
            {...props}
        />
    )
}
function CommandDialog({
    title = "Command Palette",
    description = "Search for a command to run...",
    children,
    className,
    showCloseButton = false,
    ...props
}: React.ComponentProps<typeof Dialog> & {
    title?: string
    description?: string
    className?: string
    showCloseButton?: boolean
}) {
    return (
        <Dialog {...props}>
            <DialogHeader className="sr-only">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <DialogContent
                className={cn(
                    // layout
                    "top-[18%] translate-y-0 overflow-hidden p-0 max-w-xl",
                    // shape — sharp corners, neon border
                    "rounded-none border border-primary/40",
                    // surface — use card (#111 dark / #f7f7f7 light)
                    "bg-card shadow-none ring-0",
                    className
                )}
                showCloseButton={showCloseButton}
            >
                <Command className="bg-card">
                    {children}
                </Command>
            </DialogContent>
        </Dialog>
    )
}
function CommandInput({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
    return (
        <div
            data-slot="command-input-wrapper"
            className="flex items-center gap-3 px-4 h-12 border-b border-border shrink-0 focus-within:border-primary/60 transition-colors"
        >
            <SearchIcon className="size-4 shrink-0 text-primary/70" />
            <CommandPrimitive.Input
                data-slot="command-input"
                className={cn(
                    "flex-1 bg-transparent text-[13px] font-mono outline-none",
                    "placeholder:text-muted-foreground/40",
                    "text-foreground caret-primary",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                {...props}
            />
            <Kbd className="shrink-0 border-border/60 text-muted-foreground/50">Esc</Kbd>
        </div>
    )
}
function CommandList({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
    return (
        <CommandPrimitive.List
            data-slot="command-list"
            className={cn(
                "no-scrollbar max-h-[420px] overflow-x-hidden overflow-y-auto outline-none",
                className
            )}
            {...props}
        />
    )
}
function CommandEmpty({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
    return (
        <CommandPrimitive.Empty
            data-slot="command-empty"
            className={cn(
                "py-10 text-center text-[11px] font-mono text-muted-foreground/40 uppercase tracking-widest",
                className
            )}
            {...props}
        />
    )
}
function CommandGroup({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
    return (
        <CommandPrimitive.Group
            data-slot="command-group"
            className={cn(
                "overflow-hidden px-1 pt-1 pb-3 text-foreground",
                // group heading — neon green label
                "**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:pb-1.5",
                "**:[[cmdk-group-heading]]:text-[9px] **:[[cmdk-group-heading]]:font-bold",
                "**:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-[0.18em]",
                "**:[[cmdk-group-heading]]:text-primary/60",
                className
            )}
            {...props}
        />
    )
}
function CommandSeparator({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
    return (
        <CommandPrimitive.Separator
            data-slot="command-separator"
            className={cn("h-px bg-border mx-2", className)}
            {...props}
        />
    )
}
function CommandItem({
    className,
    children,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
    return (
        <CommandPrimitive.Item
            data-slot="command-item"
            className={cn(
                // base
                "relative flex cursor-default items-center gap-3 px-3 py-3 text-sm outline-none select-none transition-colors",
                // shape — square corners, border token
                "rounded-none mx-2 mb-1 border border-border bg-background",
                // hover — lift surface slightly
                "hover:bg-muted/60 hover:border-border hover:text-foreground",
                // keyboard-selected (arrow key highlight)
                "data-selected:bg-primary/10 data-selected:text-primary",
                // border glows full neon on selection
                "data-selected:border-primary/70",
                // left accent bar on selection
                "data-selected:border-l-2 data-selected:pl-[calc(0.75rem-2px)]",
                // misc
                "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-30",
                "[&_svg]:pointer-events-none [&_svg]:shrink-0",
                className
            )}
            {...props}
        >
            {children}
        </CommandPrimitive.Item>
    )
}
function CommandShortcut({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="command-shortcut"
            className={cn("ml-auto flex items-center gap-1 shrink-0", className)}
            {...props}
        />
    )
}
function CommandFooter({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="command-footer"
            className={cn(
                "flex items-center gap-5 px-4 h-9 border-t border-border",
                "text-[10px] font-mono text-muted-foreground/40 shrink-0",
                className
            )}
            {...props}
        />
    )
}
export {
    Command,
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandShortcut,
    CommandSeparator,
    CommandFooter,
}
