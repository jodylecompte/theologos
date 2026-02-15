/**
 * PDF Book Import Job
 *
 * Imports a theological book from PDF using metadata file.
 * Automatically detects and links scripture references.
 *
 * Usage:
 *   nx run importer:import-book -- --metadata data/book-metadata.json [--force]
 */

import { prisma, disconnect } from '../../../../libs/database/src/index';
import { createLogger } from '../utils/logger';
import { detectAndResolve } from '../utils/reference-parser';
import { cleanPdfText } from '../utils/pdf-text-normalizer';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const logger = createLogger('import-book');

interface BookMetadata {
  title: string;
  author?: string;
  slug: string;
  type: string;
  tradition?: string;
  pdfFile: string;
  chapters: Array<{
    number: number;           // Sequential order for navigation (1, 2, 3, 4...)
    displayNumber?: string;   // Actual chapter number as shown in book (can be "Preface", "Introduction", "Chapter 1", etc.)
    title: string;
    subtitle?: string;        // Optional subtitle
    startPage: number;
    endPage: number;
  }>;
}

interface ImportStats {
  chaptersImported: number;
  pagesImported: number;
  referencesDetected: number;
  referencesResolved: number;
  referencesFailed: number;
}

/**
 * Extract text from a single page in PDF
 */
function extractSinglePage(pdfPath: string, pageNumber: number): string {
  try {
    const text = execSync(
      `pdftotext -layout -enc UTF-8 -f ${pageNumber} -l ${pageNumber} "${pdfPath}" -`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    return cleanPdfText(text);
  } catch (error: any) {
    throw new Error(`Failed to extract page ${pageNumber}: ${error.message}`);
  }
}

/**
 * Check if work already exists
 */
async function workExists(slug: string): Promise<boolean> {
  const existing = await prisma.work.findFirst({
    where: { title: { contains: slug, mode: 'insensitive' } },
  });
  return !!existing;
}

/**
 * Import a single book from metadata
 */
async function importBook(metadataPath: string, force: boolean): Promise<void> {
  logger.info(`Loading metadata: ${metadataPath}`);

  // Load metadata
  const absolutePath = path.resolve(metadataPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Metadata file not found: ${absolutePath}`);
  }

  const metadata: BookMetadata = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));

  // Validate PDF exists
  const pdfPath = path.resolve(metadata.pdfFile);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  logger.info(`Book: ${metadata.title}`);
  logger.info(`Author: ${metadata.author || '(none)'}`);
  logger.info(`Chapters: ${metadata.chapters.length}`);

  // Check if already imported
  if (!force && await workExists(metadata.slug)) {
    throw new Error(
      `Work "${metadata.title}" already exists. Use --force to re-import (will delete existing).`
    );
  }

  // Delete existing if force mode
  if (force) {
    logger.warn('Force mode: deleting existing work if found...');
    const existing = await prisma.work.findFirst({
      where: { title: metadata.title },
    });

    if (existing) {
      // Delete references first, then units, then work
      const units = await prisma.workUnit.findMany({
        where: { workId: existing.id },
        select: { id: true },
      });

      const unitIds = units.map(u => u.id);

      if (unitIds.length > 0) {
        await prisma.reference.deleteMany({
          where: { sourceUnitId: { in: unitIds } },
        });

        await prisma.workUnit.deleteMany({
          where: { id: { in: unitIds } },
        });
      }

      await prisma.work.delete({
        where: { id: existing.id },
      });

      logger.success('Deleted existing work');
    }
  }

  // Create Work
  logger.info('Creating Work record...');
  const work = await prisma.work.create({
    data: {
      title: metadata.title,
      author: metadata.author,
      type: metadata.type,
      tradition: metadata.tradition,
    },
  });

  logger.success(`Created Work: ${work.title} (${work.id})`);

  // Import stats
  const stats: ImportStats = {
    chaptersImported: 0,
    pagesImported: 0,
    referencesDetected: 0,
    referencesResolved: 0,
    referencesFailed: 0,
  };

  // Track sequential page number across all chapters (1, 2, 3...)
  let sequentialPageNumber = 1;

  // Process each chapter
  for (const chapter of metadata.chapters) {
    const displayNum = chapter.displayNumber || chapter.number.toString();
    logger.info(`Processing ${displayNum}: ${chapter.title}`);
    logger.info(`  Pages ${chapter.startPage}-${chapter.endPage}`);

    // Create chapter WorkUnit (for structure/navigation)
    // Use chapter.number for sequential positionIndex (1, 2, 3...)
    // Title should be complete (e.g., "Preface to the Tenth-Anniversary Edition")
    let chapterTitle = chapter.title;

    // Append subtitle if provided
    if (chapter.subtitle) {
      chapterTitle += `\n${chapter.subtitle}`;
    }

    const chapterUnit = await prisma.workUnit.create({
      data: {
        workId: work.id,
        type: 'chapter',
        positionIndex: chapter.number,  // Sequential: 1, 2, 3, 4, 5, 6, 7...
        title: chapterTitle,
        contentText: '', // No content at chapter level, it's in pages
      },
    });

    logger.success(`  ✓ Created chapter: ${chapterTitle.split('\n')[0]}`);

    // Process each page in this chapter
    for (let pdfPageNum = chapter.startPage; pdfPageNum <= chapter.endPage; pdfPageNum++) {
      logger.info(`    Extracting PDF page ${pdfPageNum} (book page ${sequentialPageNumber})...`);

      // Extract single page
      const pageText = extractSinglePage(pdfPath, pdfPageNum);

      if (!pageText || pageText.length < 10) {
        logger.warn(`    ⚠️  Empty page ${pdfPageNum}, skipping`);
        continue;
      }

      // Detect scripture references on this page
      const { resolved, unresolved, detectedCount } = await detectAndResolve(pageText);

      stats.referencesDetected += detectedCount;
      stats.referencesResolved += resolved.length;
      stats.referencesFailed += unresolved.length;

      if (detectedCount > 0) {
        logger.info(`    Found ${detectedCount} references (${resolved.length} resolved)`);
      }

      // Create page WorkUnit (child of chapter)
      // Use sequential page number for positionIndex, store PDF page in title
      const pageUnit = await prisma.workUnit.create({
        data: {
          workId: work.id,
          parentUnitId: chapterUnit.id,
          type: 'page',
          positionIndex: sequentialPageNumber,
          title: `Page ${sequentialPageNumber} (PDF p.${pdfPageNum})`,
          contentText: pageText,
        },
      });

      // Link references to this page
      if (resolved.length > 0) {
        await prisma.reference.createMany({
          data: resolved.map(ref => ({
            sourceUnitId: pageUnit.id,
            bibleVerseId: ref.verseId,
          })),
        });
      }

      stats.pagesImported++;
      sequentialPageNumber++;
    }

    logger.success(`  ✓ Imported ${chapter.endPage - chapter.startPage + 1} pages`);
    stats.chaptersImported++;
  }

  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('Import Complete!');
  console.log('='.repeat(70));
  console.log(`\nBook: ${metadata.title}`);
  console.log(`Slug: ${metadata.slug}`);
  console.log(`\nStatistics:`);
  console.log(`  Chapters imported: ${stats.chaptersImported}`);
  console.log(`  Pages imported: ${stats.pagesImported}`);
  console.log(`  References detected: ${stats.referencesDetected}`);
  console.log(`  References resolved: ${stats.referencesResolved}`);
  console.log(`  References failed: ${stats.referencesFailed}`);
  console.log(`\nView in reader:`);
  console.log(`  http://localhost:4200/reader?work=${metadata.slug}&page=${metadata.chapters[0]?.startPage || 1}`);
  console.log('='.repeat(70) + '\n');

  logger.success('Import complete!');
}

// CLI interface
const args = process.argv.slice(2);
const metadataIndex = args.indexOf('--metadata');
const force = args.includes('--force');

if (metadataIndex === -1) {
  console.error('Usage: nx run importer:import-book -- --metadata <json-file> [--force]');
  process.exit(1);
}

const metadataFile = args[metadataIndex + 1];

importBook(metadataFile, force)
  .then(async () => {
    await disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error('Import failed:', error);
    await disconnect();
    process.exit(1);
  });
