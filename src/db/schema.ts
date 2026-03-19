import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
} from 'drizzle-orm/pg-core';

export const pipelines = pgTable('pipelines', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  sourcePath: text('source_path').notNull().unique(),
  actionType: text('action_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const subscribers = pgTable('subscribers', {
  id: uuid('id').defaultRandom().primaryKey(),
  pipelineId: uuid('pipeline_id')
    .notNull()
    .references(() => pipelines.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  pipelineId: uuid('pipeline_id')
    .notNull()
    .references(() => pipelines.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('queued'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
});

export const deliveryAttempts = pgTable('delivery_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  subscriberUrl: text('subscriber_url').notNull(),
  attemptNumber: integer('attempt_number').notNull(),
  status: text('status').notNull(),
  responseStatus: integer('response_status'),
  errorMessage: text('error_message'),
  attemptedAt: timestamp('attempted_at').defaultNow().notNull(),
});