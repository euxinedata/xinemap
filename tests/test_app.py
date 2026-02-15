import pytest
from httpx import ASGITransport, AsyncClient

from xinemap_server.app import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_index_html(client):
    resp = await client.get("/")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]


@pytest.mark.asyncio
async def test_spa_fallback(client):
    """Non-existent paths should return index.html for SPA routing."""
    resp = await client.get("/some/spa/route")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]


@pytest.mark.asyncio
async def test_static_asset(client):
    """Existing files in dist/assets/ should be served directly."""
    resp = await client.get("/assets/index-BHDFeV0V.css")
    assert resp.status_code == 200
    assert "text/css" in resp.headers["content-type"]
