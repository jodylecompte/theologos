import { Router } from 'express';
import { prisma } from '../../../../libs/database/src/index';
import { applyTransform, type TransformName } from '../../../../libs/database/src/text-transforms';

const router = Router();

interface ApplyTransformRequest {
  transformName: TransformName;
  startWorkUnitId: string;
  endWorkUnitId: string;
  dryRun?: boolean;
}

interface ApplyTransformResponse {
  dryRun: boolean;
  affectedCount: number;
  affectedIds: string[];
  summary?: {
    updated: number;
    errors: number;
  };
}

/**
 * POST /api/transforms/books/:bookId/work-units/apply
 *
 * Apply a transform to a range of WorkUnits within a book
 */
router.post('/books/:bookId/work-units/apply', async (req, res) => {
  try {
    const { bookId } = req.params;
    const {
      transformName,
      startWorkUnitId,
      endWorkUnitId,
      dryRun = false,
    } = req.body as ApplyTransformRequest;

    // Validate inputs
    if (!transformName || !startWorkUnitId || !endWorkUnitId) {
      return res.status(400).json({
        error: 'Missing required fields: transformName, startWorkUnitId, endWorkUnitId'
      });
    }

    // Validate transform name
    const validTransforms: TransformName[] = [
      'promote-heading',
      'demote-heading',
      'mark-paragraph',
      'dehyphenate',
      'fix-drop-cap',
    ];

    if (!validTransforms.includes(transformName)) {
      return res.status(400).json({
        error: `Invalid transform name. Valid options: ${validTransforms.join(', ')}`
      });
    }

    // Get the start and end WorkUnits to determine range
    const [startUnit, endUnit] = await Promise.all([
      prisma.workUnit.findUnique({
        where: { id: startWorkUnitId },
        select: { workId: true, positionIndex: true },
      }),
      prisma.workUnit.findUnique({
        where: { id: endWorkUnitId },
        select: { workId: true, positionIndex: true },
      }),
    ]);

    if (!startUnit || !endUnit) {
      return res.status(404).json({ error: 'Start or end WorkUnit not found' });
    }

    // Verify both are in the same work (book)
    if (startUnit.workId !== endUnit.workId) {
      return res.status(400).json({
        error: 'Start and end WorkUnits must be in the same work'
      });
    }

    // Verify the work ID matches the route parameter (optional security check)
    // Note: bookId in route is actually workId in our schema
    if (startUnit.workId !== bookId) {
      return res.status(400).json({
        error: 'WorkUnits do not belong to the specified work'
      });
    }

    // Get all WorkUnits in the range
    const minPosition = Math.min(startUnit.positionIndex, endUnit.positionIndex);
    const maxPosition = Math.max(startUnit.positionIndex, endUnit.positionIndex);

    const workUnitsInRange = await prisma.workUnit.findMany({
      where: {
        workId: startUnit.workId,
        positionIndex: {
          gte: minPosition,
          lte: maxPosition,
        },
      },
      orderBy: {
        positionIndex: 'asc',
      },
      select: {
        id: true,
        contentText: true,
        editedText: true,
        status: true,
      },
    });

    const affectedIds = workUnitsInRange.map(u => u.id);

    // Dry run: just return what would be affected
    if (dryRun) {
      const response: ApplyTransformResponse = {
        dryRun: true,
        affectedCount: workUnitsInRange.length,
        affectedIds,
      };
      return res.json(response);
    }

    // Apply transform to each WorkUnit
    let updated = 0;
    let errors = 0;

    for (const workUnit of workUnitsInRange) {
      try {
        // Apply transform to the current text (editedText if present, else contentText)
        const currentText = workUnit.editedText || workUnit.contentText;
        const transformedText = applyTransform(transformName, currentText);

        // Update the WorkUnit with transformed text
        await prisma.workUnit.update({
          where: { id: workUnit.id },
          data: {
            editedText: transformedText,
            status: 'EDITED', // Mark as edited since we're applying a transform
          },
        });

        updated++;
      } catch (err) {
        console.error(`Error transforming WorkUnit ${workUnit.id}:`, err);
        errors++;
      }
    }

    const response: ApplyTransformResponse = {
      dryRun: false,
      affectedCount: workUnitsInRange.length,
      affectedIds,
      summary: {
        updated,
        errors,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error applying transform:', error);
    res.status(500).json({
      error: 'Failed to apply transform',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
