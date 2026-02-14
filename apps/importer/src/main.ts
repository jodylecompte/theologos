/**
 * Bible Importer Application
 *
 * Entry point for import jobs.
 * Individual jobs are executed via Nx targets.
 */

console.log('Bible Importer - Use Nx targets to run import jobs');
console.log('');
console.log('Import complete WEB Bible (all 66 books):');
console.log('  nx run importer:import:web');
console.log('');
console.log('Force re-import:');
console.log('  nx run importer:import:web:force');
