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
import { resolveReferences, parseReferences, detectReferences, type ParsedReference } from '../utils/reference-parser';
import { proofsToReferences } from '../utils/osis-parser';
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

interface CreedSubQuestion {
  Number: string;
  Question: string;
  Answer: string;
}

interface CreedQuestion {
  Number: number | string;
  Question: string;
  Answer: string;
  AnswerWithProofs?: string;
  Proofs?: CreedProof[];
  SubQuestions?: CreedSubQuestion[];
}

interface CreedFile {
  Metadata: CreedMetadata;
  Data: CreedQuestion[];
}

/**
 * Extract ParsedReferences from SubQuestion answers.
 *
 * References are embedded in answer text in traditional format:
 *   "Yes: For there is a spirit in man... Job 32:8."
 *   "No: This people have I formed for myself, Isa. 43:21."
 *
 * We run the full answer text through parseReferences() to extract them.
 */
function subQuestionsToReferences(subQuestions: CreedSubQuestion[]): ParsedReference[] {
  const allRefs: ParsedReference[] = [];
  for (const sq of subQuestions) {
    // References are embedded in prose: "Yes: ...understanding, Job 32:8."
    // Use detectReferences() to extract them from the answer text, then parse each.
    const detected = detectReferences(sq.Answer);
    for (const ref of detected) {
      const parsed = parseReferences(ref);
      allRefs.push(...parsed);
    }
  }
  return allRefs;
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
  const positionIndex = parseInt(String(question.Number), 10);
  const contentText = `Q. ${question.Question}\n\nA. ${question.Answer}`;

  const unit = await prisma.workUnit.create({
    data: {
      workId,
      type: 'question',
      positionIndex,
      title: `Q${question.Number}`,
      contentText,
    },
  });

  let referencesCreated = 0;
  let unresolvedCount = 0;

  let parsed: ParsedReference[] = [];

  if (question.Proofs && question.Proofs.length > 0) {
    // Standard Creeds.json format: explicit OSIS proof references
    parsed = proofsToReferences(question.Proofs);
  } else if (question.SubQuestions && question.SubQuestions.length > 0) {
    // HenrysCatechism format: references embedded in SubQuestion answer text
    parsed = subQuestionsToReferences(question.SubQuestions);
  }

  if (parsed.length > 0) {
    const { resolved, unresolved } = await resolveReferences(parsed);

    if (unresolved.length > 0) {
      logger.warn(`Q${question.Number}: Unresolved references:`, unresolved);
      unresolvedCount += unresolved.length;
    }

    // Deduplicate verse IDs before inserting
    const seenVerseIds = new Set<string>();
    for (const ref of resolved) {
      if (seenVerseIds.has(ref.verseId)) continue;
      seenVerseIds.add(ref.verseId);
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

    let imported = 0;
    for (let i = 0; i < creed.Data.length; i++) {
      const question = creed.Data[i];
      const questionNumber = parseInt(String(question.Number), 10);

      // Skip placeholder items (Number="?", Question="?", etc.)
      if (isNaN(questionNumber) || !question.Question || question.Question === '?' || !question.Answer || question.Answer === '?') {
        logger.warn(`Skipping item ${i} with Number="${question.Number}" (placeholder or invalid)`);
        continue;
      }

      const result = await importQuestion(workId, question);
      totalReferences += result.referencesCreated;
      totalUnresolved += result.unresolvedCount;
      imported++;

      if (questionNumber % 25 === 0) {
        logger.info(`Progress: ${questionNumber}/${creed.Data.length}`);
      }
    }

    logger.success('Import complete', {
      title,
      questionsImported: imported,
      questionsSkipped: creed.Data.length - imported,
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
