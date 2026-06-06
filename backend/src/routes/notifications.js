import { Router } from 'express';
import { Notification } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

const router = Router();
router.use(protect);

// ─── GET MY NOTIFICATIONS ─────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;

  const filter = { user: req.user._id };
  if (unreadOnly === 'true') filter.isRead = false;

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('relatedAnime', 'title coverImage slug'),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);

  res.json({ success: true, data: notifications, unreadCount });
}));

// ─── MARK AS READ ─────────────────────────────────────────────────────────────
router.patch('/:id/read', asyncHandler(async (req, res) => {
  await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isRead: true }
  );
  res.json({ success: true });
}));

router.patch('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  res.json({ success: true });
}));

// ─── DELETE NOTIFICATION ──────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  res.json({ success: true });
}));

export default router;
