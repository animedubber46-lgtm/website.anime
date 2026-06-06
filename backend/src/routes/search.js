import { Router } from 'express';
import { Anime } from '../models/index.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { cacheGet, cacheSet } from '../config/redis.js';

const router = Router();

// ─── FULL-TEXT SEARCH ─────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const {
    q = '',
    genre,
    year,
    season,
    format,
    status,
    sort = 'score',
    page = 1,
    limit = 20,
  } = req.query;

  if (!q && !genre && !year && !format && !status) {
    return res.json({ success: true, data: [], pagination: { total: 0 } });
  }

  const cacheKey = `search:${JSON.stringify(req.query)}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json({ success: true, ...cached });

  const filter = {};

  if (q.trim()) {
    filter.$text = { $search: q.trim() };
  }

  if (genre) filter.genres = { $in: Array.isArray(genre) ? genre : [genre] };
  if (year) filter.seasonYear = parseInt(year);
  if (season) filter.season = season.toUpperCase();
  if (format) filter.format = format.toUpperCase();
  if (status) filter.status = status.toUpperCase();

  const sortOptions = {
    score: { 'score.average': -1 },
    popularity: { popularity: -1 },
    trending: { trending: -1 },
    newest: { seasonYear: -1 },
    title: { 'title.romaji': 1 },
  };

  // If text search, add relevance score
  if (q.trim()) {
    sortOptions.relevance = { score: { $meta: 'textScore' } };
  }

  const sortQuery = q.trim()
    ? { score: { $meta: 'textScore' }, ...sortOptions[sort] }
    : sortOptions[sort];

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const projection = q.trim()
    ? { score: { $meta: 'textScore' } }
    : {};

  const [results, total] = await Promise.all([
    Anime.find(filter, projection)
      .sort(sortQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .select('title coverImage slug score status format seasonYear genres'),
    Anime.countDocuments(filter),
  ]);

  const responseData = {
    data: results,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  };

  await cacheSet(cacheKey, responseData, 120); // 2 min cache

  res.json({ success: true, ...responseData });
}));

// ─── AUTOCOMPLETE / SUGGESTIONS ───────────────────────────────────────────────
router.get('/suggest', asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ success: true, data: [] });

  const cacheKey = `suggest:${q.toLowerCase()}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json({ success: true, data: cached });

  const results = await Anime.find({
    $or: [
      { 'title.romaji': { $regex: q, $options: 'i' } },
      { 'title.english': { $regex: q, $options: 'i' } },
    ],
  })
    .limit(8)
    .select('title coverImage slug format');

  await cacheSet(cacheKey, results, 300);
  res.json({ success: true, data: results });
}));

// ─── RECOMMENDATION ENGINE ────────────────────────────────────────────────────
router.get('/recommendations', asyncHandler(async (req, res) => {
  // Import protect middleware inline to make it optional
  const userId = req.headers.authorization ? null : null; // handled by optionalAuth in server

  if (!userId) {
    // Anonymous: return top trending
    const trending = await Anime.find({})
      .sort({ trending: -1 })
      .limit(12)
      .select('title coverImage slug score');
    return res.json({ success: true, data: trending, type: 'trending' });
  }

  // Logged in: based on watch history genres
  const { WatchProgress } = await import('../models/index.js');
  const history = await WatchProgress.find({ user: userId })
    .sort({ lastWatched: -1 })
    .limit(20)
    .populate('anime', 'genres');

  const genreFrequency = {};
  history.forEach(({ anime }) => {
    anime?.genres?.forEach((g) => {
      genreFrequency[g] = (genreFrequency[g] || 0) + 1;
    });
  });

  const topGenres = Object.entries(genreFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);

  const watchedIds = history.map((h) => h.anime?._id).filter(Boolean);

  const recommendations = await Anime.find({
    genres: { $in: topGenres },
    _id: { $nin: watchedIds },
  })
    .sort({ 'score.average': -1 })
    .limit(12)
    .select('title coverImage slug score genres');

  res.json({ success: true, data: recommendations, type: 'personalized', basedOn: topGenres });
}));

export default router;
