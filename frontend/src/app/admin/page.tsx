'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Film, Play, Eye, TrendingUp, Crown, Plus, Upload } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface Stats { totalUsers: number; premiumUsers: number; totalAnime: number; totalEpisodes: number; totalViews: number; newUsersThisMonth: number; }

export default function AdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard'|'anime'|'users'>('dashboard');
  const [creating, setCreating] = useState(false);
  const [newAnime, setNewAnime] = useState({ titleRomaji: '', titleEnglish: '', synopsis: '', genres: '', status: 'RELEASING', format: 'TV', seasonYear: '' });

  useEffect(() => {
    if (!user || user.role !== 'admin') { router.push('/'); return; }
    Promise.all([
      api.get('/admin/stats'),
      api.get('/anime?limit=50&sort=newest'),
    ]).then(([statsRes, animeRes]) => {
      setStats(statsRes.data.data);
      setAnimeList(animeRes.data.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const createAnime = async () => {
    if (!newAnime.titleRomaji) return;
    setCreating(true);
    try {
      await api.post('/admin/anime', {
        title: { romaji: newAnime.titleRomaji, english: newAnime.titleEnglish },
        synopsis: newAnime.synopsis,
        genres: newAnime.genres.split(',').map(g => g.trim()).filter(Boolean),
        status: newAnime.status, format: newAnime.format,
        seasonYear: newAnime.seasonYear ? parseInt(newAnime.seasonYear) : undefined,
      });
      const res = await api.get('/anime?limit=50&sort=newest');
      setAnimeList(res.data.data);
      setNewAnime({ titleRomaji: '', titleEnglish: '', synopsis: '', genres: '', status: 'RELEASING', format: 'TV', seasonYear: '' });
    } catch {} finally { setCreating(false); }
  };

  const deleteAnime = async (id: string) => {
    if (!confirm('Delete this anime and all its episodes?')) return;
    await api.delete(`/admin/anime/${id}`);
    setAnimeList(prev => prev.filter(a => a._id !== id));
  };

  if (!user || user.role !== 'admin') return null;

  const statCards = stats ? [
    { icon: Users, label: 'Total Users', value: stats.totalUsers.toLocaleString(), sub: `+${stats.newUsersThisMonth} this month`, color: 'blue' },
    { icon: Crown, label: 'Premium Users', value: stats.premiumUsers.toLocaleString(), sub: `${((stats.premiumUsers/Math.max(stats.totalUsers,1))*100).toFixed(1)}% of users`, color: 'gold' },
    { icon: Film, label: 'Anime Titles', value: stats.totalAnime.toLocaleString(), sub: 'In database', color: 'red' },
    { icon: Play, label: 'Episodes', value: stats.totalEpisodes.toLocaleString(), sub: 'Total episodes', color: 'purple' },
    { icon: Eye, label: 'Total Views', value: stats.totalViews.toLocaleString(), sub: 'All time', color: 'green' },
  ] : [];

  const inputCls = "w-full bg-animex-card border border-animex-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-animex-red/50 placeholder:text-white/20";

  return (
    <div className="min-h-screen bg-animex-bg pt-16">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <span className="text-xs bg-animex-red/10 border border-animex-red/30 text-animex-red px-3 py-1 rounded-full">ADMIN</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-animex-surface border border-animex-border rounded-xl p-1 mb-8 w-fit">
          {(['dashboard','anime','users'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'bg-animex-red text-white' : 'text-white/50 hover:text-white'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {statCards.map(({ icon: Icon, label, value, sub }) => (
              <div key={label} className="bg-animex-surface border border-animex-border rounded-xl p-5">
                <Icon className="w-5 h-5 text-animex-red mb-3" />
                <p className="text-2xl font-bold text-white">{loading ? '—' : value}</p>
                <p className="text-xs text-white/50 mt-1">{label}</p>
                <p className="text-xs text-white/30 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Anime management */}
        {activeTab === 'anime' && (
          <div className="space-y-6">
            {/* Create form */}
            <div className="bg-animex-surface border border-animex-border rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-animex-red" /> Add New Anime</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Title (Romaji) *" value={newAnime.titleRomaji} onChange={e => setNewAnime(p => ({ ...p, titleRomaji: e.target.value }))} className={inputCls} />
                <input placeholder="Title (English)" value={newAnime.titleEnglish} onChange={e => setNewAnime(p => ({ ...p, titleEnglish: e.target.value }))} className={inputCls} />
                <textarea placeholder="Synopsis" value={newAnime.synopsis} onChange={e => setNewAnime(p => ({ ...p, synopsis: e.target.value }))} className={`${inputCls} col-span-full h-20 resize-none`} />
                <input placeholder="Genres (comma-separated)" value={newAnime.genres} onChange={e => setNewAnime(p => ({ ...p, genres: e.target.value }))} className={inputCls} />
                <input placeholder="Season Year" type="number" value={newAnime.seasonYear} onChange={e => setNewAnime(p => ({ ...p, seasonYear: e.target.value }))} className={inputCls} />
                <select value={newAnime.format} onChange={e => setNewAnime(p => ({ ...p, format: e.target.value }))} className={inputCls}>
                  {['TV','MOVIE','OVA','ONA','SPECIAL'].map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={newAnime.status} onChange={e => setNewAnime(p => ({ ...p, status: e.target.value }))} className={inputCls}>
                  {['RELEASING','FINISHED','NOT_YET_RELEASED','HIATUS'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button onClick={createAnime} disabled={!newAnime.titleRomaji || creating}
                className="mt-4 flex items-center gap-2 bg-animex-red hover:bg-animex-red-dark disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
                <Upload className="w-4 h-4" /> {creating ? 'Creating...' : 'Create Anime'}
              </button>
            </div>

            {/* Anime list */}
            <div className="bg-animex-surface border border-animex-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-animex-border">
                <h2 className="font-semibold text-white">All Anime ({animeList.length})</h2>
              </div>
              <div className="divide-y divide-animex-border">
                {animeList.map((a: any) => (
                  <div key={a._id} className="flex items-center gap-4 px-5 py-3">
                    {a.coverImage?.medium && <img src={a.coverImage.medium} alt="" className="w-10 h-14 object-cover rounded" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{a.title?.english || a.title?.romaji}</p>
                      <p className="text-xs text-white/30">{a.format} • {a.status} • {a.seasonYear || '—'}</p>
                    </div>
                    <div className="flex gap-2">
                      <a href={`/anime/${a.slug}`} target="_blank" className="text-xs text-animex-red hover:underline">View</a>
                      <button onClick={() => deleteAnime(a._id)} className="text-xs text-white/30 hover:text-animex-red transition-colors">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-animex-surface border border-animex-border rounded-xl p-6">
            <p className="text-white/50 text-sm">User management panel — view and manage users, assign roles, and handle subscriptions via the API.</p>
            <a href="/api/admin/users" target="_blank" className="inline-block mt-4 text-animex-red text-sm hover:underline">Open Users API →</a>
          </div>
        )}
      </div>
    </div>
  );
}
