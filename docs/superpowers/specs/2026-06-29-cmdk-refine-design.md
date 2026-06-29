# Command Palette (cmdk) Visual Refine — Design

**Date:** 2026-06-29
**Scope:** `apps/web/src/modules/cmdk/CommandPalette.tsx` and supporting CSS in `apps/web/src/styles/tailwind.css`.

## Goals

Reshape the command palette away from the glassmorphic depth language used elsewhere in `apps/web` toward a **flat utility surface with a camera-viewfinder accent**. Three explicit asks:

1. **Drop the glass** — no backdrop blur, no layered gradients, no accent-tinted shadows.
2. **Square the outer shell** — `rounded-none` on the panel itself.
3. **Tighten density** — `~25%` reduction in vertical rhythm, smaller icon boxes, smaller body text.

Non-goal: behavior changes. Keyboard navigation, fuzzy search, filter actions, photo search, and modal lifecycle stay untouched.

## Design Direction

The palette becomes a **flat rectangular slab** with:

- **Hard outer shell** (no rounded corners, neutral border, single soft black shadow).
- **Soft inner elements** (icon boxes, chips, badges, segmented control, kbd all keep modest rounding so the interior does not read as brutalist).
- **AF-bracket signature** — four L-shaped accent brackets, offset 10px outside each corner, evoke a camera autofocus frame. This is the single piece of "decoration" that replaces the glass character.
- **Restrained accent** — Apple system blue is reserved for: AF brackets, the active segmented control state, active filter icon background, the `✓` check mark, and a hairline on `kbd` borders. Everything else uses neutral fill/text tokens.

The visual language target: precision instrument > frosted panel.

### Inspiration / non-goals

- Linear / Raycast cmdk — drives the density and flatness, but those use neutral selection only. We keep a small amount of brand warmth via the AF brackets.
- Glassmorphic Depth (see `apps/web/AGENTS.md`) — explicitly **does not apply** to this component anymore. The palette is now an exception island within `apps/web`. Modals, toasts, and other floating panels continue to follow the glass language.

## Token-Level Changes

Every change below maps to a single class or inline-style swap in `CommandPalette.tsx`. No new tokens; everything routes through existing `var(--color-*)` from `tailwindcss-uikit-colors`.

### Container

| Aspect | Current | New |
|---|---|---|
| Radius | `rounded-2xl rounded-b-none` + `lg:rounded-2xl!` | `rounded-none` (all breakpoints) |
| Border | `border-accent/20` (1px) | `border-border` (1px) |
| Background | `linear-gradient(...background 98%→95%)` inline | solid `bg-background` |
| Backdrop filter | `backdrop-blur-2xl` | removed |
| Box shadow | 3-layer accent-tinted shadows | inline `boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 4px 12px rgba(0,0,0,0.3)'` (single neutral, dark-mode-friendly) |
| Inner glow layer | absolute `<div>` with accent gradient | **deleted** |

The mobile-vs-desktop radius split (`rounded-b-none` on mobile) is removed; the panel is now a flat slab in both layouts.

### Backdrop (under-panel scrim)

| Aspect | Current | New |
|---|---|---|
| Class | `bg-black/40 backdrop-blur-xl` | `bg-black/40` (no blur) |

Rationale: dropping the scrim blur is consistent with "去玻璃" and saves a non-trivial paint cost on low-end devices.

### AF Brackets (new)

Four absolutely-positioned `<span>` elements rendered as siblings to the panel content, just inside the outer `relative` container.

```tsx
<div className="relative ...">
  <span aria-hidden className="af-bracket af-bracket-tl" />
  <span aria-hidden className="af-bracket af-bracket-tr" />
  <span aria-hidden className="af-bracket af-bracket-bl" />
  <span aria-hidden className="af-bracket af-bracket-br" />
  {/* existing panel content */}
</div>
```

CSS (added to `tailwind.css` under `@layer components`):

```css
.af-bracket {
  position: absolute;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-accent);
  pointer-events: none;
}
.af-bracket-tl { top: -10px; left: -10px;  border-right: 0; border-bottom: 0; }
.af-bracket-tr { top: -10px; right: -10px; border-left: 0;  border-bottom: 0; }
.af-bracket-bl { bottom: -10px; left: -10px;  border-right: 0; border-top: 0; }
.af-bracket-br { bottom: -10px; right: -10px; border-left: 0;  border-top: 0; }
```

The brackets sit outside the panel border, so the panel itself needs `overflow: visible` (default — current `overflow-hidden` must be moved to an inner wrapper that contains the rows, *not* to the brackets' container).

### Search Row

| Aspect | Current | New |
|---|---|---|
| Padding | `px-4 py-4` | `px-3 py-3` |
| Bottom border | `border-accent/20` | `border-border` |
| Input font size | `text-base` (16px) | `text-sm` (14px) — keeps placeholder readable while saving vertical space |
| Reset/Close button radius | `rounded-lg` | `rounded-md` (6px) |
| Reset/Close button class | `glassmorphic-btn border-accent/20` | `border-border bg-fill-quaternary text-text-secondary hover:bg-fill-secondary hover:text-text` (no `glassmorphic-btn`) |

### Tag-Match Toolbar

| Aspect | Current | New |
|---|---|---|
| Padding | `px-4 py-2` | `px-3 py-1.5` |
| Background | `bg-accent/3` | `bg-fill-quaternary` |
| Border | `border-accent/20` | `border-border` |
| Segmented button radius | `rounded-full` | `rounded-full` (unchanged — pill is intentional "soft inner") |
| Segmented active bg | `bg-accent text-white` | unchanged |
| Segmented inactive bg | `glassmorphic-btn text-text-secondary` | `bg-fill-tertiary text-text-secondary` |

### List Row

| Aspect | Current | New |
|---|---|---|
| Row padding | `px-4 py-3` | `px-3 py-2` |
| Row hover/selected | accent gradient (in `.command-item.selected` CSS) | `bg-fill-secondary` (neutral) |
| Icon box size | `h-9 w-9` (36px) | `h-7 w-7` (28px) |
| Icon box radius | `rounded-lg` | `rounded-md` |
| Icon box idle bg | `bg-background/95 text-text-secondary` | `bg-fill-tertiary text-text-secondary` |
| Icon box active bg | `bg-accent/10 text-accent` + `inset 0 0 0 1px accent/20` shadow | `bg-accent/10 text-accent` (drop the inset shadow) |
| Title size | `text-sm` | `text-[13px]` |
| Subtitle size | `text-xs` | `text-[11px]` |
| Badge radius | `rounded-full` | `rounded-full` (unchanged) |
| Badge bg | `bg-fill-tertiary` | unchanged |
| Check (`✓`) radius | `rounded-full` (h-5 w-5) | `rounded-full` (h-4 w-4 — slightly smaller to match new icon scale) |

**Photo-result thumbnails.** Today the photo row's `cmd.icon` is `<img className="h-6 w-6 rounded object-cover" />` rendered inside the 9×9 icon-box container — the thumbnail is smaller than its container, leaving idle bg visible around it. In the new design, change the thumbnail itself to `h-7 w-7 rounded-md object-cover` so it fills the new 28×28 icon container edge-to-edge (the container's idle background becomes invisible behind the thumbnail, which is the intended look).

### Footer

| Aspect | Current | New |
|---|---|---|
| Padding | `px-4 py-2` | `px-3 py-1.5` |
| Top border | `border-accent/20` | `border-border` |
| Background | transparent | `bg-fill-quaternary` (subtle tint distinguishes from list area, helps when there are zero results) |
| Text size | `text-xs` (12px) | `text-[11px]` |
| `kbd` radius | `rounded` (4px) | `rounded-sm` (3px) |
| `kbd` border | `border-accent/20` | `border-accent/15` (kept — one of the accent residuals) |
| `kbd` bg | `bg-accent/5` | `bg-fill-tertiary` |
| `kbd` font size | inherited | `text-[10px]` |

## CSS Changes (`tailwind.css`)

Existing entries to update inside `@layer components`:

```css
/* DELETE: .glassmorphic-btn:hover { ... }   -- no longer used */

/* REPLACE accent gradient with neutral fill */
.command-item:hover,
.command-item.selected {
  background: var(--color-fill-secondary) !important;
}
```

Add the AF bracket rules from the section above.

`.glassmorphic-btn` is only referenced from this component (verified via the existing `grep` in the explore step). Removing it from the CSS is safe; if a future component wants the same effect, it can opt back in.

## Component Structure Changes (`CommandPalette.tsx`)

1. The outer `<div>` keeps `relative` and the click-to-close handler.
2. Replace the existing container `<div className="... rounded-2xl ...">` with `<div className="... rounded-none ...">`.
3. **Replace** the inline `style={{ backgroundImage, boxShadow }}` block with `style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 4px 12px rgba(0,0,0,0.3)' }}` (no `backgroundImage`).
4. **Remove** the inner glow `<div>` entirely.
5. **Add** the four `<span className="af-bracket af-bracket-*" />` siblings at the top of the container.
6. Move `overflow-hidden` from the outer container to a new inner wrapper that contains search / toolbar / list / footer (so brackets are not clipped).
7. Apply the per-row class swaps from the tables above.

No prop / API / behavior changes. No new dependencies. No i18n key changes.

## Risk & Edge Cases

- **AF brackets clipped by viewport on mobile.** The panel is full-width on mobile (`w-full max-w-2xl`), so left/right brackets at `-10px` would be cut off by the viewport. Two options, decide at implementation:
  - (a) Drop the brackets on `<lg` and rely on the flat slab alone — simplest.
  - (b) Add `px-3` margin to the panel's parent on `<lg` so the 10px overflow is visible.

  Default: option **(a)**. Mobile already lacks visual breathing room; the brackets feel desktop-native.

- **`overflow-hidden` repositioning.** Today the outer container clips the inner glow div. After removing the glow, an inner wrapper is the right home for `overflow-hidden`. Verify the rounded scroll container still clips its scrollbar cleanly.

- **`glassmorphic-btn` is used outside this component?** Verified: only `CommandPalette.tsx` references it. Safe to delete the rule.

- **`max-h-[60vh]` list height.** Unchanged. With the tighter row padding, more items fit, which is the desired "compact" effect.

## Testing / Verification

- `pnpm --filter web type-check` after edits.
- `pnpm --filter web lint` on the two changed files only.
- Manual smoke (run `pnpm dev`): open `⌘K`, verify:
  - Panel is square with visible AF brackets on desktop.
  - No blur on backdrop or panel.
  - Hover and arrow-key selection both show the neutral `bg-fill-secondary` highlight.
  - Active filter chips still show the accent tint on the icon box and the `✓` badge.
  - Tag-match toolbar segmented control toggles correctly.
  - Footer shows neutral keys and result count.
  - Mobile (or narrow viewport) drops brackets cleanly without overlap.

## Out of Scope

- Animation tweaks (entry, exit, item-in transitions).
- Behavior or copy changes.
- Touching any other glassmorphic surface (modals, toasts, popovers) — they stay glass.
- Adding new themes / light-mode tuning beyond what the token system already provides.
