import { Router } from 'express';
import { db } from '../../db';
import { pipelines, subscribers } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateSourcePath } from '../../services/pipeline';

const router = Router();

const ALLOWED_ACTIONS = ['add_timestamp', 'uppercase_keys', 'filter_required_field'];

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /pipelines - Create a new pipeline
 */
router.post('/', async (req, res) => {
  try {
    const { name, actionType, subscribers: subscriberUrls } = req.body as {
      name?: string;
      actionType?: string;
      subscribers?: string[];
    };

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required and must be a non-empty string' });
    }

    if (!actionType || typeof actionType !== 'string') {
      return res.status(400).json({ error: 'actionType is required and must be a string' });
    }

    if (!ALLOWED_ACTIONS.includes(actionType)) {
      return res.status(400).json({
        error: `invalid actionType. Allowed values: ${ALLOWED_ACTIONS.join(', ')}`,
      });
    }

    if (subscriberUrls !== undefined) {
      if (!Array.isArray(subscriberUrls)) {
        return res.status(400).json({ error: 'subscribers must be an array' });
      }

      for (const url of subscriberUrls) {
        if (typeof url !== 'string' || !isValidUrl(url)) {
          return res.status(400).json({ error: `invalid subscriber URL: ${url}` });
        }
      }
    }

    const sourcePath = generateSourcePath();

    const insertedPipelines = await db
      .insert(pipelines)
      .values({
        name: name.trim(),
        actionType,
        sourcePath,
      })
      .returning();

    const pipeline = insertedPipelines[0];

    let createdSubscribers: Array<{ id: string; url: string }> = [];

    if (Array.isArray(subscriberUrls) && subscriberUrls.length > 0) {
      const insertedSubscribers = await db
        .insert(subscribers)
        .values(
          subscriberUrls.map((url) => ({
            pipelineId: pipeline.id,
            url,
          }))
        )
        .returning();

      createdSubscribers = insertedSubscribers.map((s) => ({
        id: s.id,
        url: s.url,
      }));
    }

    return res.status(201).json({
      ...pipeline,
      subscribers: createdSubscribers,
    });
  } catch (error) {
    console.error('Create pipeline error:', error);
    return res.status(500).json({ error: 'internal server error' });
  }
});

/**
 * GET /pipelines - List all pipelines
 */
router.get('/', async (_req, res) => {
  try {
    const allPipelines = await db.select().from(pipelines);
    return res.json(allPipelines);
  } catch (error) {
    console.error('List pipelines error:', error);
    return res.status(500).json({ error: 'internal server error' });
  }
});

/**
 * GET /pipelines/:id - Get a specific pipeline with subscribers
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'invalid pipeline ID format' });
    }

    const pipelineRows = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, id));

    const pipeline = pipelineRows[0];

    if (!pipeline) {
      return res.status(404).json({ error: 'pipeline not found' });
    }

    const pipelineSubscribers = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.pipelineId, id));

    return res.json({
      ...pipeline,
      subscribers: pipelineSubscribers,
    });
  } catch (error) {
    console.error('Get pipeline error:', error);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;