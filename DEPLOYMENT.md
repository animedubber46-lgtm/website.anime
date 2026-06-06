# AnimeX Deployment Guide

## Prerequisites
- Node.js 20+
- MongoDB Atlas account
- AWS account (S3 + CloudFront) or Cloudflare R2
- Redis (Upstash recommended for serverless)
- Vercel account (frontend)
- Railway or Render account (backend)

---

## 1. MongoDB Atlas Setup

1. Create a free cluster at mongodb.com/atlas
2. Add a database user with read/write access
3. Whitelist IP: 0.0.0.0/0 (or your server IP)
4. Copy the connection string into `backend/.env` → `MONGODB_URI`
5. Run the seed script: `cd backend && npm run seed`

---

## 2. AWS S3 + CloudFront (Video Storage)

### S3 Setup
1. Create a private S3 bucket (no public access)
2. Enable versioning (optional)
3. Note your bucket name and region

### CloudFront Setup
1. Create a CloudFront distribution pointing to your S3 bucket
2. Restrict bucket access to CloudFront only (OAC)
3. Under "Key Management" → create a CloudFront key pair
4. Download the private key (.pem file)
5. Note your Key Pair ID and distribution domain

### Environment Variables
```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=animex-videos
CLOUDFRONT_DOMAIN=https://xxxxx.cloudfront.net
CLOUDFRONT_KEY_PAIR_ID=APKA...
CLOUDFRONT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
SIGNED_URL_EXPIRY_SECONDS=3600
```

---

## 3. HLS Video Preparation

Convert videos to HLS before uploading:

```bash
# Install FFmpeg
# Multi-quality HLS encode
ffmpeg -i input.mp4 \
  -filter_complex "[0:v]split=4[v1][v2][v3][v4]" \
  -map "[v1]" -c:v h264 -b:v 400k -s 640x360 \
  -map "[v2]" -c:v h264 -b:v 800k -s 854x480 \
  -map "[v3]" -c:v h264 -b:v 2000k -s 1280x720 \
  -map "[v4]" -c:v h264 -b:v 4000k -s 1920x1080 \
  -map 0:a -c:a aac -b:a 128k \
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3" \
  -master_pl_name master.m3u8 \
  -f hls -hls_time 6 -hls_list_size 0 \
  -hls_segment_filename "stream_%v/seg%03d.ts" \
  stream_%v/index.m3u8
```

Upload the entire output folder to S3:
```bash
aws s3 sync ./hls-output s3://animex-videos/anime/{animeId}/ep{number}/
```

Then register the S3 keys in the admin panel.

---

## 4. Backend Deployment (Railway)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
cd backend
railway init
railway up

# Set environment variables in Railway dashboard
```

### Or deploy to Render
1. Connect your GitHub repo
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add all env vars from `.env.example`

---

## 5. Frontend Deployment (Vercel)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
echo "NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api" > .env.production
vercel --prod
```

Or connect your GitHub repo at vercel.com for automatic deployments.

---

## 6. Redis Setup (Upstash)

1. Create a Redis database at upstash.com
2. Copy the `REDIS_URL` (starts with `rediss://`)
3. Add to backend env vars

---

## 7. Email Setup (SendGrid)

1. Create a SendGrid account
2. Create an API key
3. Add to backend:
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=SG.your_api_key
EMAIL_FROM=noreply@yourdomain.com
```

---

## 8. Domain & SSL
- Vercel handles SSL automatically for frontend
- Use Railway/Render custom domain for backend
- Add CORS: set `FRONTEND_URL` to your production domain

---

## Production Checklist

- [ ] MongoDB Atlas connection tested
- [ ] S3 bucket and CloudFront configured
- [ ] Redis connected
- [ ] Email service working
- [ ] Admin account created (via seed script)
- [ ] JWT secrets are long random strings (32+ chars)
- [ ] `NODE_ENV=production` set
- [ ] CORS restricted to your frontend domain
- [ ] Rate limiting configured
- [ ] CSP headers enabled

