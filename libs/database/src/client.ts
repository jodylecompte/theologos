import { PrismaClient } from './__generated__';

/**
 * Singleton instance of PrismaClient for the database library.
 *
 * This ensures only one instance of the Prisma client exists throughout
 * the application lifecycle, preventing connection pool exhaustion.
 *
 * IMPORTANT: This should NEVER be imported in browser/frontend code.
 * Frontend apps should only import types from this package.
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  global.prisma = prisma;
}

/**
 * Gracefully disconnect from the database
 */
export async function disconnect() {
  await prisma.$disconnect();
}
