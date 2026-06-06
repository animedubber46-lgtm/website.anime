'use client';
import Link from 'next/link';
import { Play, Clock } from 'lucide-react';

interface ContinueWatchingProps {
  items: any[];
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ContinueWatching({ items }: ContinueWatchingProps) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-animex-red" /> Continue Watching
      </h2>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {items.map((item: any) => {
          const progress = item.duration > 0 ? (item.timestamp / item.duration) * 100 : 0;
          return (
            <Link
              key={item._id}
              href={`/anime/${item.anime?.slug}/episode/${item.episode?.number}`}
              className="flex-shrink-0 w-56 group"
            >
              <div className="relative aspect-video rounded-lg overflow-hidden bg-animex-card">
                {item.episode?.thumbnail ? (
                  <img src={item.episode.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full bg-animex-surface" />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-animex-red flex items-center justify-center">
                    <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                  </div>
                </div>
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                  <div className="h-full bg-animex-red transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="mt-1.5 px-0.5">
                <p className="text-xs font-medium text-white line-clamp-1">{item.anime?.title?.romaji || item.anime?.title?.english}</p>
                <p className="text-xs text-white/40">Ep {item.episode?.number} • {formatTime(item.timestamp)} left</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
