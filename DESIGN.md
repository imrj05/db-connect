# Design System: DB Connect

## 1. Visual Theme & Atmosphere

DB Connect is a database client built for clarity and focus. The visual system is guided by a single principle: **comfortable precision**. Every surface, every color, every typographic decision is chosen to reduce cognitive overhead while keeping data front and center.

The default mode is dark. A cool blue-gray slate with visible structural borders — modeled after Zed's One Dark aesthetic. Surfaces are separated by distinct steps of lightness and hue, not shadow. The interface reads like a well-organized workspace: quiet, spacious enough to concentrate, and never decorative.

**Density:** 6/10 (Comfortable Data). Row height is 32px. Panels breathe. Data is legible without crowding.
**Variance:** 3/10 (Predictably Structured). Consistent grid alignment across all panels and controls.
**Motion:** 2/10 (Static Restrained). State transitions are instant or near-instant. No animation for its own sake.

**The Ambient Safety System:** A 2px top border and environment-specific badges signal which database the user is connected to at all times. Red means Production. Amber means Staging. Green means Local. This signal runs through the interface — env badges, CTA buttons, SQL syntax tokens, and confirmation dialogs all adopt the active environment's color when the stakes are real.

---

## 2. Color Palette & Roles

### 2.1 Dark Mode (Default — Zed One Dark)

| Token | Approx Hex | OKLCH (CSS Var) | Role |
|-------|-----------|-----------------|------|
| **Slate Base** | `#1a1e26` | `oklch(0.15 0.014 254)` | Base canvas — `--background` |
| **Panel Slate** | `#252a34` | `oklch(0.20 0.016 254)` | Sidebar, panels — `--surface-1` |
| **Toolbar Slate** | `#2c3240` | `oklch(0.23 0.017 254)` | Toolbars, cards — `--surface-2` |
| **Elevated Slate** | `#333b4a` | `oklch(0.27 0.018 254)` | Hover states, active surface — `--surface-3` |
| **Ghost Slate** | `#39424f` | `oklch(0.30 0.018 254)` | Elevated modals — `--surface-elevated` |
| **Primary Text** | `#dce0e5` | `oklch(0.895 0.009 255)` | Primary text, data values — `--foreground` |
| **Muted Text** | `#a9afbc` | `oklch(0.68 0.012 255)` | Labels, inactive nav, column headers — `--muted-foreground` |
| **Structural Border** | `#464b57` (65% opacity) | `oklch(0.37 0.016 254 / 0.65)` | Structural 1px lines — `--border` |
| **Subtle Divider** | `#464b57` (30% opacity) | `oklch(0.37 0.016 254 / 0.30)` | Table cell dividers — `--border-subtle` |
| **Accent Blue** | `#74ade8` | `oklch(0.70 0.12 257)` | Selection highlights, active icons — `--accent` |
| **Primary Blue** | `#4a78c0` | `oklch(0.55 0.15 255)` | Primary buttons, strong CTAs — `--primary` |
| **Focus Ring** | `#6ca0e0` | `oklch(0.68 0.13 257)` | Keyboard focus indicator — `--ring` |

### 2.2 Environmental Safety Accents

These are the semantic core of the safety system. They are deliberately warm-hued — standing apart from the cool slate chrome — so they cannot be ignored.

| Token | Hex | CSS Var | Role |
|-------|-----|---------|------|
| **Prod Red** | `#EF4444` | `--env-prod` | Production env badge, destructive CTAs, DELETE/DROP keywords |
| **Staging Amber** | `#F59E0B` | `--env-staging` | Staging env badge, UPDATE/INSERT keywords, pending edits |
| **Local Green** | `#10B981` | `--env-local` | Local env badge, success states, connection confirmed |
| **Brand Yellow** | `#FACC15` | `--env-brand` | SELECT keyword highlight ("safe read") |

**Environmental CTA Rule:** The primary action button always inherits the active environment color.

### 2.3 SQL Syntax Highlighting

SQL syntax colors extend the Ambient Safety system into the code editor.

| SQL Token | Color | Hex | Semantic Meaning |
|-----------|-------|-----|-----------------|
| `DELETE`, `DROP`, `TRUNCATE` | Prod Red | `#EF4444` | Destructive, irreversible |
| `UPDATE`, `INSERT` | Staging Amber | `#F59E0B` | Modifying, cautious |
| `SELECT` | Brand Yellow | `#FACC15` | Read-only, safe |
| Keywords (`FROM`, `WHERE`, `AND`, `ON`) | Primary Text | `#dce0e5` | Structural, neutral |
| String literals (`'value'`) | Soft Teal | `#5EEAD4` | Data content |
| Column/table names | Primary Text | `#dce0e5` | Identifiers |
| Type annotations (`uuid`, `varchar`) | Muted Text | `#a9afbc` | Metadata, secondary |

### 2.4 Light Mode

| Token | Approx Hex | OKLCH | Role |
|-------|-----------|-------|------|
| **Canvas** | `#f9f9fb` | `oklch(0.985 0.002 255)` | Base canvas |
| **Panel** | `#f2f3f6` | `oklch(0.960 0.004 255)` | Sidebar, panels |
| **Toolbar** | `#ecedf0` | `oklch(0.950 0.004 255)` | Toolbars, cards |
| **Ink** | `#1c2230` | `oklch(0.18 0.016 254)` | Primary text |
| **Steel** | `#6b7280` | `oklch(0.575 0.010 255)` | Labels, inactive states |
| **Hairline** | `#d5d8de` | `oklch(0.875 0.008 254)` | Structural lines |
| **Primary Blue** | `#4060b0` | `oklch(0.52 0.145 255)` | Primary buttons, active states |
| **Accent Blue** | `#4270bc` | `oklch(0.54 0.145 255)` | Hover highlights, icon tint |

---

## 3. Typography Rules

### Font Families

| Role | Font | CSS Variable | Fallback Stack |
|------|------|-------------|----------------|
| **UI / Interface** | Space Grotesk | `--app-font-sans` | `Geist, system-ui, -apple-system, sans-serif` |
| **Data / Code / SQL** | JetBrains Mono | `--app-font-mono` | `IBM Plex Mono, SF Mono, Cascadia Code, monospace` |

### Type Scale

| Role | Size | Weight | Letter Spacing | Font | Use |
|------|------|--------|----------------|------|-----|
| **Page Title** | 22–28px | 600 | -0.01em | Space Grotesk | Screen headings |
| **Section Label** | 11px | 600 | 0.06em | Space Grotesk | Section headers — uppercase |
| **Body / Form Label** | 13–14px | 500 | 0 | Space Grotesk | Nav items, modal body text |
| **Small Metadata** | 11–12px | 400 | 0 | Space Grotesk | Connection subtext, timestamps |
| **Data / Table Cell** | 13px | 400 | 0 | JetBrains Mono | All table cell content |
| **Code / SQL** | 13px | 400 | 0 | JetBrains Mono | SQL editor, code blocks |
| **Env Badge** | 9–10px | 700 | 0.10em | Space Grotesk | "PROD", "STG", "LCL" — uppercase |
| **Table Header** | 11px | 600 | 0.06em | Space Grotesk | Column headers — uppercase |
| **Button** | 12–13px | 500–600 | 0 | Space Grotesk | Button labels |

### Typography Principles

- **Data is always monospace.** Any value that a user typed, queried, or came from a database renders in JetBrains Mono — connection strings, query text, cell values, timestamps.
- **Hierarchy via weight, not size.** A 13px connection name (weight 500) and its host:port (weight 400 + muted color) create clear hierarchy without size difference.
- **Section labels use modest uppercase.** `letter-spacing: 0.06em` — readable, not aggressive.
- **Sentence case everywhere else.** Buttons, settings rows, empty states — sentence case, not title case.

---

## 4. Component Specifications

### 4.1 Buttons

**Primary Action (Blue)**
- Background: `oklch(0.55 0.15 255)` / `oklch(0.52 0.145 255)` (light mode)
- Text: `#ffffff`
- Font: Space Grotesk, 12–13px, weight 500–600
- Padding: `6px 14px`
- Border-radius: `4px`
- Border: none
- Hover: `brightness(1.08)`

**Destructive Action (Production Red)**
- Background: `#EF4444`
- Text: `#FFFFFF`
- Border-radius: `4px`
- Use: "Connect to Prod →", "Execute (prod)", confirm destructive dialogs

**Ghost / Secondary**
- Background: transparent
- Text: `--muted-foreground`
- Border: `1px solid var(--border-subtle)`
- Hover: `--surface-hover` background
- Border-radius: `4px`

**Icon Button**
- 24–28px square
- Border-radius: `4px` (`shell-icon-button`)
- No visible border at rest, `--surface-hover` on hover

### 4.2 Radius Scale

| Radius | Value | Use |
|--------|-------|-----|
| Default | `0.25rem` (4px) | Buttons, inputs, badges, tabs, cards |
| Sharp | `0.125rem` (2px) | Env badges, table headers (intentional signal) |
| Rounded | `0.5rem` (8px) | Tooltips, large modals |

### 4.3 Tabs

- **Container:** `shell-toolbar` — `surface-1` background, `border-b` in `border-subtle`
- **Inactive tab:** transparent bg, `text-foreground/60`, `border border-transparent`
- **Active tab:** `bg-surface-3`, `text-foreground`, `border-border-subtle`
- **Tab height:** 32px (`h-8`)
- **Tab icon:** tinted with type color (`text-accent-blue`, `text-accent-purple`, etc.)

### 4.4 Sidebar

- Background: `--surface-1`
- Right border: `1px solid var(--border-subtle)` (visible structural separator)
- Item hover: `--sidebar-accent`
- Item active: `--surface-selected`
- Section label: `shell-section-label` — 11px, weight 600, `0.06em` tracking, uppercase, muted
- Tree indent: 16px per level

### 4.5 Table Grid

- **Header row:** `--surface-2`, 11px uppercase, `--muted-foreground`, `border-b border-subtle`
- **Data row height:** 32px
- **Alternate rows:** `--surface-2` / `--surface-3` striping
- **Selected row:** `--surface-selected` + left edge indicator
- **Selected cell:** `--surface-selected` + `ring-1 ring-accent/60`
- **Pending edit cell:** `--warning/10` background + `ring-1 ring-warning/60`
- **Cell text:** JetBrains Mono 13px, `--foreground`
- **NULL cell:** `--muted-foreground`, italic style

### 4.6 Status Bar

- Background: `--card` (slightly elevated above background)
- Top border: `1px solid var(--border)`
- Height: 28px (`h-7`)
- Text: 11px, monospace, `--muted-foreground`
- Connection dot: 7px circle, `text-primary` + `animate-pulse` when connected

### 4.7 Dialogs & Modals

| Size | Use |
|------|-----|
| `sm` | Confirmation dialogs, destructive confirms |
| `md` | Forms, connection editor, settings rows |
| `lg` | Settings page, workspace dialogs, import flows |

- Background: `--popover` (matches `--card`)
- Border: `1px solid var(--border)`
- Border-radius: `0.5rem` (8px) for modal containers
- Overlay: `rgb(10 14 22 / 0.60)` in dark, `rgb(21 18 18 / 0.22)` in light

---

## 5. Surface Hierarchy

Surfaces increase in lightness as they stack upward in the visual hierarchy (in dark mode).

```
--surface-0   background           deepest
--surface-1   sidebar, panels
--surface-2   toolbars, cards
--surface-3   hover, active cells
--surface-elevated   modals, inputs   lightest
```

Surfaces are separated by **structural borders** (`--border-subtle`) — a cool slate at 30% opacity — rather than shadows. This matches Zed's flat, border-defined layering.

---

## 6. Focus States

- Never remove focus outlines without a visible replacement.
- All interactive controls use `focus-visible:ring-2 focus-visible:ring-ring/70` or equivalent.
- Focus ring color: `--ring` = `oklch(0.68 0.13 257)` — a clear blue, high-contrast against both dark and light surfaces.
- Icon buttons, inline edit inputs, filter controls, and custom menu rows must maintain visible keyboard focus.

---

## 7. Env Safety System

The two-pixel top border of the window and environment badges (in the title bar) always reflect the active connection's environment:

| Environment | Color | Hex | Token |
|-------------|-------|-----|-------|
| Production | Red | `#EF4444` | `--env-prod` |
| Staging | Amber | `#F59E0B` | `--env-staging` |
| Local | Green | `#10B981` | `--env-local` |

The `--env-color` CSS variable resolves to the active environment's color and is applied to the top border, the env badge, and CTA buttons when a prod/staging connection is active.

---

## 8. Shared Component Primitives

Use the following from `src/components/ui/app-ui.tsx`:

- `SectionHeading` — section label + optional action
- `SettingRow` — label + description + control
- `MetadataRow` — monospace key/value pair
- `StatusBadge` — env or status badge
- `IconAction` — icon-only button with tooltip
- `ToolbarButton` — toolbar ghost button
- `InlineStatus` — inline status dot + label
- `EmptyState` — icon + title + description + optional CTA
- `LoadingState` — spinner + label, preserves layout
- `ErrorState` — human-readable title first, technical detail second
- `SettingsShell` — unified settings layout (dialog or full-page)

---

## 9. Named Theme Variants

The default dark/light theme uses the Zed-inspired palette documented above. Users can select from 30+ named variants in settings. Key named variants:

| Class | Description |
|-------|-------------|
| `.ui-dark-ember` | Original warm charcoal, amber accent — the previous default |
| `.ui-dark-dim` | Warm charcoal, indigo accent |
| `.ui-dark-midnight` | Deep blue-black, blue accent |
| `.ui-dark-one-dark` | Classic One Dark (Atom) |
| `.ui-dark-cursor` | Cursor editor aesthetic |
| `.ui-light-ember` | Clean zinc light, amber accent |
| `.ui-light-cursor` | Cursor warm cream light |

All variants override only the color tokens they change. The structural token mappings (`--color-app-bg`, `--color-sidebar-bg`, etc.) and env safety tokens are defined once and cascade through all themes.
