# Bible Importer

Dedicated Nx application for importing Bible translation data into the canonical database structure.

## Overview

This importer:
- Creates the canonical Bible structure (books, chapters, verses) on first run
- Imports translation-specific text segments
- Validates data integrity before insertion
- Handles both prose and poetry formats
- Fails safely with clear error messages

## Architecture

```
apps/importer/
├── src/
│   ├── data/
│   │   └── canonical-books.ts    # Protestant 66-book canon definition
│   ├── jobs/
│   │   └── import-web.ts          # WEB Bible import job
│   └── utils/
│       ├── logger.ts              # Structured logging
│       └── web-parser.ts          # WEB JSON format parser
```

## Available Import Jobs

### WEB (World English Bible)

Imports the complete Bible from the [World English Bible JSON format](https://github.com/TehShrike/world-english-bible).

**Prerequisites:**
1. PostgreSQL database running
2. `DATABASE_URL` environment variable set
3. Prisma schema migrated (`nx run database:prisma:migrate`)
4. Prisma client generated (`nx run database:prisma:generate`)

**Usage:**

```bash
# Import all 66 books of the WEB Bible
nx run importer:import:web

# Force re-import (deletes existing WEB segments)
nx run importer:import:web:force
```

**Arguments:**
- `--force`: Delete existing WEB translation segments and re-import all 66 books

**What it does:**
1. Validates JSON structure using sample books (Ephesians prose, Psalms poetry)
2. Creates WEB translation record
3. Imports all 66 books of the Protestant canon:
   - Fetches each book JSON from GitHub
   - Creates canonical structure (books, chapters, verses)
   - Inserts text segments for each verse
4. Reports detailed progress for each book

**Example:**

```bash
nx run importer:import:web
```

**Output:**
```
ℹ [import-web] Starting WEB Bible import (all 66 books)
ℹ [import-web] --- Validating JSON structure ---
✓ [import-web] Prose structure valid (Ephesians) { chapters: 6, verses: 155 }
✓ [import-web] Poetry structure valid (Psalms) { chapters: 150, verses: 2461 }
ℹ [import-web] --- Ensuring translation ---
✓ [import-web] Created translation: World English Bible (WEB)
ℹ [import-web] --- Importing all 66 books ---
ℹ [import-web] --- Importing Genesis ---
ℹ [import-web] Fetching: https://raw.githubusercontent.com/.../genesis.json
✓ [import-web] Created book: Genesis
✓ [import-web] Created 50 chapters
✓ [import-web] Imported 1533 verses for Genesis
ℹ [import-web] --- Importing Exodus ---
...
ℹ [import-web] --- Importing Revelation ---
✓ [import-web] Imported 404 verses for Revelation
ℹ [import-web] --- Import Complete ---
✓ [import-web] Summary: { translation: 'WEB', booksImported: 66, totalVerses: 31102 }
```

**Import Time:** Approximately 5-10 minutes for all 66 books (~31,000 verses).

## Data Model

The importer works with the following Prisma models:

- **BibleBook**: Canonical book record (Genesis, Exodus, etc.)
- **BibleChapter**: Chapter within a book
- **BibleVerse**: Individual verse (canonical identity)
- **BibleTranslation**: Translation metadata (WEB, ESV, NIV, etc.)
- **BibleTextSegment**: Translation-specific verse text

## Design Principles

### Canonical Grid First

The importer uses WEB as the canonical grid to establish:
- Which books exist
- How many chapters per book
- How many verses per chapter

Once created, this structure is immutable and shared by all translations.

### One Verse = One Segment (for now)

Currently, each verse is imported as a single `BibleTextSegment` with:
- `segmentIndex = 0`
- `segmentLabel = null`
- `contentText = full verse text`

Line breaks are preserved using newline characters.

### Explicit Structure Validation

The importer:
- Validates JSON structure before importing
- Verifies book names against canonical 66-book list
- Checks for chapter/verse count mismatches
- Fails loudly if inconsistencies detected

### Force Mode Safety

When `--force` is used:
1. Checks if translation exists
2. Deletes **only** BibleTextSegment rows for that translation
3. Preserves canonical structure (books, chapters, verses)
4. Re-imports text segments

The canonical grid is **never** modified during force re-import.

## Error Handling

The importer will exit with error if:
- Required arguments missing
- JSON fetch fails
- JSON structure invalid or unexpected
- Book name not in canonical 66-book list
- Chapter count mismatch on subsequent runs
- Verse count mismatch on subsequent runs
- Translation already exists (without `--force`)
- Database connection fails

## Adding New Import Jobs

To add a new translation importer:

1. Create job file: `apps/importer/src/jobs/import-<name>.ts`
2. Implement parser for source format
3. Add Nx target to `apps/importer/project.json`
4. Update this README

Import jobs should:
- Validate against canonical structure
- Use transaction-safe operations
- Log progress clearly
- Exit non-zero on failure
- Never modify canonical grid

## Development

### Run Tests

```bash
# Unit tests
nx test importer

# Lint
nx lint importer
```

### Build

```bash
nx build importer
```

### Database Setup

Before running any import:

```bash
# Generate Prisma client
nx run database:prisma:generate

# Run migrations
nx run database:prisma:migrate

# (Optional) Reset database
nx run database:prisma:migrate:reset
```

## Resources

- [WEB Bible JSON Source](https://github.com/TehShrike/world-english-bible)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Nx Documentation](https://nx.dev)
