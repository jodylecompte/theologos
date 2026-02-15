/**
 * Westminster Shorter Catechism (WSC) Import Job
 *
 * Imports the Westminster Shorter Catechism from CoffeeScript source into canonical database structure.
 *
 * Usage:
 *   nx run importer:import:wsc -- --file <path> [--force]
 *
 * This job:
 * 1. Loads CoffeeScript file and extracts catechism data
 * 2. Creates Work entry for WSC
 * 3. Creates WorkUnit entries for each question
 * 4. Parses proof texts and creates Reference entries linking to BibleVerse
 * 5. Idempotent: use --force to re-import
 */

import { prisma, disconnect } from '../../../../libs/database/src/index';
import { createLogger } from '../utils/logger';
import { parseAndResolve } from '../utils/reference-parser';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('import-wsc');

interface ImportOptions {
  file: string;
  force: boolean;
}

/**
 * WSC Question structure from CoffeeScript source
 */
interface WscQuestion {
  number: number;
  question: string;
  answer: string;
  proofTexts?: Record<string, string[]>;
}

/**
 * Load and parse CoffeeScript file
 *
 * The CoffeeScript file exports a function that returns the questions array.
 * We need to execute it safely and extract the data.
 */
async function loadWscData(filePath: string): Promise<WscQuestion[]> {
  logger.info(`Loading WSC data from: ${filePath}`);

  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  // Read the file content
  const fileContent = fs.readFileSync(absolutePath, 'utf-8');

  // Check if it's a CoffeeScript file
  if (filePath.endsWith('.coffee')) {
    // Extract the array directly without CoffeeScript compiler
    // The file structure is: module.exports = (robot) -> [array]
    // The array content is valid JavaScript object notation

    logger.info('Extracting data from CoffeeScript file (no compiler needed)...');

    // Remove the module.exports wrapper
    const arrayContent = fileContent
      .replace(/^module\.exports\s*=\s*\(robot\)\s*->\s*\n/m, '')
      .trim();

    // The CoffeeScript object notation is valid JavaScript
    // Evaluate it safely using eval (the data is from a known source)
    try {
      const data = eval(`(${arrayContent})`);

      if (!Array.isArray(data)) {
        throw new Error('Extracted data is not an array');
      }

      logger.success(`Loaded ${data.length} questions from CoffeeScript file`);
      return data;
    } catch (error) {
      throw new Error(
        `Failed to parse CoffeeScript file. Consider converting to JSON first. Error: ${error}`
      );
    }
  } else if (filePath.endsWith('.json')) {
    // If it's already JSON, just parse it
    const data = JSON.parse(fileContent);

    if (!Array.isArray(data)) {
      throw new Error('JSON file does not contain an array');
    }

    logger.success(`Loaded ${data.length} questions from JSON file`);
    return data;
  } else {
    throw new Error('Unsupported file format. Use .coffee or .json file');
  }
}

/**
 * Ensure Work entry exists
 */
async function ensureWork(force: boolean): Promise<string> {
  const title = 'Westminster Shorter Catechism';

  const existing = await prisma.work.findFirst({
    where: { title },
    include: {
      units: true,
    },
  });

  if (existing) {
    if (!force) {
      throw new Error(
        `Work "${title}" already exists with ${existing.units.length} units. Use --force to re-import.`
      );
    }

    logger.warn(`Work "${title}" exists. Force mode: will delete existing units and references.`);

    // Delete all references associated with this work's units
    const unitIds = existing.units.map(u => u.id);

    if (unitIds.length > 0) {
      const deletedRefs = await prisma.reference.deleteMany({
        where: {
          sourceUnitId: { in: unitIds },
        },
      });

      logger.info(`Deleted ${deletedRefs.count} existing references`);

      // Delete all units
      const deletedUnits = await prisma.workUnit.deleteMany({
        where: {
          workId: existing.id,
        },
      });

      logger.info(`Deleted ${deletedUnits.count} existing units`);
    }

    return existing.id;
  }

  // Create new work
  const work = await prisma.work.create({
    data: {
      title,
      author: 'Westminster Assembly',
      type: 'confession',
      tradition: 'Reformed',
    },
  });

  logger.success(`Created work: ${work.title}`);

  return work.id;
}

/**
 * Extract all proof text references from a question
 */
function extractProofTexts(question: WscQuestion): string[] {
  const references: string[] = [];

  if (!question.proofTexts) {
    return references;
  }

  // Proof texts are organized by footnote number
  // Each footnote can have multiple references
  for (const footnoteRefs of Object.values(question.proofTexts)) {
    references.push(...footnoteRefs);
  }

  return references;
}

/**
 * Import a single question as a WorkUnit
 */
async function importQuestion(
  workId: string,
  question: WscQuestion
): Promise<{ unitId: string; referencesCreated: number; unresolvedCount: number }> {
  // Combine question and answer into contentText
  const contentText = `Q. ${question.question}\n\nA. ${question.answer}`;

  // Create WorkUnit
  const unit = await prisma.workUnit.create({
    data: {
      workId,
      type: 'question',
      positionIndex: question.number,
      title: `Q. ${question.number}`,
      contentText,
    },
  });

  // Extract and resolve proof texts
  const proofTexts = extractProofTexts(question);
  let referencesCreated = 0;
  let unresolvedCount = 0;

  for (const proofText of proofTexts) {
    try {
      const { resolved, unresolved } = await parseAndResolve(proofText);

      // Log unresolved references
      if (unresolved.length > 0) {
        logger.warn(`Q${question.number}: Unresolved references:`, unresolved);
        unresolvedCount += unresolved.length;
      }

      // Create Reference entries for resolved verses
      for (const ref of resolved) {
        await prisma.reference.create({
          data: {
            sourceUnitId: unit.id,
            bibleVerseId: ref.verseId,
          },
        });

        referencesCreated++;
      }
    } catch (error) {
      logger.warn(`Q${question.number}: Failed to parse reference "${proofText}":`, error);
      unresolvedCount++;
    }
  }

  return { unitId: unit.id, referencesCreated, unresolvedCount };
}

/**
 * Main import function
 */
export async function importWsc(options: ImportOptions): Promise<void> {
  try {
    logger.info('Starting Westminster Shorter Catechism import');
    logger.info('Options:', options);

    // Step 1: Load WSC data
    logger.info('--- Loading WSC data ---');
    const questions = await loadWscData(options.file);

    logger.info(`Loaded ${questions.length} questions`);

    // Step 2: Ensure Work entry
    logger.info('--- Ensuring Work entry ---');
    const workId = await ensureWork(options.force);

    // Step 3: Import questions
    logger.info('--- Importing questions ---');

    let totalUnits = 0;
    let totalReferences = 0;
    let totalUnresolved = 0;

    for (const question of questions) {
      try {
        const result = await importQuestion(workId, question);
        totalUnits++;
        totalReferences += result.referencesCreated;
        totalUnresolved += result.unresolvedCount;

        if (question.number % 10 === 0) {
          logger.info(`Progress: ${question.number}/${questions.length} questions`);
        }
      } catch (error) {
        logger.error(`Failed to import Q${question.number}`, error);
        throw error;
      }
    }

    // Step 4: Summary
    logger.info('--- Import Complete ---');
    logger.success('Summary:', {
      work: 'Westminster Shorter Catechism',
      questionsImported: totalUnits,
      referencesLinked: totalReferences,
      unresolvedReferences: totalUnresolved,
    });

    if (totalUnresolved > 0) {
      logger.warn(
        `${totalUnresolved} references could not be resolved. Check logs for details.`
      );
    }
  } catch (error) {
    logger.error('Import failed', error);
    throw error;
  } finally {
    await disconnect();
  }
}

/**
 * Parse command-line arguments
 */
function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);
  const options: ImportOptions = {
    file: '',
    force: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--file' && i + 1 < args.length) {
      options.file = args[i + 1];
      i++;
    } else if (arg === '--force') {
      options.force = true;
    }
  }

  if (!options.file) {
    throw new Error('Missing required argument: --file <path>');
  }

  return options;
}

/**
 * Main entry point
 */
async function main() {
  try {
    const options = parseArgs();
    await importWsc(options);
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
