/**
 * Batch Creeds.json Converter
 *
 * Converts all known Creeds.json source files to canonical source JSON
 * and writes them to the /sources directory at the repo root.
 *
 * Tradition assignments are explicit and deliberate — not inferred.
 * To add a new source file, add an entry to SOURCES below.
 *
 * Usage:
 *   nx run importer:convert-all-creeds
 */

import * as fs from 'fs';
import * as path from 'path';
import { convertCreedsJson } from './convert-creeds-json';

interface SourceEntry {
  in: string;        // relative to ~/creeds/
  out: string;       // relative to /sources/ at repo root
  traditions: string[];
}

const HOME = process.env.HOME || process.env.USERPROFILE || '';
const CREEDS_DIR = path.join(HOME, 'creeds');
const SOURCES_DIR = path.resolve(__dirname, '../../../../sources');

const SOURCES: SourceEntry[] = [
  // ── Ecumenical creeds ────────────────────────────────────────────────────
  { in: 'apostles_creed.json',               out: 'creeds/apostles-creed.json',               traditions: ['ecumenical'] },
  { in: 'nicene_creed.json',                 out: 'creeds/nicene-creed.json',                 traditions: ['ecumenical'] },
  { in: 'athanasian_creed.json',             out: 'creeds/athanasian-creed.json',             traditions: ['ecumenical'] },
  { in: 'chalcedonian_definition.json',      out: 'creeds/chalcedonian-definition.json',      traditions: ['ecumenical'] },
  { in: 'confession_of_peter.json',          out: 'creeds/confession-of-peter.json',          traditions: ['ecumenical'] },
  { in: 'gregorys_declaration_of_faith.json', out: 'creeds/gregorys-declaration-of-faith.json', traditions: ['ecumenical'] },
  { in: 'ignatius_creed.json',               out: 'creeds/ignatius-creed.json',               traditions: ['ecumenical'] },
  { in: 'irenaeus_rule_of_faith.json',       out: 'creeds/irenaeus-rule-of-faith.json',       traditions: ['ecumenical'] },
  { in: 'tertullians_rule_of_faith.json',    out: 'creeds/tertullians-rule-of-faith.json',    traditions: ['ecumenical'] },
  { in: 'council_of_orange.json',            out: 'confessions/council-of-orange.json',       traditions: ['ecumenical'] },

  // Shema — pre-Christian Jewish prayer; no Christian tradition assigned
  { in: 'shema_yisrael.json',                out: 'creeds/shema-yisrael.json',                traditions: [] },

  // ── Reformed ─────────────────────────────────────────────────────────────
  { in: 'heidelberg_catechism.json',         out: 'catechisms/heidelberg-catechism.json',     traditions: ['reformed'] },
  { in: 'belgic_confession_of_faith.json',   out: 'confessions/belgic-confession.json',       traditions: ['reformed'] },
  { in: 'canons_of_dort.json',               out: 'confessions/canons-of-dort.json',          traditions: ['reformed'] },
  { in: 'savoy_declaration.json',            out: 'confessions/savoy-declaration.json',       traditions: ['reformed'] },
  { in: 'second_helvetic_confession.json',   out: 'confessions/second-helvetic-confession.json', traditions: ['reformed'] },
  { in: 'french_confession_of_faith.json',   out: 'confessions/french-confession-of-faith.json', traditions: ['reformed'] },
  { in: 'first_helvetic_confession.json',    out: 'confessions/first-helvetic-confession.json', traditions: ['reformed'] },
  { in: 'first_confession_of_basel.json',    out: 'confessions/first-confession-of-basel.json', traditions: ['reformed'] },
  { in: 'helvetic_consensus.json',           out: 'confessions/helvetic-consensus.json',      traditions: ['reformed'] },
  { in: 'consensus_tigurinus.json',          out: 'confessions/consensus-tigurinus.json',     traditions: ['reformed'] },
  { in: 'tetrapolitan_confession.json',      out: 'confessions/tetrapolitan-confession.json', traditions: ['reformed'] },
  { in: 'ten_theses_of_berne.json',          out: 'confessions/ten-theses-of-berne.json',     traditions: ['reformed'] },
  { in: 'waldensian_confession.json',        out: 'confessions/waldensian-confession.json',   traditions: ['reformed'] },
  { in: 'zwinglis_67_articles.json',         out: 'confessions/zwinglis-67-articles.json',    traditions: ['reformed'] },
  { in: 'zwinglis_fidei_ratio.json',         out: 'confessions/zwinglis-fidei-ratio.json',    traditions: ['reformed'] },
  { in: 'chicago_statement_on_biblical_inerrancy.json', out: 'confessions/chicago-statement-biblical-inerrancy.json', traditions: ['reformed'] },
  { in: 'puritan_catechism.json',            out: 'catechisms/puritan-catechism.json',        traditions: ['reformed'] },

  // ── Presbyterian ─────────────────────────────────────────────────────────
  { in: 'westminster_confession_of_faith.json', out: 'confessions/westminster-confession-of-faith.json', traditions: ['presbyterian'] },
  { in: 'westminster_shorter_catechism.json', out: 'catechisms/westminster-shorter-catechism.json', traditions: ['presbyterian'] },
  { in: 'westminster_larger_catechism.json', out: 'catechisms/westminster-larger-catechism.json', traditions: ['presbyterian'] },
  { in: 'scots_confession.json',             out: 'confessions/scots-confession.json',        traditions: ['presbyterian'] },
  { in: 'catechism_for_young_children.json', out: 'catechisms/catechism-for-young-children.json', traditions: ['presbyterian'] },
  { in: 'exposition_of_the_assemblies_catechism.json', out: 'catechisms/exposition-of-the-assemblies-catechism.json', traditions: ['presbyterian'] },
  { in: 'matthew_henrys_scripture_catechism.json', out: 'catechisms/matthew-henrys-scripture-catechism.json', traditions: ['presbyterian'] },
  { in: 'shorter_catechism_explained.json',  out: 'catechisms/shorter-catechism-explained.json', traditions: ['presbyterian'] },

  // ── Baptist ───────────────────────────────────────────────────────────────
  { in: 'london_baptist_1689.json',          out: 'confessions/london-baptist-1689.json',     traditions: ['baptist'] },
  { in: '1695_baptist_catechism.json',       out: 'catechisms/1695-baptist-catechism.json',   traditions: ['baptist'] },
  { in: 'keachs_catechism.json',             out: 'catechisms/keachs-catechism.json',         traditions: ['baptist'] },
];

async function main() {
  fs.mkdirSync(path.join(SOURCES_DIR, 'creeds'),       { recursive: true });
  fs.mkdirSync(path.join(SOURCES_DIR, 'catechisms'),   { recursive: true });
  fs.mkdirSync(path.join(SOURCES_DIR, 'confessions'),  { recursive: true });

  let converted = 0;
  let failed = 0;

  for (const entry of SOURCES) {
    const inputPath  = path.join(CREEDS_DIR, entry.in);
    const outputPath = path.join(SOURCES_DIR, entry.out);

    try {
      const result = convertCreedsJson(inputPath, entry.traditions);
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
      const tradStr = entry.traditions.length > 0 ? entry.traditions.join(', ') : 'none';
      console.log(`  ✓ ${entry.out}  [${tradStr}]`);
      converted++;
    } catch (err: any) {
      console.error(`  ✗ ${entry.in}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${converted} converted, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main();
