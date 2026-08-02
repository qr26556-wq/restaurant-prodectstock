const express = require('express');
const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const PLANS = {
  starter: { name: 'Starter', credits: 30, priceInr: 49900 }, // in paise (₹499)
  pro: { name: 'Pro', credits: 150, priceInr: 149900 }, // ₹1499
};

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes('xxxx')) return null;
  return new Stripe(key);
}

// POST /api/payment/checkout  { plan: 'starter' | 'pro' }
router.post('/checkout', requireAuth, async (req, res) => {
  const { plan } = req.body || {};
  const planDef = PLANS[plan];
  if (!planDef) return res.status(400).json({ error: 'Invalid plan.' });

  const stripe = getStripe();
  if (!stripe) {
    return res.status(500).json({
      error: 'Payments abhi configure nahi hain. .env me STRIPE_SECRET_KEY daalein (Stripe test mode free hai).',
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'inr',
            unit_amount: planDef.priceInr,
            product_data: { name: `ReelForge ${planDef.name} Plan (${planDef.credits} credits)` },
          },
          quantity: 1,
        },
      ],
      metadata: { userId: user.id, plan, credits: String(planDef.credits) },
      success_url: `${process.env.CLIENT_URL}/dashboard.html?payment=success`,
      cancel_url: `${process.env.CLIENT_URL}/pricing.html?payment=cancelled`,
    });

    db.prepare(
      `INSERT INTO payments (id, user_id, stripe_session_id, amount, plan, status) VALUES (?, ?, ?, ?, ?, 'pending')`
    ).run(uuidv4(), user.id, session.id, planDef.priceInr, plan);

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: 'Payment session create nahi ho paya. Dobara try karein.' });
  }
});

// POST /api/payment/webhook - Stripe calls this after successful payment
// Must be mounted with express.raw() body parser in server.js
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(500).send('Stripe not configured');

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, plan, credits } = session.metadata || {};

    if (userId && credits) {
      db.prepare('UPDATE users SET plan = ?, credits = credits + ? WHERE id = ?')
        .run(plan, Number(credits), userId);
      db.prepare(`UPDATE payments SET status = 'paid' WHERE stripe_session_id = ?`)
        .run(session.id);
    }
  }

  res.json({ received: true });
});

module.exports = router;
