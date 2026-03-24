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
                "flex size-full flex-col overflow-hidden text-foreground",
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
                    "top-[16%] translate-y-0 overflow-hidden p-0 max-w-[560px]",
                    "rounded-xl border border-border/70",
                    "bg-popover shadow-2xl",
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
        <div
            data-slot="command-input-wrapper"
            className="flex items-center gap-3 px-4 h-12 border-b border-border/60 shrink-0"
        >
            <SearchIcon className="size-[15px] shrink-0 text-muted-foreground/50" />
            <CommandPrimitive.Input
                data-slot="command-input"
                className={cn(
                    "flex-1 bg-transparent text-sm outline-none",
                    "placeholder:text-muted-foreground/40",
                    "text-foreground",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                {...props}
            />
            <Kbd className="shrink-0 border-border/40 text-muted-foreground/35">Esc</Kbd>
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
                "no-scrollbar max-h-[400px] overflow-x-hidden overflow-y-auto outline-none py-1.5",
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
                "py-12 text-center text-xs text-muted-foreground/40",
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
                "overflow-hidden px-1.5 pb-1.5 text-foreground",
                "**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:pb-1",
                "**:[[cmdk-group-heading]]:text-[10px] **:[[cmdk-group-heading]]:font-semibold",
                "**:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-[0.12em]",
                "**:[[cmdk-group-heading]]:text-muted-foreground/50",
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
            className={cn("h-px bg-border/50 mx-3 my-1", className)}
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
                "relative flex cursor-default items-center gap-2.5 px-3 py-2 text-sm outline-none select-none",
                "rounded-md transition-colors",
                "hover:bg-primary/10 hover:text-primary",
                "data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary",
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
                "flex items-center gap-5 px-4 h-9 border-t border-border/60",
                "text-[10px] text-muted-foreground/35 shrink-0",
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
