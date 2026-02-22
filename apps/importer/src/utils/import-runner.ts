/**
 * Import Runner — Shared Infrastructure
 *
 * Provides utilities used by all import strategies:
 *   - ensureWork: create or force-recreate a Work record
 *   - linkProofs: resolve OSIS proof references and insert Reference rows
 *   - linkDetectedReferences: detect and link scripture refs from free-form text
 */

import { prisma } from '../../../../libs/database/src/index';
import { WorkType } from '../../../../libs/database/src/__generated__';
import type { Logger } from './logger';
import type { OsisProofGroup } from '../types/source-json';
import { proofsToReferences } from './osis-parser';
import { resolveReferences, detectAndResolve } from './reference-parser';

// ---------------------------------------------------------------------------
// ensureWork
// ---------------------------------------------------------------------------

export interface EnsureWorkOptions {
  title: string;
  author: string | null;
  type: WorkType;
  traditions: string[]; // tradition slugs — must exist in the Tradition table
  force: boolean;
}

/**
 * Find or create a Work record.
 *
 * If the work exists and force=false, throws.
 * If force=true, deletes all child units and references, then updates metadata.
 * Traditions are connected by slug. Throws if any slug is not found in the DB —
 * traditions are seeded, not auto-created.
 * Returns the work ID.
 */
export async function ensureWork(
  opts: EnsureWorkOptions,
  logger: Logger
): Promise<string> {
  // Resolve tradition slugs to IDs — fail fast on unknown slugs
  const traditionConnect = await resolveTraditions(opts.traditions);

  const existing = await prisma.work.findFirst({
    where: { title: opts.title },
    include: { units: { select: { id: true } } },
  });

  if (existing) {
    if (!opts.force) {
      throw new Error(
        `Work "${opts.title}" already exists with ${existing.units.length} units. Use --force to re-import.`
      );
    }

    logger.warn(`Work "${opts.title}" exists. Force mode: deleting existing units and references.`);

    const unitIds = existing.units.map(u => u.id);
    if (unitIds.length > 0) {
      const deletedRefs = await prisma.reference.deleteMany({
        where: { sourceUnitId: { in: unitIds } },
      });
      const deletedUnits = await prisma.workUnit.deleteMany({
        where: { workId: existing.id },
      });
      logger.info(`Deleted ${deletedRefs.count} references and ${deletedUnits.count} units.`);
    }

    await prisma.work.update({
      where: { id: existing.id },
      data: {
        author: opts.author,
        type: opts.type,
        traditions: { set: traditionConnect },
      },
    });

    return existing.id;
  }

  const work = await prisma.work.create({
    data: {
      title: opts.title,
      author: opts.author,
      type: opts.type,
      traditions: { connect: traditionConnect },
    },
  });

  logger.success(`Created work: ${work.title}`);
  return work.id;
}

async function resolveTraditions(slugs: string[]): Promise<{ id: string }[]> {
  if (slugs.length === 0) return [];
  const records = await prisma.tradition.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const found = new Set(records.map(r => r.slug));
  const missing = slugs.filter(s => !found.has(s));
  if (missing.length > 0) {
    throw new Error(
      `Unknown tradition slug(s): ${missing.join(', ')}. Check seed data in libs/database/prisma/seed.ts.`
    );
  }
  return records.map(r => ({ id: r.id }));
}

// ---------------------------------------------------------------------------
// linkProofs
// ---------------------------------------------------------------------------

export interface LinkResult {
  linked: number;
  unresolved: number;
}

/**
 * Convert an OSIS proof group array into BibleVerse IDs and insert Reference rows.
 * Deduplicates verse IDs within a single unit.
 */
export async function linkProofs(
  unitId: string,
  proofs: OsisProofGroup[],
  label: string,
  logger: Logger
): Promise<LinkResult> {
  if (!proofs || proofs.length === 0) return { linked: 0, unresolved: 0 };

  const parsed = proofsToReferences(proofs);
  const { resolved, unresolved } = await resolveReferences(parsed);

  if (unresolved.length > 0) {
    logger.warn(`${label}: ${unresolved.length} unresolved reference(s): ${unresolved.join(', ')}`);
  }

  const seenVerseIds = new Set<string>();
  for (const ref of resolved) {
    if (seenVerseIds.has(ref.verseId)) continue;
    seenVerseIds.add(ref.verseId);
    await prisma.reference.create({
      data: { sourceUnitId: unitId, bibleVerseId: ref.verseId },
    });
  }

  return { linked: seenVerseIds.size, unresolved: unresolved.length };
}

// ---------------------------------------------------------------------------
// linkDetectedReferences
// ---------------------------------------------------------------------------

/**
 * Run regex-based scripture reference detection over free-form text and
 * insert Reference rows for all resolved matches.
 * Used by the book import strategy on paragraph and blockquote blocks.
 */
export async function linkDetectedReferences(
  unitId: string,
  text: string,
  logger: Logger
): Promise<LinkResult> {
  const { resolved, unresolved, detectedCount } = await detectAndResolve(text);

  if (detectedCount === 0) return { linked: 0, unresolved: 0 };

  if (unresolved.length > 0) {
    logger.warn(`  ${unresolved.length} unresolved detected reference(s)`);
  }

  const seenVerseIds = new Set<string>();
  for (const ref of resolved) {
    if (seenVerseIds.has(ref.verseId)) continue;
    seenVerseIds.add(ref.verseId);
    await prisma.reference.create({
      data: { sourceUnitId: unitId, bibleVerseId: ref.verseId },
    });
  }

  return { linked: seenVerseIds.size, unresolved: unresolved.length };
}
