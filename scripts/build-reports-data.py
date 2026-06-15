#!/usr/bin/env python3
"""Build public/reports-data.cbf3b17bc7.json from PetPooja "Order Report: Item Wise" CSV exports.

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


def build(frame: pd.DataFrame) -> dict[str, Any]:
    """Aggregate successful item rows into the dashboard JSON structure."""
    frame = frame.copy()
    frame["date"] = pd.to_datetime(frame["date"], format="mixed", errors="coerce")
    frame = frame.dropna(subset=["date"])
    success = frame[frame["status"] == "Success"].copy()
    if success.empty:
        raise ValueError("No 'Success' rows found; nothing to aggregate.")

    success["item_quantity"] = pd.to_numeric(success["item_quantity"], errors="coerce").fillna(0)
    success["item_total"] = pd.to_numeric(success["item_total"], errors="coerce").fillna(0)
    success["hour"] = success["date"].dt.hour
    success["dow"] = success["date"].dt.dayofweek
    success["day"] = success["date"].dt.date.astype(str)
    success["week_start"] = (
        success["date"] - pd.to_timedelta(success["date"].dt.dayofweek, unit="D")
    ).dt.date.astype(str)

    def orders(group: pd.DataFrame) -> int:
        return int(group["invoice_no"].nunique())

    def qty(group: pd.DataFrame) -> int:
        return int(group["item_quantity"].sum())

    def rev(group: pd.DataFrame) -> float:
        return round(float(group["item_total"].sum()), 2)

    items = (
        success.groupby("item_name")
        .agg(qty=("item_quantity", "sum"), rev=("item_total", "sum"), cat=("category_name", "first"))
        .reset_index()
        .sort_values("qty", ascending=False)
    )
    categories = (
        success.groupby("category_name")
        .agg(qty=("item_quantity", "sum"), rev=("item_total", "sum"))
        .reset_index()
        .sort_values("qty", ascending=False)
    )

    def hour_label(hour: int) -> str:
        return f"{hour % 12 or 12}{'am' if hour < 12 else 'pm'}"

    out: dict[str, Any] = {
        "meta": {
            "source": "PetPooja Order Report: Item Wise (Barrackpore)",
            "date_from": str(success["date"].min().date()),
            "date_to": str(success["date"].max().date()),
            "generated": pd.Timestamp.now().strftime("%Y-%m-%d"),
            "note": "Built from PetPooja exports. Only 'Success' orders are counted.",
        },
        "summary": {
            "orders": orders(success),
            "items_sold": qty(success),
            "revenue": rev(success),
            "avg_order_value": round(float(success.groupby("invoice_no")["item_total"].sum().mean()), 2),
            "days_active": int(success["day"].nunique()),
        },
        "top_items": [
            {"item": r["item_name"], "category": r["cat"], "qty": int(r["qty"]), "revenue": round(float(r["rev"]), 2)}
            for _, r in items.head(15).iterrows()
        ],
        "by_category": [
            {"category": r["category_name"], "qty": int(r["qty"]), "revenue": round(float(r["rev"]), 2)}
            for _, r in categories.iterrows()
        ],
        "by_hour": [
            {
                "hour": h,
                "label": hour_label(h),
                "qty": qty(success[success["hour"] == h]),
                "orders": orders(success[success["hour"] == h]),
                "revenue": rev(success[success["hour"] == h]),
            }
            for h in HOURS
        ],
        "by_dow": [
            {
                "dow": DOW[d],
                "qty": qty(success[success["dow"] == d]),
                "orders": orders(success[success["dow"] == d]),
                "revenue": rev(success[success["dow"] == d]),
            }
            for d in range(7)
        ],
        "by_week": [
            {
                "week_start": w,
                "qty": qty(success[success["week_start"] == w]),
                "orders": orders(success[success["week_start"] == w]),
                "revenue": rev(success[success["week_start"] == w]),
            }
            for w in sorted(success["week_start"].unique())
        ],
        "heatmap": {
            "hours": HOURS,
            "rows": [
                {"dow": DOW[d], **{str(h): qty(success[(success["dow"] == d) & (success["hour"] == h)]) for h in HOURS}}
                for d in range(7)
            ],
        },
        "daily": [
            {"day": r["day"], "qty": int(r["qty"]), "revenue": round(float(r["rev"]), 2)}
            for _, r in success.groupby("day")
            .agg(qty=("item_quantity", "sum"), rev=("item_total", "sum"))
            .reset_index()
            .iterrows()
        ],
        "order_type": [
            {"type": k, "orders": int(v)} for k, v in success.groupby("order_type")["invoice_no"].nunique().items()
        ],
        # Normalise UPI variants BEFORE grouping so they collapse into one
        # bucket. Renaming after groupby would yield two rows both typed "UPI"
        # (duplicate chart keys + a split donut arc) when PetPooja emits variant
        # names like "UPI - PhonePe".
        "payment": [
            {"type": t, "orders": int(v)}
            for t, v in (
                success.assign(
                    payment_type=success["payment_type"].apply(
                        lambda k: "UPI" if str(k).lower().startswith("upi") else k
                    )
                )
                .groupby("payment_type")["invoice_no"]
                .nunique()
                .items()
            )
        ],
    }
    return out


def main() -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    export_dir = os.path.join(here, "petpooja_exports")
    paths = sorted(glob.glob(os.path.join(export_dir, "*.csv")))
    if not paths:
        print(f"No CSVs found in {export_dir}. Add PetPooja exports there first.", file=sys.stderr)
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
        json.dump(result, handle, indent=2)
    print(f"Wrote {os.path.normpath(dest)} from {len(paths)} file(s).")
    print(f"  Period: {result['meta']['date_from']} to {result['meta']['date_to']}")
    print(f"  Orders: {result['summary']['orders']}  Items: {result['summary']['items_sold']}  Revenue: {result['summary']['revenue']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
