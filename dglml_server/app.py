from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# Resolve static files directory: installed package vs editable install
_pkg_static = Path(__file__).resolve().parent / "static"
_dev_static = Path(__file__).resolve().parent.parent / "dist"
STATIC_DIR = _pkg_static if _pkg_static.is_dir() else _dev_static


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Mount static assets (js, css, etc.)
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


@app.get("/{path:path}")
async def spa_fallback(path: str):
    """Serve static files or fall back to index.html for SPA routing."""
    file = (STATIC_DIR / path).resolve()
    if path and file.is_file() and str(file).startswith(str(STATIC_DIR.resolve())):
        return FileResponse(file)
    return FileResponse(STATIC_DIR / "index.html")
