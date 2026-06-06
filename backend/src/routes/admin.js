import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import slugify from 'slugify';
import { Anime, Episode, User, WatchProgress, Notification } from '../models/index.js';
import { protect, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { uploadToS3, deleteFromS3 } from '../services/storage.js';
import { cacheDelPattern } from '../config/redis.js';
import multer from 'multer';

const router = Router();

// All admin routes require authentication + admin role
router.use(protect, requireRole('admin'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/x-mpegURL'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
router.get('/stats', asyncHandler(async (req, res) => {
  const [totalUsers, premiumUsers, totalAnime, totalEpisodes, totalViews] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'premium' }),
    Anime.countDocuments(),
    Episode.countDocuments(),
    Anime.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
  ]);

  const newUsersThisMonth = await User.countDocuments({
    createdAt: { $gte: new Date(new Date().setDate(1)) },
  });

  res.json({
    success: true,
    data: {
      totalUsers,
      premiumUsers,
      totalAnime,
      totalEpisodes,
      totalViews: totalViews[0]?.total || 0,
      newUsersThisMonth,
    },
  });
}));

// ─── CREATE ANIME ─────────────────────────────────────────────────────────────
router.post('/anime', [
  body('title.romaji').notEmpty().trim(),
  body('synopsis').optional().trim(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { title, ...rest } = req.body;

  const slug = slugify(title.romaji, { lower: true, strict: true });

  // Check for duplicate slug
  const existing = await Anime.findOne({ slug });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  const anime = await Anime.create({ title, slug: finalSlug, ...rest });
  await cacheDelPattern('homepage:*');

  res.status(201).json({ success: true, data: anime });
}));

// ─── UPDATE ANIME ─────────────────────────────────────────────────────────────
router.patch('/anime/:id', asyncHandler(async (req, res) => {
  const anime = await Anime.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!anime) return res.status(404).json({ success: false, message: 'Anime not found' });

  await cacheDelPattern(`anime:*`);
  await cacheDelPattern('homepage:*');

  res.json({ success: true, data: anime });
}));

// ─── DELETE ANIME ─────────────────────────────────────────────────────────────
router.delete('/anime/:id', asyncHandler(async (req, res) => {
  const anime = await Anime.findById(req.params.id);
  if (!anime) return res.status(404).json({ success: false, message: 'Anime not found' });

  // Delete all episodes
  const episodes = await Episode.find({ anime: anime._id }).select('+sources.storageKey');
  for (const ep of episodes) {
    for (const source of ep.sources) {
      if (source.storageKey) await deleteFromS3(source.storageKey).catch(() => {});
      if (source.hlsKey) await deleteFromS3(source.hlsKey).catch(() => {});
    }
  }

  await Episode.deleteMany({ anime: anime._id });
  await WatchProgress.deleteMany({ anime: anime._id });
  await anime.deleteOne();

  await cacheDelPattern(`anime:*`);
  res.json({ success: true, message: 'Anime and all episodes deleted' });
}));

// ─── UPLOAD ANIME IMAGE ───────────────────────────────────────────────────────
router.post('/anime/:id/images', upload.fields([
  { name: 'cover', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
  { name: 'logo', maxCount: 1 },
]), asyncHandler(async (req, res) => {
  const anime = await Anime.findById(req.params.id);
  if (!anime) return res.status(404).json({ success: false, message: 'Anime not found' });

  const updates = {};

  if (req.files?.cover?.[0]) {
    const url = await uploadToS3(req.files.cover[0], `anime/${anime._id}/cover`);
    updates.coverImage = { large: url };
  }

  if (req.files?.banner?.[0]) {
    updates.bannerImage = await uploadToS3(req.files.banner[0], `anime/${anime._id}/banner`);
  }

  if (req.files?.logo?.[0]) {
    updates.logoImage = await uploadToS3(req.files.logo[0], `anime/${anime._id}/logo`);
  }

  const updated = await Anime.findByIdAndUpdate(req.params.id, updates, { new: true });
  res.json({ success: true, data: updated });
}));

// ─── CREATE EPISODE ───────────────────────────────────────────────────────────
router.post('/anime/:animeId/episodes', [
  body('number').isInt({ min: 0 }),
  body('title').optional().trim(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const episode = await Episode.create({
    anime: req.params.animeId,
    ...req.body,
  });

  // Notify users who have this in their watchlist
  const { notifyNewEpisode } = await import('../services/notifications.js');
  await notifyNewEpisode(req.params.animeId, episode);

  res.status(201).json({ success: true, data: episode });
}));

// ─── BULK CREATE EPISODES ─────────────────────────────────────────────────────
router.post('/anime/:animeId/episodes/bulk', asyncHandler(async (req, res) => {
  const { episodes } = req.body;
  if (!Array.isArray(episodes) || episodes.length === 0) {
    return res.status(400).json({ success: false, message: 'episodes array required' });
  }

  const docs = episodes.map((ep) => ({ anime: req.params.animeId, ...ep }));
  const created = await Episode.insertMany(docs, { ordered: false });

  res.status(201).json({ success: true, data: created, count: created.length });
}));

// ─── ASSIGN VIDEO SOURCE TO EPISODE ──────────────────────────────────────────
// After uploading HLS to S3, admin registers the storage keys
router.patch('/episodes/:id/sources', asyncHandler(async (req, res) => {
  const { sources } = req.body; // [{ quality, storageKey, hlsKey, size }]

  const episode = await Episode.findByIdAndUpdate(
    req.params.id,
    { sources },
    { new: true }
  );

  if (!episode) return res.status(404).json({ success: false, message: 'Episode not found' });

  res.json({ success: true, data: episode });
}));

// ─── UPDATE EPISODE ───────────────────────────────────────────────────────────
router.patch('/episodes/:id', asyncHandler(async (req, res) => {
  const episode = await Episode.findByIdAndUpdate(req.params.id, req.body, {
    new: true, runValidators: true,
  });
  if (!episode) return res.status(404).json({ success: false, message: 'Episode not found' });
  res.json({ success: true, data: episode });
}));

// ─── DELETE EPISODE ───────────────────────────────────────────────────────────
router.delete('/episodes/:id', asyncHandler(async (req, res) => {
  const episode = await Episode.findById(req.params.id).select('+sources.storageKey +sources.hlsKey');
  if (!episode) return res.status(404).json({ success: false, message: 'Episode not found' });

  // Delete S3 files
  for (const source of episode.sources) {
    if (source.storageKey) await deleteFromS3(source.storageKey).catch(() => {});
    if (source.hlsKey) await deleteFromS3(source.hlsKey).catch(() => {});
  }

  await episode.deleteOne();
  res.json({ success: true, message: 'Episode deleted' });
}));

// ─── MANAGE USERS ─────────────────────────────────────────────────────────────
router.get('/users', asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, role, search } = req.query;

  const filter = {};
  if (role) filter.role = role;
  if (search) filter.$or = [
    { email: { $regex: search, $options: 'i' } },
    { username: { $regex: search, $options: 'i' } },
  ];

  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .select('-password -refreshToken');

  const total = await User.countDocuments(filter);
  res.json({ success: true, data: users, pagination: { total } });
}));

router.patch('/users/:id/role', asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['free', 'premium', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  res.json({ success: true, data: user });
}));

// ─── BROADCAST NOTIFICATION ───────────────────────────────────────────────────
router.post('/notifications/broadcast', asyncHandler(async (req, res) => {
  const { title, message, link, type = 'system', userFilter = {} } = req.body;

  const users = await User.find(userFilter).select('_id');
  const notifications = users.map((u) => ({
    user: u._id, type, title, message, link,
  }));

  await Notification.insertMany(notifications, { ordered: false });

  res.json({ success: true, message: `Notified ${notifications.length} users` });
}));

export default router;
