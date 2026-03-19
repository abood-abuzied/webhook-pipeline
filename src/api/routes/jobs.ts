import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { jobs } from '../../db/schema';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const allJobs = await db.select().from(jobs);
    return res.json(allJobs);
  } catch (error) {
    console.error('List jobs error:', error);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const jobRows = await db.select().from(jobs).where(eq(jobs.id, id));
    const job = jobRows[0];

    if (!job) {
      return res.status(404).json({ error: 'job not found' });
    }

    return res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;