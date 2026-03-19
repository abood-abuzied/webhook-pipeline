import 'dotenv/config';
import { Worker } from 'bullmq';

new Worker(
  'webhook-jobs',
  async (job) => {
    console.log('Processing job:', job.data);
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'redis',
      port: Number(process.env.REDIS_PORT || 6379),
    },
  }
);

console.log('Worker started');