import { Queue } from 'bullmq';

export const webhookQueue = new Queue('webhook-jobs', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
  },
});