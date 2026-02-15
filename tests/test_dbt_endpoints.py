import os
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from xinemap_server.app import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_dbt_project_not_found(client, tmp_path):
    with patch("xinemap_server.app.os.getcwd", return_value=str(tmp_path)):
        resp = await client.get("/api/dbt/project")
    assert resp.status_code == 200
    assert resp.json() == {"found": False}


@pytest.mark.asyncio
async def test_dbt_project_found(client, tmp_path):
    yml = tmp_path / "dbt_project.yml"
    yml.write_text("name: my_project\nmodel-paths: ['models', 'other']\n")
    with patch("xinemap_server.app.os.getcwd", return_value=str(tmp_path)):
        resp = await client.get("/api/dbt/project")
    data = resp.json()
    assert data["found"] is True
    assert data["projectName"] == "my_project"
    assert data["modelPaths"] == ["models", "other"]
    assert data["projectDir"] == str(tmp_path)


@pytest.mark.asyncio
async def test_dbt_generate_writes_files(client, tmp_path):
    yml = tmp_path / "dbt_project.yml"
    yml.write_text("name: test_proj\nmodel-paths: ['models']\n")
    with patch("xinemap_server.app.os.getcwd", return_value=str(tmp_path)):
        resp = await client.post("/api/dbt/generate", json={
            "files": [
                {"path": "staging/stg_customer.sql", "content": "SELECT 1"},
            ],
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["modelPath"] == "models"
    assert "models/staging/stg_customer.sql" in data["written"]
    assert (tmp_path / "models" / "staging" / "stg_customer.sql").read_text() == "SELECT 1"


@pytest.mark.asyncio
async def test_dbt_generate_no_project(client, tmp_path):
    with patch("xinemap_server.app.os.getcwd", return_value=str(tmp_path)):
        resp = await client.post("/api/dbt/generate", json={"files": []})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_dbt_generate_path_traversal(client, tmp_path):
    yml = tmp_path / "dbt_project.yml"
    yml.write_text("name: test_proj\n")
    with patch("xinemap_server.app.os.getcwd", return_value=str(tmp_path)):
        resp = await client.post("/api/dbt/generate", json={
            "files": [
                {"path": "../../etc/passwd", "content": "bad"},
            ],
        })
    assert resp.status_code == 400
