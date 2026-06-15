"""Stdin-driven CLIP image embedder.

Reads absolute paths (one per line) on stdin or via --paths-file, writes one
JSON record per line on stdout: `{"path", "embedding": <base64 fp32>}`.
Failures go to stderr as `{"path", "error"}` and the run continues.
"""
from __future__ import annotations

import argparse
import base64
import json
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


def encode_b64(vec: np.ndarray) -> str:
    return base64.b64encode(vec.astype(np.float32).tobytes()).decode("ascii")


def read_paths(args: argparse.Namespace) -> list[str]:
    if args.paths_file:
        return [
            line.strip()
            for line in Path(args.paths_file).read_text().splitlines()
            if line.strip()
        ]
    return [line.strip() for line in sys.stdin if line.strip()]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="clip-ViT-B-32")
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--paths-file", type=str, help="alternative to stdin")
    args = ap.parse_args()

    paths = read_paths(args)
    if not paths:
        print(json.dumps({"event": "no-input"}), file=sys.stderr)
        return 0

    device = pick_device()
    print(
        json.dumps(
            {"event": "ready", "device": device, "model": args.model, "count": len(paths)}
        ),
        file=sys.stderr,
    )

    model = SentenceTransformer(args.model, device=device)

    for start in range(0, len(paths), args.batch):
        batch_paths = paths[start : start + args.batch]
        imgs: list[Image.Image] = []
        kept: list[str] = []
        for p in batch_paths:
            try:
                imgs.append(Image.open(p).convert("RGB"))
                kept.append(p)
            except Exception as e:
                sys.stderr.write(json.dumps({"path": p, "error": str(e)}) + "\n")
        if not imgs:
            continue
        with torch.inference_mode():
            vecs = model.encode(
                imgs,
                batch_size=len(imgs),
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
        for path, vec in zip(kept, vecs):
            sys.stdout.write(
                json.dumps({"path": path, "embedding": encode_b64(vec)}) + "\n"
            )
        sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
