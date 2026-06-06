import { Router } from 'express';
import { body } from 'express-validator';
import { User, WatchProgress, Watchlist, Rating } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { cacheDelPattern } from '../config/redis.js';

const router = Router();
router.use(protect);

// ─── GET PROFILE ──────────────────────────────────────────────────────────────
router.get('/me', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password -refreshToken');
  res.json({ success: true, data: user });
}));

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────
router.patch('/me', [
  body('username').optional().trim().isLength({ min: 3, max: 30 }),
  body('preferences').optional().isObject(),
], asyncHandler(async (req, res) => {
  const allowed = ['username', 'avatar', 'preferences'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true, runValidators: true,
  }).select('-password -refreshToken');

  await cacheDelPattern(`user:${req.user._id}`);
  res.json({ success: true, data: user });
}));

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
router.patch('/me/password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
], asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  const isCorrect = await user.comparePassword(req.body.currentPassword);
  if (!isCorrect) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = req.body.newPassword;
  user.refreshToken = undefined; // Invalidate all sessions
  await user.save();

  res.json({ success: true, message: 'Password changed successfully' });
}));

// ─── WATCH HISTORY ────────────────────────────────────────────────────────────
router.get('/me/history', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const history = await WatchProgress.find({ user: req.user._id })
    .sort({ lastWatched: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate('anime', 'title coverImage slug')
    .populate('episode', 'number title thumbnail duration');

  res.json({ success: true, data: history });
}));

router.delete('/me/history', asyncHandler(async (req, res) => {
  await WatchProgress.deleteMany({ user: req.user._id });
  res.json({ success: true, message: 'Watch history cleared' });
}));

// ─── WATCHLIST ────────────────────────────────────────────────────────────────
router.get('/me/watchlist', asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = { user: req.user._id };
  if (status) filter.status = status;

  const watchlist = await Watchlist.find(filter)
    .sort({ updatedAt: -1 })
    .populate('anime', 'title coverImage slug score status episodeCount');

  res.json({ success: true, data: watchlist });
}));

router.post('/me/watchlist', asyncHandler(async (req, res) => {
  const { animeId, status = 'plan_to_watch', userScore, notes } = req.body;

  const entry = await Watchlist.findOneAndUpdate(
    { user: req.user._id, anime: animeId },
    { status, userScore, notes },
    { upsert: true, new: true }
  );

  res.json({ success: true, data: entry });
}));

router.delete('/me/watchlist/:animeId', asyncHandler(async (req, res) => {
  await Watchlist.findOneAndDelete({ user: req.user._id, anime: req.params.animeId });
  res.json({ success: true, message: 'Removed from watchlist' });
}));

// ─── FAVORITES ────────────────────────────────────────────────────────────────
router.get('/me/favorites', asyncHandler(async (req, res) => {
  const favorites = await Watchlist.find({ user: req.user._id, status: 'favorite' })
    .populate('anime', 'title coverImage slug score');
  res.json({ success: true, data: favorites });
}));

// ─── MY RATINGS ───────────────────────────────────────────────────────────────
router.get('/me/ratings', asyncHandler(async (req, res) => {
  const ratings = await Rating.find({ user: req.user._id })
    .sort({ updatedAt: -1 })
    .populate('anime', 'title coverImage slug');
  res.json({ success: true, data: ratings });
}));

export default router;
