/**
 * Creeds.json → Canonical Source JSON Converter
 *
 * Converts a single Creeds.json format file to our canonical source JSON format.
 *
 * Usage:
 *   nx run importer:convert-creeds-json -- --in <path> --out <path> --traditions <slug,slug>
 *
 * For bulk conversion of all known files, use convert-all-creeds.ts instead.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  CreedSourceJson,
  CatechismSourceJson,
  CatechismQuestion,
  ConfessionSourceJson,
  ConfessionChapter,
  ConfessionSection,
  ConfessionArticle,
  OsisProofGroup,
} from '../types/source-json';

// ---------------------------------------------------------------------------
// Creeds.json raw types
// ---------------------------------------------------------------------------

interface RawMetadata {
  Title: string;
  Authors?: string[];
  Year?: string;
  CreedFormat: string;
  [key: string]: unknown;
}

interface RawProof {
  Id: number;
  References: string[];
}

interface RawCreedFile {
  Metadata: RawMetadata;
  Data: unknown;
}

// ---------------------------------------------------------------------------
// Proof conversion: PascalCase → camelCase
// ---------------------------------------------------------------------------

function convertProofs(proofs: RawProof[] | undefined): OsisProofGroup[] | undefined {
  if (!proofs || proofs.length === 0) return undefined;
  return proofs.map(p => ({ id: p.Id, references: p.References }));
}

// ---------------------------------------------------------------------------
// Format-specific converters
// ---------------------------------------------------------------------------

function convertCreed(raw: RawCreedFile, traditions: string[]): CreedSourceJson {
  const data = raw.Data as { Content: string };
  const sections = data.Content
    .split(/\n\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(content => ({ content }));

  return {
    metadata: {
      type: 'creed',
      title: raw.Metadata.Title,
      author: raw.Metadata.Authors?.join(', ') || undefined,
      year: raw.Metadata.Year,
      traditions,
      sourceFormat: 'creeds-json',
    },
    sections,
  };
}

function convertCatechism(raw: RawCreedFile, traditions: string[]): CatechismSourceJson {
  const data = raw.Data as Array<{
    Number: number | string;
    Question: string;
    Answer: string;
    Proofs?: RawProof[];
  }>;

  const questions: CatechismQuestion[] = [];

  for (const q of data) {
    const num = parseInt(String(q.Number), 10);
    if (isNaN(num) || !q.Question || q.Question === '?' || !q.Answer || q.Answer === '?') {
      continue;
    }
    const proofs = convertProofs(q.Proofs);
    questions.push({
      number: num,
      question: q.Question,
      answer: q.Answer,
      ...(proofs ? { proofs } : {}),
    });
  }

  return {
    metadata: {
      type: 'catechism',
      title: raw.Metadata.Title,
      author: raw.Metadata.Authors?.join(', ') || undefined,
      traditions,
      sourceFormat: 'creeds-json',
    },
    questions,
  };
}

function convertHenrysCatechism(raw: RawCreedFile, traditions: string[]): CatechismSourceJson {
  const data = raw.Data as Array<{
    Number: number | string;
    Question: string;
    Answer: string;
    SubQuestions?: Array<{ Number: string; Question: string; Answer: string }>;
  }>;

  const questions: CatechismQuestion[] = [];

  for (const q of data) {
    const num = parseInt(String(q.Number), 10);
    if (isNaN(num) || !q.Question || !q.Answer) continue;

    // SubQuestions contain scripture references embedded in prose — we keep
    // the main Q/A and omit sub-questions. Reference linking for this format
    // requires prose detection and is handled post-import by the reference
    // detection pass.
    questions.push({
      number: num,
      question: q.Question,
      answer: q.Answer,
    });
  }

  return {
    metadata: {
      type: 'catechism',
      title: raw.Metadata.Title,
      author: raw.Metadata.Authors?.join(', ') || undefined,
      traditions,
      sourceFormat: 'creeds-json',
    },
    questions,
  };
}

function convertCanon(raw: RawCreedFile, traditions: string[]): ConfessionSourceJson {
  const data = raw.Data as Array<{
    Article: string;
    Title: string;
    Content: string;
    Proofs?: RawProof[];
  }>;

  const articles: ConfessionArticle[] = data.map(a => ({
    title: a.Title,
    content: a.Content,
    ...(a.Proofs && a.Proofs.length > 0 ? { proofs: convertProofs(a.Proofs) } : {}),
  }));

  return {
    metadata: {
      type: 'confession',
      structure: 'canon',
      title: raw.Metadata.Title,
      author: raw.Metadata.Authors?.join(', ') || undefined,
      traditions,
      sourceFormat: 'creeds-json',
    },
    articles,
  };
}

function convertConfession(raw: RawCreedFile, traditions: string[]): ConfessionSourceJson {
  const data = raw.Data as Array<{
    Chapter: string;
    Title: string;
    Sections: Array<{
      Section: string;
      Content: string;
      Proofs?: RawProof[];
    }>;
  }>;

  const chapters: ConfessionChapter[] = [];

  for (const ch of data) {
    const sections: ConfessionSection[] = (ch.Sections ?? []).map(s => ({
      content: s.Content,
      ...(s.Proofs && s.Proofs.length > 0 ? { proofs: convertProofs(s.Proofs) } : {}),
    }));

    chapters.push({ title: ch.Title, sections });
  }

  return {
    metadata: {
      type: 'confession',
      structure: 'chaptered',
      title: raw.Metadata.Title,
      author: raw.Metadata.Authors?.join(', ') || undefined,
      traditions,
      sourceFormat: 'creeds-json',
    },
    chapters,
  };
}

// ---------------------------------------------------------------------------
// Main conversion dispatch
// ---------------------------------------------------------------------------

export function convertCreedsJson(
  inputPath: string,
  traditions: string[]
): CreedSourceJson | CatechismSourceJson | ConfessionSourceJson {
  const raw: RawCreedFile = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf-8'));
  const fmt = raw.Metadata?.CreedFormat;

  switch (fmt) {
    case 'Creed':          return convertCreed(raw, traditions);
    case 'Catechism':      return convertCatechism(raw, traditions);
    case 'HenrysCatechism': return convertHenrysCatechism(raw, traditions);
    case 'Canon':          return convertCanon(raw, traditions);
    case 'Confession':     return convertConfession(raw, traditions);
    default:
      throw new Error(`Unknown CreedFormat: "${fmt}" in ${inputPath}`);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  let inputPath = '';
  let outputPath = '';
  let traditions: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--in' && i + 1 < args.length)         inputPath = args[++i];
    else if (args[i] === '--out' && i + 1 < args.length)   outputPath = args[++i];
    else if (args[i] === '--traditions' && i + 1 < args.length) {
      traditions = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (!inputPath) {
    console.error('Usage: nx run importer:convert-creeds-json -- --in <path> --out <path> [--traditions slug,slug]');
    process.exit(1);
  }

  const result = convertCreedsJson(inputPath, traditions);
  const json = JSON.stringify(result, null, 2);

  if (outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(path.resolve(outputPath), json, 'utf-8');
    console.log(`Written to ${outputPath}`);
  } else {
    console.log(json);
  }
}

if (require.main === module) {
  main();
}
