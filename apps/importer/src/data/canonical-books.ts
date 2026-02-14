/**
 * Canonical Protestant 66-book Bible structure
 *
 * This defines the authoritative book list, ordering, and metadata
 * that forms the canonical grid for all Bible data.
 */

export interface CanonicalBook {
  canonicalName: string;
  abbreviation: string;
  testament: 'OT' | 'NT';
  canonicalOrder: number;
}

/**
 * Protestant 66-book canon in canonical order
 */
export const CANONICAL_BOOKS: CanonicalBook[] = [
  // Old Testament - 39 books
  { canonicalName: 'Genesis', abbreviation: 'Gen', testament: 'OT', canonicalOrder: 1 },
  { canonicalName: 'Exodus', abbreviation: 'Exod', testament: 'OT', canonicalOrder: 2 },
  { canonicalName: 'Leviticus', abbreviation: 'Lev', testament: 'OT', canonicalOrder: 3 },
  { canonicalName: 'Numbers', abbreviation: 'Num', testament: 'OT', canonicalOrder: 4 },
  { canonicalName: 'Deuteronomy', abbreviation: 'Deut', testament: 'OT', canonicalOrder: 5 },
  { canonicalName: 'Joshua', abbreviation: 'Josh', testament: 'OT', canonicalOrder: 6 },
  { canonicalName: 'Judges', abbreviation: 'Judg', testament: 'OT', canonicalOrder: 7 },
  { canonicalName: 'Ruth', abbreviation: 'Ruth', testament: 'OT', canonicalOrder: 8 },
  { canonicalName: '1 Samuel', abbreviation: '1Sam', testament: 'OT', canonicalOrder: 9 },
  { canonicalName: '2 Samuel', abbreviation: '2Sam', testament: 'OT', canonicalOrder: 10 },
  { canonicalName: '1 Kings', abbreviation: '1Kgs', testament: 'OT', canonicalOrder: 11 },
  { canonicalName: '2 Kings', abbreviation: '2Kgs', testament: 'OT', canonicalOrder: 12 },
  { canonicalName: '1 Chronicles', abbreviation: '1Chr', testament: 'OT', canonicalOrder: 13 },
  { canonicalName: '2 Chronicles', abbreviation: '2Chr', testament: 'OT', canonicalOrder: 14 },
  { canonicalName: 'Ezra', abbreviation: 'Ezra', testament: 'OT', canonicalOrder: 15 },
  { canonicalName: 'Nehemiah', abbreviation: 'Neh', testament: 'OT', canonicalOrder: 16 },
  { canonicalName: 'Esther', abbreviation: 'Esth', testament: 'OT', canonicalOrder: 17 },
  { canonicalName: 'Job', abbreviation: 'Job', testament: 'OT', canonicalOrder: 18 },
  { canonicalName: 'Psalms', abbreviation: 'Ps', testament: 'OT', canonicalOrder: 19 },
  { canonicalName: 'Proverbs', abbreviation: 'Prov', testament: 'OT', canonicalOrder: 20 },
  { canonicalName: 'Ecclesiastes', abbreviation: 'Eccl', testament: 'OT', canonicalOrder: 21 },
  { canonicalName: 'Song of Solomon', abbreviation: 'Song', testament: 'OT', canonicalOrder: 22 },
  { canonicalName: 'Isaiah', abbreviation: 'Isa', testament: 'OT', canonicalOrder: 23 },
  { canonicalName: 'Jeremiah', abbreviation: 'Jer', testament: 'OT', canonicalOrder: 24 },
  { canonicalName: 'Lamentations', abbreviation: 'Lam', testament: 'OT', canonicalOrder: 25 },
  { canonicalName: 'Ezekiel', abbreviation: 'Ezek', testament: 'OT', canonicalOrder: 26 },
  { canonicalName: 'Daniel', abbreviation: 'Dan', testament: 'OT', canonicalOrder: 27 },
  { canonicalName: 'Hosea', abbreviation: 'Hos', testament: 'OT', canonicalOrder: 28 },
  { canonicalName: 'Joel', abbreviation: 'Joel', testament: 'OT', canonicalOrder: 29 },
  { canonicalName: 'Amos', abbreviation: 'Amos', testament: 'OT', canonicalOrder: 30 },
  { canonicalName: 'Obadiah', abbreviation: 'Obad', testament: 'OT', canonicalOrder: 31 },
  { canonicalName: 'Jonah', abbreviation: 'Jonah', testament: 'OT', canonicalOrder: 32 },
  { canonicalName: 'Micah', abbreviation: 'Mic', testament: 'OT', canonicalOrder: 33 },
  { canonicalName: 'Nahum', abbreviation: 'Nah', testament: 'OT', canonicalOrder: 34 },
  { canonicalName: 'Habakkuk', abbreviation: 'Hab', testament: 'OT', canonicalOrder: 35 },
  { canonicalName: 'Zephaniah', abbreviation: 'Zeph', testament: 'OT', canonicalOrder: 36 },
  { canonicalName: 'Haggai', abbreviation: 'Hag', testament: 'OT', canonicalOrder: 37 },
  { canonicalName: 'Zechariah', abbreviation: 'Zech', testament: 'OT', canonicalOrder: 38 },
  { canonicalName: 'Malachi', abbreviation: 'Mal', testament: 'OT', canonicalOrder: 39 },

  // New Testament - 27 books
  { canonicalName: 'Matthew', abbreviation: 'Matt', testament: 'NT', canonicalOrder: 40 },
  { canonicalName: 'Mark', abbreviation: 'Mark', testament: 'NT', canonicalOrder: 41 },
  { canonicalName: 'Luke', abbreviation: 'Luke', testament: 'NT', canonicalOrder: 42 },
  { canonicalName: 'John', abbreviation: 'John', testament: 'NT', canonicalOrder: 43 },
  { canonicalName: 'Acts', abbreviation: 'Acts', testament: 'NT', canonicalOrder: 44 },
  { canonicalName: 'Romans', abbreviation: 'Rom', testament: 'NT', canonicalOrder: 45 },
  { canonicalName: '1 Corinthians', abbreviation: '1Cor', testament: 'NT', canonicalOrder: 46 },
  { canonicalName: '2 Corinthians', abbreviation: '2Cor', testament: 'NT', canonicalOrder: 47 },
  { canonicalName: 'Galatians', abbreviation: 'Gal', testament: 'NT', canonicalOrder: 48 },
  { canonicalName: 'Ephesians', abbreviation: 'Eph', testament: 'NT', canonicalOrder: 49 },
  { canonicalName: 'Philippians', abbreviation: 'Phil', testament: 'NT', canonicalOrder: 50 },
  { canonicalName: 'Colossians', abbreviation: 'Col', testament: 'NT', canonicalOrder: 51 },
  { canonicalName: '1 Thessalonians', abbreviation: '1Thess', testament: 'NT', canonicalOrder: 52 },
  { canonicalName: '2 Thessalonians', abbreviation: '2Thess', testament: 'NT', canonicalOrder: 53 },
  { canonicalName: '1 Timothy', abbreviation: '1Tim', testament: 'NT', canonicalOrder: 54 },
  { canonicalName: '2 Timothy', abbreviation: '2Tim', testament: 'NT', canonicalOrder: 55 },
  { canonicalName: 'Titus', abbreviation: 'Titus', testament: 'NT', canonicalOrder: 56 },
  { canonicalName: 'Philemon', abbreviation: 'Phlm', testament: 'NT', canonicalOrder: 57 },
  { canonicalName: 'Hebrews', abbreviation: 'Heb', testament: 'NT', canonicalOrder: 58 },
  { canonicalName: 'James', abbreviation: 'Jas', testament: 'NT', canonicalOrder: 59 },
  { canonicalName: '1 Peter', abbreviation: '1Pet', testament: 'NT', canonicalOrder: 60 },
  { canonicalName: '2 Peter', abbreviation: '2Pet', testament: 'NT', canonicalOrder: 61 },
  { canonicalName: '1 John', abbreviation: '1John', testament: 'NT', canonicalOrder: 62 },
  { canonicalName: '2 John', abbreviation: '2John', testament: 'NT', canonicalOrder: 63 },
  { canonicalName: '3 John', abbreviation: '3John', testament: 'NT', canonicalOrder: 64 },
  { canonicalName: 'Jude', abbreviation: 'Jude', testament: 'NT', canonicalOrder: 65 },
  { canonicalName: 'Revelation', abbreviation: 'Rev', testament: 'NT', canonicalOrder: 66 },
];

/**
 * Map from canonical name (lowercase) to book metadata
 */
export const BOOK_BY_NAME = new Map(
  CANONICAL_BOOKS.map(book => [book.canonicalName.toLowerCase(), book])
);

/**
 * Find canonical book by name (case-insensitive)
 */
export function findBookByName(name: string): CanonicalBook | undefined {
  return BOOK_BY_NAME.get(name.toLowerCase());
}
