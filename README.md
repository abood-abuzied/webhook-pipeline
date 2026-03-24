# Webhook-Driven Task Processing Pipeline

A scalable webhook processing system that receives webhooks, queues them for async processing, and delivers results to registered subscribers. Think of it as a simplified Zapier - receive an event, transform it, and forward to multiple destinations.

## 🎯 Overview

This service enables users to create **pipelines** that connect three core components:

1. **Source** — A unique webhook endpoint that accepts incoming events
2. **Processing Action** — A transformation applied to the incoming data
3. **Subscribers** — One or more destination URLs that receive the processed result

## ✨ Key Features

- **Async Processing** — Webhooks are immediately queued; no blocking operations
- **Scalable Job Queue** — BullMQ + Redis for reliable background job processing
- **Retry Logic** — Automatic retries with exponential backoff for failed deliveries
- **Delivery Tracking** — Full audit trail of delivery attempts and failures
- **Containerized** — Full Docker support with docker-compose for development
- **CI/CD Ready** — GitHub Actions workflow for automated testing and building
- **RESTful API** — Complete REST API for pipeline, job, and delivery management

## 🚀 Tech Stack

- **Runtime:** Node.js 20 with TypeScript
- **Framework:** Express.js 5
- **Database:** PostgreSQL 16 with Drizzle ORM
- **Job Queue:** BullMQ (Redis-backed)
- **Container:** Docker & Docker Compose
- **CI/CD:** GitHub Actions

## 📋 Processing Actions

The system supports three built-in transformation actions:

### 1. `add_timestamp`
Adds a `timestamp` field to the webhook payload with the current ISO 8601 datetime.

**Example:**
```json
// Input
{"user": "john", "action": "login"}

// Output
{"user": "john", "action": "login", "timestamp": "2024-03-21T10:30:00.000Z"}
```

### 2. `uppercase_keys`
Recursively converts all object keys to UPPERCASE.

**Example:**
```json
// Input
{"firstName": "John", "lastName": "Doe", "contact": {"email": "john@example.com"}}

// Output
{"FIRSTNAME": "John", "LASTNAME": "Doe", "CONTACT": {"EMAIL": "john@example.com"}}
```

### 3. `filter_required_field`
Filters the payload to include only specified required fields.

**Example:**
```json
// Input with requiredFields
{
  "id": "123",
  "name": "John",
  "email": "john@example.com",
  "password": "secret",
  "requiredFields": ["id", "name", "email"]
}

// Output
{
  "id": "123",
  "name": "John",
  "email": "john@example.com"
}
```

## 🏗️ Architecture

### Database Schema

```
pipelines
├── id (UUID)
├── name (string)
├── sourcePath (string, unique)
├── actionType (string)
└── createdAt (timestamp)

subscribers
├── id (UUID)
├── pipelineId (FK → pipelines)
├── url (string)
└── createdAt (timestamp)

jobs
├── id (UUID)
├── pipelineId (FK → pipelines)
├── payload (JSONB)
├── status (queued | processing | processed | failed)
├── createdAt (timestamp)
└── processedAt (timestamp)

deliveryAttempts
├── id (UUID)
├── jobId (FK → jobs)
├── subscriberUrl (string)
├── attemptNumber (integer)
├── status (delivered | failed)
├── responseStatus (integer)
├── errorMessage (string)
└── attemptedAt (timestamp)
```

### Processing Flow

```
┌─────────────────┐
│ Webhook Request │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Find Pipeline       │
│ (by sourcePath)     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Create Job Record   │
│ (status: queued)    │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Queue to Redis      │
│ (BullMQ)            │
└────────┬────────────┘
         │
    [Async]
         │
         ▼
┌──────────────────────┐
│ Worker Picks Up Job  │
│ (status: processing) │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Apply Action         │
│ (transform payload)  │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Deliver to Subscribers
│ (with retries)       │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Mark Job Complete    │
│ (status: processed)  │
└──────────────────────┘
```

## 📦 Installation & Setup

### Prerequisites

- Docker & Docker Compose (recommended)
- Node.js 20+ (for local development)
- PostgreSQL 16+ (if not using Docker)
- Redis 7+ (if not using Docker)

### Quick Start with Docker

```bash
# Clone the repository
git clone <repo>
cd webhook-pipeline

# Copy environment template
cp .env.example .env

# Start all services (API, Worker, PostgreSQL, Redis)
docker compose up --build

# Run migrations
docker compose exec api npm run drizzle:migrate

# API is now available at http://localhost:8000
```

### Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your PostgreSQL and Redis connection strings

# Run database migrations
npm run drizzle:migrate

# Terminal 1: Start API server
npm run dev

# Terminal 2: Start worker
npm run worker
```

## 🔌 API Documentation

### Health Check

```bash
GET /health
```

### Pipeline Management

#### Create a Pipeline

```bash
POST /pipelines
Content-Type: application/json

{
  "name": "User Signup Flow",
  "actionType": "add_timestamp",
  "subscribers": [
    "https://webhook.site/your-webhook-id",
    "https://example.com/webhook"
  ]
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "User Signup Flow",
  "sourcePath": "a1b2c3d4e5f6g7h8i9j0",
  "actionType": "add_timestamp",
  "createdAt": "2024-03-21T10:30:00.000Z",
  "subscribers": [
    {
      "id": "650e8400-e29b-41d4-a716-446655440001",
      "url": "https://webhook.site/your-webhook-id"
    },
    {
      "id": "650e8400-e29b-41d4-a716-446655440002",
      "url": "https://example.com/webhook"
    }
  ]
}
```

#### List Pipelines

```bash
GET /pipelines
```

#### Get Pipeline Details

```bash
GET /pipelines/:id
```

### Job Management

#### List All Jobs

```bash
GET /jobs
```

#### Get Job Details

```bash
GET /jobs/:id
```

**Response:**
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440000",
  "pipelineId": "550e8400-e29b-41d4-a716-446655440000",
  "payload": {"user": "john", "action": "login"},
  "status": "processed",
  "createdAt": "2024-03-21T10:30:00.000Z",
  "processedAt": "2024-03-21T10:30:05.000Z"
}
```

### Webhook Ingestion

#### Send Webhook

```bash
POST /webhooks/:sourcePath
Content-Type: application/json

{
  "userId": "12345",
  "event": "user.created",
  "email": "user@example.com"
}
```

**Response (202 Accepted):**
```json
{
  "message": "Webhook accepted and queued",
  "jobId": "750e8400-e29b-41d4-a716-446655440000",
  "pipelineId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Delivery Tracking

#### List All Delivery Attempts

```bash
GET /deliveries
```

#### Get Delivery History for a Job

```bash
GET /deliveries/job/:jobId
```

**Response:**
```json
[
  {
    "id": "850e8400-e29b-41d4-a716-446655440000",
    "jobId": "750e8400-e29b-41d4-a716-446655440000",
    "subscriberUrl": "https://webhook.site/abc123",
    "attemptNumber": 1,
    "status": "delivered",
    "responseStatus": 200,
    "errorMessage": null,
    "attemptedAt": "2024-03-21T10:30:05.000Z"
  },
  {
    "id": "850e8400-e29b-41d4-a716-446655440001",
    "jobId": "750e8400-e29b-41d4-a716-446655440000",
    "subscriberUrl": "https://example.com/webhook",
    "attemptNumber": 1,
    "status": "failed",
    "responseStatus": 500,
    "errorMessage": "Internal Server Error",
    "attemptedAt": "2024-03-21T10:30:06.000Z"
  }
]
```

#### Get Specific Delivery Attempt

```bash
GET /deliveries/:id
```

## 🧪 Testing the System

### Using cURL

```bash
# 1. Create a test pipeline
curl -X POST http://localhost:8000/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Pipeline",
    "actionType": "add_timestamp",
    "subscribers": ["https://webhook.site/your-unique-id"]
  }'

# Copy the sourcePath from response

# 2. Send a webhook
curl -X POST http://localhost:8000/webhooks/YOUR_SOURCE_PATH \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "value": 42}'

# 3. Check job status
curl http://localhost:8000/jobs/JOB_ID

# 4. Check delivery attempts
curl http://localhost:8000/deliveries/job/JOB_ID
```

### Using TypeScript/fetch

```typescript
// Create pipeline
const pipelineRes = await fetch('http://localhost:8000/pipelines', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Test',
    actionType: 'uppercase_keys',
    subscribers: ['https://webhook.site/abc123']
  })
});

const { sourcePath, id } = await pipelineRes.json();

// Send webhook
const webhookRes = await fetch(`http://localhost:8000/webhooks/${sourcePath}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'john', email: 'john@example.com' })
});

const { jobId } = await webhookRes.json();

// Poll job status
const jobRes = await fetch(`http://localhost:8000/jobs/${jobId}`);
const job = await jobRes.json();
console.log('Job status:', job.status);

// Get delivery details
const deliveryRes = await fetch(`http://localhost:8000/deliveries/job/${jobId}`);
const attempts = await deliveryRes.json();
console.log('Delivery attempts:', attempts);
```

## 🛠️ Development

### File Structure

```
src/
├── api/
│   └── routes/
│       ├── server.ts          # Express app setup
│       ├── pipelines.ts       # Pipeline CRUD endpoints
│       ├── jobs.ts            # Job query endpoints
│       └── deliveries.ts      # Delivery tracking endpoints
├── db/
│   ├── index.ts               # Database connection
│   └── schema.ts              # Drizzle ORM schema
├── queue/
│   └── index.ts               # BullMQ queue initialization
├── services/
│   ├── actions.ts             # Payload transformation logic
│   ├── delivery.ts            # Subscriber delivery & retries
│   └── pipeline.ts            # Pipeline helpers
└── worker/
    └── worker.ts              # BullMQ worker process
```

### NPM Scripts

```bash
npm run dev              # Start API server (ts-node-dev)
npm run worker           # Start worker process (ts-node-dev)
npm run build            # Compile TypeScript to dist/
npm run start            # Run compiled JavaScript (production)
npm run drizzle:generate # Generate new migrations
npm run drizzle:migrate  # Apply pending migrations
```

### Adding a New Action Type

1. Add the action function in [src/services/actions.ts](src/services/actions.ts):

```typescript
export function myNewAction(payload: unknown): ProcessedPayload {
  const now = new Date().toISOString();
  const processed = { /* your transformation */ };
  return {
    original: payload,
    processed,
    actionApplied: 'my_new_action',
    processedAt: now,
  };
}
```

2. Add to the type union: `export type ActionType = '...' | 'my_new_action'`

3. Add to the switch in `processPayload()` function

4. Update allowed actions in [src/api/routes/pipelines.ts](src/api/routes/pipelines.ts):

```typescript
const allowedActions = ['add_timestamp', 'uppercase_keys', 'filter_required_field', 'my_new_action'];
```

## 🔄 Retry & Delivery Strategy

- **Initial Delivery:** Immediate attempt to deliver to subscriber
- **Retry on Failure:** Up to 3 total attempts (1 initial + 2 retries)
- **Retry Delay:** 5 seconds between attempts
- **Failure Recording:** All failed attempts logged in `deliveryAttempts` table
- **Delivery Headers:** Includes `X-Webhook-Job-ID` header for tracking

This allows subscribers to be temporarily unavailable without losing events.

## 🚢 Deployment

### Docker Compose (Development/Single Server)

```bash
docker compose up --build
```

Auto-runs migrations via the compose configuration.

### Production Considerations

1. **Environment Variables:** Use `.env` file or secret management (AWS Secrets, Vault, etc.)
2. **Database Backups:** Configure PostgreSQL backups
3. **Redis Persistence:** Enable AOF or RDB snapshots
4. **Monitoring:** Add logging and metrics (DataDog, New Relic, etc.)
5. **Load Balancing:** Use Kubernetes or AWS ECS for scaling
6. **Rate Limiting:** Implement rate limits on webhook endpoints
7. **Authentication:** Add API key authentication for pipeline management

## 📊 Monitoring & Debugging

### Check Service Health

```bash
curl http://localhost:8000/health
```

### View Logs

```bash
# API logs
docker compose logs api

# Worker logs
docker compose logs worker

# Database logs
docker compose logs postgres

# Redis logs
docker compose logs redis
```

### Database Queries

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U postgres -d webhook_pipeline

# View pipelines
SELECT * FROM pipelines;

# View recent jobs
SELECT id, status, created_at FROM jobs ORDER BY created_at DESC LIMIT 10;

# View failed deliveries
SELECT * FROM delivery_attempts WHERE status = 'failed';
```

## 🔒 Security Considerations

- **Input Validation:** All endpoints validate JSON payloads
- **SQL Injection:** Protected via Drizzle ORM parameterized queries
- **CORS:** Configure as needed for production
- **Rate Limiting:** Recommended for production deployment
- **Webhook Signature Verification:** Can be added as stretch goal
- **API Authentication:** Recommended for pipeline creation/modification

## 🎯 Design Decisions

### Why BullMQ?
- Reliable job queue backed by Redis
- Built-in retry logic and error handling
- Excellent scaling characteristics
- Easy to monitor and manage

### Why Drizzle ORM?
- Type-safe SQL queries
- Minimal runtime overhead
- Excellent TypeScript support
- Easy migrations and schema management

### Async Processing
- Non-blocking webhook ingestion for better UX
- Separate worker process handles long-running operations
- Decoupled from HTTP request/response cycle

### Retry Logic
- Exponential backoff prevents overwhelming failing services
- Audit trail of all attempts for debugging
- Configurable retry count and delays

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please submit issues and pull requests.
