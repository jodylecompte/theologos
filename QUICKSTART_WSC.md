# WSC Import - Quick Start

## ✅ No CoffeeScript Installation Required!

The WSC data has been pre-extracted to JSON for you and is ready to import.

---

## 🚀 Three Simple Steps

### 1. Ensure Bible Data Exists

```bash
nx run importer:import:web
```

*(Skip if you've already imported the Bible)*

### 2. Import WSC

```bash
nx run importer:import:wsc -- --file ./data/wsc-questions.json
```

### 3. Done! 🎉

---

## 📊 What Gets Created

- **1 Work**: Westminster Shorter Catechism
- **107 WorkUnits**: Each question/answer pair
- **~450 References**: Proof texts linked to Bible verses

---

## 🔄 Re-import (if needed)

```bash
nx run importer:import:wsc -- --file ./data/wsc-questions.json --force
```

---

## 📁 Files Location

- **WSC Data**: `./data/wsc-questions.json` (ready to use)
- **Import Job**: `apps/importer/src/jobs/import-wsc.ts`
- **Reference Parser**: `apps/importer/src/utils/reference-parser.ts`

---

## 🔍 Verify Import

```sql
-- Count questions
SELECT COUNT(*) FROM "WorkUnit"
WHERE "workId" = (
  SELECT id FROM "Work"
  WHERE title = 'Westminster Shorter Catechism'
);
-- Should return: 107

-- Count proof text references
SELECT COUNT(*) FROM "Reference" r
JOIN "WorkUnit" u ON r."sourceUnitId" = u.id
WHERE u."workId" = (
  SELECT id FROM "Work"
  WHERE title = 'Westminster Shorter Catechism'
);
-- Should return: ~450
```

---

## 🆕 Re-download Latest WSC Data

If you need to re-download the source data:

```bash
./scripts/download-wsc.sh
```

This will:
1. Download the latest CoffeeScript source from GitHub
2. Extract it to JSON automatically (no CoffeeScript compiler needed)
3. Save to `./data/wsc-questions.json`

---

## 📚 Full Documentation

- **Comprehensive Guide**: `apps/importer/docs/WSC_IMPORT.md`
- **Implementation Details**: `WSC_IMPLEMENTATION_SUMMARY.md`

---

**Ready to import! The JSON file is already in `./data/wsc-questions.json`**
