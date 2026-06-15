"""Tests for build-reports-data.py aggregation.

Run with:  pip install pandas pytest  &&  python3 -m pytest scripts/test_build_reports_data.py -v
"""
from __future__ import annotations

import importlib.util
import os
from typing import Any

import pandas as pd
import pytest

# The build script is hyphenated (not a normal importable module name), so load
# it from its file path.
_SCRIPT = os.path.join(os.path.dirname(__file__), "build-reports-data.py")
_spec = importlib.util.spec_from_file_location("build_reports_data", _SCRIPT)
assert _spec is not None and _spec.loader is not None
build_reports_data = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build_reports_data)


def _row(**overrides: Any) -> dict[str, Any]:
    """One item-level CSV row with sensible defaults, overridable per field."""
    base: dict[str, Any] = {
        "date": "2026-05-01 14:30:00",
        "status": "Success",
        "invoice_no": "INV1",
        "item_name": "Caramel Boba Coffee",
        "category_name": "Coffee",
        "item_quantity": 1,
        "item_total": 250.0,
        "order_type": "Dine In",
        "payment_type": "UPI",
    }
    base.update(overrides)
    return base


def test_build_aggregates_success_orders() -> None:
    frame = pd.DataFrame([
        _row(invoice_no="INV1", item_quantity=2, item_total=200),
        _row(invoice_no="INV2", item_quantity=1, item_total=150, item_name="Matcha Latte"),
    ])
    out = build_reports_data.build(frame)
    assert out["summary"]["orders"] == 2
    assert out["summary"]["items_sold"] == 3
    assert out["summary"]["revenue"] == 350.0


def test_build_excludes_non_success_rows() -> None:
    frame = pd.DataFrame([
        _row(invoice_no="INV1", status="Success", item_quantity=1, item_total=100),
        _row(invoice_no="INV2", status="Cancelled", item_quantity=5, item_total=999),
    ])
    out = build_reports_data.build(frame)
    assert out["summary"]["orders"] == 1
    assert out["summary"]["items_sold"] == 1
    assert out["summary"]["revenue"] == 100.0


def test_build_raises_when_no_success_rows() -> None:
    frame = pd.DataFrame([_row(status="Cancelled")])
    with pytest.raises(ValueError, match="No 'Success' rows"):
        build_reports_data.build(frame)


def test_build_output_has_expected_shape() -> None:
    out = build_reports_data.build(pd.DataFrame([_row()]))
    for key in (
        "meta", "summary", "top_items", "by_category", "by_hour",
        "by_dow", "by_week", "heatmap", "daily", "order_type", "payment",
    ):
        assert key in out, f"missing key: {key}"
    assert len(out["heatmap"]["rows"]) == 7
    assert out["heatmap"]["hours"] == list(range(8, 24))


def test_payment_type_upi_is_normalised() -> None:
    out = build_reports_data.build(pd.DataFrame([_row(payment_type="UPI - GPay")]))
    assert out["payment"][0]["type"] == "UPI"


def test_build_coerces_malformed_numeric_values_to_zero() -> None:
    # Hostile/garbled CSV cells must coerce to 0, not crash the build.
    frame = pd.DataFrame([
        _row(invoice_no="INV1", item_quantity="oops", item_total="bad"),
        _row(invoice_no="INV1", item_quantity=2, item_total=100),
    ])
    out = build_reports_data.build(frame)
    assert out["summary"]["items_sold"] == 2
    assert out["summary"]["revenue"] == 100.0


def test_build_drops_rows_with_unparseable_dates() -> None:
    frame = pd.DataFrame([
        _row(date="not-a-date", item_quantity=9, item_total=900),
        _row(date="2026-05-02 10:00:00", item_quantity=1, item_total=100),
    ])
    out = build_reports_data.build(frame)
    assert out["summary"]["items_sold"] == 1
    assert out["summary"]["revenue"] == 100.0


def test_avg_order_value_is_per_invoice_not_per_row() -> None:
    # AOV must average per invoice basket, not per line-item row.
    frame = pd.DataFrame([
        _row(invoice_no="INV1", item_total=100),
        _row(invoice_no="INV1", item_total=50),    # INV1 basket = 150
        _row(invoice_no="INV2", item_total=200),    # INV2 basket = 200
    ])
    out = build_reports_data.build(frame)
    # Per-invoice mean (150 + 200) / 2 = 175.0, NOT the row mean 350/3 = 116.67.
    assert out["summary"]["avg_order_value"] == 175.0


def test_by_week_groups_to_monday_week_start() -> None:
    # Wed 2026-05-06 and Sun 2026-05-10 share the week starting Mon 2026-05-04.
    frame = pd.DataFrame([
        _row(date="2026-05-06 12:00:00", invoice_no="INV1", item_quantity=2),
        _row(date="2026-05-10 18:00:00", invoice_no="INV2", item_quantity=3),
        _row(date="2026-05-13 18:00:00", invoice_no="INV3", item_quantity=1),  # next week
    ])
    out = build_reports_data.build(frame)
    weeks = {w["week_start"]: w for w in out["by_week"]}
    assert weeks["2026-05-04"]["qty"] == 5
    assert weeks["2026-05-04"]["orders"] == 2
    assert weeks["2026-05-11"]["qty"] == 1


def test_heatmap_cell_counts_match_day_and_hour() -> None:
    frame = pd.DataFrame([
        _row(date="2026-05-04 14:00:00", invoice_no="INV1", item_quantity=2),  # Mon 2pm
        _row(date="2026-05-04 14:30:00", invoice_no="INV2", item_quantity=1),  # Mon 2pm
        _row(date="2026-05-05 09:00:00", invoice_no="INV3", item_quantity=4),  # Tue 9am
    ])
    out = build_reports_data.build(frame)
    rows = {r["dow"]: r for r in out["heatmap"]["rows"]}
    assert rows["Mon"]["14"] == 3
    assert rows["Tue"]["9"] == 4
    assert rows["Mon"]["9"] == 0


def test_payment_swiggy_upi_kept_distinct_from_plain_upi() -> None:
    frame = pd.DataFrame([
        _row(invoice_no="INV1", payment_type="UPI - GPay"),
        _row(invoice_no="INV2", payment_type="Swiggy Pay (UPI)"),
    ])
    out = build_reports_data.build(frame)
    types = {p["type"] for p in out["payment"]}
    assert "UPI" in types                  # "UPI - GPay" -> UPI
    assert "Swiggy Pay (UPI)" in types      # not collapsed into UPI


def test_payment_upi_variants_merge_into_single_bucket() -> None:
    # Multiple UPI variants must collapse to ONE "UPI" entry (no duplicate
    # chart keys, no split donut arc), with all invoices summed.
    frame = pd.DataFrame([
        _row(invoice_no="INV1", payment_type="UPI"),
        _row(invoice_no="INV2", payment_type="UPI - PhonePe"),
        _row(invoice_no="INV3", payment_type="UPI Collect"),
    ])
    out = build_reports_data.build(frame)
    upi = [p for p in out["payment"] if p["type"] == "UPI"]
    assert len(upi) == 1
    assert upi[0]["orders"] == 3


def test_load_csv_skips_preamble_before_header(tmp_path) -> None:
    csv = tmp_path / "export.csv"
    csv.write_text(
        "PetPooja preamble line\n"
        "another junk line\n"
        "restaurant_name,invoice_no,item_name,category_name,item_quantity,"
        "item_total,status,date,order_type,payment_type\n"
        "BnB,INV1,Coffee,Coffee,1,250,Success,2026-05-01 14:00:00,Dine In,UPI\n",
        encoding="utf-8",
    )
    frame = build_reports_data.load_csv(str(csv))
    assert list(frame["item_name"]) == ["Coffee"]
    assert frame.iloc[0]["invoice_no"] == "INV1"


def test_load_csv_raises_without_header(tmp_path) -> None:
    csv = tmp_path / "bad.csv"
    csv.write_text("just,some,random\ncsv,without,header\n", encoding="utf-8")
    with pytest.raises(ValueError, match="No PetPooja header row"):
        build_reports_data.load_csv(str(csv))


def test_main_returns_1_when_no_csvs(monkeypatch) -> None:
    monkeypatch.setattr(build_reports_data.glob, "glob", lambda _pattern: [])
    assert build_reports_data.main() == 1
