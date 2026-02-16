import { Router } from 'express';
import { prisma } from '../../../../libs/database/src/index';
import { computeFlags } from '../../../../libs/database/src/flag-detector';

const router = Router();

/**
 * POST /api/flags/books/:bookId/work-units/recompute
 *
 * Recompute flags for all WorkUnits in a book
 */
router.post('/books/:bookId/work-units/recompute', async (req, res) => {
  try {
    const { bookId } = req.params;

    // Verify the work exists
    const work = await prisma.work.findUnique({
      where: { id: bookId },
      select: { id: true, title: true },
    });

    if (!work) {
      return res.status(404).json({ error: 'Work not found' });
    }

    // Get all WorkUnits for this work
    const workUnits = await prisma.workUnit.findMany({
      where: { workId: bookId },
      select: {
        id: true,
        contentText: true,
        editedText: true,
      },
    });

    let processed = 0;
    let flagged = 0;

    // Compute flags for each WorkUnit
    for (const unit of workUnits) {
      const text = unit.editedText || unit.contentText;
      const { flags } = computeFlags(text);

      // Update the WorkUnit with computed flags
      await prisma.workUnit.update({
        where: { id: unit.id },
        data: { flags },
      });

      processed++;
      if (flags.length > 0) {
        flagged++;
      }
    }

    res.json({
      success: true,
      workId: bookId,
      workTitle: work.title,
      processed,
      flagged,
      unflagged: processed - flagged,
    });
  } catch (error) {
    console.error('Error recomputing flags:', error);
    res.status(500).json({
      error: 'Failed to recompute flags',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/flags/books/:bookId/work-units/stats
 *
 * Get statistics about flags in a book
 */
router.get('/books/:bookId/work-units/stats', async (req, res) => {
  try {
    const { bookId } = req.params;

    // Get counts by flag type
    const workUnits = await prisma.workUnit.findMany({
      where: { workId: bookId },
      select: { flags: true, status: true },
    });

    const stats = {
      total: workUnits.length,
      flagged: 0,
      unflagged: 0,
      byStatus: {
        AUTO: 0,
        EDITED: 0,
        REVIEWED: 0,
      } as Record<string, number>,
      byFlag: {
        HEADING_SUSPECT: 0,
        FOOTNOTE_SUSPECT: 0,
        METADATA_SUSPECT: 0,
      } as Record<string, number>,
    };

    for (const unit of workUnits) {
      if (unit.flags.length > 0) {
        stats.flagged++;
      } else {
        stats.unflagged++;
      }

      stats.byStatus[unit.status]++;

      for (const flag of unit.flags) {
        if (flag in stats.byFlag) {
          stats.byFlag[flag]++;
        }
      }
    }

    res.json(stats);
  } catch (error) {
    console.error('Error getting flag stats:', error);
    res.status(500).json({ error: 'Failed to get flag statistics' });
  }
});

export default router;
