/**
 * @org/database/browser
 *
 * Browser-safe exports from the database library.
 * This module NEVER imports PrismaClient runtime.
 *
 * Safe for use in:
 * - Angular frontend (including SSR)
 * - Browser environments
 * - Any non-Node.js runtime
 *
 * ## Usage in Frontend
 *
 * ```typescript
 * import { applyTransform, getFlagLabel } from '@org/database/browser';
 * import type { TransformName, FlagType } from '@org/database/browser';
 * ```
 */

// Re-export all Prisma types for frontend use
export type {
  BibleBook,
  BibleChapter,
  BibleVerse,
  BibleTranslation,
  BibleTextSegment,
  Prisma,
} from './__generated__';

// Re-export text transforms for frontend use
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

// Re-export flag detection for frontend use
export {
  computeFlags,
  getFlagLabel,
  getFlagDescription,
  type FlagType,
  type FlagDetectionResult,
} from './flag-detector';
