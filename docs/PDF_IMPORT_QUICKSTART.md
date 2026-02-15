# PDF Import Quick Start

**5-minute guide to importing a theological book.**

## Prerequisites

```bash
# Install PDF tools (one-time)
sudo apt-get install poppler-utils
```

## Workflow

### 1. Auto-Detect (30 seconds)

```bash
nx run importer:detect-chapters -- --file data/your-book.pdf
```

Output: `data/your-book-metadata.json`

### 2. Fill in Metadata (2-3 minutes)

Open PDF + metadata file side-by-side:

```bash
# Open PDF
evince data/your-book.pdf &

# Edit metadata
code data/your-book-metadata.json
```

Fill in:
- Chapter titles (if auto-detect missed them)
- `startPage` and `endPage` for each chapter
- `author` (if not detected)
- `tradition` (optional: "reformed", "puritan", etc.)

**Example:**
```json
{
  "title": "Knowing God",
  "author": "J.I. Packer",
  "tradition": "reformed",
  "chapters": [
    {
      "number": 1,
      "title": "The Study of God",
      "startPage": 15,
      "endPage": 28
    },
    {
      "number": 2,
      "title": "The People Who Know Their God",
      "startPage": 29,
      "endPage": 45
    }
  ]
}
```

### 3. Import (1 minute)

```bash
nx run importer:import-book -- --metadata data/your-book-metadata.json
```

Automatically:
- Extracts text from each chapter
- Detects scripture references (Romans 8:28, etc.)
- Links to Bible verses
- Creates database records

### 4. View

Open the URL from import output:
```
http://localhost:4200/reader?work=knowing-god&unit=1
```

---

## Tips

**Page numbers** = PDF page numbers (shown in viewer), not printed page numbers

**If auto-detect finds nothing:**
- Book might not use "Chapter 1" format
- Manually define logical divisions (preface, letters, sections, etc.)

**Re-import after fixes:**
```bash
nx run importer:import-book -- --metadata data/book-metadata.json --force
```

**Test reference detection:**
```bash
nx run importer:test:refs
```

---

## Full Documentation

See: `docs/PDF_IMPORT_GUIDE.md`
