import { prisma, disconnect } from '../../../../libs/database/src/index';

async function checkWorks() {
  const works = await prisma.work.findMany({
    orderBy: { title: 'asc' }
  });

  console.log('\nWorks in database:');
  console.log('==================');
  works.forEach(work => {
    console.log(`${work.title} - Type: ${work.type}`);
  });
  console.log('');

  await disconnect();
}

checkWorks().catch(console.error);
