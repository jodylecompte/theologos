/**
 * Unified Import Entry Point
 *
 * Dispatches to the appropriate import strategy based on metadata.type
 * in the source JSON file.
 *
 * Usage:
 *   nx run importer:import -- --file sources/heidelberg-catechism.json [--tradition <name>] [--force]
 *
 * The source file must conform to one of:
 *   CreedSourceJson      (metadata.type = 'creed')
 *   CatechismSourceJson  (metadata.type = 'catechism')
 *   ConfessionSourceJson (metadata.type = 'confession')
 *   BookSourceJson       (metadata.type = 'book')
 */

import { disconnect } from '../../../../libs/database/src/index';
import { createLogger } from '../utils/logger';
import { ensureWork } from '../utils/import-runner';
import { runCreedStrategy } from '../strategies/creed.strategy';
import { runCatechismStrategy } from '../strategies/catechism.strategy';
import { runConfessionStrategy } from '../strategies/confession.strategy';
import { runBookStrategy } from '../strategies/book.strategy';
import type {
  AnySourceJson,
  CreedSourceJson,
  CatechismSourceJson,
  ConfessionSourceJson,
  BookSourceJson,
} from '../types/source-json';
import * as fs from 'fs';
import * as path from 'path';

interface CliOptions {
  file: string;
  force: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = { file: '', force: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && i + 1 < args.length) {
      opts.file = args[++i];
    } else if (args[i] === '--force') {
      opts.force = true;
    }
  }

  if (!opts.file) {
    console.error('Usage: nx run importer:import -- --file <path> [--tradition <name>] [--force]');
    process.exit(1);
  }

  return opts;
}

function loadSourceJson(filePath: string): AnySourceJson {
  const absolute = path.resolve(filePath);

  if (!fs.existsSync(absolute)) {
    throw new Error(`Source file not found: ${absolute}`);
  }

  const raw = JSON.parse(fs.readFileSync(absolute, 'utf-8'));

  if (!raw.metadata || typeof raw.metadata.type !== 'string') {
    throw new Error(`Invalid source file: missing metadata.type in ${absolute}`);
  }

  const knownTypes = ['creed', 'catechism', 'confession', 'book'];
  if (!knownTypes.includes(raw.metadata.type)) {
    throw new Error(
      `Unknown metadata.type "${raw.metadata.type}". Expected one of: ${knownTypes.join(', ')}`
    );
  }

  return raw as AnySourceJson;
}

async function run(opts: CliOptions): Promise<void> {
  const source = loadSourceJson(opts.file);
  const logger = createLogger(`import:${source.metadata.type}`);

  logger.info(`Source: ${opts.file}`);
  logger.info(`Type: ${source.metadata.type}`);
  logger.info(`Title: ${source.metadata.title}`);
  logger.info(`Force: ${opts.force}`);

  const traditions = source.metadata.traditions ?? [];
  const author = 'author' in source.metadata ? (source.metadata.author ?? null) : null;

  const workId = await ensureWork(
    {
      title: source.metadata.title,
      author,
      type: source.metadata.type,
      traditions,
      force: opts.force,
    },
    logger
  );

  switch (source.metadata.type) {
    case 'creed':
      await runCreedStrategy(workId, source as CreedSourceJson, logger);
      break;
    case 'catechism':
      await runCatechismStrategy(workId, source as CatechismSourceJson, logger);
      break;
    case 'confession':
      await runConfessionStrategy(workId, source as ConfessionSourceJson, logger);
      break;
    case 'book':
      await runBookStrategy(workId, source as BookSourceJson, logger);
      break;
  }
}

async function main() {
  const opts = parseArgs();
  try {
    await run(opts);
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    await disconnect();
  }
}

if (require.main === module) {
  main();
}
