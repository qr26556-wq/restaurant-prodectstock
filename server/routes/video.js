const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const OUTPUT_DIR = path.join(__dirname, '..', 'generated');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Photo-to-video uploads: keep the image in memory, we only need it long
// enough to forward it to Pollinations' media store.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) {
      return cb(new Error('Sirf PNG, JPG ya WEBP image allowed hai.'));
    }
    cb(null, true);
  },
});

// POST /api/video/generate  { prompt }
// Calls Hugging Face's free Inference API to actually generate a video.
// NOTE: the free HF tier is rate-limited and can queue for 20-60s on cold start.
router.post('/generate', requireAuth, async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || prompt.trim().length < 3) {
    return res.status(400).json({ error: 'Prompt likhna zaroori hai (kam se kam 3 characters).' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User nahi mila.' });

  if (user.credits <= 0) {
    return res.status(402).json({
      error: 'Aapke credits khatam ho gaye hain. Video banane ke liye plan upgrade karein.',
      code: 'NO_CREDITS',
    });
  }

  const videoId = uuidv4();
  db.prepare(
    `INSERT INTO videos (id, user_id, prompt, status) VALUES (?, ?, ?, 'processing')`
  ).run(videoId, user.id, prompt.trim());

  // Pollinations.ai — free tier (weekly Pollen credits), single GET request returns MP4 directly.
  // Get a free key at https://enter.pollinations.ai (no card required).
  const pollKey = process.env.POLLINATIONS_API_KEY;
  const model = process.env.POLLINATIONS_VIDEO_MODEL || 'wan-fast';

  if (!pollKey || pollKey.includes('xxxx')) {
    db.prepare(`UPDATE videos SET status = 'failed', error = ? WHERE id = ?`)
      .run('POLLINATIONS_API_KEY server par set nahi hai.', videoId);
    return res.status(500).json({
      error: 'Server par abhi AI video engine configure nahi hai. .env file me POLLINATIONS_API_KEY daalein (free milta hai enter.pollinations.ai par).',
    });
  }

  try {
    const url = `https://gen.pollinations.ai/video/${encodeURIComponent(prompt.trim())}?model=${encodeURIComponent(model)}&width=768&height=768`;
    const pollResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${pollKey}` },
    });

    if (!pollResponse.ok) {
      const errText = await pollResponse.text();
      db.prepare(`UPDATE videos SET status = 'failed', error = ? WHERE id = ?`)
        .run(errText.slice(0, 500), videoId);

      if (pollResponse.status === 402) {
        return res.status(402).json({
          error: 'Is hafte ke free Pollen credits khatam ho gaye hain. Agle reset ka wait karein ya plan upgrade karein.',
        });
      }
      if (pollResponse.status === 503 || pollResponse.status === 502) {
        return res.status(503).json({
          error: 'AI video engine abhi busy hai. Thodi der me dobara try karein.',
        });
      }
      return res.status(502).json({ error: 'Video generate nahi ho paya. Baad me try karein.' });
    }

    const buffer = await pollResponse.buffer();
    const filename = `${videoId}.mp4`;
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), buffer);

    // Deduct one credit only after successful generation
    db.prepare('UPDATE users SET credits = credits - 1 WHERE id = ?').run(user.id);
    db.prepare(`UPDATE videos SET status = 'done', video_url = ? WHERE id = ?`)
      .run(`/generated/${filename}`, videoId);

    const updatedUser = db.prepare('SELECT credits FROM users WHERE id = ?').get(user.id);

    res.json({
      video: { id: videoId, url: `/generated/${filename}`, prompt: prompt.trim() },
      creditsRemaining: updatedUser.credits,
    });
  } catch (err) {
    db.prepare(`UPDATE videos SET status = 'failed', error = ? WHERE id = ?`)
      .run(String(err.message || err).slice(0, 500), videoId);
    res.status(500).json({ error: 'Kuch galat ho gaya. Dobara try karein.' });
  }
});

// POST /api/video/generate-from-image  (multipart/form-data: image file + optional prompt)
// Uploads the photo to Pollinations media storage, then runs image-to-video (I2V)
// generation using that image as the starting frame.
router.post('/generate-from-image', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Ek image file upload karna zaroori hai.' });
  }

  const prompt = (req.body.prompt || '').trim() || 'Is photo ko halke se animate karein.';

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User nahi mila.' });

  if (user.credits <= 0) {
    return res.status(402).json({
      error: 'Aapke credits khatam ho gaye hain. Video banane ke liye plan upgrade karein.',
      code: 'NO_CREDITS',
    });
  }

  const videoId = uuidv4();
  db.prepare(
    `INSERT INTO videos (id, user_id, prompt, status) VALUES (?, ?, ?, 'processing')`
  ).run(videoId, user.id, `[Photo se video] ${prompt}`);

  const pollKey = process.env.POLLINATIONS_API_KEY;
  const model = process.env.POLLINATIONS_VIDEO_MODEL || 'wan-fast';

  if (!pollKey || pollKey.includes('xxxx')) {
    db.prepare(`UPDATE videos SET status = 'failed', error = ? WHERE id = ?`)
      .run('POLLINATIONS_API_KEY server par set nahi hai.', videoId);
    return res.status(500).json({
      error: 'Server par abhi AI video engine configure nahi hai. .env file me POLLINATIONS_API_KEY daalein (free milta hai enter.pollinations.ai par).',
    });
  }

  try {
    // Step 1: push the uploaded photo to Pollinations' media store so we get
    // a public URL we can pass as the video model's starting frame.
    const uploadForm = new FormData();
    uploadForm.append('file', req.file.buffer, {
      filename: req.file.originalname || 'photo.jpg',
      contentType: req.file.mimetype,
    });

    const uploadResponse = await fetch('https://gen.pollinations.ai/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pollKey}`, ...uploadForm.getHeaders() },
      body: uploadForm,
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      db.prepare(`UPDATE videos SET status = 'failed', error = ? WHERE id = ?`)
        .run(errText.slice(0, 500), videoId);
      return res.status(502).json({ error: 'Photo upload nahi ho payi. Dobara try karein.' });
    }

    const { url: imageUrl } = await uploadResponse.json();

    // Step 2: image-to-video generation, using the uploaded photo as the
    // starting frame (image[0]).
    const videoUrl = `https://gen.pollinations.ai/video/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}&image=${encodeURIComponent(imageUrl)}&width=768&height=768`;
    const pollResponse = await fetch(videoUrl, {
      headers: { Authorization: `Bearer ${pollKey}` },
    });

    if (!pollResponse.ok) {
      const errText = await pollResponse.text();
      db.prepare(`UPDATE videos SET status = 'failed', error = ? WHERE id = ?`)
        .run(errText.slice(0, 500), videoId);

      if (pollResponse.status === 402) {
        return res.status(402).json({
          error: 'Is hafte ke free Pollen credits khatam ho gaye hain. Agle reset ka wait karein ya plan upgrade karein.',
        });
      }
      if (pollResponse.status === 503 || pollResponse.status === 502) {
        return res.status(503).json({
          error: 'AI video engine abhi busy hai. Thodi der me dobara try karein.',
        });
      }
      return res.status(502).json({ error: 'Video generate nahi ho paya. Baad me try karein.' });
    }

    const buffer = await pollResponse.buffer();
    const filename = `${videoId}.mp4`;
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), buffer);

    db.prepare('UPDATE users SET credits = credits - 1 WHERE id = ?').run(user.id);
    db.prepare(`UPDATE videos SET status = 'done', video_url = ? WHERE id = ?`)
      .run(`/generated/${filename}`, videoId);

    const updatedUser = db.prepare('SELECT credits FROM users WHERE id = ?').get(user.id);

    res.json({
      video: { id: videoId, url: `/generated/${filename}`, prompt },
      creditsRemaining: updatedUser.credits,
    });
  } catch (err) {
    db.prepare(`UPDATE videos SET status = 'failed', error = ? WHERE id = ?`)
      .run(String(err.message || err).slice(0, 500), videoId);
    res.status(500).json({ error: 'Kuch galat ho gaya. Dobara try karein.' });
  }
});

// GET /api/video/history
router.get('/history', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM videos WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(req.userId);
  res.json({ videos: rows });
});

// Turns multer errors (bad file type, too large, etc.) into clean JSON
// instead of the default HTML error page.
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'File upload me masla hua.' });
  }
  next();
});

module.exports = router;
