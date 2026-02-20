/**
 * OSIS Reference Parser
 *
 * Converts OSIS-format references (used by the Creeds.json dataset) into
 * traditional "Book Chapter:Verse" strings compatible with parseReferences().
 *
 * OSIS format examples:
 *   "Isa.44.6"                  → "Isa 44:6"
 *   "Ps.73.25-Ps.73.26"         → "Ps 73:25-26"
 *   "2Tim.3.15-2Tim.3.16"       → "2Tim 3:15-16"
 *   "Acts.2.24-Acts.2.27"       → "Acts 2:24-27"
 *   "Eph.1.4,Eph.1.11"          → two refs: "Eph 1:4", "Eph 1:11"
 *   "Gen.3.6-Gen.3.8,Gen.3.13"  → three refs
 *   "Ps.83"                     → skipped (chapter-only, no verse)
 */

import { parseReferences, type ParsedReference } from './reference-parser';

interface CreedProof {
  Id: number;
  References: string[];
}

/**
 * Parse a single OSIS token: "BookAbbrev.Chapter.Verse" e.g. "1Cor.10.31"
 * Returns null for chapter-only refs like "Gen.1" (no verse = skip).
 */
function parseSingleOsis(osis: string): { book: string; chapter: number; verse: number } | null {
  const parts = osis.split('.');
  if (parts.length !== 3) return null;

  const [book, chapterStr, verseStr] = parts;
  const chapter = parseInt(chapterStr, 10);
  const verse = parseInt(verseStr, 10);

  if (isNaN(chapter) || isNaN(verse)) return null;

  return { book, chapter, verse };
}

/**
 * Convert a single OSIS token or cross-ref range to one or more
 * "Book chapter:verse[-verse]" strings that parseReferences() understands.
 */
function osisSingleToTraditionals(osis: string): string[] {
  osis = osis.trim();

  // Cross-ref range: two full OSIS refs joined by "-"
  // Pattern: anything.digits.digits - anything.digits.digits
  const rangeMatch = osis.match(/^(.+\.\d+\.\d+)-(.+\.\d+\.\d+)$/);
  if (rangeMatch) {
    const start = parseSingleOsis(rangeMatch[1]);
    const end = parseSingleOsis(rangeMatch[2]);
    if (!start || !end) return [];

    if (start.book === end.book && start.chapter === end.chapter) {
      return [`${start.book} ${start.chapter}:${start.verse}-${end.verse}`];
    }
    // Different chapters — emit two separate refs
    return [
      `${start.book} ${start.chapter}:${start.verse}`,
      `${end.book} ${end.chapter}:${end.verse}`,
    ];
  }

  // Single ref
  const single = parseSingleOsis(osis);
  if (!single) return []; // chapter-only or unrecognized — skip
  return [`${single.book} ${single.chapter}:${single.verse}`];
}

/**
 * Convert a Creeds.json Proofs array into ParsedReference objects.
 *
 * Each OSIS entry in References may be:
 *   - A single ref:           "Isa.44.6"
 *   - A cross-verse range:    "2Tim.3.15-2Tim.3.16"
 *   - Comma-separated refs:   "Eph.1.4,Eph.1.11"
 *   - Mixed:                  "Gen.3.6-Gen.3.8,Gen.3.13"
 */
export function proofsToReferences(proofs: CreedProof[]): ParsedReference[] {
  const traditionals: string[] = [];

  for (const proof of proofs) {
    for (const rawOsis of proof.References) {
      const tokens = rawOsis.split(',').map(s => s.trim());
      for (const token of tokens) {
        const converted = osisSingleToTraditionals(token);
        traditionals.push(...converted);
      }
    }
  }

  const result: ParsedReference[] = [];
  for (const t of traditionals) {
    const parsed = parseReferences(t);
    result.push(...parsed);
  }
  return result;
}
