import { Router } from 'express';
import { prisma } from '../../../../libs/database/src/index';
import type { WorkUnitStatus } from '../../../../libs/database/src/__generated__';
import { WorkUnitType } from '../../../../libs/database/src/__generated__';
import type { Prisma } from '../../../../libs/database/src/__generated__';

const router = Router();

/**
 * GET /api/work-units/books/:bookId
 *
 * Get WorkUnits for a book with optional filtering
 * Query params:
 *   - status: AUTO | EDITED | REVIEWED
 *   - flag: HEADING_SUSPECT | FOOTNOTE_SUSPECT | METADATA_SUSPECT
 *   - type: chapter | page | section (default: page for books, all for others)
 *   - limit: number (default 50)
 *   - offset: number (default 0)
 */
router.get('/books/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { status, flag, type, limit = '50', offset = '0' } = req.query;

    // Build filter
    const where: Prisma.WorkUnitWhereInput = {
      workId: bookId,
    };

    if (status && typeof status === 'string') {
      where.status = status as WorkUnitStatus;
    }

    if (flag && typeof flag === 'string') {
      where.flags = {
        has: flag,
      };
    }

    const w = where as Record<string, unknown>;
    if (type && typeof type === 'string') {
      w.type = type;
    } else {
      // Default unit type depends on the work's type:
      //   book → paragraph  (exclude empty chapter container units)
      //   catechism/confession/anything else → question
      const work = await prisma.work.findUnique({
        where: { id: bookId },
        select: { type: true },
      });
      w.type = work?.type === 'book' ? WorkUnitType.paragraph : WorkUnitType.question;
    }

    // Parse pagination
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 200) {
      return res.status(400).json({ error: 'Invalid limit (must be 1-200)' });
    }

    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({ error: 'Invalid offset' });
    }

    // Get total count
    const total = await prisma.workUnit.count({ where });

    // Get WorkUnits
    const workUnits = await prisma.workUnit.findMany({
      where,
      select: {
        id: true,
        positionIndex: true,
        title: true,
        status: true,
        flags: true,
        updatedAt: true,
      },
      orderBy: {
        positionIndex: 'asc',
      },
      take: limitNum,
      skip: offsetNum,
    });

    res.json({
      workUnits,
      total,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + workUnits.length < total,
    });
  } catch (error) {
    console.error('Error fetching work units:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/work-units/:workUnitId
 *
 * Returns a single work unit with navigation context (prev/next IDs, position, total)
 */
router.get('/:workUnitId', async (req, res) => {
  try {
    const { workUnitId } = req.params;

    // Fetch the work unit
    const workUnit = await prisma.workUnit.findUnique({
      where: { id: workUnitId },
      include: {
        work: {
          select: {
            id: true,
            title: true,
            author: true,
            type: true,
          },
        },
      },
    });

    if (!workUnit) {
      return res.status(404).json({ error: 'Work unit not found' });
    }

    // Get total count of units (same workId and type for flat navigation)
    const totalUnits = await prisma.workUnit.count({
      where: {
        workId: workUnit.workId,
        type: workUnit.type, // Navigate within same type (pages with pages)
      },
    });

    // Find previous unit (highest positionIndex < current, same workId and type)
    const prevUnit = await prisma.workUnit.findFirst({
      where: {
        workId: workUnit.workId,
        type: workUnit.type,
        positionIndex: { lt: workUnit.positionIndex },
      },
      orderBy: {
        positionIndex: 'desc',
      },
      select: {
        id: true,
      },
    });

    // Find next unit (lowest positionIndex > current, same workId and type)
    const nextUnit = await prisma.workUnit.findFirst({
      where: {
        workId: workUnit.workId,
        type: workUnit.type,
        positionIndex: { gt: workUnit.positionIndex },
      },
      orderBy: {
        positionIndex: 'asc',
      },
      select: {
        id: true,
      },
    });

    // Calculate position (1-based index) - count units of same type with lower or equal position
    const position = await prisma.workUnit.count({
      where: {
        workId: workUnit.workId,
        type: workUnit.type,
        positionIndex: { lte: workUnit.positionIndex },
      },
    });

    res.json({
      workUnit: {
        id: workUnit.id,
        workId: workUnit.workId,
        type: workUnit.type,
        positionIndex: workUnit.positionIndex,
        title: workUnit.title,
        contentText: workUnit.contentText,
        editedText: workUnit.editedText,
        status: workUnit.status,
        flags: workUnit.flags,
        updatedAt: workUnit.updatedAt,
      },
      work: workUnit.work,
      navigation: {
        prevId: prevUnit?.id ?? null,
        nextId: nextUnit?.id ?? null,
        position,
        total: totalUnits,
      },
    });
  } catch (error) {
    console.error('Error fetching work unit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/work-units/:workUnitId
 *
 * Updates a work unit's editedText and/or status
 * Body: { editedText?: string, status?: "AUTO" | "EDITED" | "REVIEWED" }
 */
router.put('/:workUnitId', async (req, res) => {
  try {
    const { workUnitId } = req.params;
    const { editedText, status } = req.body;

    // Validate work unit exists
    const existing = await prisma.workUnit.findUnique({
      where: { id: workUnitId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Work unit not found' });
    }

    // Validate status if provided
    if (status !== undefined) {
      const validStatuses: WorkUnitStatus[] = ['AUTO', 'EDITED', 'REVIEWED'];
      if (!validStatuses.includes(status as WorkUnitStatus)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
      }
    }

    // Prepare update data
    const updateData: {
      editedText?: string | null;
      status?: WorkUnitStatus;
    } = {};

    // Handle editedText: empty string or null clears it
    if (editedText !== undefined) {
      updateData.editedText = editedText === '' ? null : editedText;
    }

    if (status !== undefined) {
      updateData.status = status as WorkUnitStatus;
    }

    // Update the work unit
    const updated = await prisma.workUnit.update({
      where: { id: workUnitId },
      data: updateData,
      select: {
        id: true,
        type: true,
        positionIndex: true,
        title: true,
        contentText: true,
        editedText: true,
        status: true,
        updatedAt: true,
      },
    });

    res.json({
      workUnit: updated,
    });
  } catch (error) {
    console.error('Error updating work unit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
