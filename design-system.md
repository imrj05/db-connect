# DB Connect Design System

## Purpose

This document defines the baseline UI rules used across DB Connect so new screens and components stay visually consistent. The visual language is macOS-native with a monochrome accent (system fonts, near-neutral surfaces from the AppKit `AppColors` palette, a near-black/near-white accent, sidebar vibrancy; the only saturated hues are the safety green/amber/red) — see `DESIGN.md` for the full palette and component specs. Style only with the standard shadcn tokens plus `success`/`warning` and the env-safety vars.

## Typography Scale

- Metadata: `10px`
- Helper text: `11px`
- Control text: `12px`
- Body text: `13px`
- Section title: `15px`
- Empty state title: `20px` to `22px`

Rules:

- Use sentence case for buttons, settings rows, toolbars, and empty states.
- Reserve uppercase text for compact badges, small metadata, and short status/tab
  labels rendered at ≤11px with wide tracking (e.g. the status-bar state label
  “Connected”/“Running” and compact editor tab triggers). These read as compact
  metadata, not as control or heading text.
- Prefer `font-medium` or `font-semibold` over `font-black` for standard UI controls.

## Color Semantics

- Green: success, connected, active health, local environment
- Amber: warning, pending changes, staging environment
- Red: destructive actions, errors, production environment
- Blue / primary accent: current selection, active state, primary CTAs, focus rings
- Purple / orange: category/type accents only, not primary state colors

## Buttons

- Primary buttons: clear label, medium weight, strongest contrast
- Secondary buttons: outline, subtle surface background
- Ghost buttons: utility or low-emphasis actions
- Icon buttons: use the shared `IconAction` style where possible

## Dialog Sizes

- `sm`: confirmation dialogs
- `md`: forms and medium workflows
- `lg`: workspace-like dialogs and settings surfaces

Use shared dialog size presets instead of ad hoc width and radius values.

## Shared UI Patterns

Use the shared primitives in `src/components/ui/` where possible — notably:

- `EmptyState` (`empty-state.tsx`)
- `Field` / `FieldContent` / `FieldTitle` / `FieldDescription` (`field.tsx`)
- `Kbd` / `KbdGroup` (`kbd.tsx`)
- `Skeleton` (`skeleton.tsx`)
- the standard shadcn set (`Button`, `Dialog`, `Select`, `DropdownMenu`, …)

## Empty / Loading / Error States

- Empty states should include icon, title, concise description, and optional primary action.
- Loading states should preserve layout and use short descriptive labels.
- Error states should show a human-readable title first and technical detail second.

## Table/Grid Rules

- Selected row: clear background and edge indicator
- Selected cell: stronger inset ring and elevated surface
- Pending edit cell: amber-tinted background and warning ring
- Column headers: use sentence case, `11px` to `12px`, avoid decorative uppercase
- Empty result text should be descriptive, not just `0 rows`

## Focus States

- Do not remove focus outlines without a visible replacement.
- Use `focus-visible:ring-[3px]` or equivalent on custom controls.
- Icon buttons, inline edit inputs, filter controls, and custom menu rows must keep visible keyboard focus.

## Settings

- Use `SettingsShell` for both full-page and dialog-based settings surfaces.
- Keep settings layout identical across all entry points.

## Menus / Dropdown Rows

- Standard row structure:
  - icon column
  - text content column
  - optional action or status column
- Keep spacing, radius, hover, and active styles consistent.
