import 'dotenv/config';
import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { jobs, pipelines } from '../../db/schema';
import { webhookQueue } from '../../queue';
import pipelineRoutes from './pipelines';
import jobsRoutes from './jobs';
import deliveriesRoutes from './deliveries';

const app = express();
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    name: 'Webhook-Driven Task Processing Pipeline',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      health: 'GET /health',
      pipelines: 'GET/POST /pipelines',
      jobs: 'GET/POST /jobs',
      deliveries: 'GET /deliveries',
      webhooks: 'POST /webhooks/:sourcePath',
    },
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/pipelines', pipelineRoutes);
app.use('/jobs', jobsRoutes);
app.use('/deliveries', deliveriesRoutes);

app.post('/webhooks/:sourcePath', async (req, res) => {
  try {
    const { sourcePath } = req.params;

    // Validate sourcePath
    if (!sourcePath || typeof sourcePath !== 'string' || sourcePath.trim().length === 0) {
      return res.status(400).json({
        error: 'invalid sourcePath',
      });
    }

    // Validate payload is present
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'request body must be a JSON object',
      });
    }

    const pipelineRows = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.sourcePath, sourcePath));

    const pipeline = pipelineRows[0];

    if (!pipeline) {
      return res.status(404).json({
        error: 'pipeline not found',
      });
    }

    const insertedJobs = await db
      .insert(jobs)
      .values({
        pipelineId: pipeline.id,
        payload: req.body,
        status: 'queued',
      })
      .returning();

    const createdJob = insertedJobs[0];

    try {
      await webhookQueue.add('process-webhook', {
        jobId: createdJob.id,
      });
    } catch (queueError) {
      console.error('Failed to queue job:', queueError);
      return res.status(503).json({
        error: 'service unavailable - queue service failed',
      });
    }

    return res.status(202).json({
      message: 'Webhook accepted and queued',
      jobId: createdJob.id,
      pipelineId: pipeline.id,
    });
  } catch (error) {
    console.error('Webhook ingestion error:', error);
    return res.status(500).json({
      error: 'internal server error',
    });
  }
});

const port = Number(process.env.PORT || 8000);

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});