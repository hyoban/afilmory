# clip-embedder

Stdin-driven CLIP image embedder used by the variant cluster report.

Reads absolute file paths from stdin (one per line), writes one JSON record per
line on stdout: `{"path": "...", "embedding": "<base64 fp32>"}`. Failures go to
stderr as `{"path": "...", "error": "..."}` and are skipped.

```bash
uv sync
echo "/abs/path/to/photo.jpg" | uv run embed.py
# or
uv run embed.py --paths-file paths.txt > embeddings.jsonl
```

Auto-selects MPS / CUDA / CPU. Default model `clip-ViT-B-32` (512-d).
