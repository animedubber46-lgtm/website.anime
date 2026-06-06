'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { History, Trash2, Play } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function HistoryPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    api.get('/users/me/history?limit=50').then(res => setHistory(res.data.data)).finally(() => setLoading(false));
  }, [user]);

  const clearHistory = async () => {
    if (!confirm('Clear all watch history?')) return;
    await api.delete('/users/me/history');
    setHistory([]);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatProgress = (ts: number, dur: number) => dur > 0 ? `${Math.round((ts/dur)*100)}%` : '';

  if (!user) return null;

  return (
    <div className="min-h-screen bg-animex-bg pt-24 pb-16 px-6 lg:px-16">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-animex-red" />
            <h1 className="text-2xl font-bold text-white">Watch History</h1>
          </div>
          {history.length > 0 && (
            <button onClick={clearHistory} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-animex-red transition-colors">
              <Trash2 className="w-4 h-4" /> Clear All
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({length:8}).map((_,i)=><div key={i} className="h-20 skeleton rounded-xl"/>)}</div>
        ) : history.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No watch history yet</p>
            <Link href="/" className="inline-block mt-4 text-animex-red text-sm hover:underline">Start watching →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item: any) => {
              const progress = item.duration > 0 ? (item.timestamp / item.duration) * 100 : 0;
              return (
                <Link key={item._id} href={`/anime/${item.anime?.slug}/episode/${item.episode?.number}`}
                  className="flex items-center gap-4 bg-animex-surface border border-animex-border rounded-xl p-4 hover:border-animex-red/30 transition-colors group">
                  <div className="relative w-28 aspect-video flex-shrink-0 rounded-lg overflow-hidden bg-animex-card">
                    {item.episode?.thumbnail ? (
                      <img src={item.episode.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : <div className="w-full h-full" />}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-5 h-5 text-white fill-current" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div className="h-full bg-animex-red" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white line-clamp-1">{item.anime?.title?.english || item.anime?.title?.romaji}</p>
                    <p className="text-xs text-white/40 mt-0.5">Episode {item.episode?.number}{item.episode?.title ? ` — ${item.episode.title}` : ''}</p>
                    <p className="text-xs text-white/30 mt-1">{formatDate(item.lastWatched)} {item.duration > 0 && `• ${formatProgress(item.timestamp, item.duration)} watched`}</p>
                    {item.completed && <span className="text-xs text-green-400">✓ Completed</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
