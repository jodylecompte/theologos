// @ts-nocheck — deprecated, replaced by unified import.ts + strategy pattern
/**
 * Confession Import Job
 *
 * Imports confessions and canons from the Creeds.json format:
 *   https://github.com/NonlinearFruit/Creeds.json
 *
 * Handles two CreedFormat values:
 *
 *   "Canon" — flat list of articles:
 *     Data: [{ Article, Title, Content, Proofs? }]
 *     → Work.type='confession', WorkUnit.type='article' (no parent)
 *
 *   "Confession" — chapters with sections:
 *     Data: [{ Chapter, Title, Sections: [{ Section, Content, Proofs? }] }]
 *     → Work.type='confession', chapter units (type='chapter') + section units (type='section', parentUnitId=chapter)
 *
 * Usage:
 *   nx run importer:import:confession -- --file <path> [--tradition <tradition>] [--force]
 */

import { prisma, disconnect } from '../../../../libs/database/src/index';
import { createLogger } from '../utils/logger';
import { resolveReferences } from '../utils/reference-parser';
import { proofsToReferences } from '../utils/osis-parser';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('import-confession');

interface ImportOptions {
  file: string;
  tradition: string | null;
  force: boolean;
}

interface CreedMetadata {
  Title: string;
  Authors?: string[];
  CreedFormat: 'Canon' | 'Confession';
  [key: string]: unknown;
}

interface CreedProof {
  Id: number;
  References: string[];
}

// Canon format
interface CanonArticle {
  Article: string;
  Title: string;
  Content: string;
  Proofs?: CreedProof[];
}

// Confession format
interface ConfessionSection {
  Section: string;
  Content: string;
  Proofs?: CreedProof[];
}

interface ConfessionChapter {
  Chapter: string;
  Title: string;
  Sections: ConfessionSection[];
}

interface CreedFile {
  Metadata: CreedMetadata;
  Data: CanonArticle[] | ConfessionChapter[];
}

function loadCreedFile(filePath: string): CreedFile {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const raw = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));

  if (!raw.Metadata || !Array.isArray(raw.Data)) {
    throw new Error(
      `File does not appear to be in Creeds.json format. Expected { Metadata, Data: [...] }. Got keys: ${Object.keys(raw).join(', ')}`
    );
  }

  const fmt = raw.Metadata?.CreedFormat;
  if (fmt !== 'Canon' && fmt !== 'Confession') {
    throw new Error(
      `This importer handles CreedFormat "Canon" or "Confession". Got: "${fmt}". Use import:catechism for catechism formats, import:creed for creed formats.`
    );
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
      data: { author, type: 'confession', tradition },
    });

    return existing.id;
  }

  const work = await prisma.work.create({
    data: { title, author, type: 'confession', tradition },
  });

  logger.success(`Created work: ${work.title}`);
  return work.id;
}

async function linkProofs(
  unitId: string,
  proofs: CreedProof[],
  label: string
): Promise<{ linked: number; unresolved: number }> {
  if (!proofs || proofs.length === 0) return { linked: 0, unresolved: 0 };

  const parsed = proofsToReferences(proofs);
  const { resolved, unresolved } = await resolveReferences(parsed);

  if (unresolved.length > 0) {
    logger.warn(`${label}: ${unresolved.length} unresolved references`);
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

async function importCanon(workId: string, articles: CanonArticle[]): Promise<{ units: number; refs: number; unresolved: number }> {
  let totalRefs = 0;
  let totalUnresolved = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const positionIndex = i + 1; // Sequential — Article values may be Roman numerals or "P"

    const unit = await prisma.workUnit.create({
      data: {
        workId,
        type: 'article',
        positionIndex,
        title: article.Title,
        contentText: article.Content,
      },
    });

    if (article.Proofs && article.Proofs.length > 0) {
      const { linked, unresolved } = await linkProofs(unit.id, article.Proofs, `Article ${article.Article}`);
      totalRefs += linked;
      totalUnresolved += unresolved;
    }
  }

  return { units: articles.length, refs: totalRefs, unresolved: totalUnresolved };
}

async function importConfession(workId: string, chapters: ConfessionChapter[]): Promise<{ chapters: number; sections: number; refs: number; unresolved: number }> {
  let totalSections = 0;
  let totalRefs = 0;
  let totalUnresolved = 0;

  for (const chapter of chapters) {
    const chapterIndex = parseInt(chapter.Chapter, 10);
    if (isNaN(chapterIndex)) {
      logger.warn(`Skipping chapter with non-numeric Chapter value: "${chapter.Chapter}"`);
      continue;
    }

    const chapterUnit = await prisma.workUnit.create({
      data: {
        workId,
        type: 'chapter',
        positionIndex: chapterIndex,
        title: chapter.Title,
        contentText: chapter.Title, // Chapter units store their title as content
      },
    });

    const sections = chapter.Sections ?? [];
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionIndex = i + 1; // Sequential within chapter — Section values may be "A1", "A2", etc.

      const sectionUnit = await prisma.workUnit.create({
        data: {
          workId,
          parentUnitId: chapterUnit.id,
          type: 'section',
          positionIndex: sectionIndex,
          title: `${chapter.Chapter}.${section.Section}`,
          contentText: section.Content,
        },
      });

      if (section.Proofs && section.Proofs.length > 0) {
        const { linked, unresolved } = await linkProofs(
          sectionUnit.id,
          section.Proofs,
          `Ch${chapter.Chapter} §${section.Section}`
        );
        totalRefs += linked;
        totalUnresolved += unresolved;
      }

      totalSections++;
    }
  }

  return { chapters: chapters.length, sections: totalSections, refs: totalRefs, unresolved: totalUnresolved };
}

export async function importConfessionFile(options: ImportOptions): Promise<void> {
  try {
    logger.info('Starting confession import');
    logger.info('Options:', options);

    const creed = loadCreedFile(options.file);
    const fmt = creed.Metadata.CreedFormat;

    const title = creed.Metadata.Title;
    const authors = creed.Metadata.Authors ?? [];
    const author = authors.length > 0 ? authors.join(', ') : null;

    logger.info(`Title: ${title}`);
    logger.info(`Format: ${fmt}`);
    logger.info(`Author: ${author ?? '(none)'}`);
    logger.info(`Items: ${creed.Data.length}`);

    const workId = await ensureWork(title, author, options.tradition, options.force);

    if (fmt === 'Canon') {
      const result = await importCanon(workId, creed.Data as CanonArticle[]);
      logger.success('Import complete', {
        title,
        format: 'Canon',
        articlesImported: result.units,
        referencesLinked: result.refs,
        unresolvedReferences: result.unresolved,
      });
    } else {
      const result = await importConfession(workId, creed.Data as ConfessionChapter[]);
      logger.success('Import complete', {
        title,
        format: 'Confession',
        chaptersImported: result.chapters,
        sectionsImported: result.sections,
        referencesLinked: result.refs,
        unresolvedReferences: result.unresolved,
      });
    }
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
    console.error('Usage: nx run importer:import:confession -- --file <path> [--tradition <name>] [--force]');
    process.exit(1);
  }

  return options;
}

async function main() {
  try {
    await importConfessionFile(parseArgs());
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
