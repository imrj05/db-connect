# Design System: DB Connect

## 1. Visual Theme & Atmosphere

DB Connect is a database client built for clarity and focus. The visual system is guided by a single principle: **comfortable precision**. Every surface, every color, every typographic decision is chosen to reduce cognitive overhead while keeping data front and center.

The design language is **macOS-native** (the AppKit `AppColors` palette for surfaces and safety hues). The interface uses the platform's system fonts (SF Pro for UI, SF Mono for data) over near-neutral surfaces, with a single **blue interactive accent** (`--primary`) that drives CTAs, selection/active tints, links, focus rings, and the live-connection dot. The title bar and sidebar form a single solid **chrome rail** (`--sidebar`) — quietly recessed in light mode, gently lifted in dark — so the content canvas and white cards read as floating above it. Floating surfaces (menus, popovers, dialogs) are frosted — translucent with backdrop blur over an `NSVisualEffectView` vibrancy layer — and carry soft, large-blur shadows; content panes stay opaque. In-flow panels remain flat and are separated by hairline borders. Beyond the blue accent, **the only saturated colors are the safety tags** (§2.2, §7) — green/amber/red — so a warm/danger hue always means an environment or status signal.

**Density:** 6/10 (Comfortable Data). Row height is 32px. Panels breathe. Data is legible without crowding.
**Variance:** 3/10 (Predictably Structured). Consistent grid alignment across all panels and controls.
**Motion:** 2/10 (Static Restrained). State transitions are instant or near-instant. No animation for its own sake.

**The Ambient Safety System:** A 2px top border and environment-specific badges signal which database the user is connected to at all times. Red means Production. Amber means Staging. Green means Local. This signal runs through the interface — env badges, CTA buttons, and confirmation dialogs all adopt the active environment's color when the stakes are real.

---

## 2. Color Palette & Roles

All colors are expressed in the **standard shadcn token vocabulary** — there is no app-specific color layer beyond `--success`/`--warning` and the four env-safety tokens (§7). Surfaces and safety hues come from the AppKit `AppColors` palette; the interactive accent (`--primary`/`--ring`) is a refined blue that reads clearly for active/selected/focus states.

### 2.1 Dark Mode (Default — AppColors)

| Token | Hex | AppColors source | Role |
|-------|-----|------------------|------|
| `--background` | `#15161A` | `bgBase` | Base canvas, content panes |
| `--sidebar` | `#191A1F` | between `bgBase`/`bgCard` | Title bar + sidebar chrome (solid rail) |
| `--card` | `#1C1D22` | `bgCard` | Cards, inset panels, grid chrome |
| `--popover` | `#2A2B33` | `bgOverlay` | Menus, popovers, dialogs (frosted) |
| `--muted` / `--secondary` / `--accent` | `#23242B` | `bgElevated` | Muted fills, striping, hover fills |
| `--foreground` | `#F2F2F3` | `textPrimary` | Primary text, data values |
| `--muted-foreground` | `#9A9CA5` | `textSecondary` | Labels, column headers, metadata |
| `--border` | `#2E2F37` | `borderSubtle` | Hairline structural borders |
| `--input` | `#3A3B44` | `buttonSecondaryBorder` | Control / outline borders |
| `--primary` / `--ring` | `#3B82F6` | blue accent | CTAs, selection, active, focus, links |
| `--border` / `--input` | `#33343C` / `#3E3F49` | `borderSubtle` (firmer) | Hairline / control borders |

### 2.2 Environmental Safety Accents

The only saturated colors in the system. These are the safety tags from AppColors, mapped onto both the env-safety tokens and the general UI semantics.

| Token | AppColors source | Light / Dark hex | CSS Var | Role |
|-------|------------------|------------------|---------|------|
| **Prod Red** | `tagDangerText` | `#C5392E` / `#F2685C` | `--env-prod` / `--destructive` | Production env badge, destructive CTAs |
| **Staging Amber** | `tagCheckText` | `#9C6300` / `#F2B84B` | `--env-staging` / `--warning` | Staging env badge, pending edits |
| **Local Green** | `tagSafeText` | `#1A7A43` / `#5FD98A` | `--env-local` / `--success` | Local env badge, success states |

`--destructive`, `--warning`, and `--success` carry the same three safety hues, so safety semantics and general UI semantics stay in lockstep. The blue accent is reserved for interaction; a warm hue (red/amber/green) always signals an environment or status.

**Environmental CTA Rule:** The primary action button always inherits the active environment color.

### 2.3 SQL Syntax Highlighting

SQL syntax colors in the editor come from the user-selected CodeMirror theme (Editor → Syntax highlighting settings, one theme per appearance mode). They are intentionally not driven by app tokens. The Ambient Safety semantics (destructive red, modifying amber) still apply outside the editor — in confirmation dialogs, badges, and CTAs — via `--env-prod` / `--env-staging` / `--env-local`.

### 2.4 Light Mode (AppColors)

| Token | Hex | AppColors source | Role |
|-------|-----|------------------|------|
| `--background` | `#F5F5F6` | `bgBase` | Base canvas, content panes |
| `--sidebar` | `#ECEDEF` | `bgElevated` | Title bar + sidebar chrome (solid rail) |
| `--card` / `--popover` | `#FFFFFF` | `bgCard` / `bgOverlay` | Cards, inset panels, menus |
| `--muted` / `--secondary` / `--accent` | `#ECEDEF` | `bgElevated` | Muted fills, hover fills |
| `--foreground` | `#1A1B1F` | `textPrimary` | Primary text |
| `--muted-foreground` | `#6B6D76` | `textSecondary` | Labels, inactive states |
| `--border` | `#E2E3E6` | `borderSubtle` | Hairline structural lines |
| `--input` | `#D6D7DA` | `buttonSecondaryBorder` | Control / outline borders |
| `--primary` / `--ring` | `#2563EB` | blue accent | CTAs, selection, active, focus, links |
| `--border` / `--input` | `#DBDCE1` / `#CFD0D5` | `borderSubtle` (firmer) | Hairline / control borders |

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

**Primary Action (Blue accent)**
- Background: `--primary` (`#2563EB` light / `#3B82F6` dark)
- Text: `--primary-foreground` (white)
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
- Focus ring color: `--ring` = the blue accent — matches the selection tint so keyboard focus reads as native.
- Icon buttons, inline edit inputs, filter controls, and custom menu rows must maintain visible keyboard focus.

---

## 7. Env Safety System

The two-pixel top border of the window and environment badges (in the title bar) always reflect the active connection's environment:

| Environment | Color | AppColors source (light / dark) | Token |
|-------------|-------|--------------------------------|-------|
| Production | Red | `tagDangerText` `#C5392E` / `#F2685C` | `--env-prod` |
| Staging | Amber | `tagCheckText` `#9C6300` / `#F2B84B` | `--env-staging` |
| Local | Green | `tagSafeText` `#1A7A43` / `#5FD98A` | `--env-local` |

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
