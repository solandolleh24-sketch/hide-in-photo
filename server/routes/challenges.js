const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');

const router = express.Router();

const MAX_TIME_LIMIT = 300;
const MIN_TIME_LIMIT = 15;

function toChallengeView(row, { includeManageFields = false } = {}) {
  const view = {
    id: row.id,
    title: row.title,
    compositeImage: row.composite_image,
    characterCount: row.character_count,
    hitRegions: JSON.parse(row.hit_regions),
    timeLimitSeconds: row.time_limit_seconds,
    hintAfterMisses: row.hint_after_misses,
    active: !!row.active,
    playCount: row.play_count,
    createdAt: row.created_at,
  };
  if (!includeManageFields) {
    // gameplay view still needs hitRegions client-side for touch detection
  }
  return view;
}

router.post('/', (req, res) => {
  const { title, compositeImage, hitRegions, timeLimitSeconds, hintAfterMisses } = req.body || {};

  if (!compositeImage || typeof compositeImage !== 'string') {
    return res.status(400).json({ error: 'compositeImage is required' });
  }
  if (!Array.isArray(hitRegions) || hitRegions.length === 0) {
    return res.status(400).json({ error: 'hitRegions must be a non-empty array' });
  }
  for (const r of hitRegions) {
    if (
      typeof r.x !== 'number' || typeof r.y !== 'number' ||
      typeof r.rx !== 'number' || typeof r.ry !== 'number'
    ) {
      return res.status(400).json({ error: 'each hit region needs numeric x, y, rx, ry' });
    }
  }
  const timeLimit = Math.min(MAX_TIME_LIMIT, Math.max(MIN_TIME_LIMIT, Number(timeLimitSeconds) || 60));
  const hintAfter = Math.max(1, Number(hintAfterMisses) || 3);

  const id = nanoid(10);
  const creatorToken = nanoid(24);
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO challenges
      (id, creator_token, title, composite_image, character_count, hit_regions, time_limit_seconds, hint_after_misses, active, play_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
  `).run(
    id,
    creatorToken,
    (title || '').slice(0, 80) || '위장 캐릭터 찾기 챌린지',
    compositeImage,
    hitRegions.length,
    JSON.stringify(hitRegions),
    timeLimit,
    hintAfter,
    createdAt
  );

  res.status(201).json({ id, creatorToken });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (!row.active) return res.status(410).json({ error: 'inactive' });
  res.json(toChallengeView(row));
});

router.get('/:id/manage', (req, res) => {
  const { token } = req.query;
  const row = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (row.creator_token !== token) return res.status(403).json({ error: 'invalid token' });
  res.json(toChallengeView(row, { includeManageFields: true }));
});

router.patch('/:id/deactivate', (req, res) => {
  const { creatorToken } = req.body || {};
  const row = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (row.creator_token !== creatorToken) return res.status(403).json({ error: 'invalid token' });
  db.prepare('UPDATE challenges SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/report', (req, res) => {
  const row = db.prepare('SELECT id FROM challenges WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const reason = (req.body && req.body.reason ? String(req.body.reason) : '').slice(0, 500);
  if (!reason) return res.status(400).json({ error: 'reason is required' });
  db.prepare('INSERT INTO reports (challenge_id, reason, created_at) VALUES (?, ?, ?)')
    .run(req.params.id, reason, new Date().toISOString());
  res.status(201).json({ ok: true });
});

router.post('/:id/plays', (req, res) => {
  const row = db.prepare('SELECT id FROM challenges WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });

  const { foundCount, totalCount, durationSeconds } = req.body || {};
  if (
    !Number.isFinite(foundCount) || !Number.isFinite(totalCount) ||
    !Number.isFinite(durationSeconds) || totalCount <= 0
  ) {
    return res.status(400).json({ error: 'invalid play payload' });
  }
  const clampedFound = Math.max(0, Math.min(foundCount, totalCount));
  const score = Math.round((clampedFound / totalCount) * 100);
  const success = clampedFound === totalCount;

  db.prepare(`
    INSERT INTO plays (challenge_id, found_count, total_count, score, success, duration_seconds, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, clampedFound, totalCount, score, success ? 1 : 0, durationSeconds, new Date().toISOString());

  db.prepare('UPDATE challenges SET play_count = play_count + 1 WHERE id = ?').run(req.params.id);

  res.status(201).json({ score, success, foundCount: clampedFound, totalCount });
});

module.exports = router;
