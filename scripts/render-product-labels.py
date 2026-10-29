#!/usr/bin/env python3
"""Paint every catalogue listing onto one Redline vial label.

The shop photos share a single 1024×1024 vial. This script keeps that
photograph and replaces the product name and dose so the label matches
src/data/products.json. Dose text follows the same rules as
src/lib/variant-label.ts: numeric options gain MG, IU, or ML; form
options such as Nasal Spray stay off the strength badge.

The strength sits in a gold double rule, the same mark used on the
house label, so every listing reads as one design.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "src" / "data" / "products.json"
BASE = ROOT / "scripts" / "assets" / "vial-label-base.jpg"
OUT_DIR = ROOT / "public" / "products"
FONT = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf"

# Ink width of Inter Bold at 100px. Advance is wider, so estimates use FACTOR.
INK = {
    "A": 69, "B": 55, "C": 65, "D": 61, "E": 48, "F": 47, "G": 65, "H": 61,
    "I": 14, "J": 49, "K": 62, "L": 46, "M": 80, "N": 63, "O": 67, "P": 54,
    "Q": 67, "R": 56, "S": 57, "T": 59, "U": 60, "V": 69, "W": 87, "X": 71,
    "Y": 67, "Z": 56, "0": 58, "1": 32, "2": 53, "3": 55, "4": 58, "5": 53,
    "6": 55, "7": 50, "8": 56, "9": 55, "/": 35, "-": 33, ".": 17, ",": 19,
    "+": 50, " ": 28,
}
FACTOR = 1.22
NAME_MAX_W = 258
DOSE_MAX_W = 246
NAME_CENTER_Y = 568
CAP_RATIO = 0.71
DOSE_OPTION = re.compile(r"^[\d,]+(?:\s*/\s*[\d,]+)?$")


def text_width(text: str, size: int) -> float:
    return sum(INK[char] for char in text) * size / 100 * FACTOR


def fit_size(text: str, max_width: float, low: int, high: int) -> int:
    chosen = low
    for size in range(high, low - 1, -1):
        if text_width(text, size) <= max_width:
            chosen = size
            break
    return chosen


def name_lines(name: str) -> tuple[list[str], int]:
    one = fit_size(name, NAME_MAX_W, 22, 54)
    if " " in name:
        head, tail = name.rsplit(" ", 1)
        if len(tail) >= 4:
            two = min(
                fit_size(head, NAME_MAX_W, 22, 48),
                fit_size(tail, NAME_MAX_W, 22, 48),
            )
            if two >= one + 6:
                return [head, tail], two
    return [name], one


def dose_line(product: dict) -> str | None:
    doses = [
        variant["option"].strip()
        for variant in product["variants"]
        if DOSE_OPTION.match(variant["option"].strip())
    ]
    if not doses:
        return None
    unit = product.get("variantLabel") or ""
    if unit == "Iu":
        unit = "IU"
    joined = " / ".join(doses)
    return f"{joined} {unit}".strip() if unit else joined


def escape_drawtext(text: str) -> str:
    return text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def draw_filter(lines: list[str], name_size: int, dose: str | None) -> str:
    filters: list[str] = []
    line_h = CAP_RATIO * name_size
    gap = round(name_size * 0.28)
    block_h = line_h * len(lines) + gap * (len(lines) - 1)
    top = NAME_CENTER_Y - block_h / 2
    for index, line in enumerate(lines):
        y = round(top + index * (line_h + gap))
        filters.append(
            "drawtext="
            f"fontfile={FONT}:"
            f"text='{escape_drawtext(line)}':"
            "fontcolor=0xD4AF37:"
            f"fontsize={name_size}:"
            "x=(w-text_w)/2:"
            f"y={y}"
        )
    if dose:
        dose_size = fit_size(dose, DOSE_MAX_W, 15, 24)
        dose_w = text_width(dose, dose_size)
        badge_h = round(CAP_RATIO * dose_size + 28)
        badge_w = max(148, round(dose_w + 48))
        badge_y = 640
        badge_x = round((1024 - badge_w) / 2)
        text_y = round(badge_y + (badge_h - CAP_RATIO * dose_size) / 2)
        filters.append(
            f"drawbox=x={badge_x}:y={badge_y}:w={badge_w}:h={badge_h}:"
            "color=0xD4AF37:t=2"
        )
        filters.append(
            f"drawbox=x={badge_x + 5}:y={badge_y + 5}:w={badge_w - 10}:h={badge_h - 10}:"
            "color=0xD4AF37:t=1"
        )
        filters.append(
            "drawtext="
            f"fontfile={FONT}:"
            f"text='{escape_drawtext(dose)}':"
            "fontcolor=0xD4AF37:"
            f"fontsize={dose_size}:"
            "x=(w-text_w)/2:"
            f"y={text_y}"
        )
    return ",".join(filters)


def render(product: dict) -> None:
    lines, name_size = name_lines(product["name"])
    dose = dose_line(product)
    destination = OUT_DIR / f"{product['slug']}.jpg"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(BASE),
            "-vf",
            draw_filter(lines, name_size, dose),
            "-frames:v",
            "1",
            "-update",
            "1",
            "-q:v",
            "2",
            str(destination),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print(f"{product['slug']:20} {name_size:2}px {lines} {dose or ''}")


def main() -> None:
    products = json.loads(CATALOG.read_text())
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for product in products:
        if product["name"] != product["name"].upper():
            raise SystemExit(f"{product['slug']} name is not uppercase")
        for char in product["name"]:
            if char not in INK:
                raise SystemExit(f"{product['slug']} has unsupported glyph {char!r}")
        render(product)


if __name__ == "__main__":
    main()
