/**
 * Simple Chapter Detection
 *
 * Extracts text from PDF and attempts to detect chapter headings.
 * Outputs suggested metadata for review/adjustment.
 *
 * Usage: nx run importer:detect-chapters -- --file data/book.pdf
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createLogger } from '../utils/logger';

const logger = createLogger('detect-chapters');

interface ChapterCandidate {
  number?: number;
  title: string;
  confidence: 'high' | 'medium' | 'low';
  textContext: string;
}

/**
 * Extract text using pdftotext (if available) or fallback method
 */
function extractText(pdfPath: string): string {
  try {
    // Try using pdftotext command-line tool (fast and reliable)
    const text = execSync(`pdftotext "${pdfPath}" -`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    return text;
  } catch (error) {
    logger.warn('pdftotext not available, install with: sudo apt-get install poppler-utils');
    throw new Error('Cannot extract PDF text. Install poppler-utils: sudo apt-get install poppler-utils');
  }
}

/**
 * Detect chapter headings from text using pattern matching
 */
function detectChapters(text: string): ChapterCandidate[] {
  const candidates: ChapterCandidate[] = [];
  const lines = text.split('\n');

  // Patterns to match chapter headings
  const patterns = [
    // "Chapter 1", "Chapter One", "CHAPTER 1"
    { regex: /^(Chapter|CHAPTER|Chap\.?)\s+(\d+|[IVX]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)[\s:.\-]*(.*)$/i, confidence: 'high' as const },
    // "1. Title" or "I. Title" (at start of line, followed by capitalized text)
    { regex: /^([IVX]+|\d+)\.\s+([A-Z][A-Za-z\s]{3,50})$/, confidence: 'medium' as const },
    // "Part 1", "Section 1"
    { regex: /^(Part|PART|Section|SECTION)\s+(\d+|[IVX]+|One|Two|Three)[\s:.\-]*(.*)$/i, confidence: 'medium' as const },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length < 3 || line.length > 100) continue;

    for (const { regex, confidence } of patterns) {
      const match = line.match(regex);
      if (match) {
        let number: number | undefined;
        let title = '';

        // Parse based on pattern
        if (match[1]?.toLowerCase().includes('chapter')) {
          number = parseNumber(match[2]);
          title = match[3]?.trim() || `Chapter ${match[2]}`;
        } else if (match[1]?.toLowerCase().includes('part') || match[1]?.toLowerCase().includes('section')) {
          number = parseNumber(match[2]);
          title = match[3]?.trim() || `${match[1]} ${match[2]}`;
        } else {
          number = parseNumber(match[1]);
          title = match[2]?.trim() || '';
        }

        // Get context (next few lines)
        const context = lines.slice(i, Math.min(i + 3, lines.length))
          .map(l => l.trim())
          .filter(Boolean)
          .join(' ')
          .substring(0, 150);

        candidates.push({
          number,
          title,
          confidence,
          textContext: context,
        });

        break;
      }
    }
  }

  return candidates;
}

/**
 * Parse chapter number from various formats
 */
function parseNumber(str: string): number | undefined {
  const num = parseInt(str, 10);
  if (!isNaN(num)) return num;

  const romanMap: Record<string, number> = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
    'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
    'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15,
  };
  if (romanMap[str.toUpperCase()]) return romanMap[str.toUpperCase()];

  const wordMap: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  };
  if (wordMap[str.toLowerCase()]) return wordMap[str.toLowerCase()];

  return undefined;
}

/**
 * Extract potential title/author from first page
 */
function extractMetadata(text: string): { title?: string; author?: string } {
  const lines = text.split('\n').slice(0, 50).map(l => l.trim()).filter(Boolean);

  let title: string | undefined;
  let author: string | undefined;

  for (const line of lines) {
    if (!title && line.length > 10 && line.length < 100) {
      if (line === line.toUpperCase() || /^[A-Z][A-Za-z\s:]+$/.test(line)) {
        title = line;
      }
    }

    if (!author && /^by\s+(.+)$/i.test(line)) {
      author = line.replace(/^by\s+/i, '').trim();
    }
  }

  return { title, author };
}

/**
 * Generate metadata JSON with detected chapters
 */
function generateMetadata(pdfPath: string, title: string, author: string | undefined, chapters: ChapterCandidate[]): any {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return {
    title,
    author: author || null, // Always include field - fill in if null
    slug,
    type: 'book',
    tradition: null, // Fill in: "reformed", "puritan", "catholic", etc.
    pdfFile: pdfPath,
    detectedChapters: chapters, // Auto-detected chapters (review these)
    chapters: chapters.length > 0
      ? chapters
          .filter(ch => ch.number !== undefined)
          .map((ch) => ({
            number: ch.number!,
            title: ch.title,
            startPage: 1, // TODO: Fill in by looking at PDF
            endPage: 1,   // TODO: Fill in by looking at PDF
          }))
      : [
          // Template: Fill in your chapters here
          {
            number: 1,
            title: "Chapter 1 Title", // TODO: Edit
            startPage: 1,              // TODO: Fill in
            endPage: 10,               // TODO: Fill in
          },
        ],
  };
}

// Main
const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');

if (fileIndex === -1) {
  console.error('Usage: nx run importer:detect-chapters -- --file <pdf-path>');
  process.exit(1);
}

const pdfFile = args[fileIndex + 1];
const absolutePath = path.resolve(pdfFile);

if (!fs.existsSync(absolutePath)) {
  logger.error(`PDF not found: ${absolutePath}`);
  process.exit(1);
}

logger.info(`Analyzing: ${pdfFile}`);

try {
  // Extract text
  logger.info('Extracting text...');
  const text = extractText(absolutePath);
  logger.success(`Extracted ${text.length} characters`);

  // Detect metadata
  const { title, author } = extractMetadata(text);
  logger.info(`Title: ${title || '(not detected)'}`);
  logger.info(`Author: ${author || '(not detected)'}`);

  // Detect chapters
  logger.info('Detecting chapters...');
  const chapters = detectChapters(text);
  logger.success(`Found ${chapters.length} potential chapters`);

  // Display results
  console.log('\n' + '='.repeat(70));
  console.log('Detected Chapters:');
  console.log('='.repeat(70) + '\n');

  if (chapters.length === 0) {
    console.log('⚠️  No chapters auto-detected.');
    console.log('Use: nx run importer:create-metadata to create manual template\n');
  } else {
    chapters.forEach((ch, i) => {
      console.log(`${i + 1}. ${ch.title}`);
      console.log(`   Number: ${ch.number || '?'} | Confidence: ${ch.confidence}`);
      console.log(`   Context: ${ch.textContext}`);
      console.log();
    });
  }

  // Generate metadata
  const outputPath = pdfFile.replace('.pdf', '-metadata.json');
  const metadata = generateMetadata(
    pdfFile,
    title || path.basename(pdfFile, '.pdf'),
    author,
    chapters
  );

  fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));

  console.log('='.repeat(70));
  console.log(`📝 Metadata saved to: ${outputPath}`);
  console.log('='.repeat(70));
  console.log('\nNext steps:');
  console.log('1. Review detected chapters');
  console.log('2. Fill in startPage/endPage for each chapter (look at PDF)');
  console.log('3. Adjust chapter titles if needed');
  console.log('4. Run: nx run importer:import-book -- --metadata ' + outputPath);
  console.log();

  logger.success('Done!');
  process.exit(0);
} catch (error: any) {
  logger.error('Failed:', error.message);
  process.exit(1);
}
