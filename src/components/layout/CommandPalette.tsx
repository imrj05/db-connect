import * as React from "react"
import {
  Settings,
  User,
  Moon,
  Sun,
  Plus,
  Database
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useAppStore } from "@/store/useAppStore"

export function CommandPalette() {
  const { 
    theme, 
    setTheme, 
    addQueryTab, 
    commandPaletteOpen, 
    setCommandPaletteOpen,
    tables,
    setActiveTable,
    activeConnection
  } = useAppStore()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [commandPaletteOpen, setCommandPaletteOpen])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    setCommandPaletteOpen(false)
  }

  return (
    <>
      <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="General">
            <CommandItem onSelect={() => { addQueryTab(); setCommandPaletteOpen(false); }}>
              <Plus />
              <span>New Query Tab</span>
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={toggleTheme}>
              {theme === 'dark' ? (
                <Sun />
              ) : (
                <Moon />
              )}
              <span>Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
            </CommandItem>
          </CommandGroup>

          {activeConnection && tables.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Tables">
                {tables.map(table => (
                  <CommandItem 
                    key={table.name} 
                    onSelect={() => {
                      setActiveTable(table.name);
                      setCommandPaletteOpen(false);
                    }}
                  >
                    <Database className="text-blue-500" />
                    <span>{table.name}</span>
                    <CommandShortcut>table</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem>
              <User />
              <span>Profile</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Settings />
              <span>Settings</span>
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
