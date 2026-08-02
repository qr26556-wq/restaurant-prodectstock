const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../lib/mailer');

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    plan: u.plan,
    credits: u.credits,
  };
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email aur password sabhi zaroori hain.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password kam se kam 6 characters ka hona chahiye.' });
    }
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET missing hai. Replit Secrets (ya server/.env) me JWT_SECRET set karein.');
      return res.status(500).json({ error: 'Server abhi configure nahi hai (JWT_SECRET missing). Admin se contact karein.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'Is email se account pehle se maujood hai.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const freeCredits = Number(process.env.FREE_PLAN_MONTHLY_CREDITS || 3);

    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, plan, credits) VALUES (?, ?, ?, ?, 'free', ?)`
    ).run(id, name, email.toLowerCase(), passwordHash, freeCredits);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    const token = signToken(user.id);

    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Kuch galat ho gaya. Dobara try karein.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email aur password dono zaroori hain.' });
    }
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET missing hai. Replit Secrets (ya server/.env) me JWT_SECRET set karein.');
      return res.status(500).json({ error: 'Server abhi configure nahi hai (JWT_SECRET missing). Admin se contact karein.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Email ya password galat hai.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ya password galat hai.' });
    }

    const token = signToken(user.id);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Kuch galat ho gaya. Dobara try karein.' });
  }
});

// POST /api/auth/forgot-password  { email }
// Hamesha generic success message deta hai (chahe email exist kare ya nahi) —
// isse attacker ye pata nahi laga sakta ki koi email registered hai ya nahi.
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email zaroori hai.' });
    }

    const genericMsg = 'Agar is email se account maujood hai, to reset link bhej diya gaya hai.';

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) {
      // User exist nahi karta — phir bhi generic success return karein (security best-practice)
      return res.json({ message: genericMsg });
    }

    // Purane, use-na-hue reset requests is user ke liye invalidate kar dein
    db.prepare('DELETE FROM password_resets WHERE user_id = ? AND used = 0').run(user.id);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    db.prepare(
      `INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`
    ).run(uuidv4(), user.id, tokenHash, expiresAt);

    const baseUrl = process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${baseUrl}/reset-password.html?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

    await sendPasswordResetEmail(user.email, resetUrl);

    res.json({ message: genericMsg });
  } catch (err) {
    console.error('Forgot-password error:', err);
    res.status(500).json({ error: 'Kuch galat ho gaya. Dobara try karein.' });
  }
});

// POST /api/auth/reset-password  { email, token, newPassword }
router.post('/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body || {};
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Email, token aur naya password zaroori hain.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password kam se kam 6 characters ka hona chahiye.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) {
      return res.status(400).json({ error: 'Reset link invalid ya expire ho chuka hai.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetRow = db
      .prepare(
        `SELECT * FROM password_resets WHERE user_id = ? AND token_hash = ? AND used = 0 ORDER BY created_at DESC LIMIT 1`
      )
      .get(user.id, tokenHash);

    if (!resetRow) {
      return res.status(400).json({ error: 'Reset link invalid ya expire ho chuka hai.' });
    }
    if (new Date(resetRow.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Reset link expire ho chuka hai. Naya link mangwayein.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRow.id);

    res.json({ message: 'Password successfully reset ho gaya. Ab login karein.' });
  } catch (err) {
    console.error('Reset-password error:', err);
    res.status(500).json({ error: 'Kuch galat ho gaya. Dobara try karein.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User nahi mila.' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
