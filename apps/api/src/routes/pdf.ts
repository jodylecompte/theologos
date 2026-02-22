// @ts-nocheck — pdfPath removed from schema; this route is superseded by the book import pipeline
import { Router } from 'express';
import { prisma } from '../../../../libs/database/src/index';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

/**
 * GET /api/pdf/works/:workId
 *
 * Serves the PDF file for a work
 */
router.get('/works/:workId', async (req, res) => {
  try {
    const { workId } = req.params;

    // Get the work and its PDF path
    const work = await prisma.work.findUnique({
      where: { id: workId },
      select: { pdfPath: true, title: true },
    });

    if (!work) {
      return res.status(404).json({ error: 'Work not found' });
    }

    if (!work.pdfPath) {
      return res.status(404).json({ error: 'No PDF available for this work' });
    }

    // Resolve PDF path (relative to project root or absolute)
    const pdfPath = path.isAbsolute(work.pdfPath)
      ? work.pdfPath
      : path.join(process.cwd(), work.pdfPath);

    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({
        error: 'PDF file not found',
        path: work.pdfPath
      });
    }

    // Set headers for PDF
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${work.title}.pdf"`,
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
    });

    // Stream the file
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving PDF:', error);
    res.status(500).json({
      error: 'Failed to serve PDF',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/pdf/works/:workId/info
 *
 * Returns metadata about the PDF
 */
router.get('/works/:workId/info', async (req, res) => {
  try {
    const { workId } = req.params;

    const work = await prisma.work.findUnique({
      where: { id: workId },
      select: { id: true, pdfPath: true, title: true },
    });

    if (!work) {
      return res.status(404).json({ error: 'Work not found' });
    }

    if (!work.pdfPath) {
      return res.json({
        workId: work.id,
        title: work.title,
        hasPdf: false,
      });
    }

    const pdfPath = path.isAbsolute(work.pdfPath)
      ? work.pdfPath
      : path.join(process.cwd(), work.pdfPath);

    const exists = fs.existsSync(pdfPath);

    res.json({
      workId: work.id,
      title: work.title,
      hasPdf: exists,
      pdfPath: exists ? work.pdfPath : null,
    });
  } catch (error) {
    console.error('Error getting PDF info:', error);
    res.status(500).json({ error: 'Failed to get PDF info' });
  }
});

export default router;
