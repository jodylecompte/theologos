/**
 * Prisma 7 Configuration
 *
 * This file provides the database URL for CLI operations like migrations.
 * The PrismaClient in client.ts also needs to be configured with the URL.
 */

import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
