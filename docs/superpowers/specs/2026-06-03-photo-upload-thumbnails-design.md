# Photo Upload Modal — Thumbnail Previews for Pending Items

**Date:** 2026-06-03
**Owner:** Innei
**Scope:** `be/apps/dashboard/src/modules/photos/components/library/photo-upload/`

## Problem

In the photo upload modal's review step (and across all subsequent phases that
render the file list), each queued file is rendered as a row that shows only
its filename, size, status label, and progress bar. There is no visual preview
of the image itself, so users cannot verify whether they queued the correct
photos before pressing "开始上传". For larger batches this turns the review step
into an act of faith.

## Goal

Show a 40×40px thumbnail of every queued image in the upload list across the
three steps that currently render `UploadFileList`:

- `ReviewStep` (workflow phase `review`)
- `UploadingStep` (workflow phase `uploading`)
- `CompletedStep` (workflow phase `completed`)

`ProcessingStep` (phase `processing`) and `ErrorStep` (phase `error`) render
`ProcessingPanel` instead of the file list, so they are out of scope. We do
**not** add the file list to those steps as part of this change.

Files whose content the browser cannot decode (MOV, RAW, HEIC, etc.) or which
exceed the per-file preview size guard fall back to a typed icon placeholder
so the row layout stays consistent.

Non-goals: click-to-zoom previews, server-side thumbnail generation, gallery
grid view, image cropping/editing, adding the file list to `ProcessingStep` or
`ErrorStep`.

## Architecture

### Data model

`FileProgressEntry` gains two fields:

```ts
id: string                  // stable fingerprint, stable across removeEntry index renumbering
previewUrl: string | null   // null = not previewable; UI shows icon
```

`id` is `${file.name}|${file.size}|${file.lastModified}` — the same fingerprint
already used by `addFiles` for dedup. It is used both as the React row `key`
and as the cache key. **Why fingerprint instead of `File` reference**: a stable
key survives row identity changes when an earlier same-named file is removed,
preventing React from leaking a previous row's local state (e.g. an
`<img onError>` failure) onto a different file. It also tolerates the unlikely
case of the same `File` reference appearing twice in the initial list.

### Preview cache

```ts
type PreviewCache = Map<string /* fingerprint */, string | null>
```

The cache lives in the closure created by `createPhotoUploadStore` in
`store.tsx`. It is not part of zustand state — only the resulting entries are.

`createFileEntries(files, cache)` becomes a pure projection:

1. Compute the fingerprint for each file.
2. If `cache.has(fp)`, reuse the cached `previewUrl` (URL or null).
3. Otherwise leave the entry's `previewUrl` as `null` and **do not** allocate
   a blob URL here.

Blob URL allocation is deferred to a separate `ensurePreviews()` store action
(see § StrictMode-safe allocation below). This keeps `createFileEntries` and
the `createPhotoUploadStore` body free of render-time side effects.

### Preview classification (`shouldGeneratePreview`)

Returns `true` only when **both** are satisfied:

1. **Type check** — either:
   - `File.type` is one of `image/jpeg`, `image/jpg`, `image/png`, `image/gif`,
     `image/webp`, `image/bmp`, `image/avif`; **or**
   - `File.type` is empty/missing and the extension is one of `.jpg`, `.jpeg`,
     `.png`, `.gif`, `.webp`, `.bmp`, `.avif`. (Windows can drop the MIME on
     drag-and-drop, so plain JPEGs must still preview.)
2. **Size guard** — `File.size <= 50 * 1024 * 1024` (50 MB). Larger files skip
   preview to avoid a multi-hundred-megabyte raster decode for a 40×40 render.

Explicit `false` for `.heic`/`.heif`, `.mov`, `.raw`/`.dng`/`.arw`/`.cr2`/`.nef`,
and anything that doesn't match the type check.

No batch-count cap. Backend caps a single upload at
`MAX_UPLOAD_FILES_PER_BATCH = 128`
(`be/apps/core/src/modules/content/photo/assets/photo-upload-limits.ts:8`), so
the queue cannot exceed that; 128 blob URLs of small thumbnails is comfortably
within browser limits.

### StrictMode-safe blob URL allocation

`PhotoUploadStoreProvider` builds the store via `useMemo` and registers its
lifecycle via `useEffect`. Under React 19 StrictMode, the effect runs once,
cleans up, and runs again — but `useMemo` may also rebuild. If
`createPhotoUploadStore` allocates blob URLs as a render-time side effect, a
discarded store closure can leak its blobs because its `cleanup()` never runs.

**Resolution**: `createPhotoUploadStore` produces entries with
`previewUrl: null`. A new store action does the allocation:

```ts
ensurePreviews(): void
```

`ensurePreviews()` walks `state.files`, runs `shouldGeneratePreview` for each
file not yet in the cache, calls `URL.createObjectURL` for the truthy ones,
records the result in the cache, and emits an `uploadEntries` update so rows
re-render with the new `previewUrl`. It is idempotent.

The provider's `useEffect` calls `store.getState().ensurePreviews()` after
`setActivePhotoUploadStore`. Cleanup unchanged — `store.getState().cleanup()`
still revokes everything in the cache. Under StrictMode this gives us:

1. mount A → `ensurePreviews` (allocates) → cleanup A (revokes) →
2. mount B → `ensurePreviews` (re-allocates fresh URLs) → cleanup B at unmount.

No leak.

`addFiles` and `removeEntry` also call `ensurePreviews()` after mutating the
files list, so new entries get URLs and dropped entries get revoked.

### Lifecycle (URL revocation)

Three release points:

1. **`removeEntry(entry)`** — when the user removes a file in the review step,
   look up its `id` (fingerprint) in the cache, call `URL.revokeObjectURL` on
   its cached URL (if any), `cache.delete(id)`, then rebuild entries.
2. **`addFiles(incoming)`** — appends; existing entries keep their cached
   URLs. Calls `ensurePreviews()` afterward for the newly added files.
3. **`cleanup()`** — iterate the cache, revoke every non-null URL, then
   `cache.clear()`. Called from `PhotoUploadStoreProvider`'s unmount effect
   and from `closeModal`. Idempotent.

`reset()` and the `AbortError` rollback in `beginUpload` do not revoke — the
underlying `files` list is unchanged, so cached URLs remain valid for the next
attempt.

Helper:

```ts
export function revokePreviewUrls(
  cache: PreviewCache,
  fingerprintsToRevoke?: string[],
): void
```

When called with no filter it revokes all; with a filter it revokes only the
given fingerprints.

### UI integration

`UploadFileList` row layout changes from a header (filename/size + status +
remove button) plus a full-width progress bar into a layout where the
thumbnail anchors the row on the left and the progress bar shifts right to
align under the filename column.

```
┌────┬──────────────────────────┬─────────┐
│ 📷 │ DSC_1234.jpg             │ pending │ ×
│    │ 4.2 MB                   │         │
│    │ ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░    │
└────┴─────────────────────────────────────┘
```

- Left column: 40×40 thumbnail or icon placeholder. Fixed width with
  `flex-shrink-0` and `size-10` (Tailwind `40px`).
- Middle column: filename + size + progress bar; must have `flex-1 min-w-0` so
  the filename can truncate without pushing the right column off-screen.
- Right column: status label + remove button. Reserved width so it doesn't
  shift while filenames vary.
- Progress bar lives inside the middle column (not as a sibling under the
  row), so it inherits the filename column's left edge — no fragile `ml-12`
  math.
- Row React key: `entry.id` (fingerprint), **not** the current
  `${entry.name}-${entry.index}`. This is part of this change because the
  thumbnail's `<img onError>` state must not bleed across rows when entries
  are renumbered.

Thumbnail rendering rules:

- If `previewUrl !== null`:
  `<img src={previewUrl} class="size-10 rounded object-cover" loading="lazy"
  decoding="async" alt="" />`. Local `useState` `hasLoadError`; on `onError`
  flip to the icon fallback for that row.
- If `previewUrl === null`: render
  `<div class="size-10 rounded bg-fill/30 flex items-center justify-center
  text-text-tertiary" aria-hidden="true">…</div>` with the icon chosen by file
  extension:
  - `.mov` → lucide `Film`
  - `.raw`, `.dng`, `.arw`, `.cr2`, `.nef` → lucide `Aperture`
  - default (HEIC, oversized, unknown) → lucide `ImageOff`

Filename remains the row's accessible label; the thumbnail/icon is decorative.

Per-file progress bar should expose:

```html
<div role="progressbar"
     aria-valuemin={0}
     aria-valuemax={100}
     aria-valuenow={Math.round(entry.progress * 100)}
     aria-label={`${entry.name} 上传进度`}>
```

The existing top-of-list overall progress bar gets the same treatment.

If the row stays compact, inline the thumbnail JSX in `UploadFileList`. If it
grows past ~30 lines, extract a `UploadEntryThumbnail` component in the same
folder.

### Files changed

- `photo-upload/types.ts` — add `id: string` and `previewUrl: string | null`
  to `FileProgressEntry`.
- `photo-upload/utils.ts`:
  - add `entryFingerprint(file): string` (re-exported helper, already
    duplicated inline in `addFiles`)
  - extend `createFileEntries(files, cache)` — projection only, no URL
    allocation
  - add `shouldGeneratePreview(file): boolean` with MIME-or-extension +
    50 MB size guard
  - add `revokePreviewUrls(cache, fingerprintsToRevoke?): void`
- `photo-upload/store.tsx`:
  - allocate a `Map<string, string | null>` in `createPhotoUploadStore`
  - add `ensurePreviews()` action; call from `useEffect` mount, `addFiles`,
    and `removeEntry`
  - `removeEntry` revokes the dropped file's URL before rebuilding entries
  - `cleanup()` calls `revokePreviewUrls(cache)` then `cache.clear()`;
    idempotent
  - replace inline fingerprint usage with `entryFingerprint`
- `photo-upload/UploadFileList.tsx` — new layout (`flex-1 min-w-0` on the
  middle column, reserved-width right column, progress bar nested in middle
  column), `entry.id` key, ARIA on progress bars.
- Possibly new `photo-upload/UploadEntryThumbnail.tsx` if the row JSX gets
  long.

## Edge cases

- **StrictMode double-mount**: deferred allocation in `ensurePreviews` makes
  blob allocation a tracked effect, so the discarded first store's blobs are
  revoked by its cleanup.
- **`File.type` empty on Windows JPEG drops**: fingerprint preview test falls
  back to extension matching for known image extensions.
- **Oversized images (>50 MB)**: skip preview, render `ImageOff` icon. Keeps
  the row layout consistent and avoids decode-time memory spikes.
- **createObjectURL on file with corrupt contents**: handled by the
  `<img onError>` → icon fallback path; `hasLoadError` is per-row state keyed
  by `entry.id`, so it does not bleed across files when rows renumber.
- **Duplicate `File` reference in the initial files array**: cache is keyed by
  fingerprint, so both entries point at the same URL. Removing one entry
  calls `cache.delete(fingerprint)` and revokes the shared URL. **Resolution**:
  before removing from the cache, check whether any other `state.files` entry
  still shares that fingerprint; if so, skip the revoke. This is the only
  spot where fingerprint-keyed shared URLs need ref-counting.
- **`removeEntry` index renumbering**: row React key is `entry.id`, not
  `entry.index`, so React does not reuse component state across files.
- **HEIC**: explicit MIME/extension check skips object URL creation, so no
  broken `<img>` flashes.
- **MOV with matching image (Live Photo)**: both files exist in the queue;
  the image gets a real preview, the MOV gets a `Film` icon. That is the
  desired behavior — the user sees the photo it pairs with.
- **Double cleanup** (`closeModal` → `cleanup`, then provider unmount →
  `cleanup`): the second call finds an empty cache and is a no-op.

## Testing

Unit tests for `photo-upload/utils.ts` (mock `URL.createObjectURL` and
`URL.revokeObjectURL`):

- `createFileEntries` produces entries with `previewUrl: null` when the cache
  is empty (no allocation as a side effect of building entries).
- `shouldGeneratePreview` returns `true` for `image/jpeg`, `false` for
  `image/heic`, `false` for `.mov`, `true` for a `.jpg` with empty
  `File.type` (Windows case), `false` for a `image/jpeg` with `size = 60 MB`.
- `revokePreviewUrls(cache)` revokes every non-null URL and clears the cache.
- `revokePreviewUrls(cache, [fp1])` revokes only `fp1` and leaves the rest.

Store-level tests (using `createPhotoUploadStore` directly, no React):

- `ensurePreviews` allocates one URL per previewable file, leaves the rest
  null, and is idempotent (second call does not re-allocate).
- After `removeEntry` of a file whose fingerprint is unique in `state.files`,
  the URL is revoked and the cache no longer contains that fingerprint.
- After `removeEntry` of a file whose fingerprint is **also** held by another
  remaining entry (shared-fingerprint case), the URL is NOT revoked.
- `cleanup()` revokes all URLs and clears the cache; a second `cleanup()` is
  a no-op.
- `reset()` and the abort rollback path do not revoke previously-allocated
  URLs.

Manual smoke test:

1. Drop a mix of JPG + PNG + MOV + HEIC into the modal. Expect: JPG/PNG show
   thumbnails; MOV shows `Film` icon; HEIC shows `ImageOff` icon.
2. Drop a 60 MB JPEG. Expect: `ImageOff` icon, no thumbnail allocation.
3. Remove a file. Expect: row disappears; no console "blob URL not revoked"
   warning.
4. Mount the modal in a StrictMode-enabled dev build, then close it. Expect:
   DevTools Memory → Heap snapshot shows no residual blob entries.
5. With the modal already open in the review step, drop more files in
   (`addFiles`). Newly added files get thumbnails on first paint;
   originally-queued files keep their previews (cache reuse).
6. Trigger an `<img onError>` (e.g. by mocking a broken blob): the row
   switches to icon fallback; remove an earlier same-named file; verify the
   error state does not bleed to a now-renumbered surviving row.

## Non-goals (explicit)

- No server-generated thumbnails. The whole point is local-only review before
  upload.
- No EXIF orientation correction in the thumbnail — `<img>` honors the EXIF
  flag in all currently-supported browsers (Chrome 81+, Safari 13.1+,
  Firefox 77+). If a user reports a sideways thumbnail, revisit.
- No click-to-zoom. The 40×40 row thumbnail is sufficient for "is this the
  right photo?" confirmation.
- No file list in `ProcessingStep` or `ErrorStep`. They keep `ProcessingPanel`.
