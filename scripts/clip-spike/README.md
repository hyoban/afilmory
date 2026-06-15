# clip-spike

Throwaway sandbox to validate CLIP image embeddings on a real photo folder.
Not part of the build. `uv sync` to set up; results saved to `embeddings.npz`.

```bash
uv sync
uv run embed.py "/Volumes/WD/Capture One/Capture/Output"
uv run search.py "fog at dawn"
uv run search.py --image /path/to/some.jpg --open
```
