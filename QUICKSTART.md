# Quick Start - Bible Reader POC

## Running the Application

You need to run both the API and the frontend app:

### Terminal 1: Start the API

```bash
nx serve api
```

This starts the Express API on `http://localhost:3333`

### Terminal 2: Start the Frontend

```bash
nx serve theologos
```

This starts the Angular app (usually on `http://localhost:4200`)

## What You'll See

The Bible reader will automatically load **Genesis 1** from the WEB translation.

### Features

- **Chapter Display**: Shows all verses for the current chapter
- **Navigation**: Use "Previous" and "Next" buttons to navigate chapters
- **Clean Reading**: Simple, readable typography optimized for extended reading

## API Endpoint

The API exposes:

```
GET /api/bible/:translation/:book/:chapter
```

**Example**:
```bash
curl http://localhost:3333/api/bible/WEB/Genesis/1
```

**Response**:
```json
{
  "translation": {
    "abbreviation": "WEB",
    "name": "World English Bible"
  },
  "book": {
    "name": "Genesis",
    "testament": "OT"
  },
  "chapter": {
    "number": 1,
    "verseCount": 31
  },
  "verses": [
    {
      "number": 1,
      "text": "In the beginning, God created the heavens and the earth."
    },
    ...
  ]
}
```

## Next Steps

This POC demonstrates:
- ✅ Database integration working
- ✅ API serving Bible content
- ✅ Frontend consuming and displaying verses
- ✅ Basic navigation

Future enhancements:
- Book/chapter selector dropdown
- Cross-references
- Search functionality
- Multiple translation comparison
- Bookmarking
- Study notes
