'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Play, Plus, Check, Star, Clock, BookOpen, Heart, ChevronDown } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function AnimeDetailPage() {
  const { slug } = useParams();
  const { user } = useAuthStore();
  const [anime, setAnime] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlistStatus, setWatchlistStatus] = useState<string | null>(null);
  const [showAllEpisodes, setShowAllEpisodes] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/anime/${slug}`),
      api.get(`/anime/${slug}/episodes`),
    ]).then(([animeRes, epRes]) => {
      setAnime(animeRes.data.data);
      setEpisodes(epRes.data.data);
      setWatchlistStatus(animeRes.data.data.userWatchlist?.status || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [slug]);

  const addToWatchlist = async (status: string) => {
    if (!user) return;
    try {
      await api.post('/watchlist', { animeId: anime._id, status });
      setWatchlistStatus(status);
    } catch {}
  };

  if (loading) return (
    <div className="min-h-screen bg-animex-bg pt-16">
      <div className="h-72 skeleton" />
      <div className="max-w-6xl mx-auto px-6 mt-8 grid grid-cols-3 gap-8">
        <div className="aspect-[2/3] skeleton rounded-xl" />
        <div className="col-span-2 space-y-4">
          {[80, 60, 100, 90].map((w, i) => <div key={i} className={`h-4 skeleton rounded w-${w === 100 ? 'full' : w+'%'}`} />)}
        </div>
      </div>
    </div>
  );

  if (!anime) return <div className="min-h-screen flex items-center justify-center text-white/50">Anime not found</div>;

  const displayEpisodes = showAllEpisodes ? episodes : episodes.slice(0, 24);
  const title = anime.title?.english || anime.title?.romaji;
  const firstEp = episodes[0];

  return (
    <div className="min-h-screen bg-animex-bg">
      {/* Banner */}
      <div className="relative h-72 md:h-96 overflow-hidden">
        {anime.bannerImage ? (
          <img src={anime.bannerImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-animex-surface" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-animex-bg" />
      </div>

      <div className="max-w-6xl mx-auto px-6 -mt-32 relative z-10 pb-16">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Cover */}
          <div className="flex-shrink-0">
            <div className="w-44 md:w-52 rounded-xl overflow-hidden shadow-2xl border border-animex-border">
              {anime.coverImage?.large ? (
                <img src={anime.coverImage.large} alt={title} className="w-full aspect-[2/3] object-cover" />
              ) : (
                <div className="w-full aspect-[2/3] bg-animex-card" />
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 pt-4 md:pt-16">
            <div className="flex flex-wrap gap-2 mb-2">
              {anime.genres?.slice(0, 4).map((g: string) => (
                <Link key={g} href={`/anime?genre=${encodeURIComponent(g)}`}
                  className="text-xs px-2 py-0.5 bg-animex-red/10 border border-animex-red/20 text-animex-red rounded-full hover:bg-animex-red/20 transition-colors">
                  {g}
                </Link>
              ))}
            </div>

            <h1 className="text-2xl md:text-4xl font-display font-bold text-white mb-1">{title}</h1>
            {anime.title?.romaji && anime.title?.romaji !== title && (
              <p className="text-white/40 text-sm mb-3">{anime.title.romaji}</p>
            )}

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-white/60">
              {anime.score?.average > 0 && (
                <span className="flex items-center gap-1 text-animex-gold font-semibold">
                  <Star className="w-4 h-4 fill-current" /> {anime.score.average.toFixed(1)}
                  <span className="text-white/30 font-normal">({anime.score.count?.toLocaleString()})</span>
                </span>
              )}
              {anime.episodeCount && <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" />{anime.episodeCount} eps</span>}
              {anime.episodeDuration && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{anime.episodeDuration} min</span>}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${anime.status === 'RELEASING' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/50'}`}>
                {anime.status?.replace('_', ' ')}
              </span>
              {anime.seasonYear && <span>{anime.season} {anime.seasonYear}</span>}
            </div>

            {/* Synopsis */}
            {anime.synopsis && <p className="text-white/70 text-sm leading-relaxed mb-5 max-w-2xl line-clamp-4">{anime.synopsis}</p>}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {firstEp && (
                <Link href={`/anime/${slug}/episode/${firstEp.number}`}
                  className="flex items-center gap-2 bg-animex-red hover:bg-animex-red-dark text-white px-6 py-2.5 rounded-full font-semibold transition-colors shadow-lg shadow-animex-red/30">
                  <Play className="w-4 h-4 fill-current" />
                  {episodes.length > 1 ? 'Watch Ep 1' : 'Watch Now'}
                </Link>
              )}
              {user && (
                <button
                  onClick={() => addToWatchlist(watchlistStatus ? 'watching' : 'plan_to_watch')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-colors border ${
                    watchlistStatus
                      ? 'bg-animex-red/10 border-animex-red/40 text-animex-red'
                      : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  }`}>
                  {watchlistStatus ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {watchlistStatus ? 'In Watchlist' : 'Add to List'}
                </button>
              )}
              {user && (
                <button
                  onClick={() => addToWatchlist('favorite')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors">
                  <Heart className={`w-4 h-4 ${watchlistStatus === 'favorite' ? 'fill-animex-red text-animex-red' : ''}`} />
                  Favorite
                </button>
              )}
            </div>

            {/* Studios */}
            {anime.studios?.length > 0 && (
              <p className="mt-4 text-xs text-white/30">
                Studio: <span className="text-white/60">{anime.studios.join(', ')}</span>
              </p>
            )}
          </div>
        </div>

        {/* Episodes */}
        {episodes.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-white mb-4">Episodes ({episodes.length})</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {displayEpisodes.map((ep: any) => (
                <Link key={ep._id} href={`/anime/${slug}/episode/${ep.number}`}
                  className="group flex flex-col bg-animex-card border border-animex-border hover:border-animex-red/50 rounded-lg overflow-hidden transition-all hover:scale-[1.02]">
                  <div className="relative aspect-video bg-animex-surface">
                    {ep.thumbnail ? (
                      <img src={ep.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-5 h-5 text-white/20" />
                      </div>
                    )}
                    {ep.isPremium && (
                      <div className="absolute top-1 right-1 bg-animex-gold text-black text-[9px] font-bold px-1 rounded">PRO</div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold text-white">Ep {ep.number}</p>
                    {ep.title && <p className="text-[10px] text-white/40 line-clamp-1">{ep.title}</p>}
                  </div>
                </Link>
              ))}
            </div>
            {episodes.length > 24 && (
              <button onClick={() => setShowAllEpisodes(!showAllEpisodes)}
                className="mt-4 w-full py-2 bg-animex-card border border-animex-border rounded-lg text-sm text-white/60 hover:text-white hover:border-animex-red/50 transition-colors flex items-center justify-center gap-2">
                {showAllEpisodes ? 'Show Less' : `Show All ${episodes.length} Episodes`}
                <ChevronDown className={`w-4 h-4 transition-transform ${showAllEpisodes ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        )}

        {/* Recommendations */}
        {anime.recommendations?.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-white mb-4">You May Also Like</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {anime.recommendations.map((rec: any) => (
                <Link key={rec._id} href={`/anime/${rec.slug}`} className="group">
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-animex-card">
                    {rec.coverImage?.medium && (
                      <img src={rec.coverImage.medium} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-white/60 group-hover:text-white line-clamp-1 transition-colors">
                    {rec.title?.english || rec.title?.romaji}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
