/**
 * Database Seed
 *
 * Seeds the canonical Tradition records.
 * Traditions are a curated, finite list — not auto-created during import.
 * Adding a new tradition requires a deliberate change here.
 *
 * Run via: nx run database:prisma:seed
 */

import { prisma } from '../src/client';

const TRADITIONS = [
  // Top-level traditions (no parent)
  { slug: 'ecumenical',      name: 'Ecumenical',      parentSlug: null },
  { slug: 'reformed',        name: 'Reformed',        parentSlug: null },
  { slug: 'lutheran',        name: 'Lutheran',        parentSlug: null },
  { slug: 'anglican',        name: 'Anglican',        parentSlug: null },
  { slug: 'baptist',         name: 'Baptist',         parentSlug: null },
  { slug: 'roman-catholic',  name: 'Roman Catholic',  parentSlug: null },
  { slug: 'eastern-orthodox', name: 'Eastern Orthodox', parentSlug: null },
  { slug: 'wesleyan',        name: 'Wesleyan',        parentSlug: null },

  // Children (must come after their parents in this list)
  { slug: 'presbyterian',    name: 'Presbyterian',    parentSlug: 'reformed' },
  { slug: 'methodist',       name: 'Methodist',       parentSlug: 'wesleyan' },
];

async function main() {
  console.log('Seeding traditions...');

  for (const t of TRADITIONS) {
    let parentId: string | null = null;

    if (t.parentSlug) {
      const parent = await prisma.tradition.findUnique({ where: { slug: t.parentSlug } });
      if (!parent) throw new Error(`Parent tradition not found: "${t.parentSlug}"`);
      parentId = parent.id;
    }

    await prisma.tradition.upsert({
      where: { slug: t.slug },
      update: { name: t.name, parentId },
      create: { slug: t.slug, name: t.name, parentId },
    });

    console.log(`  ✓ ${t.name}${t.parentSlug ? ` (parent: ${t.parentSlug})` : ''}`);
  }

  console.log(`\nSeeded ${TRADITIONS.length} traditions.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
