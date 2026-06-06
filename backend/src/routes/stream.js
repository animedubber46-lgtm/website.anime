import { Router } from 'express';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../config/s3.js';
import { Episode } from '../models/index.js';
import { protect, optionalAuth, requirePremium } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { cacheGet, cacheSet } from '../config/redis.js';

const router = Router();

const SIGNED_URL_TTL = parseInt(process.env.SIGNED_URL_EXPIRY_SECONDS) || 3600;

/**
 * Generate a CloudFront signed URL for HLS streaming.
 * The key is stored in DB, never exposed. Signed URLs expire automatically.
 */
function signCloudfrontUrl(key) {
  const url = `${process.env.CLOUDFRONT_DOMAIN}/${key}`;
  const expiry = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL;

  return getSignedUrl({
    url,
    keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID,
    privateKey: process.env.CLOUDFRONT_PRIVATE_KEY,
    dateLessThan: new Date(expiry * 1000).toISOString(),
  });
}

// ─── GET STREAM SOURCES ───────────────────────────────────────────────────────
// Returns temporary signed URLs for HLS playback (no raw S3 key exposed)
router.get('/episode/:episodeId', optionalAuth, asyncHandler(async (req, res) => {
  const { episodeId } = req.params;
  const { quality = 'auto' } = req.query;

  const episode = await Episode.findById(episodeId)
    .select('+sources.storageKey +sources.hlsKey +sources.quality +sources.size +subtitles');

  if (!episode) {
    return res.status(404).json({ success: false, message: 'Episode not found' });
  }

  // Premium content gate
  if (episode.isPremium) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Login required', code: 'AUTH_REQUIRED' });
    }
    if (!req.user.isPremium()) {
      return res.status(403).json({ success: false, message: 'Premium required', code: 'PREMIUM_REQUIRED' });
    }
  }

  // Cache check (short TTL since URLs expire)
  const cacheKey = `stream:${episodeId}:${req.user?._id || 'anon'}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json({ success: true, data: cached });

  // Build signed sources
  const signedSources = await Promise.all(
    episode.sources.map(async (source) => {
      const signedHlsUrl = signCloudfrontUrl(source.hlsKey);
      return {
        quality: source.quality,
        url: signedHlsUrl, // .m3u8 master playlist URL
        size: source.size,
      };
    })
  );

  // Build signed subtitle URLs
  const signedSubtitles = await Promise.all(
    episode.subtitles.map(async (sub) => ({
      language: sub.language,
      label: sub.label,
      url: signCloudfrontUrl(sub.storageKey),
      default: sub.default,
    }))
  );

  const streamData = {
    episodeId,
    duration: episode.duration,
    sources: signedSources,
    subtitles: signedSubtitles,
    expiresAt: new Date(Date.now() + SIGNED_URL_TTL * 1000).toISOString(),
  };

  // Cache for 5 min less than TTL to avoid serving near-expired URLs
  await cacheSet(cacheKey, streamData, SIGNED_URL_TTL - 300);

  // Increment view count asynchronously
  Episode.findByIdAndUpdate(episodeId, { $inc: { views: 1 } }).exec();

  res.json({ success: true, data: streamData });
}));

// ─── SAVE WATCH PROGRESS ──────────────────────────────────────────────────────
router.post('/progress', protect, asyncHandler(async (req, res) => {
  const { episodeId, animeId, timestamp, duration } = req.body;

  if (!episodeId || timestamp === undefined) {
    return res.status(400).json({ success: false, message: 'episodeId and timestamp required' });
  }

  const completed = duration > 0 && (timestamp / duration) >= 0.9;

  const { WatchProgress } = await import('../models/index.js');
  const progress = await WatchProgress.findOneAndUpdate(
    { user: req.user._id, episode: episodeId },
    {
      anime: animeId,
      timestamp,
      duration,
      completed,
      lastWatched: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({ success: true, data: progress });
}));

// ─── GET WATCH PROGRESS ───────────────────────────────────────────────────────
router.get('/progress/:episodeId', protect, asyncHandler(async (req, res) => {
  const { WatchProgress } = await import('../models/index.js');
  const progress = await WatchProgress.findOne({
    user: req.user._id,
    episode: req.params.episodeId,
  });

  res.json({ success: true, data: progress || { timestamp: 0, completed: false } });
}));

// ─── GET CONTINUE WATCHING ────────────────────────────────────────────────────
router.get('/continue-watching', protect, asyncHandler(async (req, res) => {
  const { WatchProgress } = await import('../models/index.js');

  const progress = await WatchProgress.find({
    user: req.user._id,
    completed: false,
    timestamp: { $gt: 30 }, // at least 30s watched
  })
    .sort({ lastWatched: -1 })
    .limit(20)
    .populate({
      path: 'anime',
      select: 'title coverImage slug',
    })
    .populate({
      path: 'episode',
      select: 'number title thumbnail duration',
    });

  res.json({ success: true, data: progress });
}));

export default router;
