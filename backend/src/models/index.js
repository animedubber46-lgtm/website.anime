import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema, model } = mongoose;

// ─── USER SCHEMA ──────────────────────────────────────────────────────────────
const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false,
  },
  avatar: { type: String, default: null },
  role: {
    type: String,
    enum: ['free', 'premium', 'admin'],
    default: 'free',
  },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, select: false },
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  refreshToken: { type: String, select: false },
  subscription: {
    plan: { type: String, enum: ['monthly', 'yearly', null], default: null },
    startDate: Date,
    endDate: Date,
    stripeCustomerId: String,
    stripeSubscriptionId: String,
  },
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    autoPlay: { type: Boolean, default: true },
    defaultQuality: { type: String, default: 'auto' },
    language: { type: String, default: 'en' },
  },
  lastLogin: Date,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isPremium = function() {
  if (this.role === 'admin') return true;
  if (this.role !== 'premium') return false;
  return this.subscription?.endDate > new Date();
};

export const User = model('User', userSchema);

// ─── ANIME SCHEMA ─────────────────────────────────────────────────────────────
const animeSchema = new Schema({
  title: {
    romaji: { type: String, required: true, trim: true },
    english: { type: String, trim: true },
    native: { type: String, trim: true }, // Japanese
    synonyms: [String],
  },
  slug: { type: String, unique: true, lowercase: true },
  synopsis: { type: String, maxlength: 5000 },
  coverImage: {
    large: String,   // 460x650
    medium: String,  // 230x325
    color: String,   // dominant color hex
  },
  bannerImage: String,  // 1900x400
  logoImage: String,
  trailer: {
    site: { type: String, enum: ['youtube', 'dailymotion'] },
    id: String,
    thumbnail: String,
  },
  genres: [{ type: String, index: true }],
  tags: [{
    name: String,
    category: String,
    rank: Number,
    isAdult: Boolean,
  }],
  studios: [{ type: String }],
  format: {
    type: String,
    enum: ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'],
    index: true,
  },
  status: {
    type: String,
    enum: ['FINISHED', 'RELEASING', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS'],
    index: true,
  },
  season: {
    type: String,
    enum: ['WINTER', 'SPRING', 'SUMMER', 'FALL', null],
  },
  seasonYear: { type: Number, index: true },
  startDate: {
    year: Number,
    month: Number,
    day: Number,
  },
  endDate: {
    year: Number,
    month: Number,
    day: Number,
  },
  episodeCount: Number,
  episodeDuration: Number, // minutes
  score: {
    average: { type: Number, default: 0, min: 0, max: 10 },
    count: { type: Number, default: 0 },
  },
  popularity: { type: Number, default: 0, index: true },
  trending: { type: Number, default: 0, index: true },
  views: { type: Number, default: 0, index: true },
  isAdult: { type: Boolean, default: false },
  isPremium: { type: Boolean, default: false }, // premium-only content
  isFeatured: { type: Boolean, default: false },
  recommendations: [{ type: Schema.Types.ObjectId, ref: 'Anime' }],
}, { timestamps: true });

// Full-text search index
animeSchema.index({
  'title.romaji': 'text',
  'title.english': 'text',
  'title.synonyms': 'text',
  synopsis: 'text',
}, { weights: { 'title.romaji': 10, 'title.english': 10, 'title.synonyms': 5, synopsis: 1 } });

animeSchema.index({ genres: 1, status: 1, seasonYear: -1 });

export const Anime = model('Anime', animeSchema);

// ─── EPISODE SCHEMA ───────────────────────────────────────────────────────────
const episodeSchema = new Schema({
  anime: { type: Schema.Types.ObjectId, ref: 'Anime', required: true, index: true },
  number: { type: Number, required: true },
  title: { type: String, trim: true },
  description: { type: String, maxlength: 2000 },
  thumbnail: String,
  duration: Number, // seconds
  airDate: Date,

  // HLS Video Sources
  sources: [{
    quality: {
      type: String,
      enum: ['360p', '480p', '720p', '1080p', '4K'],
    },
    // S3/R2 key (NOT the public URL — signed at request time)
    storageKey: { type: String, select: false },
    // HLS master playlist key
    hlsKey: { type: String, select: false },
    size: Number, // bytes
  }],

  // Subtitle tracks
  subtitles: [{
    language: String,
    label: String,
    storageKey: String,
    default: { type: Boolean, default: false },
  }],

  isPremium: { type: Boolean, default: false },
  isFiller: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
}, { timestamps: true });

episodeSchema.index({ anime: 1, number: 1 }, { unique: true });

export const Episode = model('Episode', episodeSchema);

// ─── WATCH PROGRESS SCHEMA ────────────────────────────────────────────────────
const watchProgressSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  anime: { type: Schema.Types.ObjectId, ref: 'Anime', required: true },
  episode: { type: Schema.Types.ObjectId, ref: 'Episode', required: true },
  timestamp: { type: Number, default: 0 }, // seconds
  duration: { type: Number, default: 0 },  // total episode duration
  completed: { type: Boolean, default: false },
  lastWatched: { type: Date, default: Date.now },
}, { timestamps: true });

watchProgressSchema.index({ user: 1, episode: 1 }, { unique: true });
watchProgressSchema.index({ user: 1, lastWatched: -1 });
watchProgressSchema.index({ user: 1, anime: 1 });

export const WatchProgress = model('WatchProgress', watchProgressSchema);

// ─── WATCHLIST SCHEMA ─────────────────────────────────────────────────────────
const watchlistSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  anime: { type: Schema.Types.ObjectId, ref: 'Anime', required: true },
  status: {
    type: String,
    enum: ['watching', 'completed', 'plan_to_watch', 'dropped', 'on_hold', 'favorite'],
    default: 'plan_to_watch',
  },
  userScore: { type: Number, min: 1, max: 10 },
  notes: { type: String, maxlength: 500 },
}, { timestamps: true });

watchlistSchema.index({ user: 1, anime: 1 }, { unique: true });
watchlistSchema.index({ user: 1, status: 1 });

export const Watchlist = model('Watchlist', watchlistSchema);

// ─── RATING / REVIEW SCHEMA ───────────────────────────────────────────────────
const ratingSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  anime: { type: Schema.Types.ObjectId, ref: 'Anime', required: true },
  score: { type: Number, required: true, min: 1, max: 10 },
  review: { type: String, maxlength: 3000 },
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  isSpoiler: { type: Boolean, default: false },
}, { timestamps: true });

ratingSchema.index({ user: 1, anime: 1 }, { unique: true });
ratingSchema.index({ anime: 1, score: -1 });

export const Rating = model('Rating', ratingSchema);

// ─── NOTIFICATION SCHEMA ──────────────────────────────────────────────────────
const notificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['new_episode', 'new_anime', 'system', 'subscription'],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: String,
  image: String,
  isRead: { type: Boolean, default: false, index: true },
  relatedAnime: { type: Schema.Types.ObjectId, ref: 'Anime' },
  relatedEpisode: { type: Schema.Types.ObjectId, ref: 'Episode' },
}, { timestamps: true });

notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = model('Notification', notificationSchema);

// ─── COMMENT SCHEMA ───────────────────────────────────────────────────────────
const commentSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  episode: { type: Schema.Types.ObjectId, ref: 'Episode', required: true, index: true },
  content: { type: String, required: true, maxlength: 2000 },
  timestamp: Number, // video timestamp (for "at this moment" comments)
  isSpoiler: { type: Boolean, default: false },
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  parent: { type: Schema.Types.ObjectId, ref: 'Comment' },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

commentSchema.index({ episode: 1, createdAt: -1 });

export const Comment = model('Comment', commentSchema);
