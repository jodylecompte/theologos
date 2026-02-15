# PDF Ebook Import Guide

Complete guide for importing theological books from PDF into the Theologos database.

## Overview

The import process uses a **semi-automated approach** that balances quality with efficiency:

1. ✅ **Auto-detect** - Attempts to find chapter headings and metadata
2. 📝 **Manual review** - You verify/adjust chapter boundaries (2-3 minutes)
3. 🤖 **Auto-import** - Extracts text, detects scripture references, creates database records

**Time per book:** ~5 minutes after workflow is familiar

---

## Prerequisites

### System Requirements

1. **pdftotext utility** (for text extraction)
   ```bash
   # Ubuntu/Debian
   sudo apt-get install poppler-utils

   # macOS
   brew install poppler
   ```

2. **Node.js dependencies** (already installed)
   - Reference parser (detects Bible verses automatically)
   - Prisma database client

### Database Requirements

- Bible data imported (books, chapters, verses)
- WEB translation imported (for reference resolution)

---

## Step-by-Step Process

### Step 1: Place PDF in Data Directory

```bash
cp ~/Downloads/book.pdf data/
```

**Recommended directory structure:**
```
data/
├── loveliness_2012.pdf
├── loveliness_2012-metadata.json
├── knowing-god.pdf
├── knowing-god-metadata.json
└── ...
```

---

### Step 2: Auto-Detect Chapters

Run the chapter detection tool:

```bash
nx run importer:detect-chapters -- --file data/book.pdf
```

**What it does:**
- Extracts all text from PDF
- Attempts to detect chapter headings using pattern matching
- Detects common patterns:
  - "Chapter 1", "CHAPTER ONE", "Chap. 1"
  - "I. Title", "1. Title" (numbered sections)
  - "Part 1", "Section 1"
- Extracts metadata (title, author if present)
- Outputs `data/book-metadata.json`

**Example output:**
```
✓ Found 12 potential chapters

Detected Chapters:
======================================================================

1. The Knowledge of God
   Number: 1 | Confidence: high
   Context: Chapter 1 The Knowledge of God What were we made for?...

2. The People Who Know Their God
   Number: 2 | Confidence: high
   Context: Chapter 2 The People Who Know Their God ...
```

---

### Step 3: Review and Edit Metadata

Open the generated metadata file:

```bash
# Edit in your preferred editor
code data/book-metadata.json
# or
nano data/book-metadata.json
```

**Metadata structure:**
```json
{
  "title": "Knowing God",
  "author": "J.I. Packer",
  "slug": "knowing-god",
  "type": "book",
  "tradition": "reformed",
  "pdfFile": "data/knowing-god.pdf",
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
      "endPage": 42
    }
  ]
}
```

**Fields to verify/edit:**

| Field | Description | Notes |
|-------|-------------|-------|
| `title` | Book title | Auto-detected, verify accuracy |
| `author` | Author name | Often not detected, add manually |
| `slug` | URL-friendly identifier | Auto-generated from title |
| `type` | Content type | Usually "book" |
| `tradition` | Theological tradition | Optional: "reformed", "catholic", "orthodox", etc. |
| `pdfFile` | Path to PDF | Relative to workspace root |
| `chapters[].number` | Chapter number | Sequential numbering |
| `chapters[].title` | Chapter title | **Edit this** - auto-detect may be incomplete |
| `chapters[].startPage` | First page | **Fill this in** by viewing PDF |
| `chapters[].endPage` | Last page | **Fill this in** by viewing PDF |

**How to find page numbers:**

1. Open PDF in viewer (evince, Preview, Acrobat)
2. Note page numbers where chapters start/end
3. Fill in metadata file

**Tips:**
- Page numbers are PDF page numbers (not printed page numbers)
- Include preface/introduction as separate chapters if desired
- Chapters can be any logical division (parts, sections, letters)

---

### Step 4: Import Book

Once metadata is ready:

```bash
nx run importer:import-book -- --metadata data/book-metadata.json
```

**What it does:**

1. **Validates** metadata and checks PDF exists
2. **Checks** if book already imported (fails if exists, use `--force` to override)
3. **Creates** Work record in database
4. **For each chapter:**
   - Extracts text from specified page range
   - Detects scripture references (e.g., "Romans 8:28", "1 John 3:16-17")
   - Resolves references to BibleVerse IDs
   - Creates WorkUnit record
   - Links References to Bible verses
5. **Reports** statistics and provides reader URL

**Example output:**
```
✓ Created Work: Knowing God (uuid-here)
ℹ Processing Chapter 1: The Study of God
  Extracting pages 15-28...
  Detecting scripture references...
  Found 12 references, resolved 12
  ✓ Created WorkUnit: The Study of God
  ✓ Linked 12 scripture references

======================================================================
Import Complete!
======================================================================

Book: Knowing God
Slug: knowing-god

Statistics:
  Chapters imported: 18
  References detected: 287
  References resolved: 285
  References failed: 2

View in reader:
  http://localhost:4200/reader?work=knowing-god&unit=1
======================================================================
```

---

### Step 5: View in Web Reader

Open the provided URL in your browser:

```
http://localhost:4200/reader?work=knowing-god&unit=1
```

**Features:**
- Navigate chapters using Previous/Next buttons
- Click scripture references to navigate Bible pane
- URL state preserved for sharing links

---

## Common Scenarios

### Scenario 1: Book with Clear Chapters

**Example:** "Knowing God" by J.I. Packer

```bash
# 1. Auto-detect (finds most chapters)
nx run importer:detect-chapters -- --file data/knowing-god.pdf

# 2. Review metadata, fill in page numbers (3 minutes)
code data/knowing-god-metadata.json

# 3. Import
nx run importer:import-book -- --metadata data/knowing-god-metadata.json
```

**Time:** ~5 minutes

---

### Scenario 2: Book with Non-Standard Structure

**Example:** "The Loveliness of Christ" (letter collection)

```bash
# 1. Auto-detect (finds title, no chapters)
nx run importer:detect-chapters -- --file data/loveliness.pdf

# 2. Manually define structure
code data/loveliness-metadata.json
```

Edit to define logical divisions:
```json
{
  "chapters": [
    { "number": 1, "title": "Preface", "startPage": 3, "endPage": 4 },
    { "number": 2, "title": "Biographical Background", "startPage": 5, "endPage": 8 },
    { "number": 3, "title": "Letter Selections", "startPage": 9, "endPage": 50 }
  ]
}
```

```bash
# 3. Import
nx run importer:import-book -- --metadata data/loveliness-metadata.json
```

**Time:** ~5-7 minutes (manual chapter definition)

---

### Scenario 3: Re-importing with Corrections

If you need to fix chapter boundaries or add missing references:

```bash
# Delete and reimport
nx run importer:import-book -- --metadata data/book-metadata.json --force
```

**Note:** `--force` flag deletes existing work and reimports from scratch.

---

## Troubleshooting

### No Chapters Detected

**Symptom:**
```
⚠️  No chapters auto-detected.
```

**Causes:**
- Book doesn't use "Chapter 1" style headings
- Headings use non-standard formatting
- Book is a letter collection or essay compilation

**Solution:**
Manually define chapters based on PDF structure. Open PDF, identify logical divisions, fill in metadata.

---

### Failed Reference Resolution

**Symptom:**
```
⚠️  Could not resolve 5 references:
   - Revelation 22:20-21
   - Song of Solomon 2:16
```

**Causes:**
- Reference uses non-standard abbreviation
- Verse doesn't exist (typo in original book)
- Book/chapter not in database yet

**Solutions:**
1. Check if abbreviation is in `reference-parser.ts` BOOK_NAME_ALIASES
2. Add missing abbreviations if needed
3. Verify verse exists in Bible database
4. Check for typos in original PDF text

---

### PDF Text Extraction Fails

**Symptom:**
```
Failed to extract pages 10-20: Command failed
```

**Causes:**
- pdftotext not installed
- PDF is scanned image (needs OCR)
- PDF is encrypted/protected

**Solutions:**
```bash
# Install pdftotext
sudo apt-get install poppler-utils

# For scanned PDFs, use OCR tool first:
sudo apt-get install ocrmypdf
ocrmypdf input.pdf output.pdf
```

---

### Very Short Chapters

**Symptom:**
```
⚠️  Very short or empty chapter, skipping reference detection
```

**Causes:**
- Wrong page range (check PDF page numbers)
- Chapter is actually an image/diagram
- Empty pages between chapters

**Solution:**
Verify page numbers in PDF viewer and adjust metadata.

---

## Best Practices

### 1. Naming Conventions

**PDF files:**
```
book-title_year.pdf         # Good
book-title-author.pdf       # Good
random-name-123.pdf         # Bad (hard to identify)
```

**Metadata files:**
```
book-title_year-metadata.json      # Auto-generated
```

### 2. Chapter Granularity

**Too granular (avoid):**
```json
{ "number": 1, "title": "Chapter 1, Part A", "startPage": 10, "endPage": 12 },
{ "number": 2, "title": "Chapter 1, Part B", "startPage": 13, "endPage": 15 }
```

**Better:**
```json
{ "number": 1, "title": "Chapter 1", "startPage": 10, "endPage": 15 }
```

**Rationale:** Readers navigate by chapter. Keep divisions at natural reading boundaries.

### 3. Include Front Matter Selectively

**Include:**
- Significant prefaces (by another author, historical context)
- Biographical background

**Skip:**
- Copyright pages
- Publisher info
- Table of contents (reader has chapter nav)

### 4. Tradition Tags

Use consistent tradition values:
- `"reformed"` - Reformed/Presbyterian
- `"puritan"` - Puritan authors
- `"catholic"` - Catholic
- `"orthodox"` - Eastern Orthodox
- `"patristic"` - Early church fathers

Enables filtering and categorization in future features.

---

## Workflow Optimization

### Batch Processing

For multiple books:

```bash
# 1. Detect all chapters
for pdf in data/*.pdf; do
  nx run importer:detect-chapters -- --file "$pdf"
done

# 2. Review/edit all metadata files
# (Open each *-metadata.json, fill in page numbers)

# 3. Import all
for json in data/*-metadata.json; do
  nx run importer:import-book -- --metadata "$json"
done
```

### Creating Templates

For series with consistent structure (e.g., commentary volumes):

1. Create metadata for first book
2. Copy and adjust for subsequent volumes
3. Only change: title, author, page numbers

---

## Reference Detection Details

### Supported Formats

The reference parser auto-detects:

**Single verses:**
```
Romans 8:28
Rom 8:28
Rom. 8:28
```

**Ranges:**
```
Romans 8:28-30
1 John 3:16-17
```

**Multiple verses:**
```
Psalm 23:1, 4, 6
```

**Multiple references:**
```
Romans 8:28; 1 Corinthians 10:31
```

**Inline references:**
```
As Paul writes in Romans 8:28, we know...
(see 1 John 3:16)
cf. Romans 12:1-2
```

### Book Abbreviations

Extensive abbreviation map supports:
- Standard abbreviations (Rom, 1 Cor, Ps)
- Variations (Romans, Rm, 1 Corinthians, I Cor)
- With/without periods (Rom., Ps.)

Full list in: `/apps/importer/src/utils/reference-parser.ts`

---

## Database Schema

**Imported books create:**

```
Work (one per book)
  ├─ WorkUnit (one per chapter)
  │    └─ Reference (many, links to BibleVerse)
  │
  └─ WorkUnit (next chapter)
       └─ Reference ...
```

**Fields populated:**

- `Work.title` - Book title
- `Work.author` - Author name
- `Work.type` - "book"
- `Work.tradition` - Theological tradition
- `WorkUnit.type` - "chapter"
- `WorkUnit.positionIndex` - Chapter number
- `WorkUnit.title` - Chapter title
- `WorkUnit.contentText` - Full chapter text
- `Reference.sourceUnitId` - Links to chapter
- `Reference.bibleVerseId` - Links to Bible verse

---

## Future Enhancements

**Planned:**
- ePub import (simpler than PDF, has structure metadata)
- HTML import (for web-based books)
- Search across imported books
- Cross-reference browser (which books cite this verse?)

**Not planned:**
- AI-based chapter detection (too expensive)
- OCR integration (use external tools first)
- PDF editing/annotation

---

## Quick Reference

### Commands

```bash
# Auto-detect chapters
nx run importer:detect-chapters -- --file data/book.pdf

# Create blank template
nx run importer:create-metadata -- --file data/book.pdf --title "Title" --author "Author"

# Import book
nx run importer:import-book -- --metadata data/book-metadata.json

# Re-import (force)
nx run importer:import-book -- --metadata data/book-metadata.json --force

# Test reference detection
nx run importer:test:refs
```

### File Locations

```
data/                                    # Place PDFs here
apps/importer/src/jobs/import-book.ts    # Import script
apps/importer/src/utils/reference-parser.ts  # Reference detection
apps/importer/src/tools/                 # Helper tools
```

### Nx Targets

| Target | Purpose |
|--------|---------|
| `importer:detect-chapters` | Auto-detect chapter structure |
| `importer:create-metadata` | Create blank template |
| `importer:import-book` | Import book to database |
| `importer:test:refs` | Test reference detection |

---

## Support

**Issues:**
- Check troubleshooting section above
- Examine console output for specific errors
- Test reference detection: `nx run importer:test:refs`

**Adding book abbreviations:**
Edit: `/apps/importer/src/utils/reference-parser.ts`
Add to `BOOK_NAME_ALIASES` map

**Database issues:**
- Verify Bible data imported: Check `BibleBook`, `BibleChapter`, `BibleVerse` tables
- Check Prisma migrations: `nx run database:migrate`

---

## Appendix: Metadata JSON Schema

```typescript
interface BookMetadata {
  title: string;           // Required: Book title
  author?: string;         // Optional: Author name
  slug: string;            // Required: URL-friendly identifier
  type: string;            // Required: "book"
  tradition?: string;      // Optional: "reformed", "catholic", etc.
  pdfFile: string;         // Required: Path to PDF
  chapters: Chapter[];     // Required: At least one chapter
}

interface Chapter {
  number: number;          // Required: Sequential chapter number
  title: string;           // Required: Chapter title
  startPage: number;       // Required: First page (PDF page number)
  endPage: number;         // Required: Last page (PDF page number)
}
```

**Validation rules:**
- `chapters` array must not be empty
- `startPage` < `endPage` for each chapter
- Chapter numbers should be sequential (1, 2, 3...)
- PDF file must exist at specified path

---

**Last Updated:** 2026-02-15
