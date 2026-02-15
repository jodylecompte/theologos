import { Router } from 'express';
import { prisma } from '../../../../libs/database/src/index';

const router = Router();

// Map of work slugs to database titles
// This allows flexible URL slugs while maintaining database integrity
const WORK_SLUG_MAP: Record<string, string> = {
  'wsc': 'Westminster Shorter Catechism',
  'wcf': 'Westminster Confession of Faith',
  'heidelberg': 'Heidelberg Catechism',
  'apostles-creed': 'Apostles\' Creed',
  'nicene-creed': 'Nicene Creed',
  'the-loveliness-of-christ': 'THE LOVELINESS OF CHRIST',
  'when-i-don-t-desire-god': 'When I Don\'t Desire God',
  'when-i-dont-desire-god': 'When I Don\'t Desire God', // Alternative slug format
  // Add more as you import them
};

// Helper to create slug from title
function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper to get slug from title, checking map first
function getSlugForTitle(title: string): string {
  // Check if title is in the map
  for (const [slug, mappedTitle] of Object.entries(WORK_SLUG_MAP)) {
    if (mappedTitle === title) {
      return slug;
    }
  }
  // Otherwise generate a slug
  return titleToSlug(title);
}

/**
 * GET /api/works
 *
 * Returns all works in the library
 */
router.get('/', async (req, res) => {
  try {
    const works = await prisma.work.findMany({
      orderBy: {
        title: 'asc',
      },
    });

    const workItems = works.map(work => ({
      id: work.id,
      title: work.title,
      author: work.author,
      type: work.type,
      tradition: work.tradition,
      slug: getSlugForTitle(work.title),
    }));

    res.json({
      works: workItems,
      totalCount: workItems.length,
    });
  } catch (error) {
    console.error('Error fetching works:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/works/:slug
 *
 * Returns all units (questions, articles, etc.) for a theological work
 */
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const workTitle = WORK_SLUG_MAP[slug];

    if (!workTitle) {
      return res.status(404).json({
        error: `Work not found. Valid slugs: ${Object.keys(WORK_SLUG_MAP).join(', ')}`
      });
    }

    // Find the work
    const work = await prisma.work.findFirst({
      where: {
        title: workTitle,
      },
      include: {
        units: {
          where: {
            parentUnitId: null, // Only top-level units (chapters/questions)
          },
          orderBy: {
            positionIndex: 'asc',
          },
          include: {
            references: true,
            children: true, // Include child pages for books
          },
        },
      },
    });

    if (!work) {
      return res.status(404).json({
        error: `Work "${workTitle}" not found in database`
      });
    }

    // Map units to metadata
    const units = work.units.map((unit) => {
      let displayText: string;

      // For books, use title (contains "Preface: Title" or "Chapter 1: Title\nSubtitle")
      // For catechisms/creeds, parse from contentText
      if (work.type === 'book' && unit.title) {
        // Extract main title line (before any subtitle newline)
        displayText = unit.title.split('\n')[0];
      } else {
        // Parse unit text from contentText
        // Format varies: "Q. question\nA. answer" for catechisms, or just content for creeds
        const lines = unit.contentText.split('\n');
        const firstLine = lines[0] || unit.contentText;
        displayText = firstLine;
      }

      if (displayText.length > 150) {
        displayText = displayText.substring(0, 150) + '...';
      }

      // For books with pages, include the first page number
      let firstPage: number | undefined;
      if (work.type === 'book' && unit.children && unit.children.length > 0) {
        // Find the first page child (sorted by positionIndex)
        const firstChild = unit.children.reduce((min, child) =>
          child.positionIndex < min.positionIndex ? child : min
        );
        firstPage = firstChild.positionIndex;
      }

      return {
        number: unit.positionIndex,
        displayText,
        hasReferences: unit.references.length > 0,
        firstPage, // Include first page number for books
      };
    });

    // Calculate total pages (for books with page-level units)
    const totalPages = work.units.reduce((sum, unit) => sum + (unit.children?.length || 0), 0);

    res.json({
      slug,
      title: work.title,
      author: work.author,
      type: work.type,
      tradition: work.tradition,
      units, // Top-level units (chapters/questions)
      totalUnits: units.length,
      totalPages: totalPages > 0 ? totalPages : units.length, // Pages for books, units for catechisms
    });
  } catch (error) {
    console.error('Error fetching work:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/works/:slug/units/:unitNumber
 *
 * Returns a single unit with full details including proof texts/references
 */
router.get('/:slug/units/:unitNumber', async (req, res) => {
  try {
    const { slug, unitNumber: unitNumberStr } = req.params;
    const unitNumber = parseInt(unitNumberStr, 10);

    if (isNaN(unitNumber) || unitNumber < 1) {
      return res.status(400).json({ error: 'Invalid unit number (must be >= 1)' });
    }

    const workTitle = WORK_SLUG_MAP[slug];

    if (!workTitle) {
      return res.status(404).json({
        error: `Work not found. Valid slugs: ${Object.keys(WORK_SLUG_MAP).join(', ')}`
      });
    }

    // Find the work
    const work = await prisma.work.findFirst({
      where: {
        title: workTitle,
      },
    });

    if (!work) {
      return res.status(404).json({
        error: `Work "${workTitle}" not found in database`
      });
    }

    // Find the specific unit with all references and Bible text
    const unit = await prisma.workUnit.findFirst({
      where: {
        workId: work.id,
        positionIndex: unitNumber,
      },
      include: {
        references: {
          include: {
            bibleVerse: {
              include: {
                chapter: {
                  include: {
                    book: true,
                  },
                },
                textSegments: {
                  where: {
                    translation: {
                      abbreviation: 'WEB',
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!unit) {
      return res.status(404).json({ error: `Unit ${unitNumber} not found in ${workTitle}` });
    }

    // Parse content based on work type
    // For catechisms: "Q. question\nA. answer"
    // For creeds/confessions: might just be paragraph text
    const lines = unit.contentText.split('\n');
    const questionLine = lines.find(line => line.startsWith('Q.'));
    const answerLine = lines.find(line => line.startsWith('A.'));

    let primaryText = '';
    let secondaryText = '';

    if (questionLine && answerLine) {
      // Catechism format
      primaryText = questionLine.substring(2).trim();
      secondaryText = answerLine.substring(2).trim();
    } else {
      // Creed/confession format - just use the content
      primaryText = unit.contentText;
    }

    // Group references by proximity (consecutive verses in same chapter)
    interface ProofText {
      displayText: string;
      references: Array<{
        book: string;
        chapter: number;
        verse: number;
        text: string;
      }>;
    }

    const proofTexts: ProofText[] = [];
    const sortedRefs = unit.references.sort((a, b) => {
      return a.bibleVerse.canonicalOrderIndex - b.bibleVerse.canonicalOrderIndex;
    });

    let currentGroup: ProofText | null = null;

    for (const ref of sortedRefs) {
      const verse = ref.bibleVerse;
      const chapter = verse.chapter;
      const book = chapter.book;
      const verseText = verse.textSegments.map(seg => seg.contentText).join(' ');

      const refData = {
        book: book.canonicalName,
        chapter: chapter.chapterNumber,
        verse: verse.verseNumber,
        text: verseText,
      };

      // Check if this verse continues the current group
      if (currentGroup && currentGroup.references.length > 0) {
        const lastRef = currentGroup.references[currentGroup.references.length - 1];
        const sameChapter = lastRef.book === refData.book && lastRef.chapter === refData.chapter;
        const consecutive = sameChapter && lastRef.verse === refData.verse - 1;

        if (consecutive || sameChapter) {
          // Add to current group
          currentGroup.references.push(refData);
          // Update display text
          if (consecutive) {
            const firstRef = currentGroup.references[0];
            const lastVerse = currentGroup.references[currentGroup.references.length - 1].verse;
            currentGroup.displayText = `${firstRef.book} ${firstRef.chapter}:${firstRef.verse}${
              lastVerse > firstRef.verse ? `-${lastVerse}` : ''
            }`;
          } else {
            currentGroup.displayText = `${refData.book} ${refData.chapter}:${currentGroup.references
              .map(r => r.verse)
              .join(', ')}`;
          }
        } else {
          // Start new group
          currentGroup = {
            displayText: `${refData.book} ${refData.chapter}:${refData.verse}`,
            references: [refData],
          };
          proofTexts.push(currentGroup);
        }
      } else {
        // Start first group
        currentGroup = {
          displayText: `${refData.book} ${refData.chapter}:${refData.verse}`,
          references: [refData],
        };
        proofTexts.push(currentGroup);
      }
    }

    res.json({
      workSlug: slug,
      workTitle: work.title,
      number: unitNumber,
      primaryText,
      secondaryText,
      proofTexts,
    });
  } catch (error) {
    console.error('Error fetching work unit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/works/:slug/pages/:pageNumber
 *
 * Returns a single page with full details including references
 * For books with page-level granularity
 */
router.get('/:slug/pages/:pageNumber', async (req, res) => {
  try {
    const { slug, pageNumber: pageNumberStr } = req.params;
    const pageNumber = parseInt(pageNumberStr, 10);

    if (isNaN(pageNumber) || pageNumber < 1) {
      return res.status(400).json({ error: 'Invalid page number (must be >= 1)' });
    }

    const workTitle = WORK_SLUG_MAP[slug];

    if (!workTitle) {
      return res.status(404).json({
        error: `Work not found. Valid slugs: ${Object.keys(WORK_SLUG_MAP).join(', ')}`
      });
    }

    // Find the work
    const work = await prisma.work.findFirst({
      where: {
        title: workTitle,
      },
    });

    if (!work) {
      return res.status(404).json({
        error: `Work "${workTitle}" not found in database`
      });
    }

    // Find the specific page with all references and Bible text
    const page = await prisma.workUnit.findFirst({
      where: {
        workId: work.id,
        positionIndex: pageNumber,
        type: 'page', // Only get page-level units
      },
      include: {
        parentUnit: true, // Include chapter info
        references: {
          include: {
            bibleVerse: {
              include: {
                chapter: {
                  include: {
                    book: true,
                  },
                },
                textSegments: {
                  where: {
                    translation: {
                      abbreviation: 'WEB',
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!page) {
      return res.status(404).json({ error: `Page ${pageNumber} not found in ${workTitle}` });
    }

    // Group references by proximity
    interface ProofText {
      displayText: string;
      references: Array<{
        book: string;
        chapter: number;
        verse: number;
        text: string;
      }>;
    }

    const proofTexts: ProofText[] = [];
    const sortedRefs = page.references.sort((a, b) => {
      return a.bibleVerse.canonicalOrderIndex - b.bibleVerse.canonicalOrderIndex;
    });

    let currentGroup: ProofText | null = null;

    for (const ref of sortedRefs) {
      const verse = ref.bibleVerse;
      const chapter = verse.chapter;
      const book = chapter.book;
      const verseText = verse.textSegments.map(seg => seg.contentText).join(' ');

      const refData = {
        book: book.canonicalName,
        chapter: chapter.chapterNumber,
        verse: verse.verseNumber,
        text: verseText,
      };

      // Check if this verse continues the current group
      if (currentGroup && currentGroup.references.length > 0) {
        const lastRef = currentGroup.references[currentGroup.references.length - 1];
        const sameChapter = lastRef.book === refData.book && lastRef.chapter === refData.chapter;
        const consecutive = sameChapter && lastRef.verse === refData.verse - 1;

        if (consecutive || sameChapter) {
          currentGroup.references.push(refData);
          if (consecutive) {
            const firstRef = currentGroup.references[0];
            const lastVerse = currentGroup.references[currentGroup.references.length - 1].verse;
            currentGroup.displayText = `${firstRef.book} ${firstRef.chapter}:${firstRef.verse}${
              lastVerse > firstRef.verse ? `-${lastVerse}` : ''
            }`;
          } else {
            currentGroup.displayText = `${refData.book} ${refData.chapter}:${currentGroup.references
              .map(r => r.verse)
              .join(', ')}`;
          }
        } else {
          currentGroup = {
            displayText: `${refData.book} ${refData.chapter}:${refData.verse}`,
            references: [refData],
          };
          proofTexts.push(currentGroup);
        }
      } else {
        currentGroup = {
          displayText: `${refData.book} ${refData.chapter}:${refData.verse}`,
          references: [refData],
        };
        proofTexts.push(currentGroup);
      }
    }

    res.json({
      workSlug: slug,
      workTitle: work.title,
      pageNumber,
      chapterNumber: page.parentUnit?.positionIndex, // Chapter this page belongs to
      chapterTitle: page.parentUnit?.title,
      content: page.contentText,
      proofTexts,
    });
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
