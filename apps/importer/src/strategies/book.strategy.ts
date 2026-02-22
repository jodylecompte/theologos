import { prisma } from '../../../../libs/database/src/index';
import { Prisma } from '../../../../libs/database/src/__generated__';
import type { Logger } from '../utils/logger';
import type { BookSourceJson, BookFootnote } from '../types/source-json';
import { linkDetectedReferences } from '../utils/import-runner';

function footnotesMetadata(footnotes: BookFootnote[] | undefined): Prisma.InputJsonValue | undefined {
  if (!footnotes || footnotes.length === 0) return undefined;
  return { footnotes } as unknown as Prisma.InputJsonValue;
}

export interface BookImportResult {
  chaptersImported: number;
  blocksImported: number;
  referencesLinked: number;
  unresolvedReferences: number;
}

/**
 * Import a book from BookSourceJson.
 *
 * Structure produced in the DB:
 *
 *   WorkUnit (chapter)
 *     WorkUnit (heading | paragraph | blockquote)   ← blocks in positionIndex order
 *
 * Each paragraph and blockquote block:
 *   - Has its sourcePage recorded
 *   - Has footnotes stored in metadata.footnotes
 *   - Has scripture references detected and linked
 *
 * Each heading block:
 *   - Has its level stored in metadata.level
 *   - Has its sourcePage recorded
 */
export async function runBookStrategy(
  workId: string,
  source: BookSourceJson,
  logger: Logger
): Promise<BookImportResult> {
  let chaptersImported = 0;
  let blocksImported = 0;
  let referencesLinked = 0;
  let unresolvedReferences = 0;

  for (let ci = 0; ci < source.chapters.length; ci++) {
    const chapter = source.chapters[ci];
    const chapterIndex = ci + 1;

    const chapterTitle = chapter.subtitle
      ? `${chapter.title}\n${chapter.subtitle}`
      : chapter.title;

    const chapterUnit = await prisma.workUnit.create({
      data: {
        workId,
        type: 'chapter',
        positionIndex: chapterIndex,
        title: chapterTitle,
        contentText: '',
      },
    });

    chaptersImported++;
    logger.info(`Chapter ${chapterIndex}: ${chapter.title} (${chapter.blocks.length} blocks)`);

    for (let bi = 0; bi < chapter.blocks.length; bi++) {
      const block = chapter.blocks[bi];
      const blockIndex = bi + 1;

      let unitId: string;

      if (block.type === 'heading') {
        const unit = await prisma.workUnit.create({
          data: {
            workId,
            parentUnitId: chapterUnit.id,
            type: 'heading',
            positionIndex: blockIndex,
            title: block.content,
            contentText: block.content,
            sourcePage: block.sourcePage ?? null,
            metadata: { level: block.level },
          },
        });
        unitId = unit.id;
      } else if (block.type === 'paragraph') {
        const unit = await prisma.workUnit.create({
          data: {
            workId,
            parentUnitId: chapterUnit.id,
            type: 'paragraph',
            positionIndex: blockIndex,
            title: null,
            contentText: block.content,
            sourcePage: block.sourcePage ?? null,
            metadata: footnotesMetadata(block.footnotes),
          },
        });
        unitId = unit.id;
      } else {
        // blockquote
        const unit = await prisma.workUnit.create({
          data: {
            workId,
            parentUnitId: chapterUnit.id,
            type: 'blockquote',
            positionIndex: blockIndex,
            title: null,
            contentText: block.content,
            sourcePage: block.sourcePage ?? null,
            metadata: footnotesMetadata(block.footnotes),
          },
        });
        unitId = unit.id;
      }

      blocksImported++;

      // Detect and link scripture references in body text (not headings)
      if (block.type === 'paragraph' || block.type === 'blockquote') {
        const result = await linkDetectedReferences(unitId, block.content, logger);
        referencesLinked += result.linked;
        unresolvedReferences += result.unresolved;
      }
    }
  }

  logger.success('Book import complete', {
    chaptersImported,
    blocksImported,
    referencesLinked,
    unresolvedReferences,
  });

  return { chaptersImported, blocksImported, referencesLinked, unresolvedReferences };
}
