# Quick Start: Testing Edit/Review Flow

Get up and running with the WorkUnit editor in 5 minutes.

## 1. Start Services

**Terminal 1 - API:**
```bash
nx serve api
```

**Terminal 2 - Frontend:**
```bash
nx serve theologos
```

## 2. Import a Book

**Terminal 3:**
```bash
# Import small book (~126KB, quick to test)
nx run importer:import-book -- --metadata data/loveliness_2012-metadata.json
```

Wait for completion message.

## 3. Get Editor URL

```bash
# List all works
npx ts-node scripts/get-work-info.ts

# Get details + first 10 WorkUnit URLs
npx ts-node scripts/get-work-info.ts --work-id {PASTE_WORK_ID_HERE}
```

Copy one of the editor URLs from the output.

## 4. Open Editor

Paste the URL in your browser:
```
http://localhost:4200/admin/books/{workId}/work-units/{workUnitId}/edit
```

## 5. Test Basic Workflow

1. ✅ Verify PDF displays on right side
2. ✅ Edit text in the left panel
3. ✅ Press **Ctrl+S** to save
4. ✅ See status change to EDITED (blue)
5. ✅ Press **Ctrl+Shift+R** to mark as reviewed
6. ✅ See status change to REVIEWED (green)
7. ✅ Click **Next** to navigate to next WorkUnit

## 6. Test Transformations

1. Select some text with a hyphen at line break
2. Press **Ctrl+D** to dehyphenate
3. Save with **Ctrl+S**
4. Check diff view to see changes

## Common URLs

- **Frontend**: http://localhost:4200
- **API**: http://localhost:3333
- **Prisma Studio**: Run `nx run database:prisma:studio`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Ctrl+S | Save |
| Ctrl+Shift+R | Mark reviewed |
| Ctrl+H | Promote heading |
| Ctrl+D | Dehyphenate |
| Escape | Back to list |

## Need More Info?

See full testing guide: `TESTING_EDIT_REVIEW.md`
