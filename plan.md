# Theologos Import Pipeline — v1 Plan

This document captures the agreed-upon order of operations for rebuilding
the import pipeline ahead of v1 launch.

---

## Current Step

**Phase 3 — Book Pipeline (next: 3.1 PDF extraction target)**

---

---

## Context & Principles

- **LLM is preprocessing, not runtime.** The LLM is used to produce committed
  JSON source files. After that, all imports are deterministic.
- **Intermediate JSON is the source of truth.** PDFs, EPUBs, and external
  formats (Creeds.json) are upstream inputs. They produce committed JSON that
  lives in a `/sources` directory in the repo. The DB is always reconstructible
  from those files.
- **The canonical intermediate format is epub-shaped.** The logical structure
  of epub (ordered chapters, heading levels, paragraphs, footnotes attached to
  paragraphs) is the model for `BookSourceJson`. EPUBs are therefore a
  near-zero-cost addition once the pipeline exists — they are deterministic
  producers of the same format that PDFs require LLM normalization to reach.
- **Paragraph is the content unit for books, not page.** Pages are a PDF
  artifact. The DB models logical structure.

---

## Work Types (v1 Baseline)

```typescript
type WorkType = 'creed' | 'catechism' | 'confession' | 'book' | 'sermon';
```

- `creed` — short confessional statements (Apostles', Nicene, Chalcedonian)
- `catechism` — Q&A format (WSC, WLC, Heidelberg, etc.)
- `confession` — chaptered confessions and flat canons (WCF, Canons of Dort, etc.)
- `book` — theological books imported from PDF, EPUB, or MOBI
- `sermon` — reserved for future use; defined now to lock the enum

Note: `confession` covers both Creeds.json `Confession` (chapter/section) and
`Canon` (flat articles) structural variants. That distinction is internal to
the import strategy, not a separate work type.

---

## Phase 1 — Foundation

### 1.1 Define `WorkType` enum in the database lib

- Add `WorkType` as a TypeScript const/union in `libs/database`
- Replace free `string` on `Work.type` in the Prisma schema with the enum
- Migration required

### 1.2 Define `BookSourceJson` schema

The canonical intermediate format for all book-length works. Inspired by
epub's logical structure, not its file format.

```typescript
interface BookSourceJson {
  metadata: {
    title: string;
    author?: string;
    tradition?: string;
    type: 'book';                  // always 'book' for this format
    sourceFormat: 'pdf' | 'epub' | 'mobi' | 'manual';
    sourceFile?: string;           // original filename, informational only
  };
  chapters: Array<{
    title: string;
    subtitle?: string;
    blocks: Array<{
      type: 'heading' | 'paragraph' | 'blockquote';
      level?: 1 | 2 | 3;          // for type='heading' only
      content: string;             // markdown for body text
      footnotes?: Array<{
        mark: string;              // "1", "2", "*", etc.
        text: string;              // full footnote text
      }>;
    }>;
  }>;
}
```

This schema is finalized before any import tooling is built. It is the
contract between the LLM normalization step and the DB import step.

### 1.3 Define canonical source JSON schemas for small works

Similar treatment for creed/catechism/confession. These replace Creeds.json
as the format consumed at import time. Creeds.json becomes an upstream source
that is converted once (by LLM or manually) into these formats.

- `CreedSourceJson` — metadata + ordered sections of prose
- `CatechismSourceJson` — metadata + questions with OSIS proof references
- `ConfessionSourceJson` — metadata + chapters/sections or flat articles with OSIS proofs

All source files live in a `/sources` directory at the repo root, committed
and human-reviewable.

---

## Phase 2 — Importer Consolidation

### 2.1 Consolidate into a single importer with strategy pattern

Current state: 5 separate job files, each duplicating `ensureWork`,
force-delete logic, `disconnect()`, and arg parsing.

Target: one entry point, one strategy per work type.

```
nx run importer:import -- --file sources/wsc.json
```

The work type is read from the source file's `metadata.type` field.
No `--type` flag needed.

Shared infrastructure (extracted into `utils/`):
- `ensureWork(title, author, type, tradition, force)` — single implementation
- `linkProofs(unitId, proofs)` — already exists, deduplicate across callers
- `ImportRunner` — handles force flag, disconnect, error reporting

Strategies (one file each):
- `CreedImportStrategy`
- `CatechismImportStrategy`
- `ConfessionImportStrategy`
- `BookImportStrategy`
- `SermonImportStrategy` (stub, reserved)

### 2.2 Wire new Nx target, deprecate old targets

New: `importer:import`
Old targets (`import:catechism`, `import:creed`, `import:confession`, `import-book`)
are deprecated but left in place until all source files are migrated to the
new format.

---

## Phase 3 — Book Pipeline

### 3.1 PDF extraction target

Extracts raw text from a PDF and produces a preliminary `BookSourceJson`
with best-effort chapter structure. No LLM involved. Output is intentionally
rough — this is the input to the LLM normalization step.

```
nx run importer:book:extract -- --pdf path/to/file.pdf --out extracted/book-name.json
```

Internally uses `pdftotext` (existing approach). Chapter boundaries come from
a simple metadata hint file (page ranges), or are left as a single flat
chapter if unknown.

### 3.2 LLM normalization target

Takes the rough extracted JSON and produces a clean `BookSourceJson`.

```
nx run importer:book:normalize -- --in extracted/book-name.json --out sources/book-name.json
```

The LLM's job:
- Identify true chapter boundaries and titles
- Identify headings, subheadings, and their levels
- Split text into paragraph blocks
- Identify and attach footnotes to their referencing paragraph
- Strip headers, footers, page numbers, and running titles
- Normalize typographic artifacts from pdftotext

This step is iterative. Run → inspect output → adjust prompt or input → run
again. Once the output is satisfactory, commit `sources/book-name.json`.
The LLM is not involved again.

The local LLM is used here. The prompt and any tuning notes live alongside
the normalization tool in the importer app.

### 3.3 Deterministic book import

`BookImportStrategy` reads `BookSourceJson` and imports:

```
Work (type='book')
  WorkUnit (type='chapter', positionIndex=n, title=chapter.title)
    WorkUnit (type='paragraph', positionIndex=n, contentText=block.content)
      → footnotes stored in WorkUnit.metadata JSON field (v1)
      → scripture references detected and linked as Reference rows
```

No PDF access at import time. Fully deterministic.

---

## Phase 4 — EPUB Support

### 4.1 EPUB extraction target

EPUBs are zipped XHTML. Parse the spine, extract chapter HTML, convert to
`BookSourceJson` deterministically. No LLM required for well-formed EPUBs.

```
nx run importer:book:extract-epub -- --epub path/to/file.epub --out sources/book-name.json
```

Output goes directly to `sources/` (skipping `extracted/`) for well-formed
EPUBs. Poorly structured EPUBs can still go through the LLM normalize step.

Import step is identical to Phase 3.3 — `BookImportStrategy` does not know
or care whether the source came from PDF or EPUB.

### 4.2 MOBI/AZW support (optional, post-launch)

MOBI can be converted to EPUB via Calibre (`ebook-convert`), then processed
by the EPUB extractor. No new importer logic needed.

---

## Phase 5 — Source Migration & Launch

### 5.1 Convert existing Creeds.json sources to canonical format

For each currently imported work: creed, catechism, confession.
- LLM-assisted or manual conversion to `CreedSourceJson`, `CatechismSourceJson`,
  `ConfessionSourceJson`
- Commit to `/sources`
- Verify deterministic re-import produces identical DB state

### 5.2 Complete book imports

For each theological book targeted for v1:
- Run extract → normalize → inspect → commit
- Run import
- Verify scripture reference linking

### 5.3 Schema / DB audit

- Confirm `WorkType` enum is correctly constraining all `Work` records
- Confirm no `page` units remain (all book content is paragraph-level)
- Confirm footnotes are stored in `WorkUnit.metadata`

### 5.4 Launch

---

## Open Questions (to resolve during implementation)

- **Sermons:** What is the source format? Audio transcripts? Manual entry?
  Define when the sermon work type becomes active.
- **Footnote promotion:** At what point do footnotes graduate from
  `WorkUnit.metadata` JSON to their own `WorkUnit` type? Likely post-launch
  when footnote-level reference linking becomes valuable.
- **`WorkUnit.metadata` schema:** Needs a Prisma `Json` field added.
  Currently not modeled. Required before book import can store footnotes.
- **OSIS in canonical source formats:** Do `CreedSourceJson` etc. retain OSIS
  proof reference format, or switch to traditional `Book Chapter:Verse`?
  Current recommendation: retain OSIS — the parser already handles it and
  it's more precise.
- **Sermon import:** Deferred. Define work type now, implement post-launch.
