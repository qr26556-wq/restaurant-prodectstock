require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const videoRoutes = require('./routes/video');
const paymentRoutes = require('./routes/payment');

const app = express();

// Stripe webhook needs the raw body, so mount it BEFORE express.json()
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(cors());
app.use(express.json());

// Serve generated videos
app.use('/generated', express.static(path.join(__dirname, 'generated')));

// Serve the frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/payment', paymentRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`ReelForge server chal raha hai: http://localhost:${PORT}`);
});
