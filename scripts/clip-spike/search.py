"""Query embeddings.npz with text or an image and show top-K matches."""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from sentence_transformers import SentenceTransformer


def pick_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("query", nargs="?", help="text query (omit if using --image)")
    ap.add_argument("--image", type=Path, help="image path for image-to-image search")
    ap.add_argument("--embeddings", type=Path, default=Path("embeddings.npz"))
    ap.add_argument("--model", default="clip-ViT-B-32")
    ap.add_argument("-k", type=int, default=10)
    ap.add_argument("--open", action="store_true", help="open top results in Preview")
    args = ap.parse_args()

    if args.image is None and not args.query:
        print("provide a text query or --image PATH", file=sys.stderr)
        return 2
    if args.image is not None and args.query:
        print("provide either text or --image, not both", file=sys.stderr)
        return 2

    data = np.load(args.embeddings, allow_pickle=False)
    paths = data["paths"]
    emb = data["embeddings"]

    device = pick_device()
    model = SentenceTransformer(args.model, device=device)

    if args.image:
        img = Image.open(args.image).convert("RGB")
        q = model.encode([img], normalize_embeddings=True, convert_to_numpy=True)
        label = f"image: {args.image.name}"
    else:
        q = model.encode([args.query], normalize_embeddings=True, convert_to_numpy=True)
        label = f"text:  {args.query!r}"

    sims = emb @ q[0]
    idx = np.argsort(-sims)[: args.k]

    print(f"\nquery: {label}")
    print(f"top-{args.k}:")
    for r, i in enumerate(idx, 1):
        print(f"  {r:2d}. {sims[i]:.4f}  {paths[i]}")

    if args.open:
        subprocess.run(["open", "-a", "Preview", *(str(paths[i]) for i in idx)])

    return 0


if __name__ == "__main__":
    sys.exit(main())
