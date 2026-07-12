# Design System: DB Connect

## 1. Visual Theme & Atmosphere

DB Connect is a database client built for clarity and focus. The visual system is guided by a single principle: **comfortable precision**. Every surface, every color, every typographic decision is chosen to reduce cognitive overhead while keeping data front and center.

The design language is **macOS-native**. The interface uses the platform's system fonts (SF Pro for UI, SF Mono for data), zero-chroma neutral surfaces, the macOS system accent palette, and native window materials: the sidebar is translucent over an `NSVisualEffectView` vibrancy layer, while content panes stay opaque. Floating surfaces (menus, popovers, dialogs) are frosted — translucent with backdrop blur — and carry soft, large-blur shadows. In-flow panels remain flat and are separated by hairline borders.

**Density:** 6/10 (Comfortable Data). Row height is 32px. Panels breathe. Data is legible without crowding.
**Variance:** 3/10 (Predictably Structured). Consistent grid alignment across all panels and controls.
**Motion:** 2/10 (Static Restrained). State transitions are instant or near-instant. No animation for its own sake.

**The Ambient Safety System:** A 2px top border and environment-specific badges signal which database the user is connected to at all times. Red means Production. Amber means Staging. Green means Local. This signal runs through the interface — env badges, CTA buttons, and confirmation dialogs all adopt the active environment's color when the stakes are real.

---

## 2. Color Palette & Roles

All colors are expressed in the **standard shadcn token vocabulary** — there is no app-specific color layer beyond `--success`/`--warning` and the four env-safety tokens (§7). Neutrals are zero-chroma (pure gray); the only hue in the chrome is the macOS system accent.

### 2.1 Dark Mode (Default — macOS)

| Token | Approx Hex | OKLCH (CSS Var) | Role |
|-------|-----------|-----------------|------|
| `--background` | `#1a1a1a` | `oklch(0.215 0 0)` | Base canvas, content panes |
| `--sidebar` | 60% `#242424` | `oklch(0.24 0 0 / 60%)` | Sidebar — translucent over vibrancy |
| `--card` | `#262626` | `oklch(0.26 0 0)` | Cards, inset panels, grid chrome |
| `--popover` | `#2b2b2b` | `oklch(0.28 0 0)` | Menus, popovers, dialogs (frosted at 70%) |
| `--muted` | `#2d2d2d` | `oklch(0.29 0 0)` | Muted fills, table striping base |
| `--accent` | `#323232` | `oklch(0.31 0 0)` | Hover fills |
| `--foreground` | `#f2f2f2` | `oklch(0.96 0 0)` | Primary text, data values |
| `--muted-foreground` | `#a3a3a3` | `oklch(0.7 0 0)` | Labels, column headers, metadata |
| `--border` | 12% white | `oklch(1 0 0 / 12%)` | Hairline structural borders |
| `--primary` / `--ring` | `#0A84FF` | `oklch(0.62 0.19 252)` | System blue — CTAs, selection, focus |

### 2.2 Environmental Safety Accents

These are the semantic core of the safety system, mapped to the macOS system palette so they read as native alerts.

| Token | System Color | CSS Var | Role |
|-------|--------------|---------|------|
| **Prod Red** | systemRed | `--env-prod` | Production env badge, destructive CTAs |
| **Staging Amber** | systemOrange | `--env-staging` | Staging env badge, pending edits |
| **Local Green** | systemGreen | `--env-local` | Local env badge, success states |

`--destructive`, `--warning`, and `--success` carry the same three system hues, so safety semantics and general UI semantics stay in lockstep.

**Environmental CTA Rule:** The primary action button always inherits the active environment color.

### 2.3 SQL Syntax Highlighting

SQL syntax colors in the editor come from the user-selected CodeMirror theme (Editor → Syntax highlighting settings, one theme per appearance mode). They are intentionally not driven by app tokens. The Ambient Safety semantics (destructive red, modifying amber) still apply outside the editor — in confirmation dialogs, badges, and CTAs — via `--env-prod` / `--env-staging` / `--env-local`.

### 2.4 Light Mode (macOS)

| Token | Approx Hex | OKLCH | Role |
|-------|-----------|-------|------|
| `--background` | `#ffffff` | `oklch(1 0 0)` | Base canvas, content panes |
| `--sidebar` | 65% `#f2f2f2` | `oklch(0.965 0 0 / 65%)` | Sidebar — translucent over vibrancy |
| `--card` | `#f7f7f7` | `oklch(0.985 0 0)` | Cards, inset panels |
| `--muted` | `#eeeeee` | `oklch(0.955 0 0)` | Muted fills |
| `--foreground` | `#212121` | `oklch(0.2 0 0)` | Primary text |
| `--muted-foreground` | `#6e6e6e` | `oklch(0.5 0 0)` | Labels, inactive states |
| `--border` | `#dedede` | `oklch(0.9 0 0)` | Hairline structural lines |
| `--primary` / `--ring` | `#007AFF` | `oklch(0.58 0.19 252)` | System blue — CTAs, selection, focus |

---

## 3. Typography Rules

### Font Families

| Role | Font | CSS Variable | Stack |
|------|------|-------------|-------|
| **UI / Interface** | System (SF Pro on macOS) | `--font-sans` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif` |
| **Data / Code / SQL** | System Mono (SF Mono on macOS) | `--font-mono` | `ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Code", monospace` |

Fonts remain user-selectable (Settings → Fonts); the settings apply at runtime by overriding `--font-sans` / `--font-mono` on the root element. The defaults above are the platform's native UI fonts.

### Type Scale

| Role | Size | Weight | Letter Spacing | Use |
|------|------|--------|----------------|-----|
| **Page Title** | 22–28px | 600 | -0.01em | Screen headings |
| **Section Label** | 11px | 600 | 0.06em | Section headers — uppercase |
| **Body / Form Label** | 13–14px | 500 | 0 | Nav items, modal body text |
| **Small Metadata** | 11–12px | 400 | 0 | Connection subtext, timestamps |
| **Data / Table Cell** | 13px | 400 | 0 | All table cell content — mono |
| **Code / SQL** | 13px | 400 | 0 | SQL editor, code blocks — mono |
| **Env Badge** | 9–10px | 700 | 0.10em | "PROD", "STG", "LCL" — uppercase |
| **Table Header** | 11px | 600 | 0.06em | Column headers — uppercase |
| **Button** | 12–13px | 500–600 | 0 | Button labels |

### Typography Principles

- **Data is always monospace.** Any value that a user typed, queried, or came from a database renders in the mono stack — connection strings, query text, cell values, timestamps.
- **Hierarchy via weight, not size.** A 13px connection name (weight 500) and its host:port (weight 400 + muted color) create clear hierarchy without size difference.
- **Section labels use modest uppercase.** `letter-spacing: 0.06em` — readable, not aggressive.
- **Sentence case everywhere else.** Buttons, settings rows, empty states — sentence case, not title case.

---

## 4. Component Specifications

### 4.1 Buttons

**Primary Action (System Blue)**
- Background: `--primary` (`#007AFF` light / `#0A84FF` dark)
- Text: white
- 12–13px, weight 500–600, padding `6px 14px`, `rounded-md`
- Hover: `brightness(1.08)`

**Destructive Action (System Red)**
- Background: `--destructive`
- Text: white, `rounded-md`
- Use: "Connect to Prod →", "Execute (prod)", confirm destructive dialogs

**Ghost / Secondary**
- Background: transparent; text `--muted-foreground`
- Border: `1px solid var(--border)`; hover `--accent` fill; `rounded-md`

**Icon Button**
- 24–28px square, `rounded-md`
- No visible border at rest, `--accent` fill on hover

### 4.2 Radius Scale

Stepped scale derived from `--radius: 0.625rem` (10px) via the shadcn formula (`sm = −4px`, `md = −2px`, `lg = base`, `xl = +4px`). Small controls stay crisp; containers get progressively softer, matching macOS control geometry.

| Utility | Value | Use |
|---------|-------|-----|
| `rounded-sm` | 6px | Badges, chips, env badges, small controls |
| `rounded-md` | 8px | Buttons, inputs, menu items, tabs |
| `rounded-lg` / `var(--radius)` | 10px | Toolbars, icon buttons, popovers |
| `rounded-xl` | 14px | Cards, dialogs, command palette |

### 4.3 Tabs

- **Container:** translucent toolbar strip (`bg-sidebar/95`), `border-b` hairline
- **Inactive tab:** transparent bg, `text-foreground/60`, `border border-transparent`
- **Active tab:** `bg-muted`, `text-foreground`, hairline border
- **Tab height:** 32px (`h-8`)

### 4.4 Sidebar (macOS source list)

- Background: `--sidebar` — translucent; native vibrancy shows through on macOS/Windows (opaque fallback elsewhere)
- Right border: `1px solid var(--border)` hairline
- Item hover: `--sidebar-accent`; item active: `bg-primary/15` tinted selection
- Section label: 11px, weight 600, `0.06em` tracking, uppercase, muted
- Tree indent: 16px per level; rows 24–28px

### 4.5 Table Grid

- **Header row:** `--card`, 11px uppercase, `--muted-foreground`, hairline `border-b`
- **Data row height:** 32px
- **Alternate rows:** `bg-muted/40` striping
- **Selected row:** `bg-primary/15` + left edge indicator
- **Selected cell:** `bg-primary/15` + `ring-1 ring-primary/60`
- **Pending edit cell:** `bg-warning/10` + `ring-1 ring-warning/60`
- **Cell text:** mono 13px, `--foreground`
- **NULL cell:** `--muted-foreground`, italic style

### 4.6 Status Bar

- Background: `--card`; top hairline border; height 28px (`h-7`)
- Text: 11px, monospace, `--muted-foreground`
- Connection dot: 7px circle, `text-primary` + `animate-pulse` when connected

### 4.7 Dialogs & Modals

| Size | Use |
|------|-----|
| `sm` | Confirmation dialogs, destructive confirms |
| `md` | Forms, connection editor, settings rows |
| `lg` | Settings page, workspace dialogs, import flows |

- Background: `--popover`; menus/popovers frost at `bg-popover/70` + `backdrop-blur-2xl`
- `rounded-xl`, `shadow-xl`, hairline ring (`ring-1 ring-foreground/10`)

---

## 5. Surface Hierarchy

Surfaces step in lightness as they stack upward, using the standard shadcn ladder directly:

```
--background   canvas, content panes        deepest
--sidebar      sidebar (translucent, vibrancy behind)
--card         cards, grid chrome, status bar
--popover      menus, popovers, dialogs     highest
--muted        muted fills, striping
--accent       hover fills
```

**Elevation rule:** in-flow surfaces are flat, separated by hairline borders (`--border`). Shadows exist only on floating elements — menus and popovers carry `shadow-md`/`shadow-lg`, dialogs `shadow-xl` — via a soft, large-blur, low-alpha ramp. Never add shadows to in-flow panels, cards at rest, or table chrome.

---

## 6. Focus States

- Never remove focus outlines without a visible replacement.
- All interactive controls use `focus-visible:ring-3 focus-visible:ring-ring/50` (the shadcn control convention) or equivalent.
- Focus ring color: `--ring` = system blue — matches the selection accent so keyboard focus reads as native.
- Icon buttons, inline edit inputs, filter controls, and custom menu rows must maintain visible keyboard focus.

---

## 7. Env Safety System

The two-pixel top border of the window and environment badges (in the title bar) always reflect the active connection's environment:

| Environment | Color | System Color | Token |
|-------------|-------|--------------|-------|
| Production | Red | systemRed | `--env-prod` |
| Staging | Amber | systemOrange | `--env-staging` |
| Local | Green | systemGreen | `--env-local` |

The `--env-color` CSS variable resolves to the active environment's color and is applied to the top border, the env badge, and CTA buttons when a prod/staging connection is active. It defaults to `transparent` — never green — when no connection is live: a safety signal that says "safe" with no connection is worse than no signal.

---

## 8. Shared Component Primitives

The shared layer lives in `src/components/ui/` (shadcn-based, Radix-backed). Reach for these before hand-rolling:

**Custom primitives**

- `EmptyState` (`empty-state.tsx`) — icon + title + description + optional action + optional keyboard shortcut hint. The only sanctioned empty-state treatment; do not hand-roll centered muted-text placeholders.
- `Field` / `FieldContent` / `FieldTitle` / `FieldDescription` (`field.tsx`) — settings and form rows: label + description + control. Used throughout the settings page.
- `Kbd` / `KbdGroup` (`kbd.tsx`) — keyboard shortcut chips (shortcuts help, empty-state hints).
- `Skeleton` (`skeleton.tsx`) — loading placeholders that preserve layout; prefer over centered spinners for full-view loads.

**Standard shadcn set**: `Button`, `Badge`, `Dialog`, `AlertDialog`, `Select`, `Switch`, `ToggleGroup`, `Tabs`, `Table`, `Tooltip`, `ContextMenu`, `DropdownMenu`, `Card`, `Input`, `Textarea`, `Popover`, `Command`, `Sidebar`, and the rest of `src/components/ui/`. All carry the focus-ring and state conventions of §6; use their variants rather than overriding styles inline.

Status badges for env/diff states are currently local one-offs (e.g. `StatusBadge` inside `schema-diff-view.tsx`); promote to a shared primitive if a third usage appears.

---

## 9. Theming Model

The app ships exactly two themes: **light** (`:root`) and **dark** (`.dark` on the root element), both expressed **entirely** in the standard shadcn token vocabulary (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1..5`, `--sidebar-*`) plus exactly two sanctioned extensions: the `--success`/`--warning` semantic pair and the env-safety tokens (`--env-prod/staging/local/color`, §7). There is no other custom token layer; component styling composes standard Tailwind utilities over these tokens.

There are no named theme variants. SQL editor syntax colors come from the selected CodeMirror theme (Editor settings), not from app tokens. Native window vibrancy is applied by the Rust shell (macOS `NSVisualEffectMaterial::Sidebar`, Windows mica) and signaled to CSS via `data-vibrancy` on the root element; every translucent surface has an opaque compositing fallback.
