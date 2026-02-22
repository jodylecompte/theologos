/**
 * Book PDF Extractor
 *
 * Extracts per-page text from a PDF using pdftotext.
 * Outputs a raw pages JSON file for inspection and use by normalize-book.
 *
 * Usage:
 *   nx run importer:book:extract -- --pdf data/loveliness_2012.pdf --out extracted/loveliness.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ExtractedPage {
  page: number;
  text: string;
}

interface ExtractedBook {
  sourceFile: string;
  extractedAt: string;
  totalPages: number;
  detectedHeader: string | null;
  pages: ExtractedPage[];
}

/**
 * Detect the running page header — the line that appears at the top of
 * most pages (e.g. "THE LOVELINESS OF CHRIST"). We strip it so the LLM
 * normalizer doesn't have to deal with it.
 */
function detectRunningHeader(pages: ExtractedPage[]): string | null {
  const firstLineCount: Record<string, number> = {};

  for (const p of pages) {
    const firstLine = p.text.split('\n')[0]?.trim();
    if (firstLine && firstLine.length > 3) {
      firstLineCount[firstLine] = (firstLineCount[firstLine] ?? 0) + 1;
    }
  }

  // If a line appears on more than half the pages, it's a running header
  const threshold = pages.length * 0.5;
  for (const [line, count] of Object.entries(firstLineCount)) {
    if (count >= threshold) return line;
  }

  return null;
}

function extractPages(pdfPath: string): ExtractedBook {
  const absolutePath = path.resolve(pdfPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`PDF not found: ${absolutePath}`);
  }

  // pdftotext separates pages with form feed (\f)
  const rawText = execSync(`pdftotext -layout "${absolutePath}" -`, {
    maxBuffer: 50 * 1024 * 1024,
  }).toString('utf-8');

  const rawPages = rawText.split('\f');
  const pages: ExtractedPage[] = rawPages
    .map((text, i) => ({ page: i + 1, text: text.trim() }))
    .filter(p => p.text.length > 0);

  const detectedHeader = detectRunningHeader(pages);

  // Strip the running header from each page
  if (detectedHeader) {
    for (const p of pages) {
      const lines = p.text.split('\n');
      if (lines[0]?.trim() === detectedHeader) {
        p.text = lines.slice(1).join('\n').trim();
      }
    }
  }

  return {
    sourceFile: pdfPath,
    extractedAt: new Date().toISOString(),
    totalPages: pages.length,
    detectedHeader,
    pages,
  };
}

// CLI
const args = process.argv.slice(2);
const pdfIdx = args.indexOf('--pdf');
const outIdx = args.indexOf('--out');

if (pdfIdx === -1) {
  console.error('Usage: nx run importer:book:extract -- --pdf <path> [--out <path>]');
  process.exit(1);
}

const pdfArg = args[pdfIdx + 1];
const outArg = outIdx !== -1 ? args[outIdx + 1] : pdfArg.replace('.pdf', '-extracted.json');

console.log(`Extracting: ${pdfArg}`);
const result = extractPages(pdfArg);

fs.mkdirSync(path.dirname(path.resolve(outArg)), { recursive: true });
fs.writeFileSync(path.resolve(outArg), JSON.stringify(result, null, 2), 'utf-8');

console.log(`✓ Detected running header: ${result.detectedHeader ?? '(none)'}`);
console.log(`✓ Extracted ${result.totalPages} pages → ${outArg}`);
