import { Router } from 'express';
import { prisma } from '../../../../libs/database/src/index';

const router = Router();

/**
 * GET /api/bible/:translation/:book/:chapter
 *
 * Fetches all verses for a specific chapter
 */
router.get('/:translation/:book/:chapter', async (req, res) => {
  try {
    const { translation: translationAbbr, book: bookName, chapter: chapterNum } = req.params;
    const chapterNumber = parseInt(chapterNum, 10);

    if (isNaN(chapterNumber)) {
      return res.status(400).json({ error: 'Invalid chapter number' });
    }

    // Find translation
    const translation = await prisma.bibleTranslation.findUnique({
      where: { abbreviation: translationAbbr.toUpperCase() },
    });

    if (!translation) {
      return res.status(404).json({ error: `Translation "${translationAbbr}" not found` });
    }

    // Find book (case-insensitive)
    const book = await prisma.bibleBook.findFirst({
      where: {
        canonicalName: {
          equals: bookName,
          mode: 'insensitive',
        },
      },
    });

    if (!book) {
      return res.status(404).json({ error: `Book "${bookName}" not found` });
    }

    // Find chapter
    const chapter = await prisma.bibleChapter.findUnique({
      where: {
        bookId_chapterNumber: {
          bookId: book.id,
          chapterNumber,
        },
      },
      include: {
        verses: {
          include: {
            textSegments: {
              where: {
                translationId: translation.id,
              },
              orderBy: {
                segmentIndex: 'asc',
              },
            },
          },
          orderBy: {
            verseNumber: 'asc',
          },
        },
      },
    });

    if (!chapter) {
      return res.status(404).json({
        error: `Chapter ${chapterNumber} not found in ${bookName}`
      });
    }

    // Format response
    const verses = chapter.verses.map(verse => ({
      number: verse.verseNumber,
      text: verse.textSegments
        .map(segment => segment.contentText)
        .join('\n'),
      paragraphStart: verse.paragraphStart,
    }));

    res.json({
      translation: {
        abbreviation: translation.abbreviation,
        name: translation.name,
      },
      book: {
        name: book.canonicalName,
        testament: book.testament,
      },
      chapter: {
        number: chapter.chapterNumber,
        verseCount: verses.length,
      },
      verses,
    });
  } catch (error) {
    console.error('Error fetching Bible chapter:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
