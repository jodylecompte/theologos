/**
 * Catechism Import Job
 *
 * Imports catechisms from the Creeds.json format:
 *   https://github.com/NonlinearFruit/Creeds.json
 *
 * Usage:
 *   nx run importer:import:catechism -- --file <path> [--tradition <tradition>] [--force]
 *
 * The JSON file must follow the Creeds.json format:
 *   { "Metadata": { "Title": "...", "Authors": [...] }, "Data": [...questions] }
 *
 * Each question must have:
 *   { "Number": 1, "Question": "...", "Answer": "...", "Proofs": [{ "Id": 1, "References": ["Isa.44.6"] }] }
 */

import { prisma, disconnect } from '../../../../libs/database/src/index';
import { createLogger } from '../utils/logger';
import { resolveReferences, parseReferences, type ParsedReference } from '../utils/reference-parser';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('import-catechism');

interface ImportOptions {
  file: string;
  tradition: string | null;
  force: boolean;
}

interface CreedMetadata {
  Title: string;
  Authors?: string[];
  [key: string]: unknown;
}

interface CreedProof {
  Id: number;
  References: string[];
}

interface CreedQuestion {
  Number: number;
  Question: string;
  Answer: string;
  AnswerWithProofs?: string;
  Proofs?: CreedProof[];
}

interface CreedFile {
  Metadata: CreedMetadata;
  Data: CreedQuestion[];
}

/**
 * Parse a single OSIS token: "BookAbbrev.Chapter.Verse"  e.g. "1Cor.10.31"
 * Returns null for chapter-only refs like "Gen.1" (no verse = skip).
 */
function parseSingleOsis(osis: string): { book: string; chapter: number; verse: number } | null {
  const parts = osis.split('.');
  if (parts.length !== 3) return null; // chapter-only refs (Gen.1) are skipped

  const [book, chapterStr, verseStr] = parts;
  const chapter = parseInt(chapterStr, 10);
  const verse = parseInt(verseStr, 10);

  if (isNaN(chapter) || isNaN(verse)) return null;

  return { book, chapter, verse };
}

/**
 * Convert a single OSIS token or cross-ref range to one or more
 * "Book chapter:verse[-verse]" strings the reference parser understands.
 *
 * Handles:
 *   "Isa.44.6"               → ["Isa 44:6"]
 *   "Ps.73.25-Ps.73.26"      → ["Ps 73:25-26"]
 *   "2Tim.3.15-2Tim.3.16"    → ["2Tim 3:15-16"]
 *   "Acts.2.24-Acts.2.27"    → ["Acts 2:24-27"]
 */
function osisSingleToTraditionals(osis: string): string[] {
  osis = osis.trim();

  // Cross-ref range: two full OSIS refs joined by "-"
  // Pattern: anything.digits.digits - anything.digits.digits
  // Use a split at the hyphen that separates two OSIS refs
  const rangeMatch = osis.match(/^(.+\.\d+\.\d+)-(.+\.\d+\.\d+)$/);
  if (rangeMatch) {
    const start = parseSingleOsis(rangeMatch[1]);
    const end = parseSingleOsis(rangeMatch[2]);
    if (!start || !end) return [];

    if (start.book === end.book && start.chapter === end.chapter) {
      return [`${start.book} ${start.chapter}:${start.verse}-${end.verse}`];
    }
    // Different chapters: emit two separate refs
    return [
      `${start.book} ${start.chapter}:${start.verse}`,
      `${end.book} ${end.chapter}:${end.verse}`,
    ];
  }

  // Single ref
  const single = parseSingleOsis(osis);
  if (!single) return []; // chapter-only or unrecognized — skip
  return [`${single.book} ${single.chapter}:${single.verse}`];
}

/**
 * Convert a Creeds.json Proofs array into ParsedReference objects.
 *
 * Each OSIS entry in References may be:
 *   - A single ref:              "Isa.44.6"
 *   - A cross-verse range:       "2Tim.3.15-2Tim.3.16"
 *   - Comma-separated refs:      "Eph.1.4,Eph.1.11"
 *   - Mixed:                     "Gen.3.6-Gen.3.8,Gen.3.13"
 *
 * All are split, converted, then fed through parseReferences so that
 * book name normalization happens the same way as the rest of the system.
 */
function proofsToReferences(proofs: CreedProof[]): ParsedReference[] {
  const traditionals: string[] = [];

  for (const proof of proofs) {
    for (const rawOsis of proof.References) {
      // Split comma-separated OSIS refs first
      const tokens = rawOsis.split(',').map(s => s.trim());

      for (const token of tokens) {
        const converted = osisSingleToTraditionals(token);
        if (converted.length === 0) {
          logger.warn(`Could not convert OSIS reference: ${token} (from: ${rawOsis})`);
        }
        traditionals.push(...converted);
      }
    }
  }

  // Use parseReferences so book name normalization is applied consistently
  const result: ParsedReference[] = [];
  for (const t of traditionals) {
    const parsed = parseReferences(t);
    result.push(...parsed);
  }
  return result;
}

/**
 * Load and parse a Creeds.json format file.
 */
function loadCreedFile(filePath: string): CreedFile {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const raw = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));

  if (!raw.Metadata || !Array.isArray(raw.Data)) {
    throw new Error(
      `File does not appear to be in Creeds.json format. Expected { Metadata, Data }. Got keys: ${Object.keys(raw).join(', ')}`
    );
  }

  return raw as CreedFile;
}

/**
 * Ensure Work entry exists, deleting existing units if --force.
 */
async function ensureWork(
  title: string,
  author: string | null,
  tradition: string | null,
  force: boolean
): Promise<string> {
  const existing = await prisma.work.findFirst({
    where: { title },
    include: { units: true },
  });

  if (existing) {
    if (!force) {
      throw new Error(
        `Work "${title}" already exists with ${existing.units.length} units. Use --force to re-import.`
      );
    }

    logger.warn(`Work "${title}" exists. Force mode: deleting existing units.`);

    const unitIds = existing.units.map(u => u.id);
    if (unitIds.length > 0) {
      const deletedRefs = await prisma.reference.deleteMany({
        where: { sourceUnitId: { in: unitIds } },
      });
      logger.info(`Deleted ${deletedRefs.count} existing references`);

      const deletedUnits = await prisma.workUnit.deleteMany({
        where: { workId: existing.id },
      });
      logger.info(`Deleted ${deletedUnits.count} existing units`);
    }

    // Update work metadata in case it changed (e.g. type was wrong on previous import)
    await prisma.work.update({
      where: { id: existing.id },
      data: { author, type: 'catechism', tradition },
    });

    return existing.id;
  }

  const work = await prisma.work.create({
    data: {
      title,
      author,
      type: 'catechism',
      tradition,
    },
  });

  logger.success(`Created work: ${work.title}`);
  return work.id;
}

/**
 * Import a single question as a WorkUnit.
 */
async function importQuestion(
  workId: string,
  question: CreedQuestion
): Promise<{ referencesCreated: number; unresolvedCount: number }> {
  const contentText = `Q. ${question.Question}\n\nA. ${question.Answer}`;

  const unit = await prisma.workUnit.create({
    data: {
      workId,
      type: 'question',
      positionIndex: question.Number,
      title: `Q${question.Number}`,
      contentText,
    },
  });

  let referencesCreated = 0;
  let unresolvedCount = 0;

  if (question.Proofs && question.Proofs.length > 0) {
    const parsed = proofsToReferences(question.Proofs);
    const { resolved, unresolved } = await resolveReferences(parsed);

    if (unresolved.length > 0) {
      logger.warn(`Q${question.Number}: Unresolved references:`, unresolved);
      unresolvedCount += unresolved.length;
    }

    for (const ref of resolved) {
      await prisma.reference.create({
        data: { sourceUnitId: unit.id, bibleVerseId: ref.verseId },
      });
      referencesCreated++;
    }
  }

  return { referencesCreated, unresolvedCount };
}

/**
 * Main import function.
 */
export async function importCatechism(options: ImportOptions): Promise<void> {
  try {
    logger.info('Starting catechism import');
    logger.info('Options:', options);

    const creed = loadCreedFile(options.file);

    const title = creed.Metadata.Title;
    const authors = creed.Metadata.Authors ?? [];
    const author = authors.length > 0 ? authors.join(', ') : null;

    logger.info(`Title: ${title}`);
    logger.info(`Author: ${author ?? '(none)'}`);
    logger.info(`Questions: ${creed.Data.length}`);

    const workId = await ensureWork(title, author, options.tradition, options.force);

    let totalReferences = 0;
    let totalUnresolved = 0;

    for (const question of creed.Data) {
      const result = await importQuestion(workId, question);
      totalReferences += result.referencesCreated;
      totalUnresolved += result.unresolvedCount;

      if (question.Number % 25 === 0) {
        logger.info(`Progress: ${question.Number}/${creed.Data.length}`);
      }
    }

    logger.success('Import complete', {
      title,
      questionsImported: creed.Data.length,
      referencesLinked: totalReferences,
      unresolvedReferences: totalUnresolved,
    });
  } catch (error) {
    logger.error('Import failed', error);
    throw error;
  } finally {
    await disconnect();
  }
}

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);
  const options: ImportOptions = { file: '', tradition: null, force: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && i + 1 < args.length) {
      options.file = args[++i];
    } else if (args[i] === '--tradition' && i + 1 < args.length) {
      options.tradition = args[++i];
    } else if (args[i] === '--force') {
      options.force = true;
    }
  }

  if (!options.file) {
    console.error('Usage: nx run importer:import:catechism -- --file <path> [--tradition <name>] [--force]');
    process.exit(1);
  }

  return options;
}

async function main() {
  try {
    await importCatechism(parseArgs());
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
