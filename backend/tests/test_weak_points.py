"""
tests/test_weak_points.py
==========================
Unit tests for the update_weak_points logic in profile/weak_points.py.

These tests exercise only the pure update_weak_points() function (no LLM calls).
The extract_user_intent_concepts() function requires an API call and is
integration-tested separately.
"""

import pytest

from profile.weak_points import update_weak_points


def test_new_asking_concept_incremented():
    wp = {}
    result = update_weak_points(wp, asking=["研究空白"], demonstrated=[])
    assert result["研究空白"] == 1


def test_multiple_asks_accumulate():
    wp = {"概念A": 1}
    result = update_weak_points(wp, asking=["概念A", "概念B"], demonstrated=[])
    assert result["概念A"] == 2
    assert result["概念B"] == 1


def test_demonstrated_concept_decremented():
    wp = {"概念A": 2}
    result = update_weak_points(wp, asking=[], demonstrated=["概念A"])
    assert result["概念A"] == 1


def test_demonstrated_at_one_is_pruned():
    wp = {"概念A": 1}
    result = update_weak_points(wp, asking=[], demonstrated=["概念A"])
    assert "概念A" not in result


def test_demonstrated_unknown_concept_ignored():
    """Demonstrating knowledge of something not in weak_points should not crash."""
    wp = {"概念A": 1}
    result = update_weak_points(wp, asking=[], demonstrated=["概念B"])
    assert "概念B" not in result
    assert result["概念A"] == 1


def test_ask_and_demonstrate_same_concept_net_zero():
    """Simultaneous ask+demonstrate (unlikely, but should not go negative)."""
    wp = {"概念A": 1}
    result = update_weak_points(wp, asking=["概念A"], demonstrated=["概念A"])
    # Net: +1 then -1 = 1+1-1 = 1
    assert result.get("概念A", 0) == 1


def test_empty_strings_ignored():
    wp = {}
    result = update_weak_points(wp, asking=["", "  ", "合法概念"], demonstrated=[])
    assert "" not in result
    assert "  " not in result
    assert result["合法概念"] == 1


def test_original_dict_not_mutated():
    """update_weak_points must return a new dict, not modify in-place."""
    wp = {"A": 2}
    original_id = id(wp)
    result = update_weak_points(wp, asking=["B"], demonstrated=[])
    assert id(result) != original_id
    assert "B" not in wp
