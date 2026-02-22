/**
 * @org/database
 *
 * Canonical data layer for the Theologos monorepo.
 *
 * This library provides:
 * - Prisma schema defining the Bible data model
 * - Type-safe database client
 * - Generated TypeScript types for all models
 *
 * ## Usage in Backend (Node.js)
 *
 * Import the Prisma client instance:
 * ```typescript
 * import { prisma } from '@org/database';
 *
 * const books = await prisma.bibleBook.findMany();
 * ```
 *
 * ## Usage in Frontend (Browser)
 *
 * ONLY import types - never import the runtime client:
 * ```typescript
 * import type { BibleBook, BibleVerse } from '@org/database';
 * ```
 */

// Re-export Prisma client for backend use
export { prisma, disconnect } from './client';

// Re-export all Prisma types for both backend and frontend use
export type {
  BibleBook,
  BibleChapter,
  BibleVerse,
  BibleTranslation,
  BibleTextSegment,
  Work,
  WorkUnit,
  Reference,
  Prisma,
} from './__generated__';

// Re-export enums as values (required for runtime use in importers and backend)
export { WorkType, WorkUnitType, WorkUnitStatus } from './__generated__';

// Re-export text transforms for backend and frontend use
export {
  promoteHeading,
  demoteHeading,
  markParagraph,
  dehyphenate,
  fixDropCap,
  applyTransform,
  getTransformLabel,
  type TransformName,
} from './text-transforms';

// Re-export flag detection for backend and frontend use
export {
  computeFlags,
  getFlagLabel,
  getFlagDescription,
  type FlagType,
  type FlagDetectionResult,
} from './flag-detector';
