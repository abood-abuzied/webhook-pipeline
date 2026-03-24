import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import { deliveryAttempts } from '../../db/schema';
import { getJobDeliveryHistory } from '../../services/delivery';

const router = Router();

/**
 * GET /deliveries - List all delivery attempts (with optional jobId filter)
 */
router.get('/', async (req, res) => {
  try {
    const { jobId, status, limit = '100', offset = '0' } = req.query;

    const limitNum = Math.min(Number(limit) || 100, 1000);
    const offsetNum = Math.max(Number(offset) || 0, 0);

    let conditions = [];

    if (jobId && typeof jobId === 'string') {
      // Validate UUID format
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
        return res.status(400).json({ error: 'invalid jobId format' });
      }
      conditions.push(eq(deliveryAttempts.jobId, jobId));
    }

    if (status && typeof status === 'string') {
      if (!['delivered', 'failed'].includes(status)) {
        return res.status(400).json({ error: 'status must be either "delivered" or "failed"' });
      }
      conditions.push(eq(deliveryAttempts.status, status));
    }

    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(deliveryAttempts.attemptedAt)
      .limit(limitNum)
      .offset(offsetNum);
    
    return res.json(attempts);
  } catch (error) {
    console.error('List deliveries error:', error);
    return res.status(500).json({ error: 'internal server error' });
  }
});

/**
 * GET /deliveries/job/:jobId - Get delivery history for a specific job
 */
router.get('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
      return res.status(400).json({ error: 'invalid jobId format' });
    }

    const attempts = await getJobDeliveryHistory(jobId);
    return res.json(attempts);
  } catch (error) {
    console.error('Get job delivery history error:', error);
    return res.status(500).json({ error: 'internal server error' });
  }
});

/**
 * GET /deliveries/:id - Get a specific delivery attempt
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'invalid delivery ID format' });
    }

    const attemptRows = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.id, id));

    const attempt = attemptRows[0];

    if (!attempt) {
      return res.status(404).json({ error: 'delivery attempt not found' });
    }

    return res.json(attempt);
  } catch (error) {
    console.error('Get delivery attempt error:', error);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;

