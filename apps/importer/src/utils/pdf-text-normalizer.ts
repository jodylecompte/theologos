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
  const processedLines: string[] = [];
  const baselineIndent = detectBaselineIndent(lines, skipPageNumbers, skipLikelyFootnotes);

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, '');
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      processedLines.push('');
      continue;
    }

    if (skipPageNumbers && /^\d{1,3}$/.test(trimmedLine)) {
      continue;
    }

    if (skipLikelyFootnotes && /^\d{1,2}\s+\S/.test(trimmedLine) && trimmedLine.length < 100) {
      continue;
    }

    const leadingWhitespaceWidth = getLeadingWhitespaceWidth(line);
    const isIndented = leadingWhitespaceWidth >= baselineIndent + indentationThreshold;

    if (isIndented && processedLines.length > 0) {
      const lastLine = processedLines[processedLines.length - 1];
      if (lastLine && lastLine.trim() !== '') {
        processedLines.push('');
      }
      processedLines.push(`¶${trimmedLine}`);
      continue;
    }

    processedLines.push(trimmedLine);
  }

  while (processedLines.length > 0 && processedLines[0].trim() === '') {
    processedLines.shift();
  }
  while (processedLines.length > 0 && processedLines[processedLines.length - 1].trim() === '') {
    processedLines.pop();
  }

  return processedLines.join('\n');
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
    if (skipLikelyFootnotes && /^\d{1,2}\s+\S/.test(trimmedLine) && trimmedLine.length < 100) {
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

export function renderVisibleWhitespace(input: string): string {
  return input
    .replace(/ /g, '·')
    .replace(/\t/g, '⇥')
    .replace(/\n/g, '⏎\n');
}
