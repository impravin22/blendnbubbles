#!/usr/bin/env python3
"""Build public/reports-data.cbf3b17bc7.json from PetPooja "Order Report: Item Wise" CSV exports.

The dashboard cross-filters a row-level ledger, so this emits one compact row
per sold line item ({meta, dims, rows}) and lets the client derive every chart.
Real invoice numbers are never shipped: each invoice maps to a compact integer.

Refresh workflow:
  1. In PetPooja: Reports > Other Reports > Order Report: Item Wise All Restaurants.
     Export one month at a time (the report caps each export at one month), then
     download each CSV.
  2. Drop the CSV(s) into scripts/petpooja_exports/ (create the folder).
  3. Run:  python3 scripts/build-reports-data.py
  4. Commit public/reports-data.cbf3b17bc7.json and redeploy.

The /reports dashboard reads the generated JSON, so this is the manual stand-in
until the PetPooja API + a scheduled function automates the pull.
"""

from __future__ import annotations

import glob
import io
import json
import os
import sys
from typing import Any

import pandas as pd

DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
HEADER_PREFIX = "restaurant_name,invoice_no,"
HOURS = list(range(8, 24))  # shop trades evenings; 8am-11pm keeps charts readable


def load_csv(path: str) -> pd.DataFrame:
    """Read one export, skipping any non-CSV preamble before the real header.

    Args:
        path: Path to a PetPooja Order-Item CSV.

    Returns:
        DataFrame of the item-level rows.

    Raises:
        ValueError: If the expected header row is not found in the file.
    """
    with open(path, encoding="utf-8", errors="replace") as handle:
        lines: list[str] = handle.read().splitlines()
    header_index: int | None = next(
        (i for i, line in enumerate(lines) if line.startswith(HEADER_PREFIX)), None
    )
    if header_index is None:
        raise ValueError(f"No PetPooja header row found in {path}")
    return pd.read_csv(io.StringIO("\n".join(lines[header_index:])))


def _normalise_payment(value: Any) -> str:
    """Collapse any UPI-tagged value into one 'UPI' bucket.

    The real PetPooja data labels UPI payments "Other (Upijio)", so this matches
    "upi" anywhere in the value rather than only as a prefix.
    """
    return "UPI" if "upi" in str(value).lower() else str(value)


def build(frame: pd.DataFrame) -> dict[str, Any]:
    """Aggregate successful item rows into the row-level dashboard JSON.

    Returns a dict with three keys:
      - meta:  period, generation date, and headline totals (used for "% of all").
      - dims:  ordered axis/filter values (hours, dows, weeks, drinks, etc.).
      - rows:  one compact entry per sold line item, the source of every chart.
    """
    frame = frame.copy()
    frame["date"] = pd.to_datetime(frame["date"], format="mixed", errors="coerce")
    frame = frame.dropna(subset=["date"])
    success = frame[frame["status"] == "Success"].copy()
    if success.empty:
        raise ValueError("No 'Success' rows found; nothing to aggregate.")

    # Coerce numerics; replace NaN and non-finite (inf) values so the JSON stays
    # valid and totals never blow up on a corrupt export.
    for col in ("item_quantity", "item_total"):
        success[col] = (
            pd.to_numeric(success[col], errors="coerce")
            .fillna(0)
            .replace([float("inf"), float("-inf")], 0)
        )
    # Drop lines with no invoice number (can't be attributed to an order) and
    # voided / zero-quantity lines (not a sale, and the source of junk labels).
    success = success.dropna(subset=["invoice_no"])
    success = success[success["item_quantity"] > 0].copy()
    if success.empty:
        raise ValueError("No 'Success' rows with a positive quantity found.")
    # Replace missing labels so rows never carry NaN (invalid JSON for browsers).
    for col in ("item_name", "category_name", "order_type", "payment_type"):
        success[col] = success[col].fillna("Unknown")
    success["hour"] = success["date"].dt.hour
    success["dow"] = success["date"].dt.dayofweek
    success["day"] = success["date"].dt.date.astype(str)
    success["week_start"] = (
        success["date"] - pd.to_timedelta(success["date"].dt.dayofweek, unit="D")
    ).dt.date.astype(str)
    # Calendar month bucket (YYYY-MM) so the dashboard can narrow to a single
    # month. Derived from the real order date, not week_start, so a week that
    # straddles a month boundary attributes each row to its own month.
    success["month"] = success["date"].dt.strftime("%Y-%m")

    # Map each invoice number to a compact integer id so the client can count
    # distinct orders without the real invoice numbers ever being published.
    invoice_ids = {no: i for i, no in enumerate(success["invoice_no"].unique())}

    rows: list[dict[str, Any]] = [
        {
            "drink": r["item_name"],
            "category": r["category_name"],
            "qty": int(r["item_quantity"]),
            "revenue": round(float(r["item_total"]), 2),
            "hour": int(r["hour"]),
            "dow": int(r["dow"]),
            "week": r["week_start"],
            "month": r["month"],
            "order_type": r["order_type"],
            "payment": _normalise_payment(r["payment_type"]),
            "inv": invoice_ids[r["invoice_no"]],
        }
        for _, r in success.iterrows()
    ]

    def by_qty(col: str) -> list[str]:
        """Distinct values of `col` ordered by total quantity, descending."""
        return (
            success.groupby(col)["item_quantity"]
            .sum()
            .sort_values(ascending=False)
            .index.tolist()
        )

    return {
        "meta": {
            "source": "PetPooja Order Report: Item Wise (Barrackpore)",
            "date_from": str(success["date"].min().date()),
            "date_to": str(success["date"].max().date()),
            "generated": pd.Timestamp.now().strftime("%Y-%m-%d"),
            "note": "Built from PetPooja exports. Only 'Success' orders are counted.",
            "orders": int(success["invoice_no"].nunique()),
            "items": int(success["item_quantity"].sum()),
            "revenue": round(float(success["item_total"].sum()), 2),
            "days_active": int(success["day"].nunique()),
        },
        "dims": {
            "hours": HOURS,
            "dows": DOW,
            "weeks": sorted(success["week_start"].unique().tolist()),
            "months": sorted(success["month"].unique().tolist()),
            "drinks": by_qty("item_name"),
            "categories": by_qty("category_name"),
            "order_types": sorted(success["order_type"].dropna().unique().tolist()),
            "payments": sorted(
                {
                    _normalise_payment(p)
                    for p in success["payment_type"].dropna().unique()
                }
            ),
        },
        "rows": rows,
    }


def main() -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    export_dir = os.path.join(here, "petpooja_exports")
    paths = sorted(glob.glob(os.path.join(export_dir, "*.csv")))
    if not paths:
        print(
            f"No CSVs found in {export_dir}. Add PetPooja exports there first.",
            file=sys.stderr,
        )
        return 1

    frames = [load_csv(p) for p in paths]
    # Drop exact-duplicate rows from overlapping monthly exports. Full-row
    # equality is deliberate: invoice_no is assumed unique across outlets, and a
    # genuine repeat of the same item on one order arrives as item_quantity > 1.
    combined = pd.concat(frames, ignore_index=True).drop_duplicates()
    result = build(combined)

    dest = os.path.join(here, "..", "public", "reports-data.cbf3b17bc7.json")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w", encoding="utf-8") as handle:
        # allow_nan=False fails loudly rather than writing NaN/Infinity, which
        # browsers reject when fetching the JSON.
        json.dump(result, handle, indent=2, allow_nan=False)
    print(f"Wrote {os.path.normpath(dest)} from {len(paths)} file(s).")
    print(f"  Period: {result['meta']['date_from']} to {result['meta']['date_to']}")
    print(
        f"  Orders: {result['meta']['orders']}  Items: {result['meta']['items']}  Revenue: {result['meta']['revenue']}"
    )
    print(f"  Rows: {len(result['rows'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
