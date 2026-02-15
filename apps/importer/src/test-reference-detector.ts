/**
 * Test script for reference detection
 *
 * Usage: nx run importer:test-refs
 */

import { detectReferences, detectAndResolve } from './utils/reference-parser';

// Sample book text with various reference formats
const sampleText = `
As we see in Romans 8:28 and all things work together for good.
The Apostle Paul writes in 1 Corinthians 13:4-7 about love.
John tells us (see 1 John 3:16) that we should love one another.
Compare this with 1st Corinthians 13:13 and 2 Cor 5:17-21.
The Psalms (Ps. 23:1-6) remind us that the Lord is our shepherd.
We read in Matt. 5:3-12 the Beatitudes.
See also Rom. 12:1-2; Phil 4:8; Col. 3:1-3 for more context.
`;

async function testDetection() {
  console.log('Testing Reference Detection\n');
  console.log('Sample text:');
  console.log(sampleText);
  console.log('\n' + '='.repeat(70) + '\n');

  // Test detection only
  const detected = detectReferences(sampleText);
  console.log(`Detected ${detected.length} references:\n`);
  detected.forEach((ref, i) => {
    console.log(`  ${i + 1}. ${ref}`);
  });

  console.log('\n' + '='.repeat(70) + '\n');

  // Test detection + resolution
  console.log('Resolving references to database...\n');
  const result = await detectAndResolve(sampleText);

  console.log(`Total detected: ${result.detectedCount}`);
  console.log(`Successfully resolved: ${result.resolved.length}`);
  console.log(`Failed to resolve: ${result.unresolved.length}`);

  if (result.unresolved.length > 0) {
    console.log('\nUnresolved references:');
    result.unresolved.forEach(ref => console.log(`  - ${ref}`));
  }

  console.log('\nResolved references (first 5):');
  result.resolved.slice(0, 5).forEach(ref => {
    console.log(`  - ${ref.bookName} ${ref.chapter}:${ref.verse} → ${ref.verseId}`);
  });
}

testDetection()
  .then(() => {
    console.log('\n✓ Test complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
