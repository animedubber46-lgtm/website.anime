import cron from 'node-cron';
import { User, Notification } from '../models/index.js';

// Clean old notifications every day at 2am
cron.schedule('0 2 * * *', async () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
  const result = await Notification.deleteMany({ createdAt: { $lt: cutoff }, isRead: true });
  console.log(`🗑️  Cleaned ${result.deletedCount} old notifications`);
});

// Expire premium subscriptions daily at 1am
cron.schedule('0 1 * * *', async () => {
  const result = await User.updateMany(
    { role: 'premium', 'subscription.endDate': { $lt: new Date() } },
    { role: 'free' }
  );
  console.log(`⏱️  Expired ${result.modifiedCount} premium subscriptions`);
});

console.log('⏰ Cron jobs registered');
