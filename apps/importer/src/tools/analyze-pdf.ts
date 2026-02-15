/**
 * PDF Analysis Tool
 *
 * Analyzes a PDF to detect potential chapter boundaries.
 * Outputs a metadata JSON file that can be reviewed and adjusted before import.
 *
 * Usage: nx run importer:analyze-pdf -- --file data/book.pdf [--output data/book-metadata.json]
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const { PDFParse: pdfParse } = require('pdf-parse');

const logger = createLogger('analyze-pdf');

interface ChapterCandidate {
  number?: number;
  title: string;
  page: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

interface BookMetadata {
  title: string;
  author?: string;
  pdfFile: string;
  totalPages: number;
  detectedChapters: ChapterCandidate[];
  chapters?: Array<{
    number: number;
    title: string;
    startPage: number;
    endPage?: number;
  }>;
}

/**
 * Extract text from PDF with page information
 */
async function extractPdfText(pdfPath: string): Promise<{
  pages: Array<{ pageNum: number; text: string; lines: string[] }>;
  totalPages: number;
  fullText: string;
}> {
  const dataBuffer = fs.readFileSync(pdfPath);

  // Parse PDF
  const data = await pdfParse(dataBuffer, {
    // Custom page render to preserve page boundaries
    pagerender: (pageData: any) => {
      return pageData.getTextContent().then((textContent: any) => {
        const text = textContent.items.map((item: any) => item.str).join(' ');
        return `\n---PAGE_BREAK---\n${text}`;
      });
    },
  });

  // Split by page breaks
  const pageTexts = data.text.split('---PAGE_BREAK---').filter(Boolean);
  const pages: Array<{ pageNum: number; text: string; lines: string[] }> = [];

  pageTexts.forEach((text, i) => {
    const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
    pages.push({
      pageNum: i + 1,
      text,
      lines,
    });
  });

  return {
    pages,
    totalPages: data.numpages,
    fullText: data.text,
  };
}

/**
 * Detect potential chapter headings
 */
function detectChapters(pages: Array<{ pageNum: number; text: string; lines: string[] }>): ChapterCandidate[] {
  const candidates: ChapterCandidate[] = [];

  // Patterns to match chapter headings
  const chapterPatterns = [
    // "Chapter 1", "Chapter One", "CHAPTER 1"
    /^(Chapter|CHAPTER|Chap\.|Ch\.)\s+(\d+|[IVX]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\.?\s*:?\s*(.*)$/i,
    // "1. Title" or "I. Title" (at start of line)
    /^([IVX]+|\d+)\.\s+([A-Z][^.!?]+)$/,
    // "Part 1", "Part One"
    /^(Part|PART|Section|SECTION)\s+(\d+|[IVX]+|One|Two|Three)\.?\s*:?\s*(.*)$/i,
  ];

  for (const page of pages) {
    for (const line of page.lines) {
      if (line.length < 3 || line.length > 100) continue; // Skip very short or very long lines

      for (const pattern of chapterPatterns) {
        const match = line.match(pattern);
        if (match) {
          let number: number | undefined;
          let title = '';
          let confidence: 'high' | 'medium' | 'low' = 'medium';

          // Parse based on which pattern matched
          if (match[1].toLowerCase().includes('chapter')) {
            // "Chapter 5: Title" or "Chapter Five"
            number = parseChapterNumber(match[2]);
            title = match[3]?.trim() || match[2];
            confidence = 'high';
          } else if (match[1].toLowerCase().includes('part') || match[1].toLowerCase().includes('section')) {
            // "Part 1: Title"
            number = parseChapterNumber(match[2]);
            title = match[3]?.trim() || `Part ${match[2]}`;
            confidence = 'medium';
          } else {
            // "1. Title" format
            number = parseChapterNumber(match[1]);
            title = match[2]?.trim() || '';
            confidence = 'medium';
          }

          candidates.push({
            number,
            title,
            page: page.pageNum,
            confidence,
            reason: `Matched pattern: ${pattern.source}`,
          });

          break; // Only match one pattern per line
        }
      }
    }
  }

  return candidates;
}

/**
 * Parse chapter number from various formats
 */
function parseChapterNumber(str: string): number | undefined {
  // Handle numeric
  const num = parseInt(str, 10);
  if (!isNaN(num)) return num;

  // Handle Roman numerals
  const romanMap: Record<string, number> = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
    'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
    'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15,
  };
  if (romanMap[str.toUpperCase()]) return romanMap[str.toUpperCase()];

  // Handle word numbers
  const wordMap: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  };
  if (wordMap[str.toLowerCase()]) return wordMap[str.toLowerCase()];

  return undefined;
}

/**
 * Extract potential book title and author from first few pages
 */
function extractMetadata(pages: Array<{ pageNum: number; text: string; lines: string[] }>): {
  title?: string;
  author?: string;
} {
  // Look at first 3 pages for title/author
  const firstPages = pages.slice(0, 3);
  let title: string | undefined;
  let author: string | undefined;

  for (const page of firstPages) {
    for (const line of page.lines) {
      // Title is usually a longer line near the top, all caps or title case
      if (!title && line.length > 10 && line.length < 100) {
        if (line === line.toUpperCase() || /^[A-Z][^.!?]+$/.test(line)) {
          title = line;
        }
      }

      // Author often has "by" prefix
      if (!author && /^by\s+(.+)$/i.test(line)) {
        author = line.replace(/^by\s+/i, '').trim();
      }
    }
  }

  return { title, author };
}

/**
 * Main analysis function
 */
async function analyzePdf(pdfPath: string, outputPath?: string): Promise<void> {
  logger.info(`Analyzing PDF: ${pdfPath}`);

  const absolutePath = path.resolve(pdfPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`PDF file not found: ${absolutePath}`);
  }

  // Extract text
  logger.info('Extracting text from PDF...');
  const { pages, totalPages, fullText } = await extractPdfText(absolutePath);
  logger.success(`Extracted ${totalPages} pages`);

  // Extract metadata
  const { title, author } = extractMetadata(pages);
  logger.info(`Detected title: ${title || '(unknown)'}`);
  logger.info(`Detected author: ${author || '(unknown)'}`);

  // Detect chapters
  logger.info('Detecting chapter headings...');
  const detectedChapters = detectChapters(pages);
  logger.success(`Detected ${detectedChapters.length} potential chapters`);

  // Build metadata
  const metadata: BookMetadata = {
    title: title || path.basename(pdfPath, '.pdf'),
    author,
    pdfFile: pdfPath,
    totalPages,
    detectedChapters,
  };

  // Display detected chapters
  console.log('\n' + '='.repeat(70));
  console.log('Detected Chapters:');
  console.log('='.repeat(70) + '\n');

  if (detectedChapters.length === 0) {
    console.log('⚠️  No chapters detected automatically.');
    console.log('You will need to create the chapter metadata manually.\n');
  } else {
    detectedChapters.forEach((ch, i) => {
      console.log(`${i + 1}. Page ${ch.page} - ${ch.title}`);
      console.log(`   Confidence: ${ch.confidence} - ${ch.reason}`);
      if (ch.number !== undefined) {
        console.log(`   Chapter number: ${ch.number}`);
      }
      console.log();
    });
  }

  // Write to output file
  const output = outputPath || pdfPath.replace('.pdf', '-metadata.json');
  fs.writeFileSync(output, JSON.stringify(metadata, null, 2));
  logger.success(`\nMetadata written to: ${output}`);

  console.log('\n' + '='.repeat(70));
  console.log('Next Steps:');
  console.log('='.repeat(70));
  console.log('1. Review the detected chapters in the metadata file');
  console.log('2. Adjust chapter boundaries if needed');
  console.log('3. Convert detectedChapters to chapters array with startPage/endPage');
  console.log('4. Run the import script with the verified metadata\n');
}

// CLI interface
const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');
const outputIndex = args.indexOf('--output');

if (fileIndex === -1) {
  console.error('Usage: nx run importer:analyze-pdf -- --file <pdf-path> [--output <json-path>]');
  process.exit(1);
}

const pdfFile = args[fileIndex + 1];
const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : undefined;

analyzePdf(pdfFile, outputFile)
  .then(() => {
    logger.success('Analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Analysis failed:', error);
    process.exit(1);
  });
