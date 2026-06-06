import { Router } from 'express';
import { Watchlist } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

const router = Router();
router.use(protect);

router.get('/', asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = { user: req.user._id };
  if (status) filter.status = status;
  const list = await Watchlist.find(filter).sort({ updatedAt: -1 })
    .populate('anime', 'title coverImage slug score status episodeCount genres');
  res.json({ success: true, data: list });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { animeId, status = 'plan_to_watch', userScore, notes } = req.body;
  if (!animeId) return res.status(400).json({ success: false, message: 'animeId required' });
  const entry = await Watchlist.findOneAndUpdate(
    { user: req.user._id, anime: animeId },
    { status, userScore, notes },
    { upsert: true, new: true }
  );
  res.json({ success: true, data: entry });
}));

router.delete('/:animeId', asyncHandler(async (req, res) => {
  await Watchlist.findOneAndDelete({ user: req.user._id, anime: req.params.animeId });
  res.json({ success: true, message: 'Removed from watchlist' });
}));

export default router;
