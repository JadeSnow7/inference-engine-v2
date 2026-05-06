"""
tests/test_redis_store.py
==========================
Unit tests for the extended RedisConversationStore (artifact persistence)
and RedisProfileStore (weak-point update).

Uses fakeredis for an in-process Redis instance — no real Redis needed.
"""

import json

import pytest
import pytest_asyncio

try:
    import fakeredis.aioredis as fakeredis
    HAS_FAKEREDIS = True
except ImportError:
    HAS_FAKEREDIS = False

pytestmark = pytest.mark.skipif(not HAS_FAKEREDIS, reason="fakeredis not installed")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def fake_client():
    client = fakeredis.FakeRedis(decode_responses=True)
    yield client
    await client.aclose()


@pytest_asyncio.fixture
async def conv_store(fake_client):
    from store.redis_store import RedisConversationStore
    return RedisConversationStore(fake_client)


@pytest_asyncio.fixture
async def profile_store(fake_client):
    from store.redis_store import RedisProfileStore
    return RedisProfileStore(fake_client)


# ---------------------------------------------------------------------------
# RedisConversationStore — artifact tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_save_and_get_artifact(conv_store):
    papers = [{"id": "p1", "title": "BERT", "year": 2018, "score": 0.9, "embedding": [0.1, 0.2]}]
    gaps = [{"id": "g1", "description": "Gap A", "severity": "high", "addressed_by": 0}]
    outline = "1. Introduction\n2. Method"

    await conv_store.save_session_artifact(
        "user_a", "sess_1",
        papers=papers, gaps=gaps, final_outline=outline,
    )

    artifact = await conv_store.get_session_artifact("user_a", "sess_1")
    assert artifact["final_outline"] == outline
    assert artifact["gaps"][0]["description"] == "Gap A"

    # Embeddings must be stripped
    assert "embedding" not in artifact["papers"][0]


@pytest.mark.asyncio
async def test_get_missing_artifact_returns_empty(conv_store):
    result = await conv_store.get_session_artifact("nobody", "no_session")
    assert result == {}


@pytest.mark.asyncio
async def test_artifact_partial_save(conv_store):
    """Only papers, no gaps or outline — should still work."""
    await conv_store.save_session_artifact("u", "s", papers=[{"id": "x", "title": "T", "year": 2020, "score": 0.5}])
    artifact = await conv_store.get_session_artifact("u", "s")
    assert "papers" in artifact
    assert "gaps" not in artifact
    assert "final_outline" not in artifact


@pytest.mark.asyncio
async def test_artifact_overwrite(conv_store):
    await conv_store.save_session_artifact("u", "s", final_outline="v1")
    await conv_store.save_session_artifact("u", "s", final_outline="v2")
    artifact = await conv_store.get_session_artifact("u", "s")
    assert artifact["final_outline"] == "v2"


# ---------------------------------------------------------------------------
# RedisProfileStore — weak_points update
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_weak_points(profile_store):
    from profile.models import UserProfile
    profile = UserProfile(weak_points={"概念A": 2})
    await profile_store.set("user_b", profile)

    await profile_store.update_weak_points("user_b", {"概念A": 3, "概念B": 1})

    updated = await profile_store.get("user_b")
    assert updated["weak_points"]["概念A"] == 3
    assert updated["weak_points"]["概念B"] == 1


@pytest.mark.asyncio
async def test_update_weak_points_no_profile(profile_store):
    """Should silently succeed if profile doesn't exist."""
    await profile_store.update_weak_points("ghost_user", {"x": 1})
