/**
 * Book PDF Normalizer
 *
 * Takes the raw page-by-page JSON produced by book:extract and uses a local
 * Ollama LLM to produce a clean BookSourceJson with labeled chapters,
 * paragraphs, headings, and footnotes.
 *
 * Usage:
 *   nx run importer:book:normalize -- --in extracted/loveliness.json --out sources/loveliness.json
 *   nx run importer:book:normalize -- --in extracted/loveliness.json --out sources/loveliness.json --model mistral --pages 1-15
 *
 * Options:
 *   --in      Path to extracted JSON (required)
 *   --out     Path to write BookSourceJson (required)
 *   --model   Ollama model name (default: mistral)
 *   --url     Ollama base URL (default: http://localhost:11434)
 *   --pages   Page range to process, e.g. "1-20" (default: all pages)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { BookSourceJson } from '../types/source-json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a precise text structuring assistant. Convert raw PDF text into a structured JSON document.

OUTPUT ONLY A RAW JSON OBJECT. No explanation. No markdown. No code fences. No preamble. Start your response with { and end with }.

## Required output structure

{
  "metadata": {
    "type": "book",
    "title": "The actual title from the text",
    "author": "Author name if found",
    "sourceFormat": "pdf",
    "sourceFile": "the source file path given"
  },
  "chapters": [
    {
      "title": "Chapter or section title",
      "blocks": [
        { "type": "paragraph", "content": "paragraph text", "sourcePage": 7 },
        { "type": "heading", "level": 1, "content": "heading text", "sourcePage": 7 },
        { "type": "blockquote", "content": "quoted text", "sourcePage": 7 }
      ]
    }
  ]
}

IMPORTANT RULES FOR METADATA:
- "type" must always be exactly the string "book". Never omit it.
- "title" must be the actual title of the work as it appears in the text.
- Only include "author" if the author's name is explicitly stated in the text. Do not guess or infer an author. If not stated, leave the field out entirely.
- Only include "traditions" if explicitly identifiable. If not, leave the field out entirely.
- Never use the string "omit" or "unknown" as a value. Either include the real value or leave the field out.

IMPORTANT RULES FOR CHAPTERS:
- Each named section (e.g. "PREFACE", "BIOGRAPHICAL BACKGROUND") becomes a separate chapter.
- If the body has no named divisions, use one chapter for the body.
- Skip front matter entirely (title page, copyright, publisher info — no blocks, no chapter).
- Do not include a "subtitle" field unless there is actually a subtitle in the text.

IMPORTANT RULES FOR BLOCKS:
- Every paragraph of body text is a "paragraph" block.
- Verse stanzas and hymn lines are "blockquote" blocks.
- Sub-headings within a chapter are "heading" blocks (level 1, 2, or 3).
- Set "sourcePage" on every block to the page number it came from.
- Do not emit empty blocks. If a block has no content, skip it.

IMPORTANT RULES FOR FOOTNOTES:
Footnotes appear in two parts in the raw text:
1. An inline marker — a digit appended directly to a word with no space, e.g. "providence1" or "brae.2" (the period before the digit is punctuation, not part of the marker).
2. A definition block at the bottom of the page, e.g.:
   1
     providence - provision, supply
   2
     brae - hillside, hill, any slope

For each paragraph containing inline markers you MUST do all three of these things:
- Replace the inline digit with a bracketed marker in the text: "providence1" becomes "providence[^1]", "brae.2" becomes "brae.[^2]"
- Add a "footnotes" array ON THAT PARAGRAPH BLOCK (not at the top level) with each definition:
  "footnotes": [{ "mark": "1", "text": "providence - provision, supply" }]
- Do NOT emit the footnote definition lines as paragraph blocks.

The "footnotes" array belongs on each individual paragraph block, never at the top level of the JSON.

STRIP from all content:
- Standalone page numbers (a bare integer at the end of a page)
- Blank separator lines`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPagesForPrompt(pages: ExtractedPage[]): string {
  return pages.map(p => `--- Page ${p.page} ---\n${p.text}`).join('\n\n');
}

function parsePageRange(rangeStr: string): [number, number] {
  const parts = rangeStr.split('-');
  if (parts.length !== 2) {
    throw new Error(`Invalid page range: "${rangeStr}". Use format: 1-20`);
  }
  const start = parseInt(parts[0], 10);
  const end = parseInt(parts[1], 10);
  if (isNaN(start) || isNaN(end)) {
    throw new Error(`Invalid page range: "${rangeStr}". Numbers required.`);
  }
  return [start, end];
}

/**
 * Attempt to extract a JSON object from the LLM response.
 * Handles cases where the model wraps output in markdown code fences.
 */
function extractJson(raw: string): string {
  // Strip markdown code fences if present
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenceMatch) return fenceMatch[1];

  // Fall back to extracting from first { to last }
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }

  return raw.trim();
}

// ---------------------------------------------------------------------------
// Ollama API
// ---------------------------------------------------------------------------

async function callOllama(
  model: string,
  baseUrl: string,
  userMessage: string,
): Promise<string> {
  const url = `${baseUrl}/api/chat`;

  console.log(`Calling Ollama (${url}) — model: ${model}`);
  console.log('This may take several minutes for a full book...');

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        options: {
          temperature: 0.1,
          num_predict: 32768,
        },
      }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch')) {
      throw new Error(`Cannot connect to Ollama at ${baseUrl}. Is Ollama running?\n  Start it with: ollama serve`);
    }
    throw err;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as OllamaChatResponse;

  if (data.error) throw new Error(`Ollama error: ${data.error}`);
  if (!data.message?.content) throw new Error('Ollama returned an empty response');

  return data.message.content;
}

// ---------------------------------------------------------------------------
// Merge chapters from batches
//
// If the last chapter of the previous batch has the same title as the first
// chapter of the next batch, their blocks are merged (the chapter spans a
// page boundary). Otherwise chapters are simply appended.
// ---------------------------------------------------------------------------

function mergeChapters(
  accumulated: BookSourceJson['chapters'],
  incoming: BookSourceJson['chapters'],
): BookSourceJson['chapters'] {
  if (accumulated.length === 0) return incoming;
  if (incoming.length === 0) return accumulated;

  const last = accumulated[accumulated.length - 1];
  const first = incoming[0];

  if (last.title === first.title) {
    // Same chapter spans the batch boundary — merge blocks
    const merged = [...accumulated];
    merged[merged.length - 1] = {
      ...last,
      blocks: [...last.blocks, ...first.blocks],
    };
    return [...merged, ...incoming.slice(1)];
  }

  return [...accumulated, ...incoming];
}

// ---------------------------------------------------------------------------
// Process a single batch of pages
// ---------------------------------------------------------------------------

async function processBatch(
  pages: ExtractedPage[],
  sourceFile: string,
  model: string,
  baseUrl: string,
  debugDir: string,
  batchIndex: number,
): Promise<BookSourceJson> {
  const userMessage = [
    `Source file: ${sourceFile}`,
    `Pages in this batch: ${pages.length}`,
    '',
    formatPagesForPrompt(pages),
  ].join('\n');

  const rawResponse = await callOllama(model, baseUrl, userMessage);

  // Save raw response for this batch
  const debugPath = path.join(debugDir, `batch-${batchIndex}-raw.txt`);
  fs.writeFileSync(debugPath, rawResponse, 'utf-8');

  let result: BookSourceJson;
  try {
    const jsonStr = extractJson(rawResponse);
    result = JSON.parse(jsonStr) as BookSourceJson;
  } catch {
    console.error(`Batch ${batchIndex}: failed to parse JSON. Raw response at: ${debugPath}`);
    throw new Error(`Batch ${batchIndex} JSON parse failure`);
  }

  if (!result.metadata || result.metadata.type !== 'book') {
    console.error(`Batch ${batchIndex}: invalid metadata. Raw response at: ${debugPath}`);
    throw new Error(`Batch ${batchIndex} metadata validation failure`);
  }
  if (!Array.isArray(result.chapters) || result.chapters.length === 0) {
    console.error(`Batch ${batchIndex}: no chapters returned. Raw response at: ${debugPath}`);
    throw new Error(`Batch ${batchIndex} produced no chapters`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  const args = process.argv.slice(2);

  const getArg = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const inArg = getArg('--in');
  const outArg = getArg('--out');
  const modelArg = getArg('--model') ?? 'mistral';
  const urlArg = getArg('--url') ?? 'http://localhost:11434';
  const pagesArg = getArg('--pages');
  const chunkSize = parseInt(getArg('--chunk-size') ?? '8', 10);

  if (!inArg || !outArg) {
    console.error(
      'Usage: nx run importer:book:normalize -- --in <extracted.json> --out <sources/book.json> [--model mistral] [--pages 1-20] [--chunk-size 8]',
    );
    process.exit(1);
  }

  const extractedPath = path.resolve(inArg);
  if (!fs.existsSync(extractedPath)) {
    console.error(`Input file not found: ${extractedPath}`);
    process.exit(1);
  }

  const extracted: ExtractedBook = JSON.parse(fs.readFileSync(extractedPath, 'utf-8'));

  let pages = extracted.pages;
  if (pagesArg) {
    const [start, end] = parsePageRange(pagesArg);
    pages = pages.filter(p => p.page >= start && p.page <= end);
    console.log(`Page range: ${start}–${end} (${pages.length} pages)`);
  } else {
    console.log(`Processing all ${pages.length} pages`);
  }

  // Split into chunks
  const chunks: ExtractedPage[][] = [];
  for (let i = 0; i < pages.length; i += chunkSize) {
    chunks.push(pages.slice(i, i + chunkSize));
  }
  console.log(`Chunks: ${chunks.length} × ${chunkSize} pages (chunk size)`);

  // Debug dir for raw batch responses
  const debugDir = path.resolve(outArg.replace(/\.json$/, '-batches'));
  fs.mkdirSync(debugDir, { recursive: true });

  // Process chunks sequentially and merge
  let allChapters: BookSourceJson['chapters'] = [];
  let metadata: BookSourceJson['metadata'] | null = null;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const firstPage = chunk[0].page;
    const lastPage = chunk[chunk.length - 1].page;
    console.log(`\nChunk ${i + 1}/${chunks.length} — pages ${firstPage}–${lastPage}`);

    const batchResult = await processBatch(
      chunk,
      extracted.sourceFile,
      modelArg,
      urlArg,
      debugDir,
      i + 1,
    );

    // Use metadata from the first successful batch
    if (!metadata) metadata = batchResult.metadata;

    allChapters = mergeChapters(allChapters, batchResult.chapters);

    const totalBlocks = allChapters.reduce((sum, ch) => sum + ch.blocks.length, 0);
    console.log(`  ✓ ${batchResult.chapters.length} chapter(s) this chunk — running total: ${allChapters.length} chapters, ${totalBlocks} blocks`);
  }

  const finalResult: BookSourceJson = {
    metadata: metadata!,
    chapters: allChapters,
  };

  const outPath = path.resolve(outArg);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(finalResult, null, 2), 'utf-8');

  const totalBlocks = allChapters.reduce((sum, ch) => sum + ch.blocks.length, 0);
  console.log(`\n✓ ${allChapters.length} chapters, ${totalBlocks} blocks`);
  console.log(`✓ Written to: ${outArg}`);
  console.log(`  Batch debug files: ${debugDir}/`);
}

run().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
