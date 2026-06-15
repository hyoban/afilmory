"""Walk a folder, embed every image with CLIP, save to embeddings.npz."""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".heic", ".tif", ".tiff", ".webp"}


def find_images(root: Path) -> list[Path]:
    return sorted(
        p
        for p in root.rglob("*")
        if p.is_file()
        and p.suffix.lower() in IMAGE_EXTS
        and not p.name.startswith("._")
    )


def pick_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", type=Path)
    ap.add_argument("--model", default="clip-ViT-B-32")
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--out", type=Path, default=Path("embeddings.npz"))
    args = ap.parse_args()

    device = pick_device()
    print(f"device: {device}")
    print(f"model:  {args.model}")

    candidates = find_images(args.folder)
    if not candidates:
        print(f"no images under {args.folder}", file=sys.stderr)
        return 1
    print(f"images: {len(candidates)}")

    print("loading model...")
    t0 = time.perf_counter()
    model = SentenceTransformer(args.model, device=device)
    print(f"  loaded in {time.perf_counter() - t0:.1f}s")

    paths_kept: list[str] = []
    chunks: list[np.ndarray] = []
    t_load = 0.0
    t_embed = 0.0

    for i in tqdm(range(0, len(candidates), args.batch), desc="embed"):
        batch_paths = candidates[i : i + args.batch]

        ts = time.perf_counter()
        imgs: list[Image.Image] = []
        kept: list[str] = []
        for p in batch_paths:
            try:
                imgs.append(Image.open(p).convert("RGB"))
                kept.append(str(p))
            except Exception as e:
                print(f"  skip {p.name}: {e}", file=sys.stderr)
        t_load += time.perf_counter() - ts

        if not imgs:
            continue

        ts = time.perf_counter()
        with torch.inference_mode():
            v = model.encode(
                imgs,
                batch_size=len(imgs),
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
        t_embed += time.perf_counter() - ts

        chunks.append(v.astype(np.float32))
        paths_kept.extend(kept)

    if not chunks:
        print("nothing embedded", file=sys.stderr)
        return 1

    emb = np.vstack(chunks)
    np.savez(args.out, paths=np.array(paths_kept), embeddings=emb)

    n = len(paths_kept)
    size_mb = args.out.stat().st_size / 1024**2
    print()
    print(f"embedded:    {n}")
    print(f"shape:       {emb.shape} ({emb.dtype})")
    print(f"file:        {args.out} ({size_mb:.2f} MB)")
    print(f"load time:   {t_load:.2f}s ({t_load * 1000 / n:.1f} ms/img)")
    print(f"embed time:  {t_embed:.2f}s ({t_embed * 1000 / n:.1f} ms/img)")
    print(f"total:       {t_load + t_embed:.2f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
