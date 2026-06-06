import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { cacheGet, cacheSet } from '../config/redis.js';

export function generateTokens(userId) {
  const accessToken = jwt.sign(
    { id: userId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
  return { accessToken, refreshToken };
}

export async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Check token blacklist (logged out tokens)
    const isBlacklisted = await cacheGet(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ success: false, message: 'Token has been invalidated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Cache user to reduce DB hits
    let user = await cacheGet(`user:${decoded.id}`);
    if (!user) {
      user = await User.findById(decoded.id).select('+role +subscription');
      if (!user || !user.isActive) {
        return res.status(401).json({ success: false, message: 'User not found or deactivated' });
      }
      await cacheSet(`user:${decoded.id}`, user, 60); // 60s cache
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.userId = decoded.id;
  } catch { /* ignore */ }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

export function requirePremium(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (!req.user.isPremium()) {
    return res.status(403).json({
      success: false,
      message: 'Premium subscription required',
      code: 'PREMIUM_REQUIRED',
    });
  }
  next();
}
