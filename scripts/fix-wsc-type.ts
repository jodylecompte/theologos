import { prisma, disconnect } from '../libs/database/src/index';

async function fixWSC() {
  console.log('Updating Westminster Shorter Catechism type to catechism...');

  const result = await prisma.work.updateMany({
    where: {
      title: 'Westminster Shorter Catechism'
    },
    data: {
      type: 'catechism'
    }
  });

  console.log('✓ Updated', result.count, 'record(s)');
  console.log('✓ Westminster Shorter Catechism is now labeled as catechism');

  await disconnect();
}

fixWSC().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
