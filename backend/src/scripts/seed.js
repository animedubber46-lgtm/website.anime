import 'dotenv/config';
import { connectDB } from '../config/database.js';
import { User, Anime } from '../models/index.js';

async function seed() {
  await connectDB();

  // Create admin user
  const admin = await User.findOneAndUpdate(
    { email: 'admin@animex.tv' },
    {
      username: 'admin',
      email: 'admin@animex.tv',
      password: 'Admin@123456',
      role: 'admin',
      isEmailVerified: true,
    },
    { upsert: true, new: true }
  );
  console.log('✅ Admin user ready:', admin.email);

  // Sample anime
  const sample = await Anime.findOneAndUpdate(
    { slug: 'attack-on-titan' },
    {
      title: { romaji: 'Shingeki no Kyojin', english: 'Attack on Titan', native: '進撃の巨人' },
      slug: 'attack-on-titan',
      synopsis: 'Humanity fights for survival against man-eating giants called Titans.',
      genres: ['Action', 'Drama', 'Fantasy', 'Military'],
      format: 'TV', status: 'FINISHED',
      seasonYear: 2013, season: 'SPRING',
      episodeCount: 25, episodeDuration: 24,
      score: { average: 9.0, count: 150000 },
      popularity: 980000, trending: 99, views: 5000000,
      isFeatured: true,
    },
    { upsert: true, new: true }
  );
  console.log('✅ Sample anime ready:', sample.title.english);

  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
