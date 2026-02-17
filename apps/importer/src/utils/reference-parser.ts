/**
 * Reference Parser
 *
 * Parses Bible references from various formats into canonical BibleVerse IDs.
 * Supports:
 * - Single verses: "Romans 8:28"
 * - Ranges: "Romans 8:28-30"
 * - Multiple verses: "Romans 8:28, 30"
 * - Multiple references: "Romans 8:28; 1 Cor 13:4"
 */

import { prisma } from '../../../../libs/database/src/index';
import { findBookByName } from '../data/canonical-books';

/**
 * Parsed reference result
 */
export interface ParsedReference {
  bookName: string;
  chapter: number;
  verses: number[];
}

/**
 * Reference resolution result
 */
export interface ResolvedReference {
  verseId: string;
  bookName: string;
  chapter: number;
  verse: number;
}

/**
 * Book name normalization map
 * Maps common abbreviations and variations to canonical names
 */
const BOOK_NAME_ALIASES: Record<string, string> = {
  // Genesis variations
  'gen': 'Genesis',
  'ge': 'Genesis',

  // Exodus variations
  'exod': 'Exodus',
  'ex': 'Exodus',

  // Leviticus variations
  'lev': 'Leviticus',
  'le': 'Leviticus',

  // Numbers variations
  'num': 'Numbers',
  'nu': 'Numbers',

  // Deuteronomy variations
  'deut': 'Deuteronomy',
  'dt': 'Deuteronomy',

  // Joshua variations
  'josh': 'Joshua',
  'jos': 'Joshua',

  // Judges variations
  'judg': 'Judges',
  'jdg': 'Judges',

  // Ruth variations
  'ruth': 'Ruth',
  'ru': 'Ruth',

  // Samuel variations
  '1 sam': '1 Samuel',
  '1sam': '1 Samuel',
  'i sam': '1 Samuel',
  '2 sam': '2 Samuel',
  '2sam': '2 Samuel',
  'ii sam': '2 Samuel',

  // Kings variations
  '1 kings': '1 Kings',
  '1kings': '1 Kings',
  'i kings': '1 Kings',
  '2 kings': '2 Kings',
  '2kings': '2 Kings',
  'ii kings': '2 Kings',

  // Chronicles variations
  '1 chron': '1 Chronicles',
  '1chron': '1 Chronicles',
  '1 chr': '1 Chronicles',
  '1chr': '1 Chronicles',
  'i chronicles': '1 Chronicles',
  '2 chron': '2 Chronicles',
  '2chron': '2 Chronicles',
  '2 chr': '2 Chronicles',
  '2chr': '2 Chronicles',
  'ii chronicles': '2 Chronicles',

  // Ezra variations
  'ezra': 'Ezra',
  'ezr': 'Ezra',

  // Nehemiah variations
  'neh': 'Nehemiah',
  'ne': 'Nehemiah',

  // Esther variations
  'esth': 'Esther',
  'est': 'Esther',

  // Job variations
  'job': 'Job',

  // Psalms variations
  'ps': 'Psalms',
  'psa': 'Psalms',
  'psalm': 'Psalms',

  // Proverbs variations
  'prov': 'Proverbs',
  'pr': 'Proverbs',

  // Ecclesiastes variations
  'eccl': 'Ecclesiastes',
  'ecc': 'Ecclesiastes',
  'ec': 'Ecclesiastes',

  // Song of Solomon variations
  'song': 'Song of Solomon',
  'song of songs': 'Song of Solomon',
  'sos': 'Song of Solomon',
  'ss': 'Song of Solomon',

  // Isaiah variations
  'isa': 'Isaiah',
  'is': 'Isaiah',

  // Jeremiah variations
  'jer': 'Jeremiah',
  'je': 'Jeremiah',

  // Lamentations variations
  'lam': 'Lamentations',
  'la': 'Lamentations',

  // Ezekiel variations
  'ezek': 'Ezekiel',
  'eze': 'Ezekiel',

  // Daniel variations
  'dan': 'Daniel',
  'da': 'Daniel',

  // Minor Prophets
  'hos': 'Hosea',
  'joel': 'Joel',
  'amos': 'Amos',
  'obad': 'Obadiah',
  'ob': 'Obadiah',
  'jonah': 'Jonah',
  'jon': 'Jonah',
  'mic': 'Micah',
  'mi': 'Micah',
  'nah': 'Nahum',
  'na': 'Nahum',
  'hab': 'Habakkuk',
  'zeph': 'Zephaniah',
  'zep': 'Zephaniah',
  'hag': 'Haggai',
  'haggai': 'Haggai',
  'zech': 'Zechariah',
  'zec': 'Zechariah',
  'mal': 'Malachi',

  // New Testament
  'matt': 'Matthew',
  'mt': 'Matthew',
  'mark': 'Mark',
  'mk': 'Mark',
  'mr': 'Mark',
  'luke': 'Luke',
  'lk': 'Luke',
  'john': 'John',
  'jn': 'John',
  'joh': 'John',
  'acts': 'Acts',
  'ac': 'Acts',

  // Romans variations
  'rom': 'Romans',
  'ro': 'Romans',

  // Corinthians variations
  '1 cor': '1 Corinthians',
  '1cor': '1 Corinthians',
  'i cor': '1 Corinthians',
  'i corinthians': '1 Corinthians',
  '2 cor': '2 Corinthians',
  '2cor': '2 Corinthians',
  'ii cor': '2 Corinthians',
  'ii corinthians': '2 Corinthians',

  // Galatians variations
  'gal': 'Galatians',
  'ga': 'Galatians',

  // Ephesians variations
  'eph': 'Ephesians',

  // Philippians variations
  'phil': 'Philippians',
  'php': 'Philippians',

  // Colossians variations
  'col': 'Colossians',

  // Thessalonians variations
  '1 thess': '1 Thessalonians',
  '1thess': '1 Thessalonians',
  'i thess': '1 Thessalonians',
  '2 thess': '2 Thessalonians',
  '2thess': '2 Thessalonians',
  'ii thess': '2 Thessalonians',

  // Timothy variations
  '1 tim': '1 Timothy',
  '1tim': '1 Timothy',
  'i tim': '1 Timothy',
  'i timothy': '1 Timothy',
  '2 tim': '2 Timothy',
  '2tim': '2 Timothy',
  'ii tim': '2 Timothy',
  'ii timothy': '2 Timothy',

  // Titus variations
  'titus': 'Titus',
  'tit': 'Titus',

  // Philemon variations
  'philem': 'Philemon',
  'phlm': 'Philemon',
  'phm': 'Philemon',

  // Hebrews variations
  'heb': 'Hebrews',

  // James variations
  'jas': 'James',
  'jam': 'James',

  // Peter variations
  '1 pet': '1 Peter',
  '1pet': '1 Peter',
  'i pet': '1 Peter',
  'i peter': '1 Peter',
  '2 pet': '2 Peter',
  '2pet': '2 Peter',
  'ii pet': '2 Peter',
  'ii peter': '2 Peter',

  // John variations
  '1 john': '1 John',
  '1john': '1 John',
  'i john': '1 John',
  '2 john': '2 John',
  '2john': '2 John',
  'ii john': '2 John',
  '3 john': '3 John',
  '3john': '3 John',
  'iii john': '3 John',

  // Jude variations
  'jude': 'Jude',
  'jud': 'Jude',

  // Revelation variations
  'rev': 'Revelation',
  're': 'Revelation',
  'revelations': 'Revelation',
};

/**
 * Normalize book name to canonical form
 */
function normalizeBookName(rawName: string): string | null {
  // Strip trailing period(s) so abbreviations like "Ps.", "Isa.", "Cor." normalize correctly
  const cleaned = rawName.trim().toLowerCase().replace(/\.+$/, '');

  // Try direct lookup in aliases
  if (BOOK_NAME_ALIASES[cleaned]) {
    return BOOK_NAME_ALIASES[cleaned];
  }

  // Try canonical book lookup
  const book = findBookByName(cleaned);
  if (book) {
    return book.canonicalName;
  }

  return null;
}

/**
 * Parse a single reference string
 * Examples:
 *   "Romans 8:28"
 *   "Romans 8:28-30"
 *   "Romans 8:28, 30"
 */
function parseReference(ref: string): ParsedReference | null {
  const trimmed = ref.trim();

  // Match pattern: "BookName Chapter:Verse" or "BookName Chapter:Verse-Verse"
  const match = trimmed.match(/^(.+?)\s+(\d+):(.+)$/);

  if (!match) {
    return null;
  }

  const [, rawBook, chapterStr, versesStr] = match;

  const bookName = normalizeBookName(rawBook);
  if (!bookName) {
    return null;
  }

  const chapter = parseInt(chapterStr, 10);
  if (isNaN(chapter) || chapter < 1) {
    return null;
  }

  // Parse verses (could be "28", "28-30", "28,30", etc.)
  const verses: number[] = [];

  // Split by comma first
  const verseParts = versesStr.split(',').map(s => s.trim());

  for (const part of verseParts) {
    // Check if it's a range
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        continue;
      }

      // Expand range
      for (let v = start; v <= end; v++) {
        verses.push(v);
      }
    } else {
      const verse = parseInt(part, 10);
      if (!isNaN(verse) && verse >= 1) {
        verses.push(verse);
      }
    }
  }

  if (verses.length === 0) {
    return null;
  }

  return {
    bookName,
    chapter,
    verses,
  };
}

/**
 * Detect Bible references in free-form text
 * Finds direct inline references in common formats:
 *   - "Romans 8:28"
 *   - "1 Corinthians 13:4-7"
 *   - "1st Cor 13:4"
 *   - "(see Romans 8:28)"
 *   - "cf. 1 John 3:16"
 *
 * Does NOT detect complex separated references like:
 *   - "In Romans we read...verse 42 of chapter 13"
 */
export function detectReferences(text: string): string[] {
  const references: string[] = [];

  // Regex pattern to match common inline reference formats:
  // Optional prefix (see, cf., etc.) + Book Name + Chapter:Verse
  // Handles numbered books (1, 2, 3, 1st, 2nd, 3rd, I, II, III)
  const pattern = /\b(?:(?:see|cf\.|compare|cp\.)\s+)?(?:\()?([1-3](?:st|nd|rd)?\s+|I{1,3}\s+)?([A-Z][a-z]+(?:\s+of\s+[A-Z][a-z]+)?\.?)\s+(\d+):(\d+(?:-\d+)?(?:\s*,\s*\d+(?:-\d+)?)*)\)?/gi;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const [fullMatch, bookNumber, bookName, chapter, verses] = match;

    // Reconstruct the reference string
    const bookPart = (bookNumber || '').trim() + ' ' + bookName.trim();
    const reference = `${bookPart.trim()} ${chapter}:${verses}`;

    // Validate that the book name is recognized
    const normalized = normalizeBookName(bookPart);
    if (normalized) {
      references.push(reference);
    }
  }

  return references;
}

/**
 * Parse multiple references separated by semicolons
 * Example: "Romans 8:28; 1 Cor 13:4-7"
 */
export function parseReferences(input: string): ParsedReference[] {
  const results: ParsedReference[] = [];

  // Split by semicolon
  const parts = input.split(';').map(s => s.trim());

  for (const part of parts) {
    const parsed = parseReference(part);
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}

/**
 * Resolve parsed references to BibleVerse IDs
 */
export async function resolveReferences(
  parsed: ParsedReference[]
): Promise<{
  resolved: ResolvedReference[];
  unresolved: string[];
}> {
  const resolved: ResolvedReference[] = [];
  const unresolved: string[] = [];

  for (const ref of parsed) {
    // Find the book
    const book = await prisma.bibleBook.findFirst({
      where: {
        canonicalName: ref.bookName,
      },
    });

    if (!book) {
      unresolved.push(`${ref.bookName} ${ref.chapter}:${ref.verses.join(',')}`);
      continue;
    }

    // Find the chapter
    const chapter = await prisma.bibleChapter.findUnique({
      where: {
        bookId_chapterNumber: {
          bookId: book.id,
          chapterNumber: ref.chapter,
        },
      },
    });

    if (!chapter) {
      unresolved.push(`${ref.bookName} ${ref.chapter}:${ref.verses.join(',')}`);
      continue;
    }

    // Find each verse
    for (const verseNum of ref.verses) {
      const verse = await prisma.bibleVerse.findUnique({
        where: {
          chapterId_verseNumber: {
            chapterId: chapter.id,
            verseNumber: verseNum,
          },
        },
      });

      if (!verse) {
        unresolved.push(`${ref.bookName} ${ref.chapter}:${verseNum}`);
        continue;
      }

      resolved.push({
        verseId: verse.id,
        bookName: ref.bookName,
        chapter: ref.chapter,
        verse: verseNum,
      });
    }
  }

  return { resolved, unresolved };
}

/**
 * Parse and resolve a single reference string
 */
export async function parseAndResolve(
  input: string
): Promise<{
  resolved: ResolvedReference[];
  unresolved: string[];
}> {
  const parsed = parseReferences(input);
  return resolveReferences(parsed);
}

/**
 * Detect, parse, and resolve references from free-form text
 * Useful for importing books where references are embedded in content
 *
 * Example:
 *   "As we see in Romans 8:28 and 1 John 3:16-17, God works all things..."
 *   → Detects both references
 *   → Parses them into structured data
 *   → Resolves to BibleVerse IDs
 */
export async function detectAndResolve(
  text: string
): Promise<{
  resolved: ResolvedReference[];
  unresolved: string[];
  detectedCount: number;
}> {
  const detectedRefs = detectReferences(text);
  const allParsed: ParsedReference[] = [];

  // Parse each detected reference
  for (const ref of detectedRefs) {
    const parsed = parseReferences(ref);
    allParsed.push(...parsed);
  }

  const { resolved, unresolved } = await resolveReferences(allParsed);

  return {
    resolved,
    unresolved,
    detectedCount: detectedRefs.length,
  };
}
