/**
 * Simple Book Metadata Creator
 *
 * Creates a template metadata JSON file for manual completion.
 * Open the PDF, note the chapter page numbers, and fill in the template.
 *
 * Usage: nx run importer:create-metadata -- --file data/book.pdf --title "Book Title" --author "Author Name"
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('create-metadata');

interface BookMetadata {
  title: string;
  author?: string;
  slug: string;
  type: string;
  tradition?: string;
  pdfFile: string;
  chapters: Array<{
    number: number;
    title: string;
    startPage: number;
    endPage: number;
  }>;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function createTemplate(pdfPath: string, title: string, author?: string): void {
  const absolutePath = path.resolve(pdfPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`PDF file not found: ${absolutePath}`);
  }

  const slug = generateSlug(title);
  const outputPath = pdfPath.replace('.pdf', '-metadata.json');

  const template: BookMetadata = {
    title,
    author,
    slug,
    type: 'book',
    tradition: undefined, // e.g., 'reformed', 'catholic', 'orthodox'
    pdfFile: pdfPath,
    chapters: [
      {
        number: 1,
        title: 'Chapter 1 Title',
        startPage: 1,
        endPage: 10,
      },
      {
        number: 2,
        title: 'Chapter 2 Title',
        startPage: 11,
        endPage: 20,
      },
      // Add more chapters as needed
    ],
  };

  fs.writeFileSync(outputPath, JSON.stringify(template, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('📝 Metadata Template Created');
  console.log('='.repeat(70) + '\n');
  console.log(`File: ${outputPath}\n`);
  console.log('Next Steps:');
  console.log('1. Open your PDF in a viewer');
  console.log('2. Note the page numbers where each chapter starts/ends');
  console.log('3. Edit the metadata file and fill in:');
  console.log('   - Chapter titles');
  console.log('   - Start and end page numbers');
  console.log('   - Add/remove chapters as needed');
  console.log('4. Optionally set "tradition" field (reformed, catholic, etc.)');
  console.log('5. Run the import command with this metadata file\n');
  console.log('Example metadata structure:');
  console.log(JSON.stringify(template, null, 2).split('\n').slice(0, 20).join('\n'));
  console.log('  ...\n');
  console.log('='.repeat(70) + '\n');

  logger.success(`Template created: ${outputPath}`);
}

// CLI interface
const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');
const titleIndex = args.indexOf('--title');
const authorIndex = args.indexOf('--author');

if (fileIndex === -1 || titleIndex === -1) {
  console.error('Usage: nx run importer:create-metadata -- --file <pdf> --title "Book Title" [--author "Author"]');
  process.exit(1);
}

const pdfFile = args[fileIndex + 1];
const title = args[titleIndex + 1];
const author = authorIndex !== -1 ? args[authorIndex + 1] : undefined;

try {
  createTemplate(pdfFile, title, author);
  process.exit(0);
} catch (error: any) {
  logger.error('Failed:', error.message);
  process.exit(1);
}
