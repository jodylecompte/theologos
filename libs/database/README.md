# @org/database

The canonical data layer for the Theologos monorepo.

This library contains the Prisma schema, database client, and TypeScript types for all database models.

## Architecture

- **Schema Location**: `libs/database/prisma/schema.prisma`
- **Client Export**: `libs/database/src/client.ts`
- **Generated Client**: `node_modules/.prisma/database-client`

## Database Schema

The schema implements a canonical-first Bible data model:

- `BibleBook` - Canonical book definitions (Genesis, Exodus, etc.)
- `BibleChapter` - Chapter divisions within books
- `BibleVerse` - Canonical verse identities (stable reference points)
- `BibleTranslation` - Translation metadata (KJV, ESV, NIV, etc.)
- `BibleTextSegment` - Translation-specific text content for verses

### Design Principles

- All primary keys are UUIDs
- All relations are explicit
- Composite unique constraints ensure data integrity
- Indexes optimize common query patterns
- Timestamps track creation and modification

## Usage

### In Backend Code (Node.js, API)

Import the Prisma client instance:

```typescript
import { prisma } from '@org/database';

// Query the database
const books = await prisma.bibleBook.findMany({
  orderBy: { canonicalOrder: 'asc' },
});

// Create records
const translation = await prisma.bibleTranslation.create({
  data: {
    name: 'King James Version',
    abbreviation: 'KJV',
    year: 1611,
    license: 'Public Domain',
  },
});
```

### In Frontend Code (Angular, Browser)

**IMPORTANT**: Only import types - never import the runtime client in browser code:

```typescript
import type { BibleBook, BibleVerse, BibleTranslation } from '@org/database';

// Use types for component interfaces
interface BibleViewerProps {
  book: BibleBook;
  verses: BibleVerse[];
}
```

Importing the runtime client in frontend code will cause build errors and bundle bloat.

## Database Operations

All database operations should be run through Nx targets to ensure proper workspace integration.

### Generate Prisma Client

After creating or modifying the schema, generate the Prisma client:

```bash
nx run database:prisma:generate
```

This creates the TypeScript client at `node_modules/.prisma/database-client`.

### Create a Migration

When you modify the schema, create a migration:

```bash
nx run database:prisma:migrate
```

This will:
1. Prompt you to name the migration
2. Generate SQL migration files
3. Apply the migration to your development database
4. Regenerate the Prisma client

### Apply Migrations (Production)

In production or CI environments:

```bash
nx run database:prisma:migrate:deploy
```

### Reset Database

To reset your database (drops all data):

```bash
nx run database:prisma:migrate:reset
```

### Push Schema Changes (Development Only)

For rapid prototyping without creating migrations:

```bash
nx run database:prisma:push
```

### Open Prisma Studio

To visually explore and edit database data:

```bash
nx run database:prisma:studio
```

## Environment Variables

Set `DATABASE_URL` in your environment:

```bash
# Development
DATABASE_URL="postgresql://user:password@localhost:5432/theologos_dev?schema=public"

# Production
DATABASE_URL="postgresql://user:password@prod-host:5432/theologos_prod?schema=public"
```

## Import Patterns

### ✅ Correct

```typescript
// Backend - import client and types
import { prisma } from '@org/database';
import type { BibleBook } from '@org/database';

// Frontend - ONLY import types
import type { BibleBook, BibleVerse } from '@org/database';
```

### ❌ Incorrect

```typescript
// Frontend - DO NOT import runtime client
import { prisma } from '@org/database'; // ❌ Will break browser builds
```

## Building the Library

To build the library for distribution:

```bash
nx run database:build
```

This compiles TypeScript and outputs to `dist/libs/database`.

## Development Workflow

1. **Modify schema** in `libs/database/prisma/schema.prisma`
2. **Generate client**: `nx run database:prisma:generate`
3. **Create migration**: `nx run database:prisma:migrate`
4. **Update imports** in consuming apps/libs as needed

## Dependencies

The library requires:

- `@prisma/client` (runtime dependency)
- `prisma` (dev dependency for CLI)
- PostgreSQL database

## Notes

- The Prisma client is generated to a shared location so all projects in the monorepo use the same client
- Never commit `node_modules/.prisma/` - it's generated
- Migration files in `libs/database/prisma/migrations/` should be committed
- The schema is the source of truth - modify it, not the database directly
