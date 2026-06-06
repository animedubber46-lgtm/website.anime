'use client';
import Link from 'next/link';
import { Star, Play, Crown } from 'lucide-react';

interface AnimeCardProps {
  anime: {
    _id: string; slug: string;
    title: { romaji?: string; english?: string };
    coverImage?: { large?: string; medium?: string };
    score?: { average: number };
    status?: string; format?: string;
    isPremium?: boolean;
  };
}

export default function AnimeCard({ anime }: AnimeCardProps) {
  const title = anime.title?.english || anime.title?.romaji || 'Unknown';
  const cover = anime.coverImage?.medium || anime.coverImage?.large;

  return (
    <Link href={`/anime/${anime.slug}`} className="group block">
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-animex-card border border-animex-border/50">
        {cover ? (
          <img src={cover} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <Play className="w-8 h-8" />
          </div>
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-card-gradient opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          {anime.isPremium && (
            <span className="flex items-center gap-0.5 bg-animex-gold/90 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
              <Crown className="w-2.5 h-2.5" /> PRO
            </span>
          )}
          {anime.status === 'RELEASING' && (
            <span className="bg-animex-red/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">AIRING</span>
          )}
        </div>

        {/* Score */}
        {anime.score?.average > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm text-animex-gold text-xs font-bold px-1.5 py-0.5 rounded">
            <Star className="w-2.5 h-2.5 fill-current" />
            {anime.score.average.toFixed(1)}
          </div>
        )}

        {/* Play button on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-12 h-12 rounded-full bg-animex-red/90 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-animex-red/50">
            <Play className="w-5 h-5 text-white fill-current ml-0.5" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-2 px-0.5">
        <p className="text-sm text-white font-medium line-clamp-1 group-hover:text-animex-red transition-colors">{title}</p>
        <p className="text-xs text-white/40 mt-0.5">{anime.format} {anime.status === 'RELEASING' ? '• Airing' : ''}</p>
      </div>
    </Link>
  );
}
