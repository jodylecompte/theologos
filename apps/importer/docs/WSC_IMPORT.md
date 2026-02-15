# Westminster Shorter Catechism Import Guide

This guide explains how to import the Westminster Shorter Catechism (WSC) into the theological study system.

## Overview

The WSC importer:
- Loads catechism data from CoffeeScript or JSON source files
- Creates a `Work` entry for the Westminster Shorter Catechism
- Creates `WorkUnit` entries for each of the 107 questions
- Parses proof text references
- Links proof texts to canonical `BibleVerse` entries via `Reference` rows
- Is idempotent and supports force re-import

## Prerequisites

### 1. Database Must Have Bible Data

The canonical Bible structure (books, chapters, verses) must already exist in your database.

Run the WEB Bible import first if you haven't:

```bash
nx run importer:import:web
```

### 2. Install CoffeeScript Compiler

The WSC source file is in CoffeeScript format. Install the compiler:

```bash
npm install --save-dev coffeescript
```

Or if you prefer yarn:

```bash
yarn add -D coffeescript
```

## Getting the WSC Source File

### Option 1: Download from GitHub

Download the CoffeeScript source directly:

```bash
curl -o wsc-questions.coffee https://raw.githubusercontent.com/ReformedDevs/hubot-wsc/refs/heads/master/lib/questions.coffee
```

### Option 2: Use Local JSON

If you prefer to work with JSON, you can compile the CoffeeScript file first:

```bash
# Download the CoffeeScript file
curl -o wsc-questions.coffee https://raw.githubusercontent.com/ReformedDevs/hubot-wsc/refs/heads/master/lib/questions.coffee

# Create a Node script to extract the data
cat > extract-wsc.js << 'EOF'
const coffee = require('coffeescript');
const fs = require('fs');

const source = fs.readFileSync('wsc-questions.coffee', 'utf-8');
const compiled = coffee.compile(source, { bare: true });

const moduleContext = { exports: {} };
const fn = new Function('module', 'exports', 'require', compiled);
fn(moduleContext, moduleContext.exports, require);

const data = moduleContext.exports({});
fs.writeFileSync('wsc-questions.json', JSON.stringify(data, null, 2));
console.log('Extracted', data.length, 'questions to wsc-questions.json');
EOF

# Run the extraction
node extract-wsc.js

# Clean up
rm extract-wsc.js wsc-questions.coffee
```

## Running the Import

### Basic Import

```bash
nx run importer:import:wsc -- --file /path/to/wsc-questions.coffee
```

Or with JSON:

```bash
nx run importer:import:wsc -- --file /path/to/wsc-questions.json
```

### Force Re-Import

If you've already imported the WSC and want to re-import (this will delete existing units and references):

```bash
nx run importer:import:wsc -- --file /path/to/wsc-questions.coffee --force
```

## Expected Output

```
ℹ [import-wsc] Starting Westminster Shorter Catechism import
ℹ [import-wsc] Options: { file: '...', force: false }
ℹ [import-wsc] --- Loading WSC data ---
ℹ [import-wsc] Loading WSC data from: /path/to/wsc-questions.coffee
✓ [import-wsc] Loaded 107 questions from CoffeeScript file
ℹ [import-wsc] --- Ensuring Work entry ---
✓ [import-wsc] Created work: Westminster Shorter Catechism
ℹ [import-wsc] --- Importing questions ---
ℹ [import-wsc] Progress: 10/107 questions
ℹ [import-wsc] Progress: 20/107 questions
...
ℹ [import-wsc] --- Import Complete ---
✓ [import-wsc] Summary: {
  work: 'Westminster Shorter Catechism',
  questionsImported: 107,
  referencesLinked: 450,
  unresolvedReferences: 5
}
```

## Data Structure Created

### Work Entry

```
title: "Westminster Shorter Catechism"
author: "Westminster Assembly"
type: "confession"
tradition: "Reformed"
```

### WorkUnit Entries (107 total)

Each question becomes a WorkUnit:

```
type: "question"
positionIndex: 1 (question number)
title: "Q. 1"
contentText: "Q. What is the chief end of man?\n\nA. Man's chief end is to glorify God..."
```

### Reference Entries

Each proof text reference is parsed and linked:

- Romans 8:28 → Creates Reference linking WorkUnit to BibleVerse
- Romans 8:28-30 → Expands range, creates 3 Reference entries (verses 28, 29, 30)
- Multiple references separated by semicolons are all parsed and linked

## Proof Text Parsing

The reference parser supports:

| Format | Example | Result |
|--------|---------|--------|
| Single verse | Romans 8:28 | Links to Romans 8:28 |
| Verse range | Romans 8:28-30 | Links to Romans 8:28, 8:29, 8:30 |
| Multiple verses | Romans 8:28, 30 | Links to Romans 8:28, 8:30 |
| Multiple refs | Romans 8:28; 1 Cor 13:4 | Links to both verses |

### Book Name Normalization

The parser handles common abbreviations:

- "Rom" → Romans
- "1 Cor" → 1 Corinthians
- "Ps" → Psalms
- And 100+ other variations

See `apps/importer/src/utils/reference-parser.ts` for the full list.

## Troubleshooting

### Error: "CoffeeScript compiler not found"

Install the CoffeeScript package:

```bash
npm install --save-dev coffeescript
```

### Error: "File not found"

Ensure the path to the WSC file is correct and the file exists:

```bash
ls -la /path/to/wsc-questions.coffee
```

### Warning: "Unresolved references"

Some proof texts may not resolve to canonical verses if:

1. The Bible book/chapter/verse doesn't exist in your database
2. The reference format is non-standard
3. The reference is to an apocryphal book (not in Protestant canon)

These are logged but don't stop the import. Check logs for details.

### Error: "Work already exists"

The WSC has already been imported. Use `--force` to re-import:

```bash
nx run importer:import:wsc -- --file /path/to/wsc-questions.coffee --force
```

## File Locations

- **Import Job**: `apps/importer/src/jobs/import-wsc.ts`
- **Reference Parser**: `apps/importer/src/utils/reference-parser.ts`
- **Nx Target**: `apps/importer/project.json` (see `import:wsc` target)
- **This Guide**: `apps/importer/docs/WSC_IMPORT.md`

## Database Schema

The import uses these Prisma models:

- `Work` - The catechism itself
- `WorkUnit` - Each question/answer
- `Reference` - Links from questions to Bible verses
- `BibleVerse` - Canonical verse entries (must exist before import)
- `BibleChapter` - Canonical chapter entries
- `BibleBook` - Canonical book entries

## Advanced Usage

### Custom Source Files

You can create your own JSON file with the same structure:

```json
[
  {
    "number": 1,
    "question": "What is the chief end of man?",
    "answer": "Man's chief end is to glorify God...",
    "proofTexts": {
      "1": ["Romans 11:36"],
      "2": ["1 Corinthians 10:31"]
    }
  }
]
```

### Extending the Parser

To add support for additional book name variations, edit:

```
apps/importer/src/utils/reference-parser.ts
```

Add entries to the `BOOK_NAME_ALIASES` map.

## Next Steps

After importing the WSC:

1. Verify import in database:
   ```sql
   SELECT * FROM "Work" WHERE title = 'Westminster Shorter Catechism';
   SELECT COUNT(*) FROM "WorkUnit" WHERE "workId" = '<work-id>';
   SELECT COUNT(*) FROM "Reference" r
   JOIN "WorkUnit" u ON r."sourceUnitId" = u.id
   WHERE u."workId" = '<work-id>';
   ```

2. Build frontend features to display the catechism
3. Create cross-reference views showing which questions cite which verses
4. Import other Reformed confessions (Westminster Larger Catechism, Heidelberg, etc.)
