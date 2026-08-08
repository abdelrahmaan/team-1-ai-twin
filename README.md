# AI-Twin — PDF document parsing pipeline

Parses a large technical PDF into structured, retrieval-ready JSON: one record per
page, each with a short summary and the full page rendered as markdown.

Built against the *Dubai Building Code, 2021 Edition* (843 pages, A4 landscape,
~1,230 figures and ~750 tables).

## Output schema

```json
{
  "document_name": "dubai_building_code_2021",
  "content_format": "markdown",
  "page_count": 843,
  "pages": [
    {
      "page_number": 11,
      "summary": "1-2 sentence gist, for triage and retrieval recall.",
      "page_content": "## A.5 Scope and application ...\n\n| Change | Description |\n..."
    }
  ]
}
```

`page_content` holds the whole page in reading order:

- headings, body text and lists as markdown
- KPI tiles as `Metric | Value` tables, real tables cell-for-cell
- every chart, diagram and photo as an inline `<figure type=… title=…>` block,
  transcribed element by element with colours named, so a reader can audit which
  mark pairs with which legend entry without opening the PDF

## Why two sources per page

Neither the text layer nor the page image is sufficient alone:

| Source | Used for |
| --- | --- |
| `pdftotext -layout` text layer | authoritative wording, numbers, table values |
| Rendered page image | figure content, colour, callouts, spatial relationships |

The text layer is trusted for anything that is *written*; the image is used only
to describe what is *drawn*. This avoids OCR-style transcription errors on
dimensions and table cells, which matters for a building code.

## Setup

```bash
brew install poppler
python3 -m venv venv && ./venv/bin/pip install pypdf pdfplumber
```

## Usage

```bash
python scripts/extract_text.py "<source>.pdf" --cache
python scripts/extract_text.py "<source>.pdf" 11 30
python scripts/assemble.py data/ out/parsed.json --name my_doc --page-count 843
```

`assemble.py` reports duplicate and missing page numbers on every run, so a
partial parse is never mistaken for a complete one.

## Repository layout

```
scripts/extract_text.py   text-layer extraction and caching
scripts/assemble.py       merge per-batch page JSON, validate coverage
data/                     parsed page batches (git-ignored, see below)
```

## Data and copyright

The source PDF and the parsed page batches are **git-ignored on purpose**:

- The Dubai Building Code states at A.10 that no content, in part or whole, may
  be copied, printed, sold or reproduced in any format. The parsed JSON is a
  near-verbatim reproduction of that content, so it is not published here.
- The source PDF is a 31 MB third-party binary.

Keep parsed output in `data/` locally, or in a private store, rather than in a
public repository.

`.env` is git-ignored and holds API keys. Never commit it.
