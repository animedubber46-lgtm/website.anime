import { Router } from 'express';
import { Episode, Comment } from '../models/index.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { body, validationResult } from 'express-validator';

const router = Router();

// GET episode by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const episode = await Episode.findById(req.params.id)
    .select('number title description thumbnail duration airDate isPremium isFiller views anime');
  if (!episode) return res.status(404).json({ success: false, message: 'Episode not found' });
  res.json({ success: true, data: episode });
}));

// GET comments for episode
router.get('/:id/comments', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const comments = await Comment.find({ episode: req.params.id, isDeleted: false, parent: null })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate('user', 'username avatar role');
  const total = await Comment.countDocuments({ episode: req.params.id, isDeleted: false, parent: null });
  res.json({ success: true, data: comments, pagination: { total } });
}));

// POST comment
router.post('/:id/comments', protect, [
  body('content').trim().notEmpty().isLength({ max: 2000 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const comment = await Comment.create({
    user: req.user._id,
    episode: req.params.id,
    content: req.body.content,
    isSpoiler: req.body.isSpoiler || false,
    parent: req.body.parentId || null,
    timestamp: req.body.timestamp,
  });
  await comment.populate('user', 'username avatar role');
  res.status(201).json({ success: true, data: comment });
}));

// DELETE comment (own or admin)
router.delete('/:epId/comments/:commentId', protect, asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });
  if (comment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  comment.isDeleted = true;
  comment.content = '[deleted]';
  await comment.save();
  res.json({ success: true });
}));

export default router;
