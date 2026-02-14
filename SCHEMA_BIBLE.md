# Canonical Bible Schema Documentation

## Overview

This schema defines a canonical Bible backbone for a browser-based theological study application. It is optimized for:

- stable reference linking
- cross-translation comparison
- theological citation resolution
- search and study tooling

The architecture separates canonical structure from translation text:

- `BibleBook` / `BibleChapter` / `BibleVerse` model canonical identity
- `BibleTranslation` / `BibleTextSegment` model translation-specific text layers

This separation is intentional. Canonical verse identity must remain stable even as translations, licenses, and segmentation rules differ.

## Scope and Non-Goals

Current scope:

- standard 66-book Protestant canon only
- canonical books, chapters, verses
- translation metadata and translation text segments

Explicit non-goals in this phase:

- no morphology
- no manuscript witnesses
- no textual variants
- no alternate versification mappings
- no apocrypha/deuterocanonical books

## Canonical Identity Model

Canonical identity is anchored at `BibleVerse.id` (UUID).

Why this matters:

- all downstream entities should link to a stable verse key
- translation text can change or be replaced without breaking references
- citation systems can resolve references to one canonical target

`canonicalOrderIndex` exists on chapters and verses to allow deterministic global ordering and fast sequential traversal.

Do not model canonical references as free strings (for example `"John 3:16"`) in relational links. Parse strings at boundaries, then resolve to canonical IDs.

## Translation Layering Model

Translations are modeled independently from canonical structure:

- `BibleTranslation` stores translation identity and licensing metadata
- `BibleTextSegment` stores text tied to both a `BibleVerse` and a `BibleTranslation`

This enables:

- one canonical verse linked to many translations
- per-translation segmentation differences (e.g. `a` / `b` splits)
- future comparison features without canonical duplication

## Table Reference

### `BibleBook`

Purpose:
- Represents each canonical Bible book in fixed order.

Why it exists:
- Provides the root of canonical hierarchy.
- Normalizes shared metadata (`canonicalName`, `abbreviation`, `testament`).

Key constraints:
- unique `canonicalName`
- unique `abbreviation`
- unique `canonicalOrder`

What it does not model:
- alternate canons
- manuscript naming traditions
- commentary metadata

### `BibleChapter`

Purpose:
- Represents canonical chapters within a canonical book.

Why it exists:
- Encodes ordered chapter structure and supports chapter-level traversal.

Key constraints:
- unique (`bookId`, `chapterNumber`)
- unique `canonicalOrderIndex`

What it does not model:
- versification alternatives
- chapter headings or per-edition ornaments

### `BibleVerse`

Purpose:
- Represents canonical verses within a canonical chapter.

Why it exists:
- Serves as the canonical anchor for all future references.
- Decouples citation identity from translation wording.

Key constraints:
- unique (`chapterId`, `verseNumber`)
- unique `canonicalOrderIndex`

What it does not model:
- textual variants
- punctuation or morphology layers
- manuscript-level verse boundaries

### `BibleTranslation`

Purpose:
- Stores metadata for each translation/version.

Why it exists:
- Separates translation identity from canonical identity.
- Holds legal/licensing metadata needed for production usage.

Key constraints:
- unique `name`
- unique `abbreviation`

What it does not model:
- chapter/verse structure changes
- manuscript provenance
- distribution policy workflows beyond raw license string

### `BibleTextSegment`

Purpose:
- Stores the actual text content for a verse in a specific translation, optionally split into ordered segments.

Why it exists:
- Supports translation-level verse segmentation differences.
- Preserves ordered textual units for rendering and comparison.

Key constraints:
- unique (`verseId`, `translationId`, `segmentIndex`)

What it does not model:
- syntactic parsing
- morphology tags
- interlinear alignment

## Why Segmentation Exists

Not all translations align perfectly to one single text chunk per verse. Some need labeled subdivisions such as `a` and `b` for display or import compatibility.

Design rules:

- Use `segmentIndex = 0` when a verse is unsplit.
- Use incremental segment indices (`0`, `1`, `2`, ...) when split storage is needed.
- `segmentLabel` is optional display metadata (e.g. `"a"`, `"b"`), not a primary key.

This keeps storage consistent and queryable while handling translation-specific structure.

## Importer Data Flow (JSON -> Database)

Recommended ingest flow for a Bible JSON importer:

1. Seed canonical books (`BibleBook`) in fixed canonical order 1..66.
2. For each book, insert canonical chapters (`BibleChapter`) with:
   - `chapterNumber`
   - global `canonicalOrderIndex` for chapter sequence
3. For each chapter, insert canonical verses (`BibleVerse`) with:
   - `verseNumber`
   - global `canonicalOrderIndex` for verse sequence
4. Insert translation metadata row (`BibleTranslation`) once per translation.
5. For each canonical verse text in that translation:
   - resolve canonical verse by (`book`, `chapter`, `verse`) to `BibleVerse.id`
   - insert one or more `BibleTextSegment` rows
   - set `segmentIndex = 0` if unsplit
   - set ordered segment indices if split

Operational guidance:

- upsert canonical layers before translation text
- fail fast on unresolved canonical references
- never create duplicate canonical verses per translation

## Query and Reference Guidance

Preferred reference pattern:

- Store `BibleVerse.id` as foreign key in dependent tables.

Avoid:

- storing unresolved reference strings as canonical links
- duplicating canonical chapter/verse numbers in multiple dependent tables

If user input arrives as `"Book Chapter:Verse"`:

- parse input
- resolve to canonical IDs via book/chapter/verse constraints
- persist resolved UUIDs

## Extensibility Notes

### Versification Mapping (Future)

If alternate versification is required later, add mapping tables instead of mutating canonical rows. Keep `BibleVerse` as baseline canonical layer and map external systems into it.

### Apocrypha Support (Future)

Add canon set support (for example `canonType`) and extend `BibleBook` ordering by canon context. Do not break existing 66-book IDs.

### Cross-Reference Graph Integration (Future)

A future `CrossReferenceEdge` table can target `BibleVerse.id` as source/target. This allows semantic graph features while preserving canonical identity.

## AI Agent Ingestion Notes

For future AI agents consuming this schema:

- treat `BibleVerse.id` as the canonical truth anchor
- treat `BibleTextSegment` as translation projection over canonical verses
- do not infer canonical identity from free-text references alone
- preserve unique constraints during bulk upserts
- never collapse translation rows into canonical verse rows

## Hard Warning

Do not treat verse references as strings for relational identity.

Correct:
- resolve `"John 3:16"` -> `BibleVerse.id` and store that UUID

Incorrect:
- storing `"John 3:16"` directly as a relational key

String forms are display/input artifacts. Canonical IDs are persistence artifacts.
