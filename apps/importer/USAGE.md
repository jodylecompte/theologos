# Quick Start: WEB Bible Import

## Prerequisites

1. **PostgreSQL running** with DATABASE_URL configured
2. **Prisma client generated**:
   ```bash
   nx run database:prisma:generate
   ```
3. **Database migrated**:
   ```bash
   nx run database:prisma:migrate
   ```

## Import Complete WEB Bible (All 66 Books)

### Single Command Import

```bash
nx run importer:import:web
```

This will:
- Validate JSON structure using sample books (Ephesians + Psalms)
- Import **all 66 books** of the Protestant canon
- Create canonical structure (books, chapters, verses)
- Insert text segments for the WEB translation
- Import ~31,000 verses total

### Re-import (Force Mode)

```bash
nx run importer:import:web:force
```

⚠️ **Warning**: This deletes all existing WEB text segments and re-imports all 66 books.

## What Gets Imported

The importer automatically fetches and imports all 66 books from the [World English Bible repository](https://github.com/TehShrike/world-english-bible):

**Old Testament** (39 books):
- Genesis through Malachi

**New Testament** (27 books):
- Matthew through Revelation

**Total**: ~31,000 verses across all books

## Process Flow

1. **Structure Validation** (~30 seconds)
   - Fetches Ephesians (prose) and Psalms (poetry)
   - Validates JSON format matches expected structure

2. **Translation Setup** (~1 second)
   - Creates WEB translation record (or verifies existing)

3. **Book Import** (~5-10 minutes for all 66 books)
   - For each book:
     - Fetch JSON from GitHub
     - Create canonical structure (book, chapters, verses)
     - Insert text segments

## Progress Monitoring

You'll see progress for each book:

```
ℹ [import-web] Starting WEB Bible import (all 66 books)
ℹ [import-web] --- Validating JSON structure ---
✓ [import-web] Prose structure valid (Ephesians)
✓ [import-web] Poetry structure valid (Psalms)
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
✓ [import-web] Summary: { translation: 'WEB', booksImported: 66, totalVerses: 31102 }
```

## Verification

After import, verify data in Prisma Studio:

```bash
nx run database:prisma:studio
```

Check:
- **BibleBook**: Should have 66 entries
- **BibleChapter**: Should have 1,189 chapters
- **BibleVerse**: Should have ~31,102 verses
- **BibleTranslation**: Should have 1 entry (WEB)
- **BibleTextSegment**: Should have ~31,102 segments

## Troubleshooting

### Error: Translation "WEB" already exists

**Solution**: Use force mode to re-import:
```bash
nx run importer:import:web:force
```

### Error: Failed to fetch [book].json

**Cause**: Network issue or GitHub unavailable.

**Solution**:
- Check internet connection
- Retry the import (it will skip already-imported books)
- Verify GitHub repository is accessible

### Error: Prisma client not generated

**Solution**: Generate client:
```bash
nx run database:prisma:generate
```

### Import is slow

**Expected**: Importing 31,000+ verses takes time (5-10 minutes).

The import:
- Fetches 66 JSON files from GitHub
- Creates ~31,000 database records
- Validates structure at each step

Future optimizations planned:
- Batch insertions
- Parallel book imports
- Progress caching

## Next Steps

After importing the complete WEB Bible:

1. **Verify data integrity** in Prisma Studio
2. **Build API endpoints** to query Bible data
3. **Import other translations** (ESV, NIV, etc.) - create new import jobs
4. **Build frontend features** using the canonical Bible structure

## Book List

All 66 books are automatically imported:

**Old Testament**:
Genesis, Exodus, Leviticus, Numbers, Deuteronomy, Joshua, Judges, Ruth, 1 Samuel, 2 Samuel, 1 Kings, 2 Kings, 1 Chronicles, 2 Chronicles, Ezra, Nehemiah, Esther, Job, Psalms, Proverbs, Ecclesiastes, Song of Solomon, Isaiah, Jeremiah, Lamentations, Ezekiel, Daniel, Hosea, Joel, Amos, Obadiah, Jonah, Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah, Malachi

**New Testament**:
Matthew, Mark, Luke, John, Acts, Romans, 1 Corinthians, 2 Corinthians, Galatians, Ephesians, Philippians, Colossians, 1 Thessalonians, 2 Thessalonians, 1 Timothy, 2 Timothy, Titus, Philemon, Hebrews, James, 1 Peter, 2 Peter, 1 John, 2 John, 3 John, Jude, Revelation
