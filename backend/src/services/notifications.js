import { Notification, Watchlist, User } from '../models/index.js';
import { sendEmail } from './email.js';

/**
 * Notify all users who have an anime in their watchlist when a new episode drops.
 */
export async function notifyNewEpisode(animeId, episode) {
  try {
    // Find all users watching/planning this anime
    const watchlistEntries = await Watchlist.find({
      anime: animeId,
      status: { $in: ['watching', 'plan_to_watch', 'favorite'] },
    }).populate('user', 'email username preferences').populate('anime', 'title coverImage slug');

    if (watchlistEntries.length === 0) return;

    const anime = watchlistEntries[0].anime;
    const notifications = watchlistEntries.map((entry) => ({
      user: entry.user._id,
      type: 'new_episode',
      title: `New episode: ${anime.title.romaji || anime.title.english}`,
      message: `Episode ${episode.number}${episode.title ? ` — ${episode.title}` : ''} is now available!`,
      link: `/anime/${anime.slug}/episode/${episode.number}`,
      image: anime.coverImage?.medium,
      relatedAnime: anime._id,
      relatedEpisode: episode._id,
    }));

    // Batch insert notifications
    await Notification.insertMany(notifications, { ordered: false });

    // Email notifications (only for users who have enabled them)
    const emailUsers = watchlistEntries
      .filter((e) => e.user.preferences?.emailNotifications)
      .slice(0, 1000); // Rate limit

    for (const entry of emailUsers) {
      await sendEmail({
        to: entry.user.email,
        template: 'new-episode',
        data: {
          username: entry.user.username,
          animeTitle: anime.title.romaji || anime.title.english,
          episodeNumber: episode.number,
          episodeTitle: episode.title,
          watchUrl: `${process.env.FRONTEND_URL}/anime/${anime.slug}/episode/${episode.number}`,
          coverImage: anime.coverImage?.large,
        },
      });
    }

    console.log(`📢 Notified ${notifications.length} users about new episode`);
  } catch (error) {
    console.error('Failed to send new episode notifications:', error.message);
  }
}
