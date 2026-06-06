import { Router } from 'express';
import { query } from 'express-validator';
import { Anime, Episode, Rating, Watchlist } from '../models/index.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { cacheGet, cacheSet } from '../config/redis.js';

const router = Router();

// ─── GET HOMEPAGE DATA ────────────────────────────────────────────────────────
router.get('/homepage', asyncHandler(async (req, res) => {
  const cacheKey = 'homepage:data';
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json({ success: true, data: cached });

  const [featured, trending, latest, ongoing, topRated] = await Promise.all([
    Anime.find({ isFeatured: true }).limit(5).select('title coverImage bannerImage slug synopsis score'),
    Anime.find({}).sort({ trending: -1 }).limit(12).select('title coverImage slug score status format'),
    Anime.find({}).sort({ createdAt: -1 }).limit(12).select('title coverImage slug score status'),
    Anime.find({ status: 'RELEASING' }).limit(12).select('title coverImage slug score episodeCount'),
    Anime.find({}).sort({ 'score.average': -1 }).limit(12).select('title coverImage slug score'),
  ]);

  const data = { featured, trending, latest, ongoing, topRated };
  await cacheSet(cacheKey, data, 300); // 5 min cache

  res.json({ success: true, data });
}));

// ─── GET ALL ANIME (with filters) ─────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 24,
    genre,
    year,
    season,
    format,
    status,
    sort = 'trending',
  } = req.query;

  const filter = {};
  if (genre) filter.genres = genre;
  if (year) filter.seasonYear = parseInt(year);
  if (season) filter.season = season.toUpperCase();
  if (format) filter.format = format.toUpperCase();
  if (status) filter.status = status.toUpperCase();

  const sortMap = {
    trending: { trending: -1 },
    popularity: { popularity: -1 },
    score: { 'score.average': -1 },
    newest: { createdAt: -1 },
    title: { 'title.romaji': 1 },
    year: { seasonYear: -1 },
  };

  const sortQuery = sortMap[sort] || sortMap.trending;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [anime, total] = await Promise.all([
    Anime.find(filter)
      .sort(sortQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .select('title coverImage slug score status format seasonYear genres'),
    Anime.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: anime,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

// ─── GET SINGLE ANIME ─────────────────────────────────────────────────────────
router.get('/:slug', optionalAuth, asyncHandler(async (req, res) => {
  const cacheKey = `anime:${req.params.slug}`;
  const cached = await cacheGet(cacheKey);

  let anime = cached;
  if (!anime) {
    anime = await Anime.findOne({ slug: req.params.slug })
      .populate('recommendations', 'title coverImage slug score');
    if (!anime) {
      return res.status(404).json({ success: false, message: 'Anime not found' });
    }
    await cacheSet(cacheKey, anime, 600);
  }

  // Increment view count
  Anime.findByIdAndUpdate(anime._id, { $inc: { views: 1 } }).exec();

  // User-specific data
  let userWatchlist = null;
  let userRating = null;
  if (req.userId || req.user) {
    const userId = req.user?._id || req.userId;
    [userWatchlist, userRating] = await Promise.all([
      Watchlist.findOne({ user: userId, anime: anime._id }).select('status userScore'),
      Rating.findOne({ user: userId, anime: anime._id }).select('score review'),
    ]);
  }

  res.json({
    success: true,
    data: { ...anime.toObject(), userWatchlist, userRating },
  });
}));

// ─── GET ANIME EPISODES ───────────────────────────────────────────────────────
router.get('/:slug/episodes', optionalAuth, asyncHandler(async (req, res) => {
  const anime = await Anime.findOne({ slug: req.params.slug }).select('_id');
  if (!anime) return res.status(404).json({ success: false, message: 'Anime not found' });

  const episodes = await Episode.find({ anime: anime._id })
    .sort({ number: 1 })
    .select('number title thumbnail duration airDate isPremium isFiller views');

  res.json({ success: true, data: episodes });
}));

// ─── GET SINGLE EPISODE ───────────────────────────────────────────────────────
router.get('/:slug/episodes/:number', asyncHandler(async (req, res) => {
  const anime = await Anime.findOne({ slug: req.params.slug }).select('_id title');
  if (!anime) return res.status(404).json({ success: false, message: 'Anime not found' });

  const episode = await Episode.findOne({
    anime: anime._id,
    number: parseInt(req.params.number),
  }).select('number title description thumbnail duration airDate isPremium isFiller');

  if (!episode) return res.status(404).json({ success: false, message: 'Episode not found' });

  // Get adjacent episodes
  const [prevEp, nextEp] = await Promise.all([
    Episode.findOne({ anime: anime._id, number: episode.number - 1 }).select('number title thumbnail'),
    Episode.findOne({ anime: anime._id, number: episode.number + 1 }).select('number title thumbnail'),
  ]);

  res.json({
    success: true,
    data: { episode, anime: { _id: anime._id, title: anime.title }, prevEp, nextEp },
  });
}));

// ─── GET GENRES LIST ──────────────────────────────────────────────────────────
router.get('/meta/genres', asyncHandler(async (req, res) => {
  const genres = await Anime.distinct('genres');
  res.json({ success: true, data: genres.sort() });
}));

// ─── RATE ANIME ───────────────────────────────────────────────────────────────
router.post('/:id/rate', protect, asyncHandler(async (req, res) => {
  const { score, review, isSpoiler } = req.body;

  if (!score || score < 1 || score > 10) {
    return res.status(400).json({ success: false, message: 'Score must be between 1 and 10' });
  }

  const rating = await Rating.findOneAndUpdate(
    { user: req.user._id, anime: req.params.id },
    { score, review, isSpoiler },
    { upsert: true, new: true }
  );

  // Recalculate average score
  const aggr = await Rating.aggregate([
    { $match: { anime: rating.anime } },
    { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } },
  ]);

  if (aggr[0]) {
    await Anime.findByIdAndUpdate(req.params.id, {
      'score.average': Math.round(aggr[0].avg * 10) / 10,
      'score.count': aggr[0].count,
    });
  }

  res.json({ success: true, data: rating });
}));

export default router;
