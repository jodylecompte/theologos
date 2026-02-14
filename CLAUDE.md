# Claude Agent Context

This is an Nx-managed monorepo.

The project is building a browser-based theological study system.
It is not an enterprise SaaS product.
It is a ministry-oriented, structured theological library and Bible study tool.

The architecture must remain:

- Maintainable by one primary developer
- Extendable by open-source contributors
- Strictly structured at the data layer
- Explicit in schema decisions

-----------------------------------------
NX WORKSPACE RULES
-----------------------------------------

- Always use Nx commands instead of raw tooling.
- Prefer `nx run`, `nx run-many`, `nx affected`.
- Do not invoke Prisma CLI directly without wiring it through Nx targets.
- All database operations must be Nx task-backed.

-----------------------------------------
DATABASE ARCHITECTURE PRINCIPLES
-----------------------------------------

Prisma lives in: `libs/database`.

This library is the canonical data layer for the entire monorepo.

It must:

- Contain the Prisma schema at `libs/database/prisma/schema.prisma`
- Export a singleton Prisma client from `libs/database/src/client.ts`
- Export Prisma types for use in frontend apps
- Never allow runtime Prisma client to leak into browser bundles

-----------------------------------------
BIBLE MODEL PHILOSOPHY
-----------------------------------------

The Bible schema is canonical-first.

We model:

- BibleBook
- BibleChapter
- BibleVerse (canonical identity)
- BibleTranslation
- BibleTextSegment (translation-layer content)

We do NOT model:

- Morphology
- Manuscripts
- Textual variants
- Alternate versification (yet)
- Apocrypha (yet)

The BibleVerse table is canonical and stable.
All future theological references will point to it.

-----------------------------------------
IMPORTER DESIGN RULES
-----------------------------------------

- Import scripts are disposable.
- Schema is permanent.
- Do not overbuild normalization engines.
- Write per-source importers that map to canonical schema.

-----------------------------------------
PRISMA RULES
-----------------------------------------

- All primary keys are UUID.
- All relations explicit.
- Composite unique constraints required.
- Indexes required where appropriate.
- Timestamps required on all tables.
- PostgreSQL assumed.

-----------------------------------------
FRONTEND RULES
-----------------------------------------

Frontend apps may import Prisma types only:

    import type { BibleBook } from '@your-org/database'

Frontend must NEVER import PrismaClient runtime instance.

-----------------------------------------
AGENT BEHAVIOR EXPECTATIONS
-----------------------------------------

When generating code:

- Produce complete file contents.
- Include file paths.
- Update Nx `project.json` targets when needed.
- Do not assume implicit configuration.
- Do not remove or alter unrelated workspace configuration.
- Maintain strict separation of concerns.

When uncertain about Nx configuration:
Use Nx MCP tools rather than guessing.

-----------------------------------------
SCOPE DISCIPLINE
-----------------------------------------

This project intentionally avoids:

- Sermon prep tooling
- AI outline generation
- Enterprise feature creep
- Multi-pane desktop metaphors

Focus on:

- Canonical data integrity
- Clean ingestion pipelines
- Reference linking
- Stable schema design