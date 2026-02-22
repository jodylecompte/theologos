import { prisma } from '../../../../libs/database/src/index';
import type { Logger } from '../utils/logger';
import type { CatechismSourceJson } from '../types/source-json';
import { linkProofs } from '../utils/import-runner';

export interface CatechismImportResult {
  questionsImported: number;
  questionsSkipped: number;
  referencesLinked: number;
  unresolvedReferences: number;
}

/**
 * Import a catechism from CatechismSourceJson.
 *
 * Each question becomes a WorkUnit of type 'question'.
 * OSIS proof references are resolved and linked as Reference rows.
 */
export async function runCatechismStrategy(
  workId: string,
  source: CatechismSourceJson,
  logger: Logger
): Promise<CatechismImportResult> {
  let questionsImported = 0;
  let questionsSkipped = 0;
  let referencesLinked = 0;
  let unresolvedReferences = 0;

  for (const question of source.questions) {
    // Skip placeholder items
    if (!question.question || !question.answer) {
      logger.warn(`Skipping question ${question.number} — missing question or answer text`);
      questionsSkipped++;
      continue;
    }

    const contentText = `Q. ${question.question}\n\nA. ${question.answer}`;

    const unit = await prisma.workUnit.create({
      data: {
        workId,
        type: 'question',
        positionIndex: question.number,
        title: `Q${question.number}`,
        contentText,
      },
    });

    if (question.proofs && question.proofs.length > 0) {
      const result = await linkProofs(unit.id, question.proofs, `Q${question.number}`, logger);
      referencesLinked += result.linked;
      unresolvedReferences += result.unresolved;
    }

    questionsImported++;

    if (question.number % 25 === 0) {
      logger.info(`Progress: ${question.number}/${source.questions.length}`);
    }
  }

  logger.success('Catechism import complete', {
    questionsImported,
    questionsSkipped,
    referencesLinked,
    unresolvedReferences,
  });

  return { questionsImported, questionsSkipped, referencesLinked, unresolvedReferences };
}
