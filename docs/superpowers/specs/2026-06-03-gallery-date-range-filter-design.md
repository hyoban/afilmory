# Gallery Date Range Filter

## Goal

Extend the web gallery's filter system (currently: tags, cameras, lenses, rating) with a date-range filter at day granularity. The active-filters hero already triggers when any of those filters is set; the date range becomes one more filter that contributes to the same hero and lives alongside the others in URL state.

## Non-goals

- Timezone selection — all dates are interpreted in the browser's local time. **Trade-off acknowledged**: a URL shared between users in different timezones will pick slightly different photo sets near day boundaries. Gallery date filtering is "viewer-local calendar day", not "absolute instant range".
- Month- or year-only granularity as separate filters — presets cover the common coarse cases.
- Inline calendar widget inside the command palette — custom range opens a dedicated picker.
- A new date-picker dependency (`react-day-picker`, `date-fns`, `dayjs`). Native `<input type="date">` is used.

## State shape

`apps/web/src/atoms/app.ts` — extend `gallerySettingAtom`:

```ts
selectedDateRange: null as { from: string | null; to: string | null } | null
```

No new top-level atom for picker visibility — the picker is opened imperatively via `Modal.present()` from `@afilmory/ui` (see UI section).

Semantics:

- `null` — no date filter applied.
- `{ from: 'YYYY-MM-DD', to: null }` — everything on or after `from`.
- `{ from: null, to: 'YYYY-MM-DD' }` — everything on or before `to` (inclusive of the whole day).
- `{ from, to }` — closed interval, inclusive on both ends.
- Both `from` and `to` null is normalized to the top-level `null` (filter is treated as unset).

## Shared utility module

New file: `apps/web/src/modules/gallery/dateRangeUtils.ts`. This is the single source of truth for date-range logic — URL sync, picker, command palette, hero, and chips all import from here. Reduces drift.

Exports:

- `type DateRange = { from: string | null; to: string | null }` — re-exported from atom.
- `parseDateString(s: string | null | undefined): string | null` — strict validation: returns `s` only if it matches `/^\d{4}-\d{2}-\d{2}$/` AND `new Date(year, month-1, day)` produces a valid date with the same y/m/d (catches `2024-02-30`, `9999-99-99`, etc.). Otherwise `null`.
- `normalizeDateRange(from: string | null, to: string | null): DateRange | null` — applies `parseDateString` to both; if both are null, returns `null`; if both are set and `from > to` (lexical compare is safe for `YYYY-MM-DD`), swaps them.
- `getRangeStartMs(date: string): number` — `new Date(y, m-1, d, 0, 0, 0, 0).getTime()`. Local-day start.
- `getRangeEndMs(date: string): number` — `new Date(y, m-1, d, 23, 59, 59, 999).getTime()`. Local-day end. **Must NOT use `new Date('YYYY-MM-DD')`** — that parses as UTC midnight and is off-by-one west of UTC.
- `getPhotoDateMs(photo): number | null` — see Filter logic section for source priority.
- `formatDateRange(range: DateRange | null): { headline: string; long: string; chip: string } | null` — display formatters for hero headline, info-card value, and chip label. All ISO format, no localized strings.
- `type DateRangePreset = { id: string; labelKey: string; compute(today: Date): DateRange }` and a `DATE_RANGE_PRESETS` array. Each preset receives a single `today` reference so endpoints don't drift across a midnight tick mid-call.
- `isPresetActive(preset: DateRangePreset, range: DateRange | null, today: Date): boolean` — equality check on both endpoints.

## URL sync

`apps/web/src/pages/(main)/layout.sync.tsx` — add `from` and `to` search params.

- **Read**: call `normalizeDateRange(searchParams.get('from'), searchParams.get('to'))` from the shared utility (strict regex + calendar validity + swap). Assign the result to `selectedDateRange`. Note: the existing `rating` parser uses `Number(...)` with no NaN check; do **not** copy that level of validation for dates — the shared utility is stricter.
- **Write**: serialize each non-null endpoint as `YYYY-MM-DD`. Omit the param when null. Use `replace: true` (consistent with existing filter writes).
- **Self-healing on bad URL**: because read passes through `normalizeDateRange`, the atom always holds a well-formed value. The subsequent state→URL write effect will then rewrite the URL with the cleaned values (e.g. `from=banana` gets stripped on the next sync). This is intentional.

Existing change-detection block in the write effect must include `from` and `to` so unchanged URLs don't trigger a no-op write. The comparison should be against `selectedDateRange.from ?? ''` and `selectedDateRange.to ?? ''`.

## Filter logic

`apps/web/src/hooks/usePhotoViewer.ts` — extend `filterAndSortPhotos`:

- Add `selectedDateRange` as a parameter (after `selectedRatings`, before `sortOrder` to match the atom field order).
- Date source priority via `getPhotoDateMs(photo)`: `photo.dateTaken` → `photo.exif?.DateTimeOriginal` → `photo.lastModified`. `dateTaken` is a top-level `PhotoInfo` field (`packages/typing/src/photo.ts:47`) that the build pipeline populates from EXIF + filename heuristics, so it is the most reliable "capture day" source. Falling back to `lastModified` (file mtime) only when both EXIF dates are missing.
- A photo is excluded when filter is active and the source date is missing or unparseable.
- Comparison is inclusive on both ends, using local-time day boundaries from `getRangeStartMs` / `getRangeEndMs`. `to = 2024-08-20` matches photos with a local timestamp anywhere in that day.
- Both `getFilteredPhotos` (the imperative getter) and `usePhotos` (the hook) must pass `selectedDateRange` through and include it in dependency arrays.

### Filter/sort consistency note

The existing sort uses a lexical string compare on `DateTimeOriginal` (treated as a string). For most well-formed EXIF datetimes (`YYYY:MM:DD HH:MM:SS`) and ISO `lastModified` values, lexical order aligns with chronological order. The date-range filter parses the date instead of compare-as-string, which can disagree if a photo's EXIF includes a timezone offset (`+09:00` etc.). Acceptable for this scope — the date filter operates on local calendar day regardless of stored offset, which matches user expectation more closely than strict chronological order would. Document this in code comments near `filterAndSortPhotos`.

## UI: CommandPalette entries

`apps/web/src/modules/cmdk/CommandPalette.tsx` — add a date-range filter section.

**Presets** (one Command per preset, `type: 'filter'`, icon `i-mingcute-calendar-line`):

| Preset | `from` | `to` |
|---|---|---|
| Last 7 days | today − 6d | today |
| Last 30 days | today − 29d | today |
| This month | first day of current month | today |
| Last 90 days | today − 89d | today |
| This year | Jan 1 of current year | today |
| Last year | Jan 1 of last year | Dec 31 of last year |

**Important — preset visibility**: presets are **excluded from the default (un-queried) command list**. The default list slices to 30 items (`CommandPalette.tsx:337`) and is dominated by tag/camera/lens chips central to the UX; adding 6 presets at the top would push existing filters off the visible cut. Presets only surface when a query fuzzy-matches their title/keywords (e.g. `date`, `range`, `7 days`, `this year`). Implementation: mark preset commands with a discriminating flag (e.g. add `dateRangePreset: true` to the Command shape) and exclude them in the default-branch `filter` of `filteredCommands` while letting them participate normally in the query branch.

**Preset toggle behavior — DO NOT toggle**: selecting an *active* preset is a no-op (just re-applies the same range). The only ways to clear the date range are the chip's X button in the hero, `Clear all`, and the picker's `Clear` action. Rationale: a user typing `last 30 days` and pressing Enter expects to *apply* that filter, not silently clear an existing matching one. This intentionally diverges from the rating-toggle pattern.

**Active-state display**: the preset's `active` flag (computed via `isPresetActive(preset, range, today)`) is still meaningful — it controls the visual tick on the row. Only the *action semantics* are non-toggling.

**Preset endpoint computation**: pass a single `today = new Date()` through the action handler to all preset `compute(today)` calls — never recompute `today` per endpoint inside `compute`. Otherwise a midnight tick mid-action could produce inconsistent `from`/`to`.

**Custom range entry** (one Command, `type: 'action'`, icon `i-mingcute-calendar-line`):

- Title: `Custom range…`
- Subtitle: `t('action.date.filter')`.
- Keywords: `date`, `range`, `custom`, `picker`, `from`, `to`.
- Visible in the default list (it's a single entry, not a fleet of presets — fits within the 30-item cut without crowding existing filters).
- Action: call `onClose()` to close the palette, then `Modal.present(DateRangePicker, undefined, { dismissOnOutsideClick: true })`. The real `Modal.present` signature is `(Component, props?, config?)` — see `packages/ui/src/modal/ModalManager.ts:11` and the call site in `apps/web/src/modules/social/ShareModal.tsx:38`.

**Reset paths — all three must clear date range**:

- `handleReset` (`CommandPalette.tsx:115`) — invoked by the palette's visible `Reset` button.
- `clear-filters` command (`CommandPalette.tsx:266`) — invoked from the command list.
- `handleClearAll` in `ActiveFiltersHero` — covered in the Hero section below.

Each must include `selectedDateRange: null`.

**Available-filter check**: the `hasFilters` boolean in CommandPalette (`CommandPalette.tsx:259`) must include `gallerySetting.selectedDateRange !== null` so the `clear-filters` command appears when only a date range is active.

**Existing photo-result navigation (unchanged, but documented)**: the photo command at `CommandPalette.tsx:303` navigates to `/photos/${photo.id}` without preserving `location.search`, so opening a photo result already clears tag/camera/lens/rating URL params. The date range will inherit the same behavior. Fixing this for all filters uniformly is out of scope here — flag as a separate ticket if desired.

## UI: DateRangePicker component

New file: `apps/web/src/modules/gallery/DateRangePicker.tsx`.

- Presented via `Modal.present(DateRangePicker, undefined, { dismissOnOutsideClick: true })` from `@afilmory/ui`. `ModalContainer` is already mounted in `apps/web/src/providers/root-providers.tsx`.
- Dismissal: match existing call sites — the modal item's id is returned by `Modal.present`, and components dismiss themselves by calling `Modal.dismiss(id)`. Since the picker doesn't know its own id when imported from CommandPalette's `Modal.present`, follow the existing `ShareSheet`/`ShareModal` pattern: capture the id in the caller and pass a `dismiss: () => Modal.dismiss(id)` prop, OR rely on `ModalContainer`'s child-prop injection if it provides one. Confirm during implementation.
- Contents:
  - Two `<input type="date">` controls labeled "From" and "To". Bound to local component state, not the atom, until the user clicks Apply.
  - A horizontal row of preset chips reused from `DATE_RANGE_PRESETS`. Clicking a chip fills both inputs (does not auto-apply).
  - Three actions: `Apply` (writes to atom, dismisses), `Clear` (sets atom to `null`, dismisses), `Cancel` (dismisses without writing). The `Apply` button is **disabled when `from > to`** with an inline error message ("Start date must be on or before end date") shown below the inputs — no silent swap inside the picker (URL normalization may still swap silently, but the picker is user-facing and requires explicit intent).
- On open, the picker reads `selectedDateRange` from the atom to pre-fill the inputs (empty string when an endpoint is null).
- On Apply: empty string endpoints become `null`; the result goes through `normalizeDateRange(from, to)` from the shared utility before writing to the atom; if both are null, atom is set to `null` (not an empty `{from: null, to: null}`).
- HTML attributes: set `min`/`max` on each input from the available photo date range if computable cheaply, else leave unbounded. Out of scope to compute lazily.

## UI: ActiveFiltersHero & FilterChips

`apps/web/src/modules/gallery/ActiveFiltersHero/index.tsx`:

- **Headline fragment priority**: `headline` is `fragments.slice(0, 2).join(' · ')` (line 60), so only two fragments are ever shown. Define the priority order explicitly (most-specific first): **tags → cameras → lenses → rating → date range**. This means a date-only filter shows up clearly; a date filter combined with two other dimensions may be hidden from the headline but is still visible in the `infoItems` cards below. Document the order in code comments.
- `infoItems` — add an entry with `Calendar` icon (`lucide-react`), label `t('action.date.label')` (new i18n key — see i18n section), value from `formatDateRange(range).long`:
  - `from && to`: `YYYY-MM-DD → YYYY-MM-DD`
  - `from && !to`: `Since YYYY-MM-DD`
  - `!from && to`: `Until YYYY-MM-DD`
- New handler `handleRemoveDateRange` that sets `selectedDateRange` to `null`.
- `handleClearAll` also resets `selectedDateRange: null`.
- **useMemo deps**: both `headline` and `infoItems` `useMemo` dependency arrays (lines 61–67 and 104–110) must include `gallerySetting.selectedDateRange`. Without this the UI goes stale when only the date changes.

`apps/web/src/modules/gallery/ActiveFiltersHero/FilterChips.tsx`:

- Accept new `dateRange?: DateRange | null` prop and `onRemoveDateRange?: () => void` callback.
- Render a removable chip with `formatDateRange(range).chip` as its label, when `dateRange` is non-null.
- **The internal `hasFilters` guard inside this component (line 27) must include `dateRange` as a truthy-check input**, otherwise a date-only state causes the chip group to early-return `null` and the chip never renders.

## useHasActiveFilters

`apps/web/src/hooks/useHasActiveFilters.ts` — extend the boolean expression with `gallerySetting.selectedDateRange !== null`.

## i18n

**Locale file path**: the app's translation files live at `locales/app/<lang>.json` at the repo root, **not** at `apps/web/locales/*/translation.json`. They are loaded via the resource map at `apps/web/src/@types/resources.ts`. Add keys to each locale file in `locales/app/`.

Add the following keys (consistent with existing `action.*` and `exif.*` naming):

- `action.date.filter` — subtitle on date-related commands
- `action.date.label` — "Date" label for the hero info card and chip
- `action.date.preset.last7`, `.last30`, `.thisMonth`, `.last90`, `.thisYear`, `.lastYear`
- `action.date.custom` — "Custom range…"
- `action.date.from`, `action.date.to`, `action.date.apply`, `action.date.cancel`, `action.date.clear`
- `action.date.error.fromAfterTo` — picker validation error
- `action.date.since` / `action.date.until` — open-ended display variants (for `formatDateRange`)
- Date-range display: keep ISO format for the date itself; surrounding words ("Since", "Until", error message) are localized.

## Edge cases

- Photo has no usable date source (`dateTaken`, `DateTimeOriginal`, and `lastModified` all missing or unparseable): excluded when the filter is active. Matches existing camera/lens behavior — photos missing the relevant field are filtered out.
- `from > to` arriving via URL: `normalizeDateRange` swaps them silently. URL is rewritten on next state→URL sync.
- `from > to` typed into the picker: Apply button is disabled, inline error shown. No silent correction at the user-facing surface.
- Both endpoints null: atom field is `null`; URL writes omit both params.
- Invalid date strings (e.g. `from=banana`, `from=2024-02-30`): `parseDateString` returns null; treated as no endpoint; URL is rewritten with the bad param removed on the next sync.
- Browser back/forward through history that includes/excludes the date params: handled by the existing `lastSyncedUrlRef` / `isUpdatingUrlRef` machinery in `useSyncGallerySettingsWithUrl`. New params slot into the existing change-detection block.
- DST transition day: `getRangeStartMs` / `getRangeEndMs` use `new Date(y, m-1, d, ...)` which honors the local timezone including DST. End-of-day `23:59:59.999` remains correct on a 23-hour or 25-hour day.
- Photo with EXIF datetime that includes a timezone offset (e.g. `2024-08-20T15:00:00+09:00` viewed in UTC): the photo's local-day-as-the-viewer-sees-it is what matters for `getPhotoDateMs`. Use `new Date(photo.dateTaken).getTime()` (Date parses ISO offsets) — viewer-local interpretation follows naturally from `getRangeStartMs` / `getRangeEndMs`.

## Testing

Unit tests for `dateRangeUtils`:

- `parseDateString` rejects: empty, malformed regex (`'2024-1-1'`, `'banana'`), out-of-calendar (`'2024-02-30'`, `'2024-13-01'`).
- `parseDateString` accepts: `'2024-08-20'`, `'2000-02-29'` (leap year).
- `normalizeDateRange` swaps reversed endpoints, returns `null` for `(null, null)` and `(invalid, invalid)`.
- `getRangeStartMs('2024-08-20')` and `getRangeEndMs('2024-08-20')` differ by exactly `86_399_999` ms in non-DST and behave correctly across a DST forward / backward transition (use a faked local timezone — e.g. mock `Intl.DateTimeFormat` / system time — to assert: in `America/New_York`, the start of `2024-03-10` and end of `2024-03-10` should still be one local day apart, 23 hours of millis).
- **Critically, the implementation must NOT use `new Date('2024-08-20')`** anywhere — that returns UTC midnight, which is the previous day in any west-of-UTC zone. Test by running with `TZ=America/Los_Angeles node` and asserting that `getRangeStartMs('2024-08-20')` produces a timestamp whose local-rendered date is `2024-08-20`, not `2024-08-19`.

Unit tests for `filterAndSortPhotos`:

- Various range combinations: closed, open-from, open-to, empty range, range matching zero photos.
- `to` endpoint inclusivity (a photo at `2024-08-20T23:59:00` is included when `to=2024-08-20`).
- Photos lacking all of `dateTaken`/`DateTimeOriginal`/`lastModified` are excluded.
- Photos with only `lastModified` are still date-filtered.

Manual smoke test:

- Open `/?from=2024-06-01&to=2024-08-31`: hero appears, only photos in that range are shown.
- Apply a preset from the picker (or via query in CommandPalette): URL gains `from`/`to`, hero updates, removing the chip clears the params.
- Open custom range picker, set only `from`: URL has `from` only, no `to`.
- `/?from=2024-08-31&to=2024-06-01` → atom normalizes to swapped order, URL gets rewritten on next state→URL sync.
- `/?from=banana`: URL is rewritten to omit the param, no filter applied.
- Browser back/forward across date-range changes leaves URL, atom, and UI consistent.
- Run `TZ=America/Los_Angeles pnpm dev` (or similar), set `to=today's date`, confirm photos taken late in the local evening are included.

## File-by-file diff summary

| File | Change |
|---|---|
| `apps/web/src/atoms/app.ts` | Add `selectedDateRange` field. Export `DateRange` type. |
| `apps/web/src/modules/gallery/dateRangeUtils.ts` | **New**. Shared validation, normalization, day-boundary, formatting, and preset definitions. |
| `apps/web/src/pages/(main)/layout.sync.tsx` | Read/write `from` & `to` URL params via `normalizeDateRange`; include in change-detection. |
| `apps/web/src/hooks/usePhotoViewer.ts` | Extend `filterAndSortPhotos`, `getFilteredPhotos`, `usePhotos`. Use `getPhotoDateMs`. Document sort vs filter divergence note. |
| `apps/web/src/hooks/useHasActiveFilters.ts` | Include date range in active check. |
| `apps/web/src/modules/cmdk/CommandPalette.tsx` | Add presets (default-list excluded, query-only) + custom-range action; update `hasFilters`, `clear-filters`, and `handleReset`. |
| `apps/web/src/modules/gallery/DateRangePicker.tsx` | **New**. Opened via `Modal.present(DateRangePicker, undefined, { dismissOnOutsideClick: true })`. |
| `apps/web/src/modules/gallery/ActiveFiltersHero/index.tsx` | Headline fragment with explicit priority, info item, remove handler, clear-all reset, useMemo deps. |
| `apps/web/src/modules/gallery/ActiveFiltersHero/FilterChips.tsx` | New chip + remove callback. Update internal `hasFilters` guard. |
| `locales/app/*.json` | New i18n keys. |
