/**
 * Flag detection logic for WorkUnit review workflow.
 * Detects suspicious content that may need manual review.
 */

export type FlagType = 'HEADING_SUSPECT' | 'FOOTNOTE_SUSPECT' | 'METADATA_SUSPECT';

export interface FlagDetectionResult {
  flags: FlagType[];
  details: {
    headingLikeLines?: number;
    footnoteIndicators?: number;
    metadataPatterns?: number;
  };
}

/**
 * Detect if a WorkUnit has heading-like lines that aren't marked with #
 *
 * Criteria:
 * - 2+ lines that are short (< 50 chars)
 * - Lines are title case or all caps
 * - Lines don't start with # (already marked)
 * - Lines are not obviously body text (no lowercase sentence starters)
 */
function detectHeadingSuspect(text: string): boolean {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let suspiciousLineCount = 0;

  for (const line of lines) {
    // Skip if already marked as heading
    if (line.startsWith('#')) continue;

    // Skip if already marked as paragraph
    if (line.startsWith('¶')) continue;

    // Check if line is short
    if (line.length > 50) continue;

    // Check if line looks like a heading:
    // - Starts with capital letter
    // - Either all caps OR title case (multiple capital letters)
    const startsWithCap = /^[A-Z]/.test(line);
    const isAllCaps = line === line.toUpperCase() && /[A-Z]/.test(line);
    const hasTitleCase = (line.match(/[A-Z]/g) || []).length >= 2;

    // Exclude obvious sentence fragments (ends with comma, semicolon, or lowercase)
    const looksLikeSentence = /[,;]$/.test(line) || /[a-z]$/.test(line);

    if (startsWithCap && (isAllCaps || hasTitleCase) && !looksLikeSentence) {
      suspiciousLineCount++;
    }
  }

  return suspiciousLineCount >= 2;
}

/**
 * Detect if a WorkUnit has footnote-like patterns
 *
 * Criteria:
 * - Many small numbers (1, 2, 3) appearing at start or end of lines
 * - Lines with superscript-like patterns
 * - Short lines at the bottom that look like footnotes
 */
function detectFootnoteSuspect(text: string): boolean {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let footnoteIndicators = 0;

  for (const line of lines) {
    // Check for small numbers at start: "1. Text" or "1 Text"
    if (/^[0-9]{1,2}[.\s]/.test(line)) {
      footnoteIndicators++;
    }

    // Check for superscript-like patterns: "text1" or "text²"
    if (/[a-z][0-9]/.test(line) || /[²³⁴⁵⁶⁷⁸⁹]/.test(line)) {
      footnoteIndicators++;
    }

    // Check for lines that are very short and at bottom (likely footnotes)
    // We can't easily detect "bottom" in isolation, but very short lines with numbers are suspect
    if (line.length < 30 && /[0-9]/.test(line)) {
      footnoteIndicators++;
    }
  }

  // Flag if we found 3+ footnote indicators
  return footnoteIndicators >= 3;
}

/**
 * Detect if a WorkUnit has repeated publisher/footer metadata patterns
 *
 * Criteria:
 * - Common publisher phrases (Copyright, All rights reserved, Published by)
 * - Page numbers in footer format
 * - ISBN patterns
 * - Repeated identical lines (headers/footers)
 */
function detectMetadataSuspect(text: string): boolean {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const metadataPatterns = [
    /copyright/i,
    /all rights reserved/i,
    /published by/i,
    /publishing/i,
    /isbn/i,
    /edition/i,
    /printed in/i,
    /\bpage\s+[0-9]+/i,
    /^[0-9]+$/, // Just a number (page number)
    /^\[[0-9]+\]$/, // [123] (bracketed page number)
  ];

  let patternMatches = 0;

  for (const line of lines) {
    for (const pattern of metadataPatterns) {
      if (pattern.test(line)) {
        patternMatches++;
        break; // Count each line only once
      }
    }
  }

  // Also check for repeated identical lines (common in headers/footers)
  const lineFrequency = new Map<string, number>();
  for (const line of lines) {
    if (line.length > 5) { // Ignore very short lines
      lineFrequency.set(line, (lineFrequency.get(line) || 0) + 1);
    }
  }

  const hasRepeatedLines = Array.from(lineFrequency.values()).some(count => count >= 2);

  // Flag if we found 2+ metadata patterns or repeated lines
  return patternMatches >= 2 || hasRepeatedLines;
}

/**
 * Compute all flags for a given WorkUnit text
 */
export function computeFlags(text: string): FlagDetectionResult {
  const flags: FlagType[] = [];
  const details: FlagDetectionResult['details'] = {};

  // Detect heading suspects
  if (detectHeadingSuspect(text)) {
    flags.push('HEADING_SUSPECT');
    const lines = text.split('\n').filter(l => l.trim().length > 0 && l.trim().length < 50);
    details.headingLikeLines = lines.length;
  }

  // Detect footnote suspects
  if (detectFootnoteSuspect(text)) {
    flags.push('FOOTNOTE_SUSPECT');
    const footnoteCount = (text.match(/[0-9]{1,2}[.\s]/g) || []).length;
    details.footnoteIndicators = footnoteCount;
  }

  // Detect metadata suspects
  if (detectMetadataSuspect(text)) {
    flags.push('METADATA_SUSPECT');
    const metadataCount = (text.match(/copyright|isbn|published/gi) || []).length;
    details.metadataPatterns = metadataCount;
  }

  return { flags, details };
}

/**
 * Get human-readable label for a flag
 */
export function getFlagLabel(flag: FlagType): string {
  switch (flag) {
    case 'HEADING_SUSPECT':
      return 'Possible Unmarked Headings';
    case 'FOOTNOTE_SUSPECT':
      return 'Possible Footnotes';
    case 'METADATA_SUSPECT':
      return 'Possible Metadata/Headers';
    default:
      return flag;
  }
}

/**
 * Get description for a flag
 */
export function getFlagDescription(flag: FlagType): string {
  switch (flag) {
    case 'HEADING_SUSPECT':
      return 'This page has multiple short lines that look like headings but are not marked with #';
    case 'FOOTNOTE_SUSPECT':
      return 'This page has patterns that suggest footnotes or superscript references';
    case 'METADATA_SUSPECT':
      return 'This page contains publisher metadata, headers, footers, or copyright information';
    default:
      return '';
  }
}
