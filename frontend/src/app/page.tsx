'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, Plus, Info, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import AnimeCard from '@/components/ui/AnimeCard';
import AnimeRow from '@/components/ui/AnimeRow';
import SkeletonCard from '@/components/ui/SkeletonCard';
import ContinueWatching from '@/components/ui/ContinueWatching';

export default function HomePage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [continueWatching, setContinueWatching] = useState([]);

  useEffect(() => {
    api.get('/anime/homepage').then(res => {
      setData(res.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get('/stream/continue-watching').then(res => {
      setContinueWatching(res.data.data);
    }).catch(() => {});
  }, [user]);

  // Auto-rotate hero
  useEffect(() => {
    if (!data?.featured?.length) return;
    const t = setInterval(() => {
      setHeroIndex(i => (i + 1) % data.featured.length);
    }, 7000);
    return () => clearInterval(t);
  }, [data?.featured?.length]);

  const hero = data?.featured?.[heroIndex];

  return (
    <div className="min-h-screen bg-animex-bg">
      {/* ─── HERO BANNER ─── */}
      <section className="relative h-[80vh] min-h-[500px] overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 skeleton" />
        ) : hero ? (
          <>
            {/* Background image */}
            <div className="absolute inset-0 transition-opacity duration-1000">
              <img
                src={hero.bannerImage || hero.coverImage?.large}
                alt={hero.title?.romaji}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-hero-gradient" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-animex-bg" />
            </div>

            {/* Hero content */}
            <div className="relative z-10 h-full flex flex-col justify-end pb-16 px-6 lg:px-16 max-w-2xl">
              <div className="animate-slide-up">
                <h1 className="font-display text-3xl md:text-5xl font-bold text-white mb-3 drop-shadow-2xl">
                  {hero.title?.romaji || hero.title?.english}
                </h1>
                {hero.synopsis && (
                  <p className="text-white/70 text-sm md:text-base line-clamp-2 mb-5">
                    {hero.synopsis}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <Link
                    href={`/anime/${hero.slug}`}
                    className="flex items-center gap-2 bg-animex-red hover:bg-animex-red-dark text-white px-6 py-2.5 rounded-full font-semibold transition-colors shadow-lg shadow-animex-red/30"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Watch Now
                  </Link>
                  <Link
                    href={`/anime/${hero.slug}`}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-5 py-2.5 rounded-full font-medium transition-colors border border-white/10"
                  >
                    <Info className="w-4 h-4" />
                    Details
                  </Link>
                </div>
              </div>
            </div>

            {/* Hero dots */}
            {data.featured.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {data.featured.map((_: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => setHeroIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === heroIndex ? 'bg-animex-red w-6' : 'bg-white/40 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>

      {/* ─── CONTINUE WATCHING ─── */}
      {user && continueWatching.length > 0 && (
        <section className="px-6 lg:px-16 -mt-6 relative z-10 mb-8">
          <ContinueWatching items={continueWatching} />
        </section>
      )}

      {/* ─── ANIME SECTIONS ─── */}
      <div className="px-6 lg:px-16 space-y-10 pb-16">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton h-6 w-40 rounded mb-4" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, j) => <SkeletonCard key={j} />)}
              </div>
            </div>
          ))
        ) : (
          <>
            {data?.trending?.length > 0 && (
              <AnimeRow title="🔥 Trending Now" anime={data.trending} viewAllHref="/anime?sort=trending" />
            )}
            {data?.ongoing?.length > 0 && (
              <AnimeRow title="📺 Currently Airing" anime={data.ongoing} viewAllHref="/anime?status=RELEASING" />
            )}
            {data?.latest?.length > 0 && (
              <AnimeRow title="✨ Recently Added" anime={data.latest} viewAllHref="/anime?sort=newest" />
            )}
            {data?.topRated?.length > 0 && (
              <AnimeRow title="⭐ Top Rated" anime={data.topRated} viewAllHref="/anime?sort=score" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
