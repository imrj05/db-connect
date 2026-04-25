# Design System: Ember — DB Connect

## 1. Visual Theme & Atmosphere

Ember is a high-stakes, high-performance database client. The visual system is built around a single governing philosophy: **Ambient Safety**. Every color in the interface is either a neutral structural tone or a deliberate environmental signal. Nothing is decorative. The atmosphere reads like a well-lit operations center — purposefully dim, technically dense, with precise bursts of color that carry exact semantic meaning.

The default mode is dark. Not generic dark — a warm, near-black charcoal with subtle amber undertones that gives the interface a lived-in, cockpit quality distinct from cold IDE aesthetics. Surface layers are separated not by strong borders but by a carefully graduated warmth: the deeper you go into the content hierarchy, the warmer and slightly brighter the surface becomes.

**Density:** 8/10 (Cockpit Dense). Data is the product. Row height is 32px. Information is front-facing, not hidden behind whitespace.  
**Variance:** 3/10 (Predictably Structured). Every panel, every control, every label follows strict grid alignment. Surprise in this interface means a production error.  
**Motion:** 2/10 (Static Restrained). State transitions are instant or near-instant. Confirmation dialogs snap into place. SQL execution is not animated — it finishes.

**The Ambient Safety System:** A 2px top window border and environment-specific badges signal which database the user is connected to at all times. Red means Production (danger). Amber means Staging (caution). Green means Local (safe). This environmental color runs through the entire UI — tab indicators, CTA buttons, SQL syntax highlighting, query analysis cards, and confirmation dialogs all adopt the production environment's danger color when the stakes are real.

---

## 2. Color Palette & Roles

### 2.1 Dark Mode (Default — Production Aesthetic)

| Token | Hex | OKLCH (CSS Var) | Role |
|-------|-----|-----------------|------|
| **Void Black** | `#09090B` | `oklch(0.145 0 0)` | Base canvas — `--background` |
| **Deep Charcoal** | `#18181B` | `oklch(0.225 0.01 36)` | Sidebar, panels — `--sidebar`, `--surface-1` |
| **Warm Charcoal** | `#222220` | `oklch(0.245 0.01 36)` | Toolbar, card surfaces — `--card`, `--surface-2` |
| **Elevated Surface** | `#27272A` | `oklch(0.27 0.01 36)` | Hover state, active cell — `--secondary`, `--surface-3` |
| **Ghost Surface** | `#2E2D2A` | `oklch(0.29 0.011 36)` | Elevated modals — `--surface-elevated` |
| **Bright Text** | `#FAFAFA` | `oklch(0.985 0 0)` | Primary text, data values — `--foreground` |
| **Muted Steel** | `#A1A1AA` | `oklch(0.708 0 0)` | Labels, inactive nav, column headers — `--muted-foreground` |
| **Structural Border** | `#27272A` | `oklch(1 0 0 / 10%)` | Structural 1px lines — `--border` |
| **Input Border** | `#3A3A3C` | `oklch(1 0 0 / 15%)` | Input field borders — `--input` |
| **Subtle Divider** | `rgba(#A1A1AA, 0.5)` | `oklch(0.41 0.009 36 / 0.5)` | Table cell dividers — `--border-subtle` |

### 2.2 Environmental Safety Accents

These are the semantic core of the Ember identity. Used for environment indicators, SQL keyword coloring, CTA buttons, and all state signaling.

| Token | Hex | CSS Var | Role |
|-------|-----|---------|------|
| **Brand Primary** | `#FACC15` | `--chart-1` (adapt) | Logo bolt, primary CTAs (non-prod), active nav item, SELECT keyword |
| **Prod Red** | `#EF4444` | `--destructive` | Production env badge, destructive CTAs, DELETE/DROP keywords, warning headers |
| **Staging Amber** | `#F59E0B` | `--warning` | Staging env badge, UPDATE/INSERT keywords, missing index alerts |
| **Local Green** | `#10B981` | `--success` | Local env badge, success states, connection confirmed |

**Environmental CTA Rule:** The primary action button on any screen always inherits the active environment color.
- Production → `#EF4444` "Connect to Prod →", "Execute"
- Staging → `#F59E0B` "Connect to Staging →"
- Local → `#FACC15` "New Connection +" (default non-env state uses Brand Primary)

### 2.3 SQL Syntax Highlighting

Syntax colors are not arbitrary — they extend the Ambient Safety system into the code editor.

| SQL Token | Color | Hex | Semantic Meaning |
|-----------|-------|-----|-----------------|
| `DELETE`, `DROP`, `TRUNCATE` | Prod Red | `#EF4444` | Destructive, irreversible |
| `UPDATE`, `INSERT` | Staging Amber | `#F59E0B` | Modifying, cautious |
| `SELECT` | Brand Primary | `#FACC15` | Read-only, safe |
| Keywords (`FROM`, `WHERE`, `SET`, `AND`, `ON`) | Bright Text | `#FAFAFA` | Structural, neutral |
| String literals (`'value'`) | Soft Teal | `#5EEAD4` | Data content |
| Column/table names | Bright Text | `#FAFAFA` | Identifiers |
| Type annotations (`uuid`, `varchar`, `timestamp`) | Muted Steel | `#A1A1AA` | Metadata, secondary |
| Active/changed value (strikethrough old → new) | Prod Red (old) / Staging Amber (new) | `#EF4444` / `#F59E0B` | Diff visualization |

### 2.4 Query Analysis Cards

| State | Header Bg | Icon Color | Meaning |
|-------|-----------|------------|---------|
| Destructive Action | `#EF4444` | White | Rows affected > 0, destructive op |
| Missing Index / Performance | Dark surface | `#F59E0B` | Optimization opportunity |
| Destructive Action (sub-warning) | `#1C1C1E` with red border | `#EF4444` | Secondary destructive note |

### 2.5 Light Mode (Optional Clean Technical)

| Token | Hex | Role |
|-------|-----|------|
| **Canvas White** | `#FAFAFA` | Base canvas |
| **Panel Surface** | `#F4F4F5` | Sidebars, panels |
| **Elevated Surface** | `#E4E4E7` | Hover states, elevated cards |
| **Ink Black** | `#09090B` | Primary text |
| **Dim Steel** | `#71717A` | Labels, inactive states |
| **Hair Border** | `#E4E4E7` | Structural lines |

---

## 3. Typography Rules

### Font Families

| Role | Font | CSS Variable | Fallback Stack |
|------|------|-------------|----------------|
| **UI / Interface** | Space Grotesk | `--app-font-sans` | `Geist, system-ui, -apple-system, sans-serif` |
| **Data / Code / SQL** | JetBrains Mono | `--app-font-mono` | `IBM Plex Mono, SF Mono, Cascadia Code, monospace` |

**Implementation note:** The current `--app-font-sans` is set to `"Geist"` in App.css. Space Grotesk should be loaded and set as the primary UI font to match the Ember design. JetBrains Mono is correctly specified.

### Type Scale

| Role | Size | Weight | Line Height | Letter Spacing | Font | Use |
|------|------|--------|-------------|----------------|------|-----|
| **Page Title** | 28px (1.75rem) | 700 | 1.25 | -0.01em | Space Grotesk | Screen headings ("Payments-Prod", "Audit Log") |
| **Section Subtitle** | 14px (0.875rem) | 400 | 1.5 | 0 | Space Grotesk | Page descriptions below titles |
| **Section Label** | 11px (0.6875rem) | 600 | 1 | 0.08em | Space Grotesk | Section headers ("ENVIRONMENT", "HOST", "SAVED CONNECTIONS") — always uppercase |
| **Body / Form Label** | 14px (0.875rem) | 500 | 1.5 | 0 | Space Grotesk | Nav items, sidebar connection names, modal body text |
| **Small Metadata** | 12px (0.75rem) | 400 | 1.4 | 0 | Space Grotesk | Connection subtext (host:port), timestamps, secondary info |
| **Data / Table Cell** | 13px (0.8125rem) | 400 | 1.2 | 0 | JetBrains Mono | All table cell content, query text, host fields |
| **Code / SQL** | 13px (0.8125rem) | 400 | 1.6 | 0 | JetBrains Mono | SQL editor, code blocks, execution details |
| **Env Badge** | 10px (0.625rem) | 700 | 1 | 0.1em | Space Grotesk | "PROD", "STG", "LCL" badges — uppercase |
| **Table Header** | 11px (0.6875rem) | 600 | 1 | 0.06em | Space Grotesk | Column headers — uppercase |
| **Button** | 14px (0.875rem) | 600 | 1 | 0 | Space Grotesk | All button labels |
| **Nav Link** | 14px (0.875rem) | 400 | 1 | 0 | Space Grotesk | Top navigation items, inactive state |
| **Active Nav Link** | 14px (0.875rem) | 600 | 1 | 0 | Space Grotesk | Active nav item (e.g., "Audit Log" in Brand Primary) |

### Typography Principles
- **Section labels are always uppercase** with wider letter-spacing (0.06–0.1em): "ENVIRONMENT", "HOST", "PORT", "SAVED CONNECTIONS", "TIMESTAMP (UTC)".
- **Data is always monospace.** Any value that a user typed, queried, or that came from a database renders in JetBrains Mono — connection strings, query text, cell values, timestamps.
- **Hierarchy via weight, not size.** At 14px, a connection name (weight 500) and its host:port (weight 400 + muted color) create clear hierarchy without size changes.
- **No Inter.** Inter is banned — Space Grotesk's distinctive letterforms (the 'a', 'G', 'R') give the interface a technical character that generic sans-serifs lack.

---

## 4. Component Specifications

### 4.1 Buttons

**Primary Action (Brand Yellow — non-production context)**
- Background: `#FACC15` (Brand Primary)
- Text: `#09090B` (Void Black) — dark text on yellow
- Font: Space Grotesk, 14px, weight 600
- Padding: `8px 16px`
- Border-radius: `2px` (near-sharp)
- Border: none
- Hover: `brightness(0.92)` subtle dim
- Use: "New Connection +", non-destructive primary actions

**Destructive Action (Production Red)**
- Background: `#EF4444` (Prod Red)
- Text: `#FFFFFF`
- Font: Space Grotesk, 14px, weight 600
- Padding: `8px 20px`
- Border-radius: `2px`
- Includes directional arrow icon (→) for navigation CTAs
- Use: "Connect to Prod →", "Execute", "Confirm Execute"

**Ghost / Secondary**
- Background: transparent
- Text: `#A1A1AA` (Muted Steel)
- Border: `1px solid #27272A`
- Font: Space Grotesk, 14px, weight 500
- Padding: `7px 14px`
- Border-radius: `2px`
- Hover: background `#27272A`
- Use: "Cancel", "EXPORT CSV", outline utility actions

**Icon Button (Toolbar)**
- Background: transparent
- Icon color: `#A1A1AA`
- Hover: background `#27272A`, icon `#FAFAFA`
- Size: 28px × 28px minimum touch target
- Border-radius: `2px`
- Use: format, refresh, download icons in toolbars

### 4.2 Inputs & Form Fields

**Standard Text Input**
- Background: `#18181B` (Deep Charcoal — slightly lighter than page bg)
- Text: `#FAFAFA`, JetBrains Mono, 13px
- Border: `1px solid #27272A`
- Padding: `10px 12px`
- Border-radius: `2px`
- Focus border: `1px solid #FACC15` (Brand Primary) — ring via `--ring`
- Placeholder: `#71717A` (muted)
- Use: HOST, PORT, USERNAME, PASSWORD, DATABASE NAME fields

**Confirmation Input (High-stakes)**
- Same as Standard but with red focus ring when confirming destructive actions
- Placeholder text is the exact keyword to type ("PROD")
- Background shifts to `#1C0000` subtly to reinforce danger context

**Search Input**
- Background: transparent
- Bottom border only: `1px solid #27272A`
- No side/top borders
- Search icon prefix in `#A1A1AA`
- Use: Log search, schema filter

### 4.3 Environment Tabs

**Tab Group (Local / Staging / Production)**
- Inactive tab: Background transparent, text `#A1A1AA`, weight 400
- Active tab: Background `#27272A` (Elevated Surface), text `#FAFAFA`, weight 500
- Active Production tab: dot indicator `#EF4444` (5px circle) + text `#EF4444`, weight 600
- Tab border: no outer border, `1px solid #27272A` between group and content below
- Padding: `6px 14px`
- Border-radius: `0px` — sharp

### 4.4 Environment Badges (Sidebar Connection List)

| Badge | Background | Text | Border |
|-------|------------|------|--------|
| PROD | `rgba(#EF4444, 0.15)` | `#EF4444` | `1px solid rgba(#EF4444, 0.3)` |
| STG | `rgba(#F59E0B, 0.15)` | `#F59E0B` | `1px solid rgba(#F59E0B, 0.3)` |
| LCL | `rgba(#10B981, 0.15)` | `#10B981` | `1px solid rgba(#10B981, 0.3)` |

- Font: Space Grotesk, 10px, weight 700, letter-spacing 0.1em, uppercase
- Padding: `2px 6px`
- Border-radius: `2px`

### 4.5 Data Tables

- **Row height:** 32px (strict — density is a feature)
- **Header height:** 32px
- **Cell padding:** `0 12px` (vertical padding via row height)
- **Header text:** Space Grotesk, 11px, weight 600, uppercase, `#A1A1AA`, letter-spacing 0.06em
- **Cell text:** JetBrains Mono, 13px, weight 400, `#FAFAFA`
- **Row hover:** Background `--surface-hover` (`oklch(0.285 0.012 36)`)
- **Row selected:** Background `--surface-selected` + `2px left border` in Brand Primary
- **Zebra striping:** Alternate rows use `--surface-2` vs `--surface-3` (subtle)
- **Column border:** `1px solid --border-subtle` (very faint vertical lines between cells)
- **Action column text colors:** Match SQL keyword colors (DELETE=red, SELECT=yellow, etc.)

**User/Role Chip in Tables**
- Background: `#27272A`
- Text: `#FAFAFA`, JetBrains Mono, 11px
- Border: `1px solid #3A3A3C`
- Border-radius: `2px`
- Padding: `2px 8px`

### 4.6 Sidebar (Connection Hub)

- Background: `--surface-1` / `#18181B`
- Width: 240px (fixed)
- Border-right: `1px solid --border`
- Section label: Space Grotesk, 11px, uppercase, `#A1A1AA`, letter-spacing 0.08em
- Connection item — default: Background transparent, text `#FAFAFA` weight 500
- Connection item — hover: Background `#27272A`
- Connection item — active: Background `#27272A` + left `2px solid #FACC15`
- Subtext (host:port): JetBrains Mono, 12px, `#A1A1AA`
- New Connection button: Full-width, Brand Primary fill

### 4.7 Top Navigation Bar

- Background: matches page background (`#09090B`) — no separate bar bg
- Border-bottom: `1px solid --border`
- Logo: Bolt icon in `#FACC15` + "Ember" in Space Grotesk, 16px, weight 700, `#FAFAFA`
- Nav links: Space Grotesk, 14px, weight 400, `#A1A1AA`
- Active nav link: weight 600, `#FACC15` (Brand Primary)
- Active nav indicator: `2px solid #FACC15` underline OR tab-style highlight
- No backdrop blur, no transparency — solid surface only

### 4.8 Ambient Window Header

- A `2px` top border on the app window shell that changes color by environment:
  - Production: `#EF4444`
  - Staging: `#F59E0B`
  - Local: `#10B981`
  - No connection: `#27272A` (neutral)
- Implementation: `border-top: 2px solid var(--env-color)` on the root shell

### 4.9 Destructive Query Dialog (Modal)

- **Overlay:** `rgba(0,0,0,0.65)` — `--overlay`
- **Modal container:**
  - Background: `#18181B`
  - Border: `1px solid #27272A`
  - Border-radius: `2px`
  - Width: 480px (sm/md)
  - No box shadow glow — uses border only
- **Warning header:**
  - Background: `#EF4444`
  - Text: `#FFFFFF`, Space Grotesk, 14px, weight 700, uppercase
  - Padding: `12px 20px`
  - Warning triangle icon (⚠) left-aligned
- **Body text:** 14px, `#FAFAFA`, contains inline `<code>` spans in Prod Red and Staging Amber for keyword emphasis
- **Info box (target table details):**
  - Background: `#27272A`
  - Border: `1px solid #3A3A3C`
  - Font: JetBrains Mono, 13px
  - Padding: `12px`
  - Border-radius: `2px`
- **Confirmation input:** Standard input style + red focus ring
- **Button row:** Ghost "Cancel" left, Destructive "Confirm Execute" right

### 4.10 Query Analysis Panel

- Background: Same as sidebar (`#18181B`)
- Width: 280px (fixed right panel)
- Border-left: `1px solid --border`
- Panel title: Space Grotesk, 11px, uppercase, `#A1A1AA`, letter-spacing 0.08em
- Analysis cards: `1px solid --border`, `2px` left colored accent
  - Destructive: `2px solid #EF4444` left border, dark card bg
  - Warning/Index: `2px solid #F59E0B` left border
- Code block within analysis: JetBrains Mono, 12px, background `--surface-0`
- "Apply Suggestion" button: Ghost/outline style, full-width

### 4.11 SQL Code Editor

- Background: `#09090B` (Void Black — purest dark for contrast)
- Font: JetBrains Mono, 13px, line-height 1.6
- Line numbers: `#A1A1AA`, right-aligned, `--surface-2` gutter background
- Caret: `#FACC15` (Brand Primary)
- Selection highlight: `rgba(#FACC15, 0.12)` background
- Active line: `rgba(#FAFAFA, 0.03)` very subtle highlight
- Tab bar above editor: `--surface-1` background, active tab `--surface-2` + white dot indicator
- Modified/unsaved tab dot: `#FACC15` 5px circle

### 4.12 Schema Explorer

- Background: `#18181B` (Deep Charcoal)
- Schema/table section label: Space Grotesk, 11px, uppercase, `#A1A1AA`
- Table icon: cylinder/grid icon in `#FACC15`
- Table name: Space Grotesk, 13px, weight 500, `#FAFAFA`
- Column row: `padding-left: 24px` (indented), column name in JetBrains Mono 12px `#FAFAFA`, type in JetBrains Mono 11px `#A1A1AA`
- Expand/collapse chevrons: `#A1A1AA`

### 4.13 Results Bar (Query Results)

- Background: `--surface-1`
- Border-top: `1px solid --border`
- Stats text: JetBrains Mono, 12px, `#A1A1AA` ("42ms", "0 rows affected")
- Clock/rows icons: `#A1A1AA`
- Download/export icons: icon buttons at right

---

## 5. Layout Principles

### App Shell

```
┌─────────────────────────────────────────────────────┐
│  2px top border (environment color)                  │
├──────────────────────────────────────────────────────┤
│  Top Nav Bar  (full width, 48px height)              │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│ Sidebar  │   Main Content Area                       │
│ 240px    │   flex-1                                  │
│ fixed    │                                           │
│          │                                           │
└──────────┴───────────────────────────────────────────┘
```

### Query Editor Three-Panel Layout

```
┌────────────┬──────────────────────┬──────────────────┐
│  Schema    │   SQL Editor         │  Query Analysis  │
│  Explorer  │   (tabs + editor +   │  Panel           │
│  240px     │    results pane)     │  280px           │
│            │   flex-1             │                  │
└────────────┴──────────────────────┴──────────────────┘
```

### Spacing System

Base unit: `4px`. Scale follows a 4px grid throughout.

| Token | Value | Use |
|-------|-------|-----|
| `--spacing-1` | 4px | Micro gaps, icon-to-text |
| `--spacing-2` | 8px | Badge padding, tight row padding |
| `--spacing-3` | 12px | Standard cell padding, input padding vertical |
| `--spacing-4` | 16px | Standard horizontal input padding, sidebar item padding |
| `--spacing-5` | 20px | Section padding, form group gap |
| `--spacing-6` | 24px | Panel padding, modal body padding |
| `--spacing-8` | 32px | Row height (strict), section separation |
| `--spacing-10` | 40px | Dialog content padding |
| `--spacing-12` | 48px | Nav bar height, large section gaps |

### Border Radius

`0px` to `2px` maximum throughout. This is a non-negotiable design decision — sharp corners signal technical rigor. Rounded corners signal consumer software.

| Element | Radius |
|---------|--------|
| Buttons | `2px` |
| Inputs | `2px` |
| Badges | `2px` |
| Cards / Panels | `0px` |
| Dialogs / Modals | `2px` |
| Code blocks | `2px` |
| Table cells | `0px` |
| Tabs | `0px` |
| Tooltips | `2px` |

**CSS Variable:** `--radius: 0.125rem` (2px) should be the app-wide base. The current `0.625rem` (10px) is too rounded for this design system.

### Grid Constraints

- Sidebar: `width: 240px`, `flex-shrink: 0` — never collapses on desktop
- Main content: `flex: 1 1 0`, `min-width: 0` — fills remaining space
- Analysis panels: `width: 280px`, `flex-shrink: 0` — fixed, closable
- Content max-width: none (full-bleed) — this is a native-app shell, not a marketing page
- All panels separated by `1px solid --border` dividers, zero gap

---

## 6. Depth & Elevation

This design system uses **no box-shadows** for elevation. Depth is communicated exclusively through:
1. **Background color stepping** — each surface level is slightly lighter/warmer than the level below
2. **1px borders** — structural definition of panel boundaries
3. **2px left accent borders** — active selection and attention indicators
4. **Overlay transparency** — modal backdrops at `rgba(0,0,0,0.65)`

| Level | Surface | Background | Border |
|-------|---------|------------|--------|
| 0 — Canvas | App background | `#09090B` | none |
| 1 — Panel | Sidebar, nav | `#18181B` | `1px solid border` |
| 2 — Card | Form panels, cards | `#222220` | `1px solid border` |
| 3 — Elevated | Active cells, hover | `#27272A` | `1px solid input` |
| 4 — Modal | Dialogs | `#18181B` + overlay | `1px solid border` |
| 5 — Code | SQL editor bg | `#09090B` | none (full dark) |

---

## 7. Motion & Interaction

### Philosophy
Ember is a tool for people who have already decided to act. Animation should not create doubt or delay. Transitions are for orientation, not entertainment.

### Timing
- **State transitions** (hover, focus, active): `80–120ms`, `ease-out`
- **Panel open/close** (schema expand, analysis panel): `150ms`, `ease-out` 
- **Dialog appear**: `100ms` opacity fade — no scale, no slide
- **Never:** spring physics, bounce, scale animations on data-bearing components

### Interaction States
- **Hover:** background color shift to `--surface-hover`, transition `80ms`
- **Focus:** `1px solid #FACC15` (Brand Primary) outline — no box-shadow glow
- **Active (pressed):** background darkens by one surface level
- **Disabled:** opacity `0.4`, cursor `not-allowed`
- **Loading:** skeleton shimmer on row placeholders, matching exact row dimensions — no spinners in data areas

### Production Confirmation Tension
The Destructive Query Warning dialog should feel serious, not animated. It appears instantly (no entrance animation). The Confirm Execute button starts in a muted/disabled visual state and only becomes fully saturated red after the user types the correct confirmation keyword — this state change uses a `150ms` color transition.

---

## 8. Environmental Theming System

The environment context affects multiple UI layers simultaneously:

```
Environment = "production" →
  window border-top:    2px solid #EF4444
  primary CTA bg:       #EF4444
  active env tab color: #EF4444
  env badge:            PROD (red)
  SQL DELETE/DROP:      #EF4444
  warning dialog bg:    #EF4444

Environment = "staging" →
  window border-top:    2px solid #F59E0B
  primary CTA bg:       #F59E0B
  active env tab color: #F59E0B
  env badge:            STG (amber)
  SQL UPDATE/INSERT:    #F59E0B

Environment = "local" →
  window border-top:    2px solid #10B981
  primary CTA bg:       #FACC15 (reverts to Brand Primary — safe state)
  env badge:            LCL (green)
```

### CSS Implementation Reference

Use a `data-env` attribute on the root shell:

```css
[data-env="production"] { --env-color: #EF4444; }
[data-env="staging"]    { --env-color: #F59E0B; }
[data-env="local"]      { --env-color: #10B981; }

.app-shell { border-top: 2px solid var(--env-color); }
.btn-primary-env { background-color: var(--env-color); }
```

---

## 9. Implementation Reference (CSS Variable Map)

The following maps Ember design tokens to the CSS custom properties defined in `src/App.css` (dark mode `.dark` class):

```css
/* Core */
--background:          #09090B equivalent (oklch(0.145 0 0))
--foreground:          #FAFAFA  (oklch(0.985 0 0))
--card:                #222220  (oklch(0.205 0 0))
--muted-foreground:    #A1A1AA  (oklch(0.708 0 0))
--destructive:         #EF4444  (oklch(0.704 0.191 22.216))
--warning:             #F59E0B  (oklch(0.78 0.16 70))
--success:             #10B981  (oklch(0.75 0.18 145))
--border:              rgba(white, 10%)
--ring:                #FACC15  (currently oklch(0.556 0 0) — update to yellow)

/* Surface ladder (warm charcoal) */
--surface-0:   #09090B  (base canvas)
--surface-1:   #18181B  (sidebar/panels, oklch(0.225 0.01 36))
--surface-2:   #222220  (cards/toolbar, oklch(0.245 0.01 36))
--surface-3:   #27272A  (hover/active, oklch(0.27 0.01 36))
--surface-elevated: #2E2D2A (modals, oklch(0.29 0.011 36))

/* Semantic app tokens */
--color-app-bg:          var(--surface-0)
--color-sidebar-bg:      var(--surface-1)
--color-toolbar-bg:      var(--surface-2)
--color-tab-active-bg:   var(--surface-3)
--color-table-bg:        var(--surface-3)
--color-row-hover:       var(--surface-hover)
--color-row-selected:    var(--surface-selected)
--color-input-bg:        var(--surface-elevated)
--color-border-app:      var(--border)
--color-border-table:    var(--border-subtle)

/* Typography */
--app-font-sans: "Space Grotesk", "Geist", system-ui, sans-serif
--app-font-mono: "JetBrains Mono", "IBM Plex Mono", monospace

/* Shape */
--radius: 0.125rem  /* 2px — update from current 0.625rem */
```

---

## 10. Anti-Patterns (Banned)

These patterns are explicitly incompatible with the Ember design system:

- **No rounded corners beyond 2px** — `rounded-xl`, `rounded-full`, pill buttons, rounded cards are banned
- **No box-shadow glows** — neon outer glows on buttons or focused inputs destroy the flat, terminal aesthetic
- **No Inter** — generic sans-serif that lacks character; use Space Grotesk
- **No decorative gradients** — the only gradient permitted is the ambient window top border fade
- **No pure black `#000000`** — use `#09090B` (Void Black) with its subtle warmth
- **No pure white `#FFFFFF` for text** — use `#FAFAFA` (Bright Text)
- **No oversaturated accents** — all accent colors must be contextually semantic, never decorative
- **No AI purple/neon aesthetics** — purple is not a system color; no glow effects
- **No 3-column equal card grids** — the layout is a native-app shell, not a marketing page
- **No spinner loading states in data areas** — use skeleton rows that match exact table row dimensions
- **No circular progress indicators** — SQL execution is binary: running or done
- **No emojis in UI** — status is communicated via colored dots, badges, and icons
- **No generic copywriting** — labels are precise and technical ("DESTRUCTIVE QUERY WARNING", not "Heads up!")
- **No backdrop blur on panels** — solid dark surfaces only; blur is a consumer app pattern
- **No floating labels on inputs** — label always above input, never animated floating
- **No animated CTAs** — no pulsing, shimmer, or attention-seeking button animations
- **No fabricated metrics** — never generate fake query times, row counts, or statistics in UI
- **No color outside the safety palette for semantic meaning** — if you need a new semantic color, extend the environmental safety system, don't invent new accent colors
