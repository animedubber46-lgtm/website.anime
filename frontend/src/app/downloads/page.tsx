'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2, Play, HardDrive, WifiOff } from 'lucide-react';
import { offlineStorage } from '@/lib/offlineStorage';

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function DownloadsPage() {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [storage, setStorage] = useState({ used: 0, available: 0 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [eps, stor] = await Promise.all([
      offlineStorage.getOfflineEpisodes(),
      offlineStorage.getStorageUsage(),
    ]);
    setEpisodes(eps);
    setStorage(stor);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    await offlineStorage.removeEpisode(id);
    load();
  };

  const totalSize = episodes.reduce((acc, ep) => acc + (ep.size || 0), 0);
  const usedPct = storage.available > 0 ? (storage.used / storage.available) * 100 : 0;

  return (
    <div className="min-h-screen bg-animex-bg pt-24 pb-16 px-6 lg:px-16">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <WifiOff className="w-6 h-6 text-animex-red" />
          <h1 className="text-2xl font-bold text-white">Offline Downloads</h1>
        </div>

        {/* Storage info */}
        <div className="bg-animex-surface border border-animex-border rounded-xl p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <HardDrive className="w-5 h-5 text-white/40" />
            <p className="text-sm text-white/60">Storage Used</p>
            <p className="text-sm font-semibold text-white ml-auto">{formatBytes(totalSize)}</p>
          </div>
          {storage.available > 0 && (
            <>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-animex-red rounded-full transition-all" style={{ width: `${Math.min(usedPct, 100)}%` }} />
              </div>
              <p className="text-xs text-white/30 mt-1">{formatBytes(storage.used)} of {formatBytes(storage.available)} used</p>
            </>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 skeleton rounded-xl" />)}
          </div>
        ) : episodes.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <WifiOff className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">No offline episodes</p>
            <p className="text-sm mt-1">Download episodes from any anime page to watch without internet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {episodes.map((ep) => (
              <div key={ep.id} className="flex items-center gap-4 bg-animex-surface border border-animex-border rounded-xl p-4 hover:border-animex-red/30 transition-colors">
                {ep.thumbnail && (
                  <img src={ep.thumbnail} alt="" className="w-24 aspect-video object-cover rounded-lg flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white line-clamp-1">{ep.animeTitle}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    Episode {ep.episodeNumber}{ep.episodeTitle ? ` — ${ep.episodeTitle}` : ''} • {ep.quality}
                  </p>
                  <p className="text-xs text-white/30 mt-0.5">{formatBytes(ep.size || 0)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/anime/${ep.animeSlug}/episode/${ep.episodeNumber}?offline=1`}
                    className="p-2 bg-animex-red/10 border border-animex-red/30 rounded-full text-animex-red hover:bg-animex-red/20 transition-colors">
                    <Play className="w-4 h-4 fill-current" />
                  </Link>
                  <button onClick={() => remove(ep.id)}
                    className="p-2 bg-white/5 border border-white/10 rounded-full text-white/40 hover:text-animex-red hover:border-animex-red/30 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
