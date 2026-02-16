#!/usr/bin/env node
/**
 * Helper script to get Work and WorkUnit IDs for testing
 *
 * Usage:
 *   npx ts-node scripts/get-work-info.ts
 *   npx ts-node scripts/get-work-info.ts --work-id {WORK_ID}
 */

import { prisma, disconnect } from '../libs/database/src/index.js';

async function main() {
  const args = process.argv.slice(2);
  const workIdFlag = args.indexOf('--work-id');
  const specificWorkId = workIdFlag >= 0 ? args[workIdFlag + 1] : null;

  try {
    if (specificWorkId) {
      // Get details for a specific work
      const work = await prisma.work.findUnique({
        where: { id: specificWorkId },
        include: {
          units: {
            take: 10,
            orderBy: { positionIndex: 'asc' },
          },
        },
      });

      if (!work) {
        console.error(`❌ Work not found: ${specificWorkId}`);
        process.exit(1);
      }

      console.log('\n📖 Work Details:');
      console.log(`   ID: ${work.id}`);
      console.log(`   Title: ${work.title}`);
      console.log(`   Author: ${work.author || 'Unknown'}`);
      console.log(`   Type: ${work.type}`);
      console.log(`   PDF: ${work.pdfPath || 'None'}`);
      console.log(`   Total Units: ${work.units.length}+`);

      console.log('\n📄 First 10 WorkUnits:');
      work.units.forEach((unit, idx) => {
        const statusEmoji = unit.status === 'REVIEWED' ? '✅' : unit.status === 'EDITED' ? '✏️' : '⚙️';
        const flagEmoji = unit.flags.length > 0 ? '🚩' : '';
        console.log(`   ${idx + 1}. ${statusEmoji} ${flagEmoji} ${unit.title || '(No title)'}`);
        console.log(`      ID: ${unit.id}`);
        console.log(`      Position: ${unit.positionIndex} | PDF Page: ${unit.pdfPageNumber || 'N/A'}`);
        console.log(`      Status: ${unit.status} | Flags: ${unit.flags.join(', ') || 'None'}`);
        console.log(`      URL: http://localhost:4200/admin/books/${work.id}/work-units/${unit.id}/edit`);
        console.log('');
      });

      // Get status counts
      const statusCounts = await prisma.workUnit.groupBy({
        by: ['status'],
        where: { workId: work.id },
        _count: true,
      });

      console.log('\n📊 Status Summary:');
      statusCounts.forEach(s => {
        console.log(`   ${s.status}: ${s._count}`);
      });

      // Get flag counts
      const flaggedUnits = await prisma.workUnit.findMany({
        where: {
          workId: work.id,
          flags: { isEmpty: false },
        },
        select: { flags: true },
      });

      const flagCounts: Record<string, number> = {};
      flaggedUnits.forEach(unit => {
        unit.flags.forEach(flag => {
          flagCounts[flag] = (flagCounts[flag] || 0) + 1;
        });
      });

      if (Object.keys(flagCounts).length > 0) {
        console.log('\n🚩 Flag Summary:');
        Object.entries(flagCounts).forEach(([flag, count]) => {
          console.log(`   ${flag}: ${count}`);
        });
      }

    } else {
      // List all works
      const works = await prisma.work.findMany({
        include: {
          _count: {
            select: { units: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (works.length === 0) {
        console.log('\n📚 No works found in database.');
        console.log('\nImport a book first:');
        console.log('   nx run importer:import-book -- --metadata data/loveliness_2012-metadata.json');
        process.exit(0);
      }

      console.log('\n📚 Available Works:\n');
      works.forEach((work, idx) => {
        console.log(`${idx + 1}. "${work.title}" by ${work.author || 'Unknown'}`);
        console.log(`   ID: ${work.id}`);
        console.log(`   Type: ${work.type}`);
        console.log(`   Units: ${work._count.units}`);
        console.log(`   Created: ${work.createdAt.toISOString()}`);
        console.log('');
      });

      console.log('\nℹ️  Get details for a specific work:');
      console.log(`   tsx scripts/get-work-info.ts --work-id ${works[0].id}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await disconnect();
  }
}

main();
