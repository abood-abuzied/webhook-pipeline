import axios, { AxiosError } from 'axios';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { deliveryAttempts, subscribers, jobs } from '../db/schema';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds

interface DeliveryResult {
  success: boolean;
  subscriberUrl: string;
  status?: number;
  error?: string;
  attemptNumber: number;
}

/**
 * Attempt to deliver processed payload to a subscriber URL
 */
async function attemptDelivery(
  subscriberUrl: string,
  payload: any,
  jobId: string,
  attemptNumber: number
): Promise<DeliveryResult> {
  try {
    const response = await axios.post(subscriberUrl, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Job-ID': jobId,
      },
    });

    // Record successful delivery attempt
    await db.insert(deliveryAttempts).values({
      jobId,
      subscriberUrl,
      attemptNumber,
      status: 'delivered',
      responseStatus: response.status,
    });

    return {
      success: true,
      subscriberUrl,
      status: response.status,
      attemptNumber,
    };
  } catch (error: any) {
    let errorMessage = 'Unknown error';
    let status: number | undefined;

    if (error instanceof AxiosError) {
      errorMessage = error.message + (error.response?.status ? ` (${error.response.status})` : '');
      status = error.response?.status;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Record failed delivery attempt
    await db.insert(deliveryAttempts).values({
      jobId,
      subscriberUrl,
      attemptNumber,
      status: 'failed',
      responseStatus: status || null,
      errorMessage,
    });

    return {
      success: false,
      subscriberUrl,
      status,
      error: errorMessage,
      attemptNumber,
    };
  }
}

/**
 * Deliver processed payload to all subscribers of a pipeline with retry logic
 */
export async function deliverToSubscribers(
  jobId: string,
  pipelineId: string,
  processedPayload: any
): Promise<void> {
  try {
    // Get all subscribers for this pipeline
    const subscriberList = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.pipelineId, pipelineId));

    if (subscriberList.length === 0) {
      console.log(`No subscribers found for pipeline ${pipelineId}`);
      return;
    }

    // Attempt delivery to each subscriber with retries
    for (const subscriber of subscriberList) {
      let lastResult: DeliveryResult | undefined;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(
          `Delivery attempt ${attempt}/${MAX_RETRIES} to ${subscriber.url} for job ${jobId}`
        );

        lastResult = await attemptDelivery(
          subscriber.url,
          processedPayload,
          jobId,
          attempt
        );

        if (lastResult.success) {
          console.log(`✓ Successfully delivered to ${subscriber.url}`);
          break;
        }

        // Don't retry on success; wait before next attempt
        if (attempt < MAX_RETRIES) {
          console.log(`Waiting ${RETRY_DELAY_MS}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }

      if (!lastResult?.success) {
        console.error(
          `✗ Failed to deliver to ${subscriber.url} after ${MAX_RETRIES} attempts`
        );
      }
    }
  } catch (error) {
    console.error('Error in deliverToSubscribers:', error);
    throw error;
  }
}

/**
 * Get delivery history for a job
 */
export async function getJobDeliveryHistory(jobId: string) {
  return await db
    .select()
    .from(deliveryAttempts)
    .where(eq(deliveryAttempts.jobId, jobId))
    .orderBy(deliveryAttempts.attemptedAt);
}
