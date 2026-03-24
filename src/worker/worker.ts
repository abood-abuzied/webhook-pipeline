import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { Worker } from 'bullmq';
import { db } from '../db';
import { jobs, pipelines } from '../db/schema';
import { processPayload } from '../services/actions';
import { deliverToSubscribers } from '../services/delivery';

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

    try {
      // Process the payload using the specified action
      const processedPayload = processPayload(job.payload, pipeline.actionType as any);

      console.log('Payload processed:', {
        actionType: pipeline.actionType,
        processed: processedPayload.processed,
      });

      // Deliver to all subscribers
      await deliverToSubscribers(job.id, pipeline.id, processedPayload);

      // Mark job as processed
      await db
        .update(jobs)
        .set({
          status: 'processed',
          processedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      console.log(`✓ Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`✗ Error processing job ${jobId}:`, error);

      // Mark job as failed
      await db
        .update(jobs)
        .set({
          status: 'failed',
          processedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
    },
  }
);

console.log('Worker started');
