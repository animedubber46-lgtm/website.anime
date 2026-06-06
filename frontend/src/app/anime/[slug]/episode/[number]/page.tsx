'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, Share2, AlertCircle } from 'lucide-react';
import VideoPlayer from '@/components/player/VideoPlayer';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { offlineStorage } from '@/lib/offlineStorage';

export default function WatchPage() {
  const { slug, number } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [episodeInfo, setEpisodeInfo] = useState<any>(null);
  const [streamData, setStreamData] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [infoRes, streamRes] = await Promise.all([
          api.get(`/anime/${slug}/episodes/${number}`),
          api.get(`/stream/episode/${episodeInfo?._id || ''}`, { params: { q: number } })
            .catch(() => null),
        ]);
        const info = infoRes.data.data;
        setEpisodeInfo(info);

        // Get stream data
        const streamResp = await api.get(`/stream/episode/${info.episode._id}`);
        setStreamData(streamResp.data.data);

        // Get watch progress if logged in
        if (user) {
          const progRes = await api.get(`/stream/progress/${info.episode._id}`).catch(() => null);
          if (progRes) setProgress(progRes.data.data);
        }

        // Check if downloaded offline
        const downloaded = await offlineStorage.isEpisodeDownloaded(info.episode._id);
        setIsDownloaded(downloaded);
      } catch (err: any) {
        const code = err.response?.data?.code;
        if (code === 'AUTH_REQUIRED') setError('auth');
        else if (code === 'PREMIUM_REQUIRED') setError('premium');
        else setError('general');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, number]);

  const handleDownload = async () => {
    if (!episodeInfo || !streamData || isDownloaded) return;
    setDownloading(true);
    try {
      const source = streamData.sources.find((s: any) => s.quality === '480p') || streamData.sources[0];
      const resp = await fetch(source.url);
      const buffer = await resp.arrayBuffer();
      await offlineStorage.saveEpisode({
        id: episodeInfo.episode._id,
        animeId: episodeInfo.anime._id,
        animeTitle: episodeInfo.anime.title?.english || episodeInfo.anime.title?.romaji,
        animeSlug: slug as string,
        episodeNumber: parseInt(number as string),
        episodeTitle: episodeInfo.episode.title || '',
        thumbnail: episodeInfo.episode.thumbnail || '',
        duration: episodeInfo.episode.duration || 0,
        quality: source.quality,
        size: buffer.byteLength,
      }, buffer);
      setIsDownloaded(true);
    } catch (e) {
      console.error('Download failed:', e);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-black pt-16 flex items-center justify-center">
      <div className="w-12 h-12 border-2 border-animex-red border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error === 'auth') return (
    <div className="min-h-screen bg-animex-bg pt-16 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-6">
        <AlertCircle className="w-12 h-12 text-animex-red mx-auto" />
        <h2 className="text-xl font-bold text-white">Login Required</h2>
        <p className="text-white/50">Please sign in to watch this episode.</p>
        <Link href={`/login?redirect=/anime/${slug}/episode/${number}`}
          className="inline-block bg-animex-red text-white px-6 py-2.5 rounded-full font-medium">Sign In</Link>
      </div>
    </div>
  );

  if (error === 'premium') return (
    <div className="min-h-screen bg-animex-bg pt-16 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-6">
        <div className="text-4xl mb-2">👑</div>
        <h2 className="text-xl font-bold text-white">Premium Content</h2>
        <p className="text-white/50">Upgrade to AnimeX Premium to watch this episode.</p>
        <Link href="/premium" className="inline-block bg-animex-gold text-black px-6 py-2.5 rounded-full font-bold">Upgrade to Premium</Link>
      </div>
    </div>
  );

  const ep = episodeInfo?.episode;
  const anime = episodeInfo?.anime;

  return (
    <div className="min-h-screen bg-black pt-16">
      {/* Player */}
      <div className="max-w-screen-xl mx-auto">
        {streamData ? (
          <VideoPlayer
            sources={streamData.sources}
            subtitles={streamData.subtitles}
            episodeId={ep._id}
            animeId={anime._id}
            initialTimestamp={progress?.timestamp || 0}
            duration={ep?.duration}
            autoPlay
          />
        ) : (
          <div className="aspect-video bg-animex-surface flex items-center justify-center">
            <p className="text-white/40">Stream unavailable</p>
          </div>
        )}
      </div>

      {/* Episode info bar */}
      <div className="max-w-screen-xl mx-auto px-4 lg:px-8 py-4 bg-animex-surface border-b border-animex-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <Link href={`/anime/${slug}`} className="text-animex-red text-sm hover:underline">
              {anime?.title?.english || anime?.title?.romaji}
            </Link>
            <h1 className="text-white font-semibold text-lg">
              Episode {ep?.number}{ep?.title ? ` — ${ep.title}` : ''}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Download button (PWA) */}
            {user && (
              <button
                onClick={handleDownload}
                disabled={isDownloaded || downloading}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                  isDownloaded
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10'
                }`}>
                <Download className="w-4 h-4" />
                {isDownloaded ? 'Downloaded' : downloading ? 'Saving...' : 'Download'}
              </button>
            )}
            {/* Prev/Next */}
            {episodeInfo?.prevEp && (
              <Link href={`/anime/${slug}/episode/${episodeInfo.prevEp.number}`}
                className="p-2 bg-white/5 border border-white/10 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </Link>
            )}
            {episodeInfo?.nextEp && (
              <Link href={`/anime/${slug}/episode/${episodeInfo.nextEp.number}`}
                className="p-2 bg-animex-red/20 border border-animex-red/30 rounded-full text-animex-red hover:bg-animex-red/30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
        {ep?.description && (
          <p className="text-white/50 text-sm mt-2 line-clamp-2">{ep.description}</p>
        )}
      </div>
    </div>
  );
}
