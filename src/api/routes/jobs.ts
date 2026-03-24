import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import { jobs, deliveryAttempts } from '../../db/schema';

const router = Router();

/**
 * GET /jobs - List all jobs
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;

    const limitNum = Math.min(Number(limit) || 50, 1000);
    const offsetNum = Math.max(Number(offset) || 0, 0);

    let conditions = [];

    if (status && typeof status === 'string') {
      conditions.push(eq(jobs.status, status));
    }

    const allJobs = await db
      .select()
      .from(jobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(jobs.createdAt)
      .limit(limitNum)
      .offset(offsetNum);
    
    return res.json(allJobs);
  } catch (error) {
    console.error('List jobs error:', error);
    return res.status(500).json({ error: 'internal server error' });
  }
});

/**
 * GET /jobs/:id - Get a specific job with delivery information
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'invalid job ID format' });
    }

    const jobRows = await db.select().from(jobs).where(eq(jobs.id, id));
    const job = jobRows[0];

    if (!job) {
      return res.status(404).json({ error: 'job not found' });
    }

    // Get delivery attempts for this job
    const deliveryInfoRows = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.jobId, id));

    return res.json({
      ...job,
      deliveries: deliveryInfoRows,
    });
  } catch (error) {
    console.error('Get job error:', error);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
