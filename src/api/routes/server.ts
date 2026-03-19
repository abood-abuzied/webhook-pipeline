import 'dotenv/config';
import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { jobs, pipelines } from '../../db/schema';
import { webhookQueue } from '../../queue';
import pipelineRoutes from '.././routes/pipelines';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/pipelines', pipelineRoutes);

app.post('/webhooks/:sourcePath', async (req, res) => {
  try {
    const { sourcePath } = req.params;

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

    await webhookQueue.add('process-webhook', {
      jobId: createdJob.id,
    });

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