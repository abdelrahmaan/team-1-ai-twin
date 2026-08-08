#!/usr/bin/env python3
"""Dump the PDF text layer for a page range.

The text layer is the authoritative source for wording, numbers and table
values — the page images are used alongside it only to describe figures.

Usage:
    python scripts/extract_text.py <pdf> <start> <end>
    python scripts/extract_text.py --cache <pdf>     # build the full-text cache

Requires poppler (`brew install poppler`) for pdftotext.
"""
import argparse
import pathlib
import subprocess
import sys

CACHE_SUFFIX = ".full_text.txt"


def build_cache(pdf: pathlib.Path) -> pathlib.Path:
    """Run pdftotext -layout once over the whole PDF and cache the result."""
    cache = pdf.with_suffix(CACHE_SUFFIX)
    subprocess.run(
        ["pdftotext", "-layout", str(pdf), str(cache)],
        check=True,
    )
    return cache


def load_pages(pdf: pathlib.Path) -> list[str]:
    cache = pdf.with_suffix(CACHE_SUFFIX)
    if not cache.exists():
        cache = build_cache(pdf)
    return cache.read_text(encoding="utf-8", errors="replace").split("\f")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=pathlib.Path)
    parser.add_argument("start", type=int, nargs="?")
    parser.add_argument("end", type=int, nargs="?")
    parser.add_argument("--cache", action="store_true", help="build the cache and exit")
    args = parser.parse_args()

    if not args.pdf.exists():
        print(f"error: {args.pdf} not found", file=sys.stderr)
        return 1

    if args.cache:
        print(f"cached -> {build_cache(args.pdf)}")
        return 0

    if args.start is None or args.end is None:
        parser.error("start and end are required unless --cache is given")

    pages = load_pages(args.pdf)
    for page_number in range(args.start, args.end + 1):
        if page_number > len(pages):
            break
        print(f"{'=' * 30} PAGE {page_number} {'=' * 30}")
        print(pages[page_number - 1].rstrip())
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
