import { Router } from 'express';
import { prisma } from '../../../../libs/database/src/index';

const router = Router();

/**
 * GET /api/wsc
 *
 * Returns all 107 questions metadata for the Westminster Shorter Catechism
 */
router.get('/', async (req, res) => {
  try {
    // Find the Westminster Shorter Catechism work
    const work = await prisma.work.findFirst({
      where: {
        title: 'Westminster Shorter Catechism',
      },
      include: {
        units: {
          orderBy: {
            positionIndex: 'asc',
          },
          include: {
            references: true,
          },
        },
      },
    });

    if (!work) {
      return res.status(404).json({ error: 'Westminster Shorter Catechism not found' });
    }

    // Map units to question metadata
    const questions = work.units.map((unit) => {
      // Parse question text from contentText (format: "Q. question\nA. answer")
      const lines = unit.contentText.split('\n');
      const questionLine = lines.find(line => line.startsWith('Q.'));
      const questionText = questionLine
        ? questionLine.substring(2).trim()
        : unit.contentText.substring(0, 100) + '...';

      return {
        number: unit.positionIndex,
        questionText: questionText.length > 150 ? questionText.substring(0, 150) + '...' : questionText,
        hasProofTexts: unit.references.length > 0,
      };
    });

    res.json({
      questions,
      totalQuestions: questions.length,
    });
  } catch (error) {
    console.error('Error fetching WSC questions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/wsc/:questionNumber
 *
 * Returns a single WSC question with full details including proof texts
 */
router.get('/:questionNumber', async (req, res) => {
  try {
    const questionNumber = parseInt(req.params.questionNumber, 10);

    if (isNaN(questionNumber) || questionNumber < 1 || questionNumber > 107) {
      return res.status(400).json({ error: 'Invalid question number (must be 1-107)' });
    }

    // Find the Westminster Shorter Catechism work
    const work = await prisma.work.findFirst({
      where: {
        title: 'Westminster Shorter Catechism',
      },
    });

    if (!work) {
      return res.status(404).json({ error: 'Westminster Shorter Catechism not found' });
    }

    // Find the specific question unit with all references and Bible text
    const unit = await prisma.workUnit.findFirst({
      where: {
        workId: work.id,
        positionIndex: questionNumber,
      },
      include: {
        references: {
          include: {
            bibleVerse: {
              include: {
                chapter: {
                  include: {
                    book: true,
                  },
                },
                textSegments: {
                  where: {
                    translation: {
                      abbreviation: 'WEB',
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!unit) {
      return res.status(404).json({ error: `Question ${questionNumber} not found` });
    }

    // Parse question and answer from contentText
    const lines = unit.contentText.split('\n');
    const questionLine = lines.find(line => line.startsWith('Q.'));
    const answerLine = lines.find(line => line.startsWith('A.'));

    const questionText = questionLine ? questionLine.substring(2).trim() : '';
    const answerText = answerLine ? answerLine.substring(2).trim() : unit.contentText;

    // Group references by proximity (consecutive verses in same chapter)
    interface ProofText {
      displayText: string;
      references: Array<{
        book: string;
        chapter: number;
        verse: number;
        text: string;
      }>;
    }

    const proofTexts: ProofText[] = [];
    const sortedRefs = unit.references.sort((a, b) => {
      const aVerse = a.bibleVerse;
      const bVerse = b.bibleVerse;
      // Sort by canonical order
      return aVerse.canonicalOrderIndex - bVerse.canonicalOrderIndex;
    });

    let currentGroup: ProofText | null = null;

    for (const ref of sortedRefs) {
      const verse = ref.bibleVerse;
      const chapter = verse.chapter;
      const book = chapter.book;
      const verseText = verse.textSegments.map(seg => seg.contentText).join(' ');

      const refData = {
        book: book.canonicalName,
        chapter: chapter.chapterNumber,
        verse: verse.verseNumber,
        text: verseText,
      };

      // Check if this verse continues the current group
      if (
        currentGroup &&
        currentGroup.references.length > 0
      ) {
        const lastRef = currentGroup.references[currentGroup.references.length - 1];
        const sameChapter = lastRef.book === refData.book && lastRef.chapter === refData.chapter;
        const consecutive = sameChapter && lastRef.verse === refData.verse - 1;

        if (consecutive || sameChapter) {
          // Add to current group
          currentGroup.references.push(refData);
          // Update display text
          if (consecutive) {
            // Handle verse ranges
            const firstRef = currentGroup.references[0];
            const lastVerse = currentGroup.references[currentGroup.references.length - 1].verse;
            currentGroup.displayText = `${firstRef.book} ${firstRef.chapter}:${firstRef.verse}${
              lastVerse > firstRef.verse ? `-${lastVerse}` : ''
            }`;
          } else {
            // Non-consecutive verses in same chapter
            currentGroup.displayText = `${refData.book} ${refData.chapter}:${currentGroup.references
              .map(r => r.verse)
              .join(', ')}`;
          }
        } else {
          // Start new group
          currentGroup = {
            displayText: `${refData.book} ${refData.chapter}:${refData.verse}`,
            references: [refData],
          };
          proofTexts.push(currentGroup);
        }
      } else {
        // Start first group
        currentGroup = {
          displayText: `${refData.book} ${refData.chapter}:${refData.verse}`,
          references: [refData],
        };
        proofTexts.push(currentGroup);
      }
    }

    res.json({
      number: questionNumber,
      questionText,
      answerText,
      proofTexts,
    });
  } catch (error) {
    console.error('Error fetching WSC question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
