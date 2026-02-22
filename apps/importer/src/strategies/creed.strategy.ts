import { prisma } from '../../../../libs/database/src/index';
import type { Logger } from '../utils/logger';
import type { CreedSourceJson } from '../types/source-json';

export interface CreedImportResult {
  sectionsImported: number;
}

/**
 * Import a creed from CreedSourceJson.
 *
 * Creates one WorkUnit of type 'section' per section in source.sections.
 */
export async function runCreedStrategy(
  workId: string,
  source: CreedSourceJson,
  logger: Logger
): Promise<CreedImportResult> {
  let sectionsImported = 0;

  for (let i = 0; i < source.sections.length; i++) {
    const section = source.sections[i];
    const positionIndex = i + 1;

    await prisma.workUnit.create({
      data: {
        workId,
        type: 'section',
        positionIndex,
        title: `Section ${positionIndex}`,
        contentText: section.content,
      },
    });

    sectionsImported++;
  }

  logger.success('Creed import complete', { sectionsImported });
  return { sectionsImported };
}
