import Redis from 'ioredis';

let redis;

export async function connectRedis() {
  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    await redis.connect();
    console.log('✅ Redis connected');

    redis.on('error', (err) => {
      // Non-fatal: app works without cache
      console.warn('⚠️  Redis error (cache disabled):', err.message);
    });

  } catch (error) {
    console.warn('⚠️  Redis unavailable, continuing without cache:', error.message);
    redis = null;
  }
}

export function getRedis() {
  return redis;
}

// Cache helpers
export async function cacheGet(key) {
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

export async function cacheSet(key, value, ttlSeconds = 300) {
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch { /* silent */ }
}

export async function cacheDel(key) {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch { /* silent */ }
}

export async function cacheDelPattern(pattern) {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch { /* silent */ }
}
