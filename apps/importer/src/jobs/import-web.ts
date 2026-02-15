/**
 * World English Bible (WEB) Import Job
 *
 * Imports Bible data from WEB JSON format into canonical database structure.
 *
 * Usage:
 *   nx run importer:import:web [--force]
 *
 * This job:
 * 1. Validates JSON structure using sample books (Ephesians prose, Psalms poetry)
 * 2. Creates canonical Bible structure (books, chapters, verses) for all 66 books
 * 3. Inserts BibleTextSegment rows for all 66 books
 * 4. Fails if WEB translation already exists unless --force flag is provided
 */

import { prisma, disconnect } from '../../../../libs/database/src/index';
import { CANONICAL_BOOKS, findBookByName } from '../data/canonical-books';
import { parseWebBook, analyzeWebStructure, type WebJsonEntry } from '../utils/web-parser';
import { getWebBookUrl } from '../utils/web-urls';
import { createLogger } from '../utils/logger';

const logger = createLogger('import-web');

interface ImportOptions {
  force: boolean;
}

/**
 * Fetch JSON from URL
 */
async function fetchJson(url: string): Promise<WebJsonEntry[]> {
  logger.info(`Fetching: ${url}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(`Invalid JSON format: expected array, got ${typeof data}`);
  }

  return data as WebJsonEntry[];
}

/**
 * Ensure BibleTranslation exists
 */
async function ensureTranslation(force: boolean): Promise<string> {
  const abbreviation = 'WEB';

  const existing = await prisma.bibleTranslation.findUnique({
    where: { abbreviation },
  });

  if (existing) {
    if (!force) {
      throw new Error(
        `Translation "${abbreviation}" already exists. Use --force to re-import.`
      );
    }

    logger.warn(`Translation "${abbreviation}" exists. Force mode: will delete existing segments.`);

    // Delete all existing text segments for this translation
    const deleted = await prisma.bibleTextSegment.deleteMany({
      where: { translationId: existing.id },
    });

    logger.info(`Deleted ${deleted.count} existing text segments`);

    return existing.id;
  }

  // Create new translation
  const translation = await prisma.bibleTranslation.create({
    data: {
      name: 'World English Bible',
      abbreviation,
      license: 'Public Domain',
      year: 2000,
    },
  });

  logger.success(`Created translation: ${translation.name} (${translation.abbreviation})`);

  return translation.id;
}

/**
 * Ensure canonical book structure exists
 */
async function ensureBook(bookName: string): Promise<string> {
  const canonicalBook = findBookByName(bookName);
  if (!canonicalBook) {
    throw new Error(`Book "${bookName}" not found in canonical 66-book Protestant canon`);
  }

  // Check if book exists
  let book = await prisma.bibleBook.findFirst({
    where: { canonicalName: canonicalBook.canonicalName },
  });

  if (!book) {
    // Create book
    book = await prisma.bibleBook.create({
      data: {
        canonicalName: canonicalBook.canonicalName,
        abbreviation: canonicalBook.abbreviation,
        testament: canonicalBook.testament,
        canonicalOrder: canonicalBook.canonicalOrder,
      },
    });

    logger.success(`Created book: ${book.canonicalName}`);
  } else {
    logger.info(`Book exists: ${book.canonicalName}`);
  }

  return book.id;
}

/**
 * Ensure chapter structure exists for a book
 */
async function ensureChapters(bookId: string, chapterCount: number): Promise<void> {
  const existingChapters = await prisma.bibleChapter.findMany({
    where: { bookId },
    orderBy: { chapterNumber: 'asc' },
  });

  if (existingChapters.length === chapterCount) {
    logger.info(`All ${chapterCount} chapters exist`);
    return;
  }

  if (existingChapters.length > 0 && existingChapters.length !== chapterCount) {
    throw new Error(
      `Chapter count mismatch: expected ${chapterCount}, found ${existingChapters.length}`
    );
  }

  // Get book's canonical order for calculating global chapter index
  const book = await prisma.bibleBook.findUnique({
    where: { id: bookId },
  });

  if (!book) {
    throw new Error(`Book not found: ${bookId}`);
  }

  // Calculate base canonical order index
  let baseIndex = (book.canonicalOrder - 1) * 1000;

  // Create chapters
  const chaptersToCreate = [];
  for (let i = 1; i <= chapterCount; i++) {
    chaptersToCreate.push({
      bookId,
      chapterNumber: i,
      canonicalOrderIndex: baseIndex + i,
    });
  }

  await prisma.bibleChapter.createMany({
    data: chaptersToCreate,
  });

  logger.success(`Created ${chapterCount} chapters`);
}

/**
 * Ensure verse structure exists for a chapter
 */
async function ensureVerses(
  chapterId: string,
  chapterNumber: number,
  verses: Array<{ verseNumber: number; paragraphStart: boolean }>
): Promise<void> {
  const existingVerses = await prisma.bibleVerse.findMany({
    where: { chapterId },
    orderBy: { verseNumber: 'asc' },
  });

  if (existingVerses.length === verses.length) {
    // All verses exist - update paragraphStart values
    for (const verse of verses) {
      const existingVerse = existingVerses.find(v => v.verseNumber === verse.verseNumber);
      if (existingVerse && existingVerse.paragraphStart !== verse.paragraphStart) {
        await prisma.bibleVerse.update({
          where: { id: existingVerse.id },
          data: { paragraphStart: verse.paragraphStart },
        });
      }
    }
    logger.info(`Updated paragraphStart flags for ${verses.length} verses in chapter ${chapterNumber}`);
    return;
  }

  if (existingVerses.length > 0 && existingVerses.length !== verses.length) {
    throw new Error(
      `Verse count mismatch in chapter ${chapterNumber}: expected ${verses.length}, found ${existingVerses.length}`
    );
  }

  // Get chapter's canonical order for calculating global verse index
  const chapter = await prisma.bibleChapter.findUnique({
    where: { id: chapterId },
  });

  if (!chapter) {
    throw new Error(`Chapter not found: ${chapterId}`);
  }

  // Create verses
  const versesToCreate = verses.map((verse) => ({
    chapterId,
    verseNumber: verse.verseNumber,
    canonicalOrderIndex: chapter.canonicalOrderIndex * 1000 + verse.verseNumber,
    paragraphStart: verse.paragraphStart,
  }));

  await prisma.bibleVerse.createMany({
    data: versesToCreate,
  });

  logger.success(`Created ${verses.length} verses for chapter ${chapterNumber}`);
}

/**
 * Import text segments for all verses
 */
async function importTextSegments(
  bookId: string,
  translationId: string,
  chapters: Array<{
    chapterNumber: number;
    verses: Array<{ verseNumber: number; text: string; paragraphStart: boolean }>;
  }>
): Promise<number> {
  let totalSegments = 0;

  for (const chapter of chapters) {
    // Get chapter from database
    const dbChapter = await prisma.bibleChapter.findUnique({
      where: {
        bookId_chapterNumber: {
          bookId,
          chapterNumber: chapter.chapterNumber,
        },
      },
    });

    if (!dbChapter) {
      throw new Error(`Chapter ${chapter.chapterNumber} not found in database`);
    }

    // Prepare text segments
    const segments = [];

    for (const verse of chapter.verses) {
      // Get verse from database
      const dbVerse = await prisma.bibleVerse.findUnique({
        where: {
          chapterId_verseNumber: {
            chapterId: dbChapter.id,
            verseNumber: verse.verseNumber,
          },
        },
      });

      if (!dbVerse) {
        throw new Error(
          `Verse ${chapter.chapterNumber}:${verse.verseNumber} not found in database`
        );
      }

      segments.push({
        verseId: dbVerse.id,
        translationId,
        segmentIndex: 0,
        segmentLabel: null,
        contentText: verse.text,
      });
    }

    // Insert all segments for this chapter
    await prisma.bibleTextSegment.createMany({
      data: segments,
    });

    totalSegments += segments.length;
  }

  return totalSegments;
}

/**
 * Import a single book
 */
async function importBook(
  bookName: string,
  translationId: string
): Promise<{ bookId: string; segmentCount: number }> {
  logger.info(`--- Importing ${bookName} ---`);

  // Get URL for this book
  const url = getWebBookUrl(bookName);
  if (!url) {
    throw new Error(`No URL mapping found for book: ${bookName}`);
  }

  // Fetch and parse book data
  const data = await fetchJson(url);
  const parsedBook = parseWebBook(data);

  // Ensure book structure
  const bookId = await ensureBook(bookName);
  await ensureChapters(bookId, parsedBook.chapters.length);

  // Ensure verse structure
  for (const chapter of parsedBook.chapters) {
    const dbChapter = await prisma.bibleChapter.findUnique({
      where: {
        bookId_chapterNumber: {
          bookId,
          chapterNumber: chapter.chapterNumber,
        },
      },
    });

    if (!dbChapter) {
      throw new Error(`Chapter ${chapter.chapterNumber} not found`);
    }

    await ensureVerses(dbChapter.id, chapter.chapterNumber, chapter.verses);
  }

  // Import text segments
  const segmentCount = await importTextSegments(bookId, translationId, parsedBook.chapters);
  logger.success(`Imported ${segmentCount} verses for ${bookName}`);

  return { bookId, segmentCount };
}

/**
 * Main import function
 */
export async function importWeb(options: ImportOptions): Promise<void> {
  try {
    logger.info('Starting WEB Bible import (all 66 books)');
    logger.info('Options:', options);

    // Step 1: Validate structure using sample books
    logger.info('--- Validating JSON structure ---');
    logger.info('Fetching sample books for structure validation...');

    const proseUrl = getWebBookUrl('Ephesians');
    const poetryUrl = getWebBookUrl('Psalms');

    if (!proseUrl || !poetryUrl) {
      throw new Error('Sample book URLs not found');
    }

    const proseData = await fetchJson(proseUrl);
    const poetryData = await fetchJson(poetryUrl);

    const proseInfo = analyzeWebStructure(proseData);
    const poetryInfo = analyzeWebStructure(poetryData);

    if (!proseInfo.valid) {
      throw new Error(`Invalid prose book structure: ${proseInfo.errors.join(', ')}`);
    }

    if (!poetryInfo.valid) {
      throw new Error(`Invalid poetry book structure: ${poetryInfo.errors.join(', ')}`);
    }

    logger.success('Prose structure valid (Ephesians)', {
      chapters: proseInfo.chapterCount,
      verses: proseInfo.verseCount,
    });

    logger.success('Poetry structure valid (Psalms)', {
      chapters: poetryInfo.chapterCount,
      verses: poetryInfo.verseCount,
    });

    // Step 2: Ensure translation
    logger.info('--- Ensuring translation ---');
    const translationId = await ensureTranslation(options.force);

    // Step 3: Import all 66 books
    logger.info('--- Importing all 66 books ---');

    let totalBooks = 0;
    let totalSegments = 0;

    for (const canonicalBook of CANONICAL_BOOKS) {
      try {
        const result = await importBook(canonicalBook.canonicalName, translationId);
        totalBooks++;
        totalSegments += result.segmentCount;
      } catch (error) {
        logger.error(`Failed to import ${canonicalBook.canonicalName}`, error);
        throw error;
      }
    }

    // Step 4: Summary
    logger.info('--- Import Complete ---');
    logger.success('Summary:', {
      translation: 'WEB',
      booksImported: totalBooks,
      totalVerses: totalSegments,
    });
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
    force: false,
  };

  for (const arg of args) {
    if (arg === '--force') {
      options.force = true;
    }
  }

  return options;
}

/**
 * Main entry point
 */
async function main() {
  try {
    const options = parseArgs();
    await importWeb(options);
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
