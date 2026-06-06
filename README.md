# AnimeX — Premium Anime Streaming Platform

A full-stack, production-ready anime streaming platform built with Next.js, Node.js/Express, and MongoDB Atlas.

---

## Architecture Overview

```
animex/
├── frontend/          # Next.js 14 App Router
└── backend/           # Node.js + Express API
```

---

## Quick Start

### 1. Clone & Install

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` in both `frontend/` and `backend/` and fill in values.

### 3. Run Locally

```bash
# Backend (port 5000)
cd backend && npm run dev

# Frontend (port 3000)
cd frontend && npm run dev
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 + React 18 + Tailwind CSS |
| Backend | Node.js + Express 5 |
| Database | MongoDB Atlas (Mongoose ODM) |
| Auth | JWT (Access + Refresh tokens) |
| Video | HLS (.m3u8) + Signed URLs (AWS CloudFront / Cloudflare) |
| Storage | AWS S3 / Cloudflare R2 |
| Cache | Redis (via Upstash) |
| Email | Nodemailer + SendGrid |
| Deployment | Vercel (frontend) + Railway/Render (backend) |
| PWA | next-pwa + Workbox |

---

## Deployment

### Frontend → Vercel
```bash
cd frontend
vercel --prod
```

### Backend → Railway
```bash
railway up
```

See `DEPLOYMENT.md` for detailed instructions.
