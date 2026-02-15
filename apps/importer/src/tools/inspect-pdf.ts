/**
 * PDF Inspection Tool
 *
 * Shows raw/layout extraction and normalized output for a single page so
 * line-break and indentation behavior can be diagnosed deterministically.
 *
 * Usage:
 *   nx run importer:inspect-pdf -- --file data/book.pdf --page 42
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { cleanPdfText, renderVisibleWhitespace } from '../utils/pdf-text-normalizer';

const logger = createLogger('inspect-pdf');

interface WordBox {
  text: string;
  bbox: string;
}

interface LineBox {
  bbox: string;
  words: WordBox[];
}

function parseArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function extractWithPdftotext(pdfPath: string, page: number, mode: 'raw' | 'layout' | 'bbox'): string {
  const layoutFlag = mode === 'layout' || mode === 'bbox' ? '-layout ' : '';
  const bboxFlag = mode === 'bbox' ? '-bbox-layout ' : '';

  return execSync(
    `pdftotext ${bboxFlag}${layoutFlag}-enc UTF-8 -f ${page} -l ${page} "${pdfPath}" -`,
    { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 }
  );
}

function parseBBoxLines(xhtml: string): LineBox[] {
  const lines: LineBox[] = [];
  const lineRegex = /<line[^>]*bbox="([^"]+)"[^>]*>([\s\S]*?)<\/line>/g;

  let lineMatch: RegExpExecArray | null;
  while ((lineMatch = lineRegex.exec(xhtml)) !== null) {
    const lineContent = lineMatch[2];
    const words: WordBox[] = [];

    const wordRegex = /<word[^>]*bbox="([^"]+)"[^>]*>([\s\S]*?)<\/word>/g;
    let wordMatch: RegExpExecArray | null;
    while ((wordMatch = wordRegex.exec(lineContent)) !== null) {
      words.push({
        bbox: wordMatch[1],
        text: decodeHtmlEntities(wordMatch[2]).trim(),
      });
    }

    lines.push({
      bbox: lineMatch[1],
      words,
    });
  }

  return lines;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function printBlock(title: string, content: string): void {
  console.log('\n' + '='.repeat(90));
  console.log(title);
  console.log('='.repeat(90));
  console.log(content || '(empty)');
}

function printNormalizedDiagnostics(normalized: string): void {
  const lines = normalized.split('\n');

  console.log('\n' + '='.repeat(90));
  console.log('NORMALIZED LINE DIAGNOSTICS');
  console.log('='.repeat(90));
  console.log('Legend: ¶ = indented paragraph start marker');
  console.log('');

  lines.forEach((line, i) => {
    const lineNumber = String(i + 1).padStart(3, ' ');
    const isIndentedParagraph = line.startsWith('¶');
    const label = isIndentedParagraph ? 'INDENT' : line.trim() ? 'TEXT  ' : 'BLANK ';
    console.log(`${lineNumber} [${label}] ${renderVisibleWhitespace(line)}`);
  });
}

async function main(): Promise<void> {
  const file = parseArg('--file');
  const pageStr = parseArg('--page');

  if (!file || !pageStr) {
    console.error('Usage: nx run importer:inspect-pdf -- --file <pdf-path> --page <n>');
    process.exit(1);
  }

  const page = parseInt(pageStr, 10);
  if (isNaN(page) || page < 1) {
    throw new Error(`Invalid --page value "${pageStr}". Must be >= 1.`);
  }

  const absolutePdfPath = path.resolve(file);
  if (!fs.existsSync(absolutePdfPath)) {
    throw new Error(`PDF file not found: ${absolutePdfPath}`);
  }

  logger.info(`Inspecting ${absolutePdfPath} page ${page}`);

  const raw = extractWithPdftotext(absolutePdfPath, page, 'raw');
  const layout = extractWithPdftotext(absolutePdfPath, page, 'layout');
  const bboxXhtml = extractWithPdftotext(absolutePdfPath, page, 'bbox');
  const normalizedFromLayout = cleanPdfText(layout);

  printBlock('RAW PDFTOTEXT (visible whitespace)', renderVisibleWhitespace(raw));
  printBlock('LAYOUT PDFTOTEXT (visible whitespace)', renderVisibleWhitespace(layout));
  printBlock('NORMALIZED OUTPUT FROM LAYOUT (visible whitespace)', renderVisibleWhitespace(normalizedFromLayout));
  printNormalizedDiagnostics(normalizedFromLayout);

  const lineBoxes = parseBBoxLines(bboxXhtml);
  const bboxPreview = lineBoxes
    .slice(0, 80)
    .map((line, idx) => {
      const words = line.words.map(w => `${w.text}{${w.bbox}}`).join(' | ');
      return `${String(idx + 1).padStart(3, ' ')} line bbox=${line.bbox} :: ${words}`;
    })
    .join('\n');

  printBlock(
    `BBOX PREVIEW (first ${Math.min(80, lineBoxes.length)} lines)`,
    bboxPreview || '(no line boxes found)'
  );

  console.log('\n' + '='.repeat(90));
  console.log('HOW TO USE THIS');
  console.log('='.repeat(90));
  console.log('1. Compare RAW vs LAYOUT to see extraction differences.');
  console.log('2. Check NORMALIZED output to verify paragraph markers and blank-line handling.');
  console.log('3. Use BBOX line/word coordinates to determine whether breaks are visual layout or real line intent.');
  console.log('');
}

main().catch((error) => {
  logger.error('Inspection failed:', error);
  process.exit(1);
});
