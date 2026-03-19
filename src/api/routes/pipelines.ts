import { Router } from 'express';
import { db } from '../../db';
import { pipelines, subscribers } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateSourcePath } from '../../services/pipeline';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { name, actionType, subscribers: subscriberUrls } = req.body as {
      name?: string;
      actionType?: string;
      subscribers?: string[];
    };

    if (!name || !actionType) {
      return res.status(400).json({ error: 'name and actionType are required' });
    }

    const allowedActions = ['add_timestamp', 'uppercase_keys', 'filter_required_field'];
    if (!allowedActions.includes(actionType)) {
      return res.status(400).json({ error: 'invalid actionType' });
    }

    const sourcePath = generateSourcePath();

    const insertedPipelines = await db
      .insert(pipelines)
      .values({
        name,
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

router.get('/', async (_req, res) => {
  try {
    const allPipelines = await db.select().from(pipelines);
    return res.json(allPipelines);
  } catch (error) {
    console.error('List pipelines error:', error);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

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

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, actionType } = req.body as {
      name?: string;
      actionType?: string;
    };

    const existing = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, id));

    if (!existing[0]) {
      return res.status(404).json({ error: 'pipeline not found' });
    }

    const updated = await db
      .update(pipelines)
      .set({
        ...(name ? { name } : {}),
        ...(actionType ? { actionType } : {}),
      })
      .where(eq(pipelines.id, id))
      .returning();

    return res.json(updated[0]);
  } catch (error) {
    console.error('Update pipeline error:', error);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await db
      .delete(pipelines)
      .where(eq(pipelines.id, id))
      .returning();

    if (!deleted[0]) {
      return res.status(404).json({ error: 'pipeline not found' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Delete pipeline error:', error);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;