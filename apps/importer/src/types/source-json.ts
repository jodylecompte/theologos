/**
 * Source JSON Types
 *
 * These types define the canonical intermediate formats consumed by the import
 * pipeline. They are the contract between upstream sources (PDFs, EPUBs,
 * Creeds.json, manual curation) and the deterministic DB import strategies.
 *
 * Nothing outside the importer app should ever import these types.
 * All sources conforming to these types live in /sources at the repo root.
 *
 * Pipeline positions:
 *   PDF  → [extract] → [LLM normalize] → BookSourceJson  → BookImportStrategy
 *   EPUB → [parse]                     → BookSourceJson  → BookImportStrategy
 *   external/manual → [convert/curate] → CreedSourceJson
 *                                      → CatechismSourceJson  → respective strategies
 *                                      → ConfessionSourceJson
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/**
 * OSIS-format scripture proof reference group, as used by Creeds.json.
 * e.g. { id: 1, references: ["Isa.44.6", "Rev.1.8"] }
 */
export interface OsisProofGroup {
  id: number;
  references: string[];
}

// ---------------------------------------------------------------------------
// CreedSourceJson
// ---------------------------------------------------------------------------

export interface CreedSourceMetadata {
  type: 'creed';
  title: string;
  author?: string;
  year?: string;
  traditions?: string[];
  sourceFormat: 'creeds-json' | 'manual';
  sourceFile?: string;
}

export interface CreedSection {
  content: string;
}

export interface CreedSourceJson {
  metadata: CreedSourceMetadata;
  sections: CreedSection[];
}

// ---------------------------------------------------------------------------
// CatechismSourceJson
// ---------------------------------------------------------------------------

export interface CatechismSourceMetadata {
  type: 'catechism';
  title: string;
  author?: string;
  traditions?: string[];
  sourceFormat: 'creeds-json' | 'manual';
  sourceFile?: string;
}

export interface CatechismQuestion {
  number: number;
  question: string;
  answer: string;
  proofs?: OsisProofGroup[];
}

export interface CatechismSourceJson {
  metadata: CatechismSourceMetadata;
  questions: CatechismQuestion[];
}

// ---------------------------------------------------------------------------
// ConfessionSourceJson
// ---------------------------------------------------------------------------
//
// Confessions come in two structural forms:
//   'chaptered' — chapters containing sections (e.g. Westminster Confession of Faith)
//   'canon'     — flat list of articles (e.g. Canons of Dort)
//
// These are modeled as a discriminated union on metadata.structure.

export interface ConfessionSourceMetadataBase {
  type: 'confession';
  title: string;
  author?: string;
  traditions?: string[];
  sourceFormat: 'creeds-json' | 'manual';
  sourceFile?: string;
}

export interface ChapteredConfessionMetadata extends ConfessionSourceMetadataBase {
  structure: 'chaptered';
}

export interface CanonConfessionMetadata extends ConfessionSourceMetadataBase {
  structure: 'canon';
}

export interface ConfessionSection {
  content: string;
  proofs?: OsisProofGroup[];
}

export interface ConfessionChapter {
  title: string;
  sections: ConfessionSection[];
}

export interface ConfessionArticle {
  title: string;
  content: string;
  proofs?: OsisProofGroup[];
}

export interface ChapteredConfessionSourceJson {
  metadata: ChapteredConfessionMetadata;
  chapters: ConfessionChapter[];
}

export interface CanonConfessionSourceJson {
  metadata: CanonConfessionMetadata;
  articles: ConfessionArticle[];
}

export type ConfessionSourceJson =
  | ChapteredConfessionSourceJson
  | CanonConfessionSourceJson;

// ---------------------------------------------------------------------------
// BookSourceJson
// ---------------------------------------------------------------------------
//
// The epub-inspired intermediate format for all book-length works.
// PDFs reach this format via extract → LLM normalize.
// EPUBs reach this format via deterministic HTML parsing.
// The BookImportStrategy only ever sees this format.

export interface BookSourceMetadata {
  type: 'book';
  title: string;
  author?: string;
  traditions?: string[];
  sourceFormat: 'pdf' | 'epub' | 'mobi' | 'manual';
  sourceFile?: string;
}

export interface BookFootnote {
  /** The marker as it appears inline in the text: "1", "2", "*", "†", etc. */
  mark: string;
  /** Full footnote text. May contain scripture references. */
  text: string;
}

export interface BookHeadingBlock {
  type: 'heading';
  /** Heading depth: 1 = chapter-level sub-heading, 2 = section, 3 = sub-section */
  level: 1 | 2 | 3;
  content: string;
  sourcePage?: number;
}

export interface BookParagraphBlock {
  type: 'paragraph';
  content: string;
  sourcePage?: number;
  footnotes?: BookFootnote[];
}

export interface BookBlockquoteBlock {
  type: 'blockquote';
  content: string;
  sourcePage?: number;
  footnotes?: BookFootnote[];
}

export type BookBlock = BookHeadingBlock | BookParagraphBlock | BookBlockquoteBlock;

export interface BookChapter {
  title: string;
  subtitle?: string;
  blocks: BookBlock[];
}

export interface BookSourceJson {
  metadata: BookSourceMetadata;
  chapters: BookChapter[];
}

// ---------------------------------------------------------------------------
// Union — any valid source file
// ---------------------------------------------------------------------------

export type AnySourceJson =
  | CreedSourceJson
  | CatechismSourceJson
  | ConfessionSourceJson
  | BookSourceJson;
