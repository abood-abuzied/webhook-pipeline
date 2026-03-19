import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { Worker } from 'bullmq';
import { db } from '../db';
import { jobs, pipelines } from '../db/schema';

new Worker(
  'webhook-jobs',
  async (queueJob) => {
    const { jobId } = queueJob.data as { jobId: string };

    const jobRows = await db.select().from(jobs).where(eq(jobs.id, jobId));
    const job = jobRows[0];

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    await db
      .update(jobs)
      .set({ status: 'processing' })
      .where(eq(jobs.id, jobId));

    const pipelineRows = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, job.pipelineId));

    const pipeline = pipelineRows[0];

    if (!pipeline) {
      throw new Error(`Pipeline not found for job: ${jobId}`);
    }

    console.log('Processing job:', {
      jobId: job.id,
      pipelineId: pipeline.id,
      actionType: pipeline.actionType,
      payload: job.payload,
    });

    await db
      .update(jobs)
      .set({
        status: 'processed',
        processedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
    },
  }
);

console.log('Worker started');