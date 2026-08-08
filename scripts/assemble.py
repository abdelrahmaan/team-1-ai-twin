#!/usr/bin/env python3
"""Merge per-batch page JSON into a single parsed-document JSON.

Each batch file is a JSON array of page objects:

    {
      "page_number":  int,
      "summary":      str,   # 1-2 sentence gist, for triage/retrieval recall
      "page_content": str    # whole page as markdown, in reading order
    }

Pages are sorted by page_number; duplicates and gaps are reported so a
partial run is never silently mistaken for a complete one.

Usage:
    python scripts/assemble.py <batches_dir> <output.json> [--name NAME] [--page-count N]
"""
import argparse
import json
import pathlib
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("batches_dir", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    parser.add_argument("--name", default="document", help="document_name in the output")
    parser.add_argument("--page-count", type=int, help="total pages in the source PDF")
    args = parser.parse_args()

    batch_files = sorted(args.batches_dir.glob("batch_*.json"))
    if not batch_files:
        print(f"error: no batch_*.json found in {args.batches_dir}", file=sys.stderr)
        return 1

    pages: list[dict] = []
    for path in batch_files:
        pages.extend(json.loads(path.read_text(encoding="utf-8")))
    pages.sort(key=lambda page: page["page_number"])

    numbers = [page["page_number"] for page in pages]
    duplicates = sorted({n for n in numbers if numbers.count(n) > 1})
    gaps = sorted(set(range(min(numbers), max(numbers) + 1)) - set(numbers))

    document = {
        "document_name": args.name,
        "content_format": "markdown",
        "page_count": args.page_count or max(numbers),
        "pages_parsed": len(pages),
        "page_range_parsed": f"{min(numbers)}-{max(numbers)}",
        "pages": pages,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(document, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"wrote        : {args.output}")
    print(f"batches      : {len(batch_files)}")
    print(f"pages parsed : {len(pages)} (range {min(numbers)}-{max(numbers)})")
    print(f"duplicates   : {duplicates or 'none'}")
    print(f"gaps         : {gaps or 'none'}")
    print(f"size         : {args.output.stat().st_size / 1024:.1f} KB")
    return 1 if duplicates else 0


if __name__ == "__main__":
    raise SystemExit(main())
