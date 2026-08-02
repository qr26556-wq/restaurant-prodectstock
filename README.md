# ReelForge — AI Video Generation Website

Ye ek **poora functional website** hai: login/signup, real AI text-to-video generation, aur payment (Stripe) ke saath. Neeche diye steps follow karke apne computer ya kisi bhi hosting (Render, Railway, VPS) par chala sakte hain.

## Ye kya hai, seedhe seedhe

- **Frontend**: `public/` folder — plain HTML/CSS/JS (koi build step nahi chahiye)
- **Backend**: `server/` folder — Node.js + Express
- **Database**: SQLite (file-based, koi alag setup nahi chahiye)
- **Real video generation**: [Pollinations.ai](https://pollinations.ai) ka **free** API use hota hai — koi card nahi chahiye, sirf free signup
- **Payments**: Stripe Checkout (test mode free hai, live mode ke liye Stripe account verify karna padega)

> ⚠️ **Sach baat**: "Free" real AI video generation duniya mein kahin nahi hoti — video banane ke liye GPU compute lagta hai jiski cost hoti hai. Ye website Pollinations.ai ke **free tier** se connect hoti hai — signup par har hafte kuch "Pollen" credits milte hain jo video generation mein use hote hain. Free credits khatam hone par agle hafte reset ho jaate hain, ya aap unki site par paid Pollen kharid sakte hain. Agar aapko bade scale par fast, unlimited video generation chahiye, to Runway/Pika/Stability jaisi fully-paid API use karni hogi — sirf `server/routes/video.js` file me endpoint badalna hoga.

## Setup (5 steps)

### 1. Node.js install karein
Agar nahi hai to [nodejs.org](https://nodejs.org) se LTS version install karein.

### 2. Backend dependencies install karein
```bash
cd server
npm install
```

### 3. Environment variables set karein
```bash
cp .env.example .env
```
Phir `.env` file kholein aur ye bharein:
- `JWT_SECRET` — koi bhi lamba random string
- `POLLINATIONS_API_KEY` — [enter.pollinations.ai](https://enter.pollinations.ai) par free signup karke `sk_` wala secret key banayein (koi card nahi chahiye)
- `STRIPE_SECRET_KEY` aur `STRIPE_WEBHOOK_SECRET` — [dashboard.stripe.com](https://dashboard.stripe.com) par free test account se milenge (payment feature ke liye zaroori, agar sirf video generation chahiye to ye chhod sakte hain)

### 4. Server chalayein
```bash
npm start
```
Terminal mein `http://localhost:4000` dikhega.

### 5. Browser mein kholein
`http://localhost:4000` par jayein — website ready hai.

## File structure
```
ai-video-site/
├── server/                 # Backend (Node + Express)
│   ├── server.js           # Entry point
│   ├── routes/
│   │   ├── auth.js         # Signup, login
│   │   ├── video.js        # Real AI video generation
│   │   └── payment.js      # Stripe checkout + webhook
│   ├── middleware/auth.js  # JWT verification
│   ├── db/db.js            # SQLite schema
│   └── .env.example
└── public/                 # Frontend (plain HTML/CSS/JS)
    ├── index.html           # Landing page
    ├── signup.html
    ├── login.html
    ├── pricing.html
    ├── dashboard.html       # Generate + history
    ├── css/style.css
    └── js/main.js
```

## Deploy kaise karein (free options)
- **Render.com** — free tier available, `server/` ko "Web Service" ke roop mein deploy karein, `public/` static files automatically serve ho jayengi (server.js already serve karta hai)
- **Railway.app** — similar, free starter credits milte hain
- Domain apna khareed kar us par point kar sakte hain

## Agla step (agar chahiye)
- Video generation ko koi doosri paid API (Runway, Pika, Luma) se badalna — sirf `server/routes/video.js` file edit karni hogi
- Pollinations ke doosre video models try karna (`veo`, `seedance`, `wan-pro`, etc.) — bas `.env` me `POLLINATIONS_VIDEO_MODEL` badal dein
- Stripe live mode activate karna — business verification ke baad
- Email verification, password reset — main abhi add kar sakta hoon agar bolein
