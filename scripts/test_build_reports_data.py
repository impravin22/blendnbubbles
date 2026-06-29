"""Tests for build-reports-data.py (row-level dashboard schema).

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
        "date": "2026-05-04 14:30:00",  # 2026-05-04 is a Monday
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


def test_build_returns_meta_dims_rows() -> None:
    out = build_reports_data.build(pd.DataFrame([_row()]))
    assert set(out) == {"meta", "dims", "rows"}
    assert set(out["dims"]) == {
        "hours",
        "dows",
        "weeks",
        "months",
        "drinks",
        "categories",
        "order_types",
        "payments",
    }


def test_meta_headline_totals() -> None:
    frame = pd.DataFrame(
        [
            _row(invoice_no="INV1", item_quantity=2, item_total=200),
            _row(
                invoice_no="INV1",
                item_quantity=1,
                item_total=100,
                item_name="Matcha Latte",
            ),
            _row(invoice_no="INV2", item_quantity=1, item_total=150),
        ]
    )
    meta = build_reports_data.build(frame)["meta"]
    assert meta["orders"] == 2  # distinct invoices
    assert meta["items"] == 4  # 2 + 1 + 1
    assert meta["revenue"] == 450.0


def test_rows_one_per_success_line_item_with_fields() -> None:
    frame = pd.DataFrame(
        [
            _row(
                date="2026-05-04 20:30:00",
                item_quantity=2,
                item_total=250,
                item_name="Caramel Boba Coffee",
                category_name="Coffee",
                order_type="Dine In",
                payment_type="UPI",
            ),
        ]
    )
    rows = build_reports_data.build(frame)["rows"]
    assert len(rows) == 1
    r = rows[0]
    assert r["drink"] == "Caramel Boba Coffee"
    assert r["category"] == "Coffee"
    assert r["qty"] == 2
    assert r["revenue"] == 250.0
    assert r["hour"] == 20
    assert r["dow"] == 0  # Monday
    assert r["week"] == "2026-05-04"
    assert r["month"] == "2026-05"
    assert r["order_type"] == "Dine In"
    assert r["payment"] == "UPI"
    assert r["inv"] == 0


def test_rows_exclude_non_success() -> None:
    frame = pd.DataFrame(
        [
            _row(invoice_no="INV1", status="Success"),
            _row(invoice_no="INV2", status="Cancelled", item_quantity=9),
        ]
    )
    rows = build_reports_data.build(frame)["rows"]
    assert len(rows) == 1


def test_invoice_ids_are_compact_and_stable() -> None:
    frame = pd.DataFrame(
        [
            _row(invoice_no="ZZZ-9", item_name="A"),
            _row(invoice_no="ZZZ-9", item_name="B"),  # same invoice
            _row(invoice_no="AAA-1", item_name="C"),  # different invoice
        ]
    )
    ids = [r["inv"] for r in build_reports_data.build(frame)["rows"]]
    assert ids[0] == ids[1]  # same invoice -> same id
    assert ids[2] != ids[0]  # distinct invoice -> distinct id
    assert set(ids) == {0, 1}  # compact, zero-based
    assert all(isinstance(i, int) for i in ids)


def test_payment_upi_variants_normalised_in_rows() -> None:
    # The real data labels UPI "Other (Upijio)"; both that and explicit UPI
    # strings must collapse to one "UPI" bucket.
    frame = pd.DataFrame(
        [
            _row(invoice_no="A", payment_type="UPI - PhonePe"),
            _row(invoice_no="B", payment_type="Other (Upijio)"),
            _row(invoice_no="C", payment_type="Cash"),
        ]
    )
    rows = build_reports_data.build(frame)["rows"]
    payments = {r["payment"] for r in rows}
    assert payments == {"UPI", "Cash"}


def test_dims_ordered_and_fixed_axes() -> None:
    frame = pd.DataFrame(
        [
            _row(invoice_no="INV1", item_name="Low", item_quantity=1),
            _row(invoice_no="INV2", item_name="High", item_quantity=9),
        ]
    )
    dims = build_reports_data.build(frame)["dims"]
    assert dims["drinks"][0] == "High"  # ordered by total qty desc
    assert dims["hours"] == list(range(8, 24))
    assert dims["dows"] == ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def test_month_dim_sorted_and_rows_bucketed_by_date() -> None:
    # Each row's month comes from its own order date (not week_start), and the
    # months axis is the sorted set of distinct YYYY-MM buckets.
    frame = pd.DataFrame(
        [
            _row(invoice_no="A", date="2026-06-02 10:00:00"),  # June
            _row(invoice_no="B", date="2026-04-30 23:00:00"),  # April
            _row(invoice_no="C", date="2026-05-26 18:00:00"),  # May
        ]
    )
    out = build_reports_data.build(frame)
    assert out["dims"]["months"] == ["2026-04", "2026-05", "2026-06"]
    months_in_rows = {r["month"] for r in out["rows"]}
    assert months_in_rows == {"2026-04", "2026-05", "2026-06"}


def test_build_raises_when_no_success_rows() -> None:
    with pytest.raises(ValueError, match="No 'Success' rows"):
        build_reports_data.build(pd.DataFrame([_row(status="Cancelled")]))


def test_malformed_numerics_coerced_to_zero() -> None:
    frame = pd.DataFrame(
        [
            _row(invoice_no="INV1", item_quantity="oops", item_total="bad"),
            _row(invoice_no="INV1", item_quantity=2, item_total=100),
        ]
    )
    meta = build_reports_data.build(frame)["meta"]
    assert meta["items"] == 2
    assert meta["revenue"] == 100.0


def test_unparseable_dates_dropped() -> None:
    frame = pd.DataFrame(
        [
            _row(date="not-a-date", item_quantity=9),
            _row(date="2026-05-02 10:00:00", item_quantity=1),
        ]
    )
    assert build_reports_data.build(frame)["meta"]["items"] == 1


def test_missing_labels_become_unknown_not_nan() -> None:
    # A line item with no name/payment must not leak NaN into the JSON.
    frame = pd.DataFrame(
        [
            _row(
                item_name=float("nan"),
                category_name=float("nan"),
                order_type=float("nan"),
                payment_type=float("nan"),
            )
        ]
    )
    r = build_reports_data.build(frame)["rows"][0]
    assert r["drink"] == "Unknown"
    assert r["category"] == "Unknown"
    assert r["order_type"] == "Unknown"
    assert r["payment"] == "Unknown"


def test_nan_invoice_no_rows_dropped() -> None:
    # A line with no invoice number can't be attributed to an order; drop it
    # rather than crash on the integer-id lookup.
    frame = pd.DataFrame([_row(invoice_no=float("nan")), _row(invoice_no="INV1")])
    rows = build_reports_data.build(frame)["rows"]
    assert len(rows) == 1


def test_infinite_numerics_coerced_not_crashing() -> None:
    # "inf" must not survive into the JSON (json.dump(allow_nan=False) would raise).
    frame = pd.DataFrame(
        [
            _row(invoice_no="INV1", item_total="inf"),
            _row(invoice_no="INV2", item_total=100),
        ]
    )
    meta = build_reports_data.build(frame)["meta"]
    assert meta["revenue"] == 100.0  # inf coerced to 0


def test_zero_quantity_lines_dropped() -> None:
    frame = pd.DataFrame(
        [
            _row(invoice_no="INV1", item_quantity=0, item_name="Void"),
            _row(invoice_no="INV1", item_quantity=2),
        ]
    )
    rows = build_reports_data.build(frame)["rows"]
    assert len(rows) == 1
    assert rows[0]["qty"] == 2


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
