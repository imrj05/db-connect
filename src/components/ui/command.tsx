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
                    "top-[18%] translate-y-0 overflow-hidden rounded-2xl p-0 max-w-xl",
                    className
                )}
                showCloseButton={showCloseButton}
            >
                <Command>
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
        <div data-slot="command-input-wrapper" className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground/60" />
            <CommandPrimitive.Input
                data-slot="command-input"
                className={cn(
                    "flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                {...props}
            />
            <kbd className="px-2 py-0.5 rounded border border-border bg-muted text-[10px] font-mono text-muted-foreground/60 shrink-0">
                Esc
            </kbd>
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
            className={cn("py-10 text-center text-sm text-muted-foreground", className)}
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
                "overflow-hidden text-foreground **:[[cmdk-group-heading]]:px-4 **:[[cmdk-group-heading]]:pt-4 **:[[cmdk-group-heading]]:pb-1.5 **:[[cmdk-group-heading]]:text-[10px] **:[[cmdk-group-heading]]:font-bold **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-[0.15em] **:[[cmdk-group-heading]]:text-muted-foreground/50",
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
            className={cn("h-px bg-border/50", className)}
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
                "relative flex cursor-default items-center gap-3 px-4 py-3 text-sm outline-none select-none transition-colors data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 hover:bg-accent/20 data-selected:bg-accent/30 [&_svg]:pointer-events-none [&_svg]:shrink-0",
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
                "flex items-center gap-5 px-4 h-10 border-t border-border text-[11px] text-muted-foreground/50 shrink-0",
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
