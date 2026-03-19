import 'dotenv/config';
import express from 'express';
import { webhookQueue } from '../../queue';
const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/webhooks/:sourcePath', async (req, res) => {
  const { sourcePath } = req.params;

  await webhookQueue.add('process-webhook', {
    sourcePath,
    payload: req.body,
  });

  res.status(202).json({
    message: 'Webhook accepted and queued',
  });
});

const port = Number(process.env.PORT || 8000);

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});