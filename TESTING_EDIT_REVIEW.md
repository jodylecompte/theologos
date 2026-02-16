# Testing the Edit/Review Flow

This guide explains how to test the new WorkUnit editing and review system.

## Overview

The edit/review flow allows you to:
- Import theological books from PDFs
- Review auto-generated text for accuracy
- Apply text transformations (promote/demote headings, fix hyphenation, etc.)
- Flag suspicious content for review
- View PDFs side-by-side with extracted text
- Track status: AUTO → EDITED → REVIEWED

## Prerequisites

### 1. Database Setup

Ensure PostgreSQL is running and configured:

```bash
# Generate Prisma client
nx run database:prisma:generate

# Run all migrations
nx run database:prisma:migrate
```

### 2. Import Sample Data

You have two books ready to import:

**Option A: The Loveliness of Christ (small, ~126KB)**
```bash
nx run importer:import-book -- --metadata data/loveliness_2012-metadata.json
```

**Option B: When I Don't Desire God (larger, ~8.7MB)**
```bash
nx run importer:import-book -- --metadata data/when-i-dont-desire-god-piper-metadata.json
```

This will:
- Create a `Work` record for the book
- Extract text from each PDF page
- Create `WorkUnit` records for each chapter/section
- Auto-detect scripture references
- Set initial status to `AUTO`
- Compute quality flags (HEADING_SUSPECT, FOOTNOTE_SUSPECT, etc.)

### 3. Start Both Servers

**Terminal 1 - API Server:**
```bash
nx serve api
```
Runs on http://localhost:3333

**Terminal 2 - Angular Frontend:**
```bash
nx serve theologos
```
Runs on http://localhost:4200

## Testing the Workflow

### Step 1: Get the Work ID

After importing, you need the Work ID. Check in Prisma Studio:

```bash
nx run database:prisma:studio
```

Navigate to the `Work` table and copy the UUID of your imported book.

### Step 2: Navigate to a Work Unit

The editor URL pattern is:
```
http://localhost:4200/admin/books/{workId}/work-units/{workUnitId}/edit
```

**Finding a WorkUnit ID:**

Option 1 - Use the helper script (easiest):
```bash
# List all works
npx ts-node scripts/get-work-info.ts

# Get details for a specific work (includes URLs)
npx ts-node scripts/get-work-info.ts --work-id {WORK_ID}
```

Option 2 - Use Prisma Studio:
- Open the `WorkUnit` table
- Filter by `workId` (paste the Work ID)
- Copy any WorkUnit's `id`

Option 3 - Use the API directly:
```bash
curl "http://localhost:3333/api/work-units/books/{WORK_ID}?limit=10"
```

Option 3 - Build a work unit list UI (future enhancement)

### Step 3: Test the Editor UI

The WorkUnit Editor provides:

#### **Left Panel - Text Editor**
- **Auto Text** (read-only): Original PDF-extracted text
- **Edited Text** (editable): Your manual corrections
- **Diff View**: Shows changes between auto and edited text
- **Status Indicator**: AUTO (yellow) → EDITED (blue) → REVIEWED (green)
- **Review Flags**: Visual indicators for suspicious content

#### **Right Panel - PDF Viewer**
- Displays the source PDF page
- Synchronized with the WorkUnit's `pdfPageNumber`
- Helps verify text accuracy against source

#### **Navigation**
- **Escape**: Return to work list
- **Ctrl+S**: Save changes
- **Ctrl+Shift+R**: Mark as reviewed
- **Prev/Next buttons**: Navigate between WorkUnits
- Position indicator (e.g., "3 / 42")

### Step 4: Test Text Transformations

Select text in the editor and apply transformations:

1. **Promote Heading** (Ctrl+H)
   - Adds `#` prefix to make text a heading
   - Use case: Fixing missed section titles

2. **Demote Heading** (Ctrl+Shift+H)
   - Removes `#` prefix
   - Use case: Fixing false-positive headings

3. **Mark Paragraph** (Ctrl+P)
   - Adds `¶` symbol to mark paragraph break
   - Use case: Fixing incorrect paragraph detection

4. **Dehyphenate** (Ctrl+D)
   - Removes line-break hyphens
   - Example: "scrip-\nture" → "scripture"

5. **Fix Drop Cap** (Ctrl+Shift+D)
   - Fixes initial caps separated from words
   - Example: "T his is text" → "This is text"

**Batch Transformations:**
- Select multiple WorkUnits (future: build selection UI)
- Apply transformations to a range via API
- Preview changes with dry-run mode

### Step 5: Test Status Workflow

1. **AUTO** (Initial state)
   - Yellow indicator
   - Text is auto-generated from PDF
   - May have quality flags

2. **Mark as Edited**
   - Blue indicator
   - Happens automatically when you save `editedText`
   - Press Ctrl+S to save your changes

3. **Mark as Reviewed** (Ctrl+Shift+R)
   - Green indicator
   - Final approval that text is correct
   - Cannot be done without saving first

### Step 6: Test Review Flags

Flags are computed automatically:

- **HEADING_SUSPECT**: Possible heading formatting issues
- **FOOTNOTE_SUSPECT**: Possible footnote text not properly separated
- **METADATA_SUSPECT**: Possible page numbers, headers, footers in text

**View flagged units:**
```bash
# Get all units with HEADING_SUSPECT flag
curl "http://localhost:3333/api/work-units/books/{WORK_ID}?flag=HEADING_SUSPECT"
```

**Recompute flags for a book:**
```bash
curl -X POST "http://localhost:3333/api/flags/books/{WORK_ID}/work-units/recompute"
```

### Step 7: Test Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Escape | Return to work list |
| Ctrl+S | Save current edits |
| Ctrl+Shift+R | Mark as reviewed |
| Ctrl+H | Promote heading (selection) |
| Ctrl+Shift+H | Demote heading (selection) |
| Ctrl+P | Mark paragraph (selection) |
| Ctrl+D | Dehyphenate (selection) |
| Ctrl+Shift+D | Fix drop cap (selection) |
| Ctrl+Z | Undo (browser default) |
| Ctrl+Y | Redo (browser default) |

## API Testing

### Get WorkUnit Details
```bash
curl http://localhost:3333/api/work-units/{WORK_UNIT_ID}
```

Returns:
- Full WorkUnit data (contentText, editedText, status, flags)
- Work metadata (title, author)
- Navigation context (prev/next IDs, position, total)

### Update WorkUnit
```bash
curl -X PUT http://localhost:3333/api/work-units/{WORK_UNIT_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "editedText": "Corrected text here",
    "status": "EDITED"
  }'
```

### List WorkUnits with Filters
```bash
# Get all AUTO status units
curl "http://localhost:3333/api/work-units/books/{WORK_ID}?status=AUTO&limit=50"

# Get all flagged units
curl "http://localhost:3333/api/work-units/books/{WORK_ID}?flag=HEADING_SUSPECT"

# Get reviewed units
curl "http://localhost:3333/api/work-units/books/{WORK_ID}?status=REVIEWED"
```

### Apply Transform to Range
```bash
# Dry-run to preview changes
curl -X POST http://localhost:3333/api/transforms/apply \
  -H "Content-Type: application/json" \
  -d '{
    "workId": "{WORK_ID}",
    "transformName": "dehyphenate",
    "startPosition": 10,
    "endPosition": 20,
    "dryRun": true
  }'

# Actually apply the transform
curl -X POST http://localhost:3333/api/transforms/apply \
  -H "Content-Type: application/json" \
  -d '{
    "workId": "{WORK_ID}",
    "transformName": "dehyphenate",
    "startPosition": 10,
    "endPosition": 20,
    "dryRun": false
  }'
```

## Verification Checklist

- [ ] Book imports successfully with WorkUnits created
- [ ] Can navigate to editor URL
- [ ] PDF displays on the right side
- [ ] Can edit text in the editor
- [ ] Diff view shows changes correctly
- [ ] Save (Ctrl+S) persists changes
- [ ] Status updates from AUTO → EDITED → REVIEWED
- [ ] Text transformations work on selections
- [ ] Prev/Next navigation works
- [ ] Position counter is accurate (e.g., "5 / 42")
- [ ] Keyboard shortcuts work
- [ ] Flags display correctly
- [ ] Can filter by status and flags via API
- [ ] Batch transformations work via API

## Common Issues

### PDF Not Displaying
- Check that the `pdfPath` in the Work record is correct
- Verify PDF exists at the path
- Check API logs for errors
- Ensure PDF route is mounted: `app.use('/api/pdf', pdfRouter)`

### WorkUnit Has No pdfPageNumber
- Older imports may not have `pdfPageNumber` set
- Re-import the book with updated importer
- Or manually update via Prisma Studio

### Transformations Not Working
- Ensure frontend imports from `@org/database/browser` (not `@org/database`)
- Check that text is selected before applying transform
- Verify transform functions are pure (no Prisma dependencies)

### SSR Errors
- Already fixed: PDF.js uses dynamic import with platform check
- Already fixed: Database utilities use browser-safe entry point
- If you see `__dirname` errors, check for Prisma imports in frontend

## Next Steps

After basic testing works:

1. **Build WorkUnit List UI**
   - Browse all units for a book
   - Filter by status and flags
   - Quick navigation to editor

2. **Add Batch Selection**
   - Select multiple WorkUnits
   - Apply transformations to range
   - Bulk status updates

3. **Reference Highlighting**
   - Highlight detected scripture references
   - Link to verse viewer
   - Edit/verify reference accuracy

4. **Export Reviewed Text**
   - Export finalized text to Markdown
   - Preserve heading structure
   - Include scripture references

## Database Schema Reference

### WorkUnit Model
```prisma
model WorkUnit {
  id            String          @id @default(uuid())
  workId        String          // Parent Work
  type          String          // "chapter", "section", etc.
  positionIndex Int             // Sort order
  pdfPageNumber Int?            // Source PDF page
  title         String?         // Chapter/section title
  contentText   String          // Auto-extracted text
  editedText    String?         // Manual corrections
  status        WorkUnitStatus  // AUTO | EDITED | REVIEWED
  flags         String[]        // Quality flags
}
```

### Status Enum
```prisma
enum WorkUnitStatus {
  AUTO      // Auto-generated, needs review
  EDITED    // Manually corrected
  REVIEWED  // Final approval
}
```

### Flag Types
- `HEADING_SUSPECT`: Potential heading formatting issue
- `FOOTNOTE_SUSPECT`: Possible footnote text in main content
- `METADATA_SUSPECT`: Possible page numbers/headers/footers

## Support

If you encounter issues:
1. Check API logs in Terminal 1
2. Check browser console for frontend errors
3. Verify database state in Prisma Studio
4. Review migration history: `ls libs/database/prisma/migrations/`
