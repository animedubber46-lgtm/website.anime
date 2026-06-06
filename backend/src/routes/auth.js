import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/index.js';
import { generateTokens, protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { cacheSet, cacheDel } from '../config/redis.js';
import { sendEmail } from '../services/email.js';

const router = Router();

// ─── REGISTER ─────────────────────────────────────────────────────────────────
router.post('/register', [
  body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { username, email, password } = req.body;

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: existingUser.email === email ? 'Email already in use' : 'Username taken',
    });
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const user = await User.create({
    username,
    email,
    password,
    emailVerificationToken: crypto.createHash('sha256').update(verificationToken).digest('hex'),
  });

  // Send verification email
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  await sendEmail({
    to: email,
    subject: 'Verify your AnimeX account',
    template: 'verify-email',
    data: { username, verifyUrl },
  });

  const { accessToken, refreshToken } = generateTokens(user._id);

  // Store refresh token hash
  user.refreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await user.save({ validateBeforeSave: false });

  res.status(201).json({
    success: true,
    message: 'Account created. Please verify your email.',
    data: {
      user: { id: user._id, username, email, role: user.role, avatar: user.avatar },
      accessToken,
      refreshToken,
    },
  });
}));

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +refreshToken');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account has been suspended' });
  }

  const { accessToken, refreshToken } = generateTokens(user._id);

  user.refreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isPremium: user.isPremium(),
        subscription: user.subscription,
      },
      accessToken,
      refreshToken,
    },
  });
}));

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ success: false, message: 'Refresh token required' });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }

  const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const user = await User.findOne({ _id: decoded.id, refreshToken: hashedToken });

  if (!user) {
    return res.status(401).json({ success: false, message: 'Token reuse detected' });
  }

  const tokens = generateTokens(user._id);
  user.refreshToken = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, data: tokens });
}));

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
router.post('/logout', protect, asyncHandler(async (req, res) => {
  // Blacklist access token until expiry
  await cacheSet(`blacklist:${req.token}`, 1, 15 * 60); // 15 min TTL

  // Clear refresh token
  await User.findByIdAndUpdate(req.user._id, { refreshToken: null });

  // Invalidate user cache
  await cacheDel(`user:${req.user._id}`);

  res.json({ success: true, message: 'Logged out successfully' });
}));

// ─── VERIFY EMAIL ─────────────────────────────────────────────────────────────
router.get('/verify-email/:token', asyncHandler(async (req, res) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ emailVerificationToken: hashedToken });

  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: 'Email verified successfully' });
}));

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail(),
], asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  await sendEmail({
    to: email,
    subject: 'AnimeX Password Reset',
    template: 'reset-password',
    data: { username: user.username, resetUrl },
  });

  res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
}));

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
router.patch('/reset-password/:token', [
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
], asyncHandler(async (req, res) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ success: false, message: 'Token is invalid or has expired' });
  }

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken = undefined;
  await user.save();

  res.json({ success: true, message: 'Password reset successfully. Please log in.' });
}));

export default router;
