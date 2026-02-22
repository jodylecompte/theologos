import { prisma } from '../../../../libs/database/src/index';
import type { Logger } from '../utils/logger';
import type {
  ConfessionSourceJson,
  ChapteredConfessionSourceJson,
  CanonConfessionSourceJson,
} from '../types/source-json';
import { linkProofs } from '../utils/import-runner';

export interface ConfessionImportResult {
  unitsImported: number;
  referencesLinked: number;
  unresolvedReferences: number;
}

/**
 * Import a confession from ConfessionSourceJson.
 *
 * Handles two structural forms discriminated on metadata.structure:
 *
 *   'chaptered' — chapters containing sections
 *     → WorkUnit (chapter) + WorkUnit children (section) with proofs
 *
 *   'canon' — flat list of articles
 *     → WorkUnit (article) with proofs, no parent
 */
export async function runConfessionStrategy(
  workId: string,
  source: ConfessionSourceJson,
  logger: Logger
): Promise<ConfessionImportResult> {
  if (source.metadata.structure === 'chaptered') {
    return importChaptered(workId, source as ChapteredConfessionSourceJson, logger);
  } else {
    return importCanon(workId, source as CanonConfessionSourceJson, logger);
  }
}

async function importChaptered(
  workId: string,
  source: Extract<ConfessionSourceJson, { metadata: { structure: 'chaptered' } }>,
  logger: Logger
): Promise<ConfessionImportResult> {
  let unitsImported = 0;
  let referencesLinked = 0;
  let unresolvedReferences = 0;

  for (let ci = 0; ci < source.chapters.length; ci++) {
    const chapter = source.chapters[ci];
    const chapterIndex = ci + 1;

    const chapterUnit = await prisma.workUnit.create({
      data: {
        workId,
        type: 'chapter',
        positionIndex: chapterIndex,
        title: chapter.title,
        contentText: '',
      },
    });
    unitsImported++;

    for (let si = 0; si < chapter.sections.length; si++) {
      const section = chapter.sections[si];
      const sectionIndex = si + 1;

      const sectionUnit = await prisma.workUnit.create({
        data: {
          workId,
          parentUnitId: chapterUnit.id,
          type: 'section',
          positionIndex: sectionIndex,
          title: `${chapterIndex}.${sectionIndex}`,
          contentText: section.content,
        },
      });
      unitsImported++;

      if (section.proofs && section.proofs.length > 0) {
        const result = await linkProofs(
          sectionUnit.id,
          section.proofs,
          `Ch${chapterIndex} §${sectionIndex}`,
          logger
        );
        referencesLinked += result.linked;
        unresolvedReferences += result.unresolved;
      }
    }

    logger.info(`Chapter ${chapterIndex}: ${chapter.title} (${chapter.sections.length} sections)`);
  }

  logger.success('Confession import complete', {
    structure: 'chaptered',
    chapters: source.chapters.length,
    unitsImported,
    referencesLinked,
    unresolvedReferences,
  });

  return { unitsImported, referencesLinked, unresolvedReferences };
}

async function importCanon(
  workId: string,
  source: Extract<ConfessionSourceJson, { metadata: { structure: 'canon' } }>,
  logger: Logger
): Promise<ConfessionImportResult> {
  let unitsImported = 0;
  let referencesLinked = 0;
  let unresolvedReferences = 0;

  for (let i = 0; i < source.articles.length; i++) {
    const article = source.articles[i];
    const positionIndex = i + 1;

    const unit = await prisma.workUnit.create({
      data: {
        workId,
        type: 'article',
        positionIndex,
        title: article.title,
        contentText: article.content,
      },
    });
    unitsImported++;

    if (article.proofs && article.proofs.length > 0) {
      const result = await linkProofs(unit.id, article.proofs, `Article ${positionIndex}`, logger);
      referencesLinked += result.linked;
      unresolvedReferences += result.unresolved;
    }
  }

  logger.success('Confession import complete', {
    structure: 'canon',
    unitsImported,
    referencesLinked,
    unresolvedReferences,
  });

  return { unitsImported, referencesLinked, unresolvedReferences };
}
