# Variant Cluster Report — Design

**Date**: 2026-04-26
**Status**: Approved for implementation planning
**Spike evidence**: `scripts/clip-spike/` (CLIP-ViT-B/32 on M4 Max → 32.6 ms/img, 0.34 MB for 152 photos, image-to-image similarity 0.75–1.0)

## Goal

At builder time, identify clusters of visually-similar photos in the gallery's photo store and emit a static HTML + JSON report so the curator can decide what to dedupe (tight clusters) or which frame to keep (loose clusters).

The report is **information**, not action. The curator decides; the tool does not mutate the manifest.

## Non-goals (MVP)

- No automatic deletion or hiding of photos
- No integration with the dashboard UI (`be/apps/dashboard`)
- No mutation of `photos-manifest.json`
- No visitor-facing surface (this is curator-only)
- No text-to-image search (separate decision; not in this spec)
- No "find similar to this photo" interactive query (deferred until report proves valuable)

## User workflow

1. Curator runs `pnpm build:manifest` (existing). Manifest + thumbnails are produced as today.
2. Curator runs `pnpm build:variant-report` (new).
3. The command:
   - Reads `apps/web/src/data/photos-manifest.json`
   - Embeds any photos not in the embedding cache (incremental)
   - Computes pairwise cosine similarity, forms two-threshold clusters
   - Writes `cluster-report.html` + `cluster-report.json`
4. Curator opens the HTML in a browser, visually scans clusters, decides what to remove from S3 / config, re-runs `build:manifest`.

The tool is **opt-in and out-of-band** — never blocks or slows the regular build.

## Architecture

Three thin layers, each independently testable:

```
photos-manifest.json (input)
        ↓
[Node clusterer]   packages/builder/src/cluster/
        ↓ (paths needing embedding)
[Python embedder]  scripts/clip-embedder/
        ↓ (embeddings.jsonl on stdout)
[Node clusterer]   merge with cache → cosine sim → 2-threshold clusters
        ↓
cluster-report.html + cluster-report.json
```

### Layer 1 — Python embedder (`scripts/clip-embedder/`)

A tiny stdin/stdout CLI. Productized version of the spike's `embed.py`.

- **Input**: list of absolute file paths, one per line on stdin (or via `--paths-file`)
- **Output**: JSONL on stdout, one record per input: `{"path": "...", "embedding": [512 floats]}`
- **Model**: `clip-ViT-B-32` (default, configurable to `CLIP-ViT-L-14` later)
- **Device**: auto — `mps` if available, else `cuda`, else `cpu`
- **No caching at this layer** — caller (Node) owns the cache. Embedder is pure function: paths → embeddings.
- **Failure mode**: skip unreadable files, write skip records to stderr; do not crash the batch.

This layer is the only place Python lives. Adding it costs the maintainer a `uv sync` step; in CI it requires Python 3.11+ in the image.

### Layer 2 — Node clusterer (`packages/builder/src/cluster/`)

Owns orchestration, caching, similarity, clustering.

**Inputs**:
- `apps/web/src/data/photos-manifest.json` (photo list + IDs)
- `apps/web/public/thumbnails/<id>.<ext>` (image source for the embedder — see "Photo source" below)
- `apps/web/src/data/.cache/clip-embeddings.json` (cache, see below)

**Process**:
1. Walk the manifest → build `(photoId, thumbnailPath, mtime, size)` table
2. Diff against cache: photos with matching `(thumbnailPath, mtime, size)` keep cached embedding; the rest are "stale"
3. Spawn the Python embedder with stale paths on stdin; collect embeddings; merge into cache
4. Persist updated cache atomically
5. Compute pairwise cosine similarity (dense matrix; for N ≤ 50k this is fine — 50k × 50k floats ≈ 10 GB but we only need the upper triangle and can stream; for MVP < 10k photos use the dense path)
6. Form clusters at two thresholds:
   - **Tight**: similarity ≥ 0.92 → "likely the same shot, different export"
   - **Loose**: similarity ≥ 0.80 → "likely the same moment / burst / bracket"
7. A "cluster" is a connected component under the threshold edge (single-linkage). Singletons (cluster size = 1) are dropped from the report.

**Output**: an in-memory report structure passed to Layer 3.

### Layer 3 — Report renderer (Node)

Pure function: report structure → `cluster-report.html` and `cluster-report.json`.

- `cluster-report.html` — self-contained, no JS framework, just `<img>` tags + minimal inline CSS. Two top sections:
  - **Tight clusters (likely duplicates)** — most actionable, smallest count
  - **Loose clusters (same moment)** — larger count, supports "pick a keeper" decisions
- Each cluster shows thumbnails side by side with similarity scores overlaid, and the photo ID + filename for traceability.
- Images are referenced via relative path to `apps/web/public/thumbnails/`, so opening the HTML from repo root works.

- `cluster-report.json` — same data, machine-readable, for any future automation.

## Photo source: existing thumbnails

Use `apps/web/public/thumbnails/` as the embedder input.

- CLIP's input is resized to 224×224 (B-32) or 336×336 (L-14) anyway — thumbnails are sufficient resolution
- Avoids re-downloading originals from S3 (slow, costs egress)
- Forces the workflow contract: `build:variant-report` must follow `build:manifest`
- **Resolution requirement**: thumbnails must be ≥ 224×224 px (verified per file before passing to embedder). Smaller thumbnails are upscaled by Pillow with a logged warning — quality may degrade but won't crash.
- If a photo is in the manifest but its thumbnail is missing on disk, log a warning and skip it (don't fail the whole report)

If, in a later iteration, we want to cluster a photo *folder* not yet in the manifest (e.g., the Capture One export folder before upload), we add a `--from-folder <path>` mode that bypasses the manifest. Out of scope for this spec.

## Embedding cache

**File**: `apps/web/src/data/.cache/clip-embeddings.json` (gitignored)

**Schema** (JSON for inspectability; switch to binary later if size becomes an issue):
```json
{
  "model": "clip-ViT-B-32",
  "dim": 512,
  "entries": {
    "<photoId>": {
      "thumbnailPath": "thumbnails/abc123.jpg",
      "mtime": 1745683200000,
      "size": 184327,
      "embedding": [/* 512 floats, base64-encoded fp32 to keep file small */]
    }
  }
}
```

**Cache key**: `(photoId, thumbnailPath, mtime, size)`. Any change invalidates the embedding.

**Size projection**: 512 fp32 = 2 KB raw; with JSON wrapping (base64 or array literal) and metadata, ≈ 3 KB/photo. 10k photos ≈ 30 MB; 100k photos ≈ 300 MB. Acceptable as JSON until ~50k; switch to a binary format (npz, parquet) past that.

**Cache invalidation on model change**: if `model` field in the cache differs from the current run's model, full re-embed. Logged loudly.

**Atomicity**: write to `clip-embeddings.json.tmp` and `rename`. Avoids half-written cache on crash.

## CLI surface

```bash
pnpm build:variant-report
  [--tight 0.92]
  [--loose 0.80]
  [--model clip-ViT-B-32]
  [--out apps/web/cluster-report.html]
  [--no-cache]                # force full re-embed (debugging)
  [--manifest path]           # override manifest location
```

Output goes to `apps/web/cluster-report.html` and `apps/web/cluster-report.json` by default. Both are gitignored.

The command exits 0 on success, prints a summary like:
```
Embedded:    24 new, 1452 cached
Tight clusters: 17 (covering 41 photos)
Loose clusters: 38 (covering 156 photos)
Report:      apps/web/cluster-report.html
```

## Cross-platform plan

**Mac (primary use case)**: Python + torch with MPS. ~30 ms/img on M4 Max. Confirmed by spike.

**Linux CI / server**: Python + torch with CPU fallback. ~300 ms/img on a typical CI runner. For 10k photos, one-time embed ~50 minutes, incremental ~seconds.

**Choice rationale (rejected alternatives)**:
- *Node + `@xenova/transformers` (ONNX)*: would remove Python dependency but is CPU-only on both platforms in Node, slower than Python+MPS on Mac (the primary use case), and re-validating quality vs. our spike model adds risk. Revisit if Python prereq becomes painful.
- *Hosted API (Replicate / Voyage)*: simplest deployment but adds a network dependency and cost ($1–5 per full re-embed of 10k). Overkill for a curator-only tool that runs locally.

**CI**: don't run `build:variant-report` in CI by default — the report is a curator review tool, not a build artifact.

## Threshold defaults & how they were picked

From the spike on 152 Fuji exports:

- DSCF6005 / DSCF6005 1 / DSCF6005 3 (same shot, different Capture One export) clustered at **0.95+** similarity
- "Same scene, different angle" hit **0.75–0.85**
- Cross-scene hits topped out around **0.30**

Defaults:
- **Tight = 0.92** — captures Capture One variants and very-near burst frames; rarely false-positive
- **Loose = 0.80** — captures burst sequences and bracketed shots; some "same scene different framing" will appear (intentional — that's still a "pick a keeper" decision)

Both are configurable. Adjust after first real run on your archive.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Python prereq friction in CI | Don't run in CI by default. Document `uv` install for CI image when needed. |
| Cache file grows large | JSON is fine to ~50k photos. Document upgrade path to binary format. |
| Wrong threshold for your archive | Both thresholds are CLI flags. First-run feedback drives tuning. |
| Embedder crashes on a malformed JPEG | Embedder skips bad files, logs to stderr; report continues. |
| Model version drift breaks cache | Cache stores model name; mismatch triggers full re-embed with loud log. |
| Pairwise similarity for very large libraries | Dense matrix is fine for ≤10k. Past that: switch to ANN (faiss / hnswlib). Out of scope until reached. |

## Open questions for implementation planning

These don't block the spec but should be settled in the plan:

1. Exact thumbnail filename pattern in `apps/web/public/thumbnails/` — need to verify by reading the builder's thumbnail writer.
2. Where the `pnpm build:variant-report` script lives — `packages/builder/package.json` or root `package.json`.
3. Whether to ship a sample `.gitignore` patch for `cluster-report.html`/`.json` and `.cache/clip-embeddings.json`.

## Success criteria

The first real run on your archive produces a report where:

1. The **tight section** correctly groups your obvious Capture One export variants (i.e., what you'd visually call "the same photo")
2. The **loose section** groups burst sequences in a way that helps you pick a keeper without manual scrolling
3. The total runtime on a fresh embed of your full library is under 10 minutes on Mac, under 1 hour on a Linux CI runner
4. Incremental runs (a few new photos added) complete in under 30 seconds
