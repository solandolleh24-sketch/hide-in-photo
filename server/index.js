const express = require('express');
const cors = require('cors');
const challengesRouter = require('./routes/challenges');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/challenges', challengesRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

app.listen(PORT, () => {
  console.log(`hide-in-photo server listening on :${PORT}`);
});
