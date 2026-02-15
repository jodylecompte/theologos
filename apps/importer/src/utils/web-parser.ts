/**
 * Parser for World English Bible JSON format
 *
 * The WEB JSON format is a flat array of objects with structure markers
 * and text content objects.
 */

export interface WebJsonEntry {
  type: string;
  chapterNumber?: number;
  verseNumber?: number;
  sectionNumber?: number;
  value?: string;
}

export interface ParsedVerse {
  chapterNumber: number;
  verseNumber: number;
  text: string;
  paragraphStart: boolean;
}

export interface ParsedChapter {
  chapterNumber: number;
  verses: ParsedVerse[];
}

export interface ParsedBook {
  chapters: ParsedChapter[];
}

/**
 * Parse WEB JSON format into structured book data
 *
 * Groups text by chapter and verse, preserving line breaks
 * but ignoring structural markers.
 */
export function parseWebBook(entries: WebJsonEntry[]): ParsedBook {
  const chapterMap = new Map<number, Map<number, string[]>>();
  const paragraphStarts = new Set<string>(); // Track verses that start paragraphs
  let nextVerseParagraphStart = false;

  for (const entry of entries) {
    // Track paragraph start markers
    if (entry.type === 'paragraph start') {
      nextVerseParagraphStart = true;
      continue;
    }

    // Only process entries with actual text content
    if (!entry.value || entry.chapterNumber === undefined || entry.verseNumber === undefined) {
      continue;
    }

    const { chapterNumber, verseNumber, value } = entry;

    // Mark this verse as paragraph start if we saw the marker
    if (nextVerseParagraphStart) {
      paragraphStarts.add(`${chapterNumber}:${verseNumber}`);
      nextVerseParagraphStart = false;
    }

    // Get or create chapter map
    let verseMap = chapterMap.get(chapterNumber);
    if (!verseMap) {
      verseMap = new Map();
      chapterMap.set(chapterNumber, verseMap);
    }

    // Get or create verse text array
    let verseSegments = verseMap.get(verseNumber);
    if (!verseSegments) {
      verseSegments = [];
      verseMap.set(verseNumber, verseSegments);
    }

    // Add text segment
    verseSegments.push(value);
  }

  // Convert maps to structured arrays
  const chapters: ParsedChapter[] = [];

  // Sort chapter numbers
  const chapterNumbers = Array.from(chapterMap.keys()).sort((a, b) => a - b);

  for (const chapterNumber of chapterNumbers) {
    const verseMap = chapterMap.get(chapterNumber)!;
    const verses: ParsedVerse[] = [];

    // Sort verse numbers
    const verseNumbers = Array.from(verseMap.keys()).sort((a, b) => a - b);

    for (const verseNumber of verseNumbers) {
      const segments = verseMap.get(verseNumber)!;
      // Join segments with newline to preserve line breaks
      const text = segments.join('\n');
      const paragraphStart = paragraphStarts.has(`${chapterNumber}:${verseNumber}`);

      verses.push({
        chapterNumber,
        verseNumber,
        text,
        paragraphStart,
      });
    }

    chapters.push({
      chapterNumber,
      verses,
    });
  }

  return { chapters };
}

/**
 * Detect and validate WEB JSON structure
 *
 * Ensures the data matches expected format and returns
 * basic statistics for validation.
 */
export interface StructureInfo {
  valid: boolean;
  chapterCount: number;
  verseCount: number;
  usesLineText: boolean;
  usesParagraphText: boolean;
  errors: string[];
}

export function analyzeWebStructure(entries: WebJsonEntry[]): StructureInfo {
  const errors: string[] = [];
  let chapterCount = 0;
  let verseCount = 0;
  let usesLineText = false;
  let usesParagraphText = false;

  const seenChapters = new Set<number>();
  const verseKeys = new Set<string>();

  for (const entry of entries) {
    // Check for expected text types
    if (entry.type === 'line text') {
      usesLineText = true;
    } else if (entry.type === 'paragraph text') {
      usesParagraphText = true;
    }

    // Only validate verse text entries (skip headers, metadata, etc.)
    // Verse text entries have both value AND chapter/verse numbers
    if (entry.value !== undefined &&
        entry.chapterNumber !== undefined &&
        entry.verseNumber !== undefined) {
      seenChapters.add(entry.chapterNumber);
      verseKeys.add(`${entry.chapterNumber}:${entry.verseNumber}`);
    }
  }

  chapterCount = seenChapters.size;
  verseCount = verseKeys.size;

  const valid = verseCount > 0;

  return {
    valid,
    chapterCount,
    verseCount,
    usesLineText,
    usesParagraphText,
    errors,
  };
}
