# Repository Agent Instructions

This repository is an Nx monorepo.

You must follow these constraints strictly.

------------------------------------------------
GENERAL NX REQUIREMENTS
------------------------------------------------

- Always run tasks through Nx.
- Never run underlying CLI tools directly.
- Use Nx targets defined in `project.json`.
- If adding a new tool (Prisma, migrations, etc.), wire it into Nx targets.

When analyzing workspace:
- Use nx_workspace tool first.
- Use nx_project_details when modifying specific projects.
- Use nx_docs when unsure about configuration.

------------------------------------------------
DATABASE LIBRARY REQUIREMENTS
------------------------------------------------

The Prisma layer lives in:

    libs/database

This library must:

1. Contain:
    - prisma/schema.prisma
    - src/client.ts
    - README.md
    - project.json with Nx targets
2. Export:
    - Singleton Prisma client (server only)
    - Prisma types (safe for frontend)

Prisma client output must NOT bundle into frontend builds.

------------------------------------------------
PRISMA TARGETS
------------------------------------------------

The database lib must define Nx targets:

- migrate
- generate
- studio
- build (if required)

All must use Nx executor configuration.
No raw CLI calls outside Nx.

------------------------------------------------
BIBLE SCHEMA RULES
------------------------------------------------

Canonical tables required:

- BibleBook
- BibleChapter
- BibleVerse
- BibleTranslation
- BibleTextSegment

Constraints:

- UUID primary keys
- Composite uniqueness:
    - (bookId, chapterNumber)
    - (chapterId, verseNumber)
    - (verseId, translationId, segmentIndex)
- Timestamp fields required
- Proper indexing

BibleVerse is canonical identity.
Do not treat verse references as strings.

------------------------------------------------
FUTURE EXPANSION (NOT YET IMPLEMENTED)
------------------------------------------------

- Versification mapping table
- Apocrypha support
- Cross-reference graph table
- Unit table for theological works
- Reference table linking units to verses

Do not pre-implement these.

------------------------------------------------
INGESTION GUIDELINES
------------------------------------------------

Import scripts:

- Live outside Prisma schema
- Map external JSON to canonical tables
- Must not modify schema
- Must maintain referential integrity

------------------------------------------------
QUALITY STANDARDS
------------------------------------------------

Generated code must:

- Be production-safe
- Avoid overengineering
- Avoid premature abstraction
- Respect existing workspace config
- Avoid breaking other apps

When generating files:
- Output full file path
- Output complete file contents
- Do not summarize
- Do not omit configuration

------------------------------------------------
PROJECT INTENT
------------------------------------------------

This is a theological study system, not a SaaS.
It prioritizes:

- Stability
- Clarity
- Canonical structure
- Maintainability

Avoid feature creep.
Avoid enterprise complexity.
Avoid speculative abstractions.