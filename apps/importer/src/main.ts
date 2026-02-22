/**
 * Theologos Importer
 *
 * Use Nx targets to run import jobs.
 *
 * ─── Primary import (all work types) ─────────────────────────────────────
 *
 *   nx run importer:import -- --file sources/<file>.json [--tradition <name>] [--force]
 *
 *   The source file must have metadata.type set to one of:
 *     creed | catechism | confession | book
 *
 * ─── Bible (WEB translation) ──────────────────────────────────────────────
 *
 *   nx run importer:import:web
 *   nx run importer:import:web:force
 *
 * ─── Tooling (PDF pipeline) ───────────────────────────────────────────────
 *
 *   nx run importer:book:extract  -- --pdf <path> --out extracted/<name>.json
 *   nx run importer:book:normalize -- --in extracted/<name>.json --out sources/<name>.json
 */

console.log('Theologos Importer — use Nx targets listed in main.ts');
