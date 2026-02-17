export interface CleanPdfTextOptions {
  indentationThreshold?: number;
  skipPageNumbers?: boolean;
  skipLikelyFootnotes?: boolean;
}

/**
 * Normalize extracted PDF text while preserving line-level intent.
 *
 * Rules:
 * - Keep hard line breaks.
 * - Treat indented lines as paragraph starts by prefixing `¶`.
 * - Preserve blank lines as paragraph separators.
 * - Optionally drop likely page numbers/footnotes.
 */
export function cleanPdfText(text: string, options: CleanPdfTextOptions = {}): string {
  const indentationThreshold = options.indentationThreshold ?? 1;
  const skipPageNumbers = options.skipPageNumbers ?? true;
  const skipLikelyFootnotes = options.skipLikelyFootnotes ?? true;

  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const footnoteNumbers = skipLikelyFootnotes ? detectFootnoteNumbers(lines) : new Set<number>();
  const processedLines: string[] = [];
  const baselineIndent = detectBaselineIndent(lines, skipPageNumbers, skipLikelyFootnotes);
  let inFootnoteBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.replace(/\s+$/g, '');
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      inFootnoteBlock = false;
      processedLines.push('');
      continue;
    }

    if (skipPageNumbers && /^\d{1,3}$/.test(trimmedLine)) {
      // Keep page-number filtering but preserve footnote handling precedence below.
      if (footnoteNumbers.has(parseInt(trimmedLine, 10))) {
        inFootnoteBlock = true;
        continue;
      }
      continue;
    }

    const currentIndent = getLeadingWhitespaceWidth(line);
    if (skipLikelyFootnotes && inFootnoteBlock) {
      if (currentIndent >= 2) {
        continue;
      }
      inFootnoteBlock = false;
    }

    if (skipLikelyFootnotes && isLikelyFootnoteBodyLine(lines, i, footnoteNumbers)) {
      continue;
    }

    let normalizedLine = trimmedLine;
    if (skipLikelyFootnotes && footnoteNumbers.size > 0) {
      normalizedLine = removeInlineFootnoteMarkers(normalizedLine, footnoteNumbers);
      if (!normalizedLine) {
        continue;
      }
    }

    const leadingWhitespaceWidth = currentIndent;
    const isHeading = isLikelyHeadingLine(lines, i, leadingWhitespaceWidth, baselineIndent);

    // For headings, ensure blank line before (for markdown)
    if (isHeading && processedLines.length > 0) {
      const lastLine = processedLines[processedLines.length - 1];
      if (lastLine && lastLine.trim() !== '') {
        processedLines.push('');
      }
    }

    processedLines.push(normalizedLine);
  }

  while (processedLines.length > 0 && processedLines[0].trim() === '') {
    processedLines.shift();
  }
  while (processedLines.length > 0 && processedLines[processedLines.length - 1].trim() === '') {
    processedLines.pop();
  }

  return processedLines.join('\n');
}

function detectFootnoteNumbers(lines: string[]): Set<number> {
  const result = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!/^\d{1,3}$/.test(trimmed)) continue;

    const num = parseInt(trimmed, 10);
    if (isNaN(num)) continue;

    const next = findNextNonEmptyLine(lines, i + 1);
    if (!next) continue;

    const nextIndent = getLeadingWhitespaceWidth(next.raw.replace(/\s+$/g, ''));
    const nextTrimmed = next.raw.trim();

    // Footnote blocks are often: "60" on one line, then an indented explanation line.
    if (nextIndent >= 2 && nextTrimmed.length > 0 && nextTrimmed.length < 180) {
      result.add(num);
    }
  }
  return result;
}

function detectBaselineIndent(
  lines: string[],
  skipPageNumbers: boolean,
  skipLikelyFootnotes: boolean
): number {
  const widths: number[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, '');
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (skipPageNumbers && /^\d{1,3}$/.test(trimmedLine)) {
      continue;
    }
    if (skipLikelyFootnotes && /^\d{1,3}$/.test(trimmedLine)) {
      continue;
    }

    widths.push(getLeadingWhitespaceWidth(line));
  }

  if (widths.length === 0) return 0;
  return Math.min(...widths);
}

function getLeadingWhitespaceWidth(line: string): number {
  let width = 0;
  for (const ch of line) {
    if (ch === ' ') {
      width += 1;
      continue;
    }
    if (ch === '\t') {
      width += 4;
      continue;
    }
    // Some PDFs emit non-breaking spaces for visual indentation.
    if (ch === '\u00a0') {
      width += 1;
      continue;
    }
    break;
  }
  return width;
}

function isLikelyHeadingLine(
  lines: string[],
  index: number,
  currentIndent: number,
  baselineIndent: number
): boolean {
  const current = lines[index]?.replace(/\s+$/g, '') ?? '';
  const trimmed = current.trim();
  if (!trimmed) return false;
  if (trimmed.length > 70) return false;

  const prev = findPrevNonEmptyLine(lines, index - 1);
  const next = findNextNonEmptyLine(lines, index + 1);
  const hasBlankAround =
    (!prev || prev.index < index - 1) && (!next || next.index > index + 1);

  const words = trimmed.split(/\s+/);
  const shortHeadingLike = words.length <= 6;
  const allCapsLike = /^[A-Z0-9'"(),.:;!?-]+(?:\s+[A-Z0-9'"(),.:;!?-]+)*$/.test(trimmed);
  const titleCaseLike = /^[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)*$/.test(trimmed);

  const isDisplayCentered = isLikelyCenteredDisplayLine(lines, index, currentIndent, baselineIndent);

  return (hasBlankAround && shortHeadingLike && (allCapsLike || titleCaseLike)) || isDisplayCentered;
}

function isLikelyCenteredDisplayLine(
  lines: string[],
  index: number,
  currentIndent: number,
  baselineIndent: number
): boolean {
  if (currentIndent < baselineIndent + 1) return false;

  const current = lines[index]?.replace(/\s+$/g, '') ?? '';
  const trimmed = current.trim();
  if (!trimmed || trimmed.length > 60) return false;

  const words = trimmed.split(/\s+/);
  const shortDisplayLine = words.length <= 8;
  const noTerminalPunctuation = !/[.!?:;]$/.test(trimmed);
  const allCapsLike = /^[A-Z0-9'"(),-]+(?:\s+[A-Z0-9'"(),-]+)*$/.test(trimmed);
  const titleCaseLike = /^[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)*$/.test(trimmed);

  const prev = findPrevNonEmptyLine(lines, index - 1);
  const next = findNextNonEmptyLine(lines, index + 1);
  const prevIndent = prev ? getLeadingWhitespaceWidth(prev.raw.replace(/\s+$/g, '')) : -1;
  const nextIndent = next ? getLeadingWhitespaceWidth(next.raw.replace(/\s+$/g, '')) : -1;
  const hasCenteredNeighbor =
    (prev && prevIndent >= baselineIndent + 4) || (next && nextIndent >= baselineIndent + 4);

  return shortDisplayLine && noTerminalPunctuation && hasCenteredNeighbor && (allCapsLike || titleCaseLike);
}

function findPrevNonEmptyLine(lines: string[], start: number): { raw: string; index: number } | null {
  for (let i = start; i >= 0; i--) {
    if (lines[i].trim()) return { raw: lines[i], index: i };
  }
  return null;
}

function findNextNonEmptyLine(lines: string[], start: number): { raw: string; index: number } | null {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim()) return { raw: lines[i], index: i };
  }
  return null;
}

function isLikelyFootnoteBodyLine(lines: string[], index: number, footnoteNumbers: Set<number>): boolean {
  const trimmed = lines[index].trim();
  if (!trimmed) return false;

  if (/^\d{1,3}$/.test(trimmed)) {
    return footnoteNumbers.has(parseInt(trimmed, 10));
  }

  // If the most recent non-empty line above is a known footnote number,
  // and this line is indented, treat it as footnote body.
  const prev = findPrevNonEmptyLine(lines, index - 1);
  if (!prev) return false;
  const prevTrimmed = prev.raw.trim();
  if (!/^\d{1,3}$/.test(prevTrimmed)) return false;

  const num = parseInt(prevTrimmed, 10);
  if (!footnoteNumbers.has(num)) return false;

  const indent = getLeadingWhitespaceWidth(lines[index].replace(/\s+$/g, ''));
  return indent >= 2;
}

function removeInlineFootnoteMarkers(line: string, footnoteNumbers: Set<number>): string {
  let output = line;

  for (const n of footnoteNumbers) {
    const marker = String(n);

    // Remove footnote markers attached to words/punctuation: "hands60", "ill61", "word60,"
    const attachedPattern = new RegExp(`([A-Za-z\\)\\]'"”’\\.,;:!?-])${marker}(?=\\s|$|[\\),\\].;:!?'"”’])`, 'g');
    output = output.replace(attachedPattern, '$1');

    // Remove bracketed superscript-like markers: [60], (60)
    const bracketedPattern = new RegExp(`(?:\\[${marker}\\]|\\(${marker}\\))`, 'g');
    output = output.replace(bracketedPattern, '');
  }

  return output.replace(/\s{2,}/g, ' ').trim();
}

export function renderVisibleWhitespace(input: string): string {
  return input
    .replace(/ /g, '·')
    .replace(/\t/g, '⇥')
    .replace(/\n/g, '⏎\n');
}
