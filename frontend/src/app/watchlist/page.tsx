'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { List, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const STATUSES = [
  { key: '', label: 'All' }, { key: 'watching', label: 'Watching' },
  { key: 'completed', label: 'Completed' }, { key: 'plan_to_watch', label: 'Plan to Watch' },
  { key: 'on_hold', label: 'On Hold' }, { key: 'dropped', label: 'Dropped' }, { key: 'favorite', label: '❤️ Favorites' },
];

export default function WatchlistPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [activeStatus, setActiveStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    load();
  }, [user, activeStatus]);

  const load = async () => {
    setLoading(true);
    const params = activeStatus ? `?status=${activeStatus}` : '';
    const res = await api.get(`/users/me/watchlist${params}`).catch(() => null);
    if (res) setItems(res.data.data);
    setLoading(false);
  };

  const remove = async (animeId: string) => {
    await api.delete(`/users/me/watchlist/${animeId}`);
    setItems(prev => prev.filter(i => i.anime._id !== animeId));
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-animex-bg pt-24 pb-16 px-6 lg:px-16">
      <div className="max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <List className="w-6 h-6 text-animex-red" />
          <h1 className="text-2xl font-bold text-white">My Watchlist</h1>
          <span className="text-white/30 text-sm">({items.length})</span>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-6">
          {STATUSES.map(({ key, label }) => (
            <button key={key} onClick={() => setActiveStatus(key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeStatus === key ? 'bg-animex-red text-white' : 'bg-animex-card border border-animex-border text-white/60 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">{Array.from({length:12}).map((_,i)=><div key={i} className="aspect-[2/3] skeleton rounded-lg"/>)}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <List className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Your watchlist is empty</p>
            <Link href="/anime" className="inline-block mt-4 text-animex-red text-sm hover:underline">Browse anime →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {items.map((item: any) => (
              <div key={item._id} className="group relative">
                <Link href={`/anime/${item.anime.slug}`}>
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-animex-card">
                    {item.anime.coverImage?.medium && (
                      <img src={item.anime.coverImage.medium} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-white line-clamp-1">{item.anime.title?.english || item.anime.title?.romaji}</p>
                  <p className="text-xs text-white/30 capitalize">{item.status?.replace('_',' ')}</p>
                </Link>
                <button onClick={() => remove(item.anime._id)}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 text-white/60 hover:text-animex-red transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
