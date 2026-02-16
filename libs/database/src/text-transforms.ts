/**
 * Pure text transformation functions for WorkUnit editing.
 * All functions are deterministic and operate on strings.
 */

export type TransformName =
  | 'promote-heading'
  | 'demote-heading'
  | 'mark-paragraph'
  | 'dehyphenate'
  | 'fix-drop-cap';

/**
 * Promote heading: Add '#' prefix to selected lines
 */
export function promoteHeading(text: string): string {
  const lines = text.split('\n');
  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line; // Keep empty lines as-is
    return '# ' + line;
  }).join('\n');
}

/**
 * Demote heading: Remove leading '#' from lines
 */
export function demoteHeading(text: string): string {
  const lines = text.split('\n');
  return lines.map(line => {
    // Remove one or more leading '#' followed by optional space
    return line.replace(/^#+\s?/, '');
  }).join('\n');
}

/**
 * Mark paragraph start: Add '¶' prefix to selected line(s)
 */
export function markParagraph(text: string): string {
  const lines = text.split('\n');
  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line; // Keep empty lines as-is
    if (trimmed.startsWith('¶')) return line; // Already marked
    return '¶ ' + line;
  }).join('\n');
}

/**
 * Dehyphenate: Join lines where previous ends with '-' and next starts with lowercase
 * This fixes OCR artifacts where words are split across lines with hyphens
 */
export function dehyphenate(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  let i = 0;
  while (i < lines.length) {
    let currentLine = lines[i];

    // Keep merging while current line ends with hyphen and next starts with lowercase
    while (
      i + 1 < lines.length &&
      currentLine.trimEnd().endsWith('-') &&
      /^[a-z]/.test(lines[i + 1].trim())
    ) {
      // Remove hyphen from current line and join with next
      currentLine = currentLine.trimEnd().slice(0, -1) + lines[i + 1].trimStart();
      i++; // Move to the line we just merged
    }

    result.push(currentLine);
    i++;
  }

  return result.join('\n');
}

/**
 * Fix drop-cap spacing: Remove excessive spacing after initial capital letter
 * Matches: "T  he" -> "The", "I   n" -> "In"
 * Pattern: /^([A-Z])\s{2,}([a-z])/
 */
export function fixDropCap(text: string): string {
  const lines = text.split('\n');
  return lines.map(line => {
    // Match capital letter followed by 2+ spaces and lowercase letter at start of line
    return line.replace(/^([A-Z])\s{2,}([a-z])/, '$1$2');
  }).join('\n');
}

/**
 * Apply a transform by name
 */
export function applyTransform(transformName: TransformName, text: string): string {
  switch (transformName) {
    case 'promote-heading':
      return promoteHeading(text);
    case 'demote-heading':
      return demoteHeading(text);
    case 'mark-paragraph':
      return markParagraph(text);
    case 'dehyphenate':
      return dehyphenate(text);
    case 'fix-drop-cap':
      return fixDropCap(text);
    default:
      throw new Error(`Unknown transform: ${transformName}`);
  }
}

/**
 * Get human-readable label for a transform
 */
export function getTransformLabel(transformName: TransformName): string {
  switch (transformName) {
    case 'promote-heading':
      return 'Promote Heading (add #)';
    case 'demote-heading':
      return 'Demote Heading (remove #)';
    case 'mark-paragraph':
      return 'Mark Paragraph (add ¶)';
    case 'dehyphenate':
      return 'Dehyphenate Line Breaks';
    case 'fix-drop-cap':
      return 'Fix Drop-Cap Spacing';
    default:
      return transformName;
  }
}
