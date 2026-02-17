/**
 * Creed Import Job
 *
 * Imports creeds from the Creeds.json format:
 *   https://github.com/NonlinearFruit/Creeds.json
 *
 * Handles files where CreedFormat === "Creed":
 *   { "Metadata": { "Title": "...", "Authors": [...], ... }, "Data": { "Content": "..." } }
 *
 * Content is split by double-newlines into numbered sections (WorkUnits of type 'section').
 *
 * Usage:
 *   nx run importer:import:creed -- --file <path> [--tradition <tradition>] [--force]
 */

import { prisma, disconnect } from '../../../../libs/database/src/index';
import { createLogger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('import-creed');

interface ImportOptions {
  file: string;
  tradition: string | null;
  force: boolean;
}

interface CreedMetadata {
  Title: string;
  AlternativeTitles?: string[];
  Year?: string;
  Authors?: string[];
  Location?: string | null;
  OriginalLanguage?: string;
  OriginStory?: string | null;
  SourceUrl?: string;
  SourceAttribution?: string;
  CreedFormat: string;
  [key: string]: unknown;
}

interface CreedFile {
  Metadata: CreedMetadata;
  Data: { Content: string };
}

function loadCreedFile(filePath: string): CreedFile {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const raw = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));

  if (!raw.Metadata || !raw.Data) {
    throw new Error(
      `File does not appear to be in Creeds.json format. Expected { Metadata, Data }. Got keys: ${Object.keys(raw).join(', ')}`
    );
  }

  if (raw.Metadata.CreedFormat !== 'Creed') {
    throw new Error(
      `This importer only handles CreedFormat "Creed". Got: "${raw.Metadata.CreedFormat}". Use import:catechism for catechism formats.`
    );
  }

  if (typeof raw.Data.Content !== 'string' || !raw.Data.Content.trim()) {
    throw new Error(`Data.Content is missing or empty in ${absolutePath}`);
  }

  return raw as CreedFile;
}

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
      await prisma.reference.deleteMany({
        where: { sourceUnitId: { in: unitIds } },
      });
      await prisma.workUnit.deleteMany({
        where: { workId: existing.id },
      });
    }

    await prisma.work.update({
      where: { id: existing.id },
      data: { author, type: 'creed', tradition },
    });

    return existing.id;
  }

  const work = await prisma.work.create({
    data: { title, author, type: 'creed', tradition },
  });

  logger.success(`Created work: ${work.title}`);
  return work.id;
}

export async function importCreed(options: ImportOptions): Promise<void> {
  try {
    logger.info('Starting creed import');
    logger.info('Options:', options);

    const creed = loadCreedFile(options.file);

    const title = creed.Metadata.Title;
    const authors = creed.Metadata.Authors ?? [];
    const author = authors.length > 0 ? authors.join(', ') : null;

    logger.info(`Title: ${title}`);
    logger.info(`Author: ${author ?? '(none)'}`);
    logger.info(`Year: ${creed.Metadata.Year ?? '(unknown)'}`);

    // Split content into sections by double-newline, dropping blank sections
    const sections = creed.Data.Content
      .split(/\n\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    logger.info(`Sections: ${sections.length}`);

    const workId = await ensureWork(title, author, options.tradition, options.force);

    for (let i = 0; i < sections.length; i++) {
      const sectionText = sections[i];
      const positionIndex = i + 1;

      await prisma.workUnit.create({
        data: {
          workId,
          type: 'section',
          positionIndex,
          title: `Section ${positionIndex}`,
          contentText: sectionText,
        },
      });
    }

    logger.success('Import complete', {
      title,
      sectionsImported: sections.length,
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
    console.error('Usage: nx run importer:import:creed -- --file <path> [--tradition <name>] [--force]');
    process.exit(1);
  }

  return options;
}

async function main() {
  try {
    await importCreed(parseArgs());
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
