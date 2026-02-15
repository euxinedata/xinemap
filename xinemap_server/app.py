import os
from pathlib import Path

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI()

# Resolve static files directory: installed package vs editable install
_pkg_static = Path(__file__).resolve().parent / "static"
_dev_static = Path(__file__).resolve().parent.parent / "dist"
STATIC_DIR = _pkg_static if _pkg_static.is_dir() else _dev_static


class FileEntry(BaseModel):
    path: str
    content: str


class GenerateRequest(BaseModel):
    files: list[FileEntry]


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/dbt/project")
async def dbt_project():
    project_file = Path(os.getcwd()) / "dbt_project.yml"
    if not project_file.is_file():
        return {"found": False}
    data = yaml.safe_load(project_file.read_text())
    return {
        "found": True,
        "projectName": data.get("name", ""),
        "modelPaths": data.get("model-paths", ["models"]),
        "projectDir": str(project_file.parent),
    }


@app.post("/api/dbt/generate")
async def dbt_generate(req: GenerateRequest):
    project_dir = Path(os.getcwd())
    project_file = project_dir / "dbt_project.yml"
    if not project_file.is_file():
        raise HTTPException(status_code=404, detail="dbt_project.yml not found")
    data = yaml.safe_load(project_file.read_text())
    model_path = data.get("model-paths", ["models"])[0]
    base_dir = (project_dir / model_path).resolve()
    written = []
    for f in req.files:
        target = (base_dir / f.path).resolve()
        if not str(target).startswith(str(project_dir.resolve())):
            raise HTTPException(status_code=400, detail=f"Invalid path: {f.path}")
        os.makedirs(target.parent, exist_ok=True)
        target.write_text(f.content)
        written.append(str(target.relative_to(project_dir)))
    return {"written": written, "modelPath": model_path}


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
