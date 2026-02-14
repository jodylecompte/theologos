import { Router } from 'express';
import { prisma } from '../../../../libs/database/src/index';

const router = Router();

/**
 * GET /api/books
 *
 * Returns all Bible books with their metadata including chapter counts
 */
router.get('/', async (req, res) => {
  try {
    const books = await prisma.bibleBook.findMany({
      include: {
        chapters: {
          select: {
            chapterNumber: true,
          },
          orderBy: {
            chapterNumber: 'asc',
          },
        },
      },
      orderBy: {
        canonicalOrder: 'asc',
      },
    });

    const booksWithMetadata = books.map(book => ({
      name: book.canonicalName,
      abbreviation: book.abbreviation,
      testament: book.testament,
      canonicalOrder: book.canonicalOrder,
      chapterCount: book.chapters.length,
      chapters: book.chapters.map(ch => ch.chapterNumber),
    }));

    res.json({
      books: booksWithMetadata,
      totalBooks: booksWithMetadata.length,
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
