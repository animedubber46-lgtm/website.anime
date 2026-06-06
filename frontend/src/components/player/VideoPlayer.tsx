'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize,
         Settings, SkipForward, SkipBack, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

interface VideoSource {
  quality: string;
  url: string; // signed .m3u8 URL
}

interface Subtitle {
  language: string;
  label: string;
  url: string;
  default: boolean;
}

interface VideoPlayerProps {
  sources: VideoSource[];
  subtitles?: Subtitle[];
  episodeId: string;
  animeId: string;
  initialTimestamp?: number;
  duration?: number;
  onEnded?: () => void;
  autoPlay?: boolean;
}

export default function VideoPlayer({
  sources,
  subtitles = [],
  episodeId,
  animeId,
  initialTimestamp = 0,
  duration = 0,
  onEnded,
  autoPlay = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressSaveRef = useRef<NodeJS.Timeout>();
  const controlsHideRef = useRef<NodeJS.Timeout>();

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(duration);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [selectedQuality, setSelectedQuality] = useState('auto');
  const [showSettings, setShowSettings] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(true);

  // Auto-select quality based on connection speed
  const selectBestQuality = useCallback(() => {
    const nav = navigator as any;
    if (!nav.connection) return sources.find(s => s.quality === '720p') || sources[0];
    const conn = nav.connection;
    const downlink = conn.downlink || 10; // Mbps
    if (downlink >= 20) return sources.find(s => s.quality === '1080p') || sources[sources.length - 1];
    if (downlink >= 5) return sources.find(s => s.quality === '720p') || sources[1];
    if (downlink >= 2) return sources.find(s => s.quality === '480p') || sources[1];
    return sources.find(s => s.quality === '360p') || sources[0];
  }, [sources]);

  const loadSource = useCallback((source: VideoSource) => {
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        // ABR settings for adaptive bitrate
        abrEwmaFastLive: 3.0,
        abrEwmaSlowLive: 9.0,
        abrEwmaFastVoD: 3.0,
        abrEwmaSlowVoD: 9.0,
        abrMaxWithRealBitrate: true,
      });

      hls.loadSource(source.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        if (initialTimestamp > 0) {
          video.currentTime = initialTimestamp;
        }
        if (autoPlay) video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error('HLS fatal error:', data.type, data.details);
          setLoading(false);
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = source.url;
      video.addEventListener('loadedmetadata', () => {
        setLoading(false);
        if (initialTimestamp > 0) video.currentTime = initialTimestamp;
        if (autoPlay) video.play().catch(() => {});
      });
    }
  }, [initialTimestamp, autoPlay]);

  // Initial load
  useEffect(() => {
    const best = selectBestQuality();
    if (best) loadSource(best);

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, []);

  // Save progress every 5 seconds
  const saveProgress = useCallback(async (timestamp: number) => {
    if (!episodeId || timestamp < 5) return;
    try {
      await api.post('/stream/progress', {
        episodeId, animeId, timestamp, duration: videoDuration,
      });
    } catch { /* silent */ }
  }, [episodeId, animeId, videoDuration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      // Update buffered
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }

      // Save progress every 5s
      clearTimeout(progressSaveRef.current);
      progressSaveRef.current = setTimeout(() => saveProgress(video.currentTime), 5000);
    };

    const onLoadedMetadata = () => setVideoDuration(video.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      saveProgress(video.currentTime);
    };
    const onEnded = () => {
      setPlaying(false);
      saveProgress(video.duration);
      onEnded?.();
    };
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded as any);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded as any);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
    };
  }, [saveProgress, onEnded]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    playing ? video.pause() : video.play();
  };

  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = Math.max(0, Math.min(video.duration, seconds));
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    seek(pct * videoDuration);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsHideRef.current);
    controlsHideRef.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  };

  const changeQuality = (quality: string) => {
    const source = quality === 'auto'
      ? selectBestQuality()
      : sources.find(s => s.quality === quality);
    if (!source) return;

    const currentT = videoRef.current?.currentTime || 0;
    setSelectedQuality(quality);
    loadSource(source);

    // Restore time after quality change
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentT;
        videoRef.current.play().catch(() => {});
      }
    }, 500);
    setShowSettings(false);
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const progressPct = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;
  const bufferedPct = videoDuration > 0 ? (buffered / videoDuration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative bg-black w-full aspect-video group select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        playsInline
        crossOrigin="anonymous"
      >
        {subtitles.map((sub) => (
          <track
            key={sub.language}
            kind="subtitles"
            src={sub.url}
            srcLang={sub.language}
            label={sub.label}
            default={sub.default}
          />
        ))}
      </video>

      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 border-2 border-animex-red border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

        {/* Bottom controls */}
        <div className="relative z-10 px-4 pb-3 space-y-2">
          {/* Progress bar */}
          <div
            className="relative h-1.5 bg-white/20 rounded-full cursor-pointer group/progress hover:h-3 transition-all duration-150"
            onClick={handleProgressClick}
          >
            {/* Buffered */}
            <div
              className="absolute h-full bg-white/30 rounded-full"
              style={{ width: `${bufferedPct}%` }}
            />
            {/* Progress */}
            <div
              className="absolute h-full bg-animex-red rounded-full"
              style={{ width: `${progressPct}%` }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-animex-red rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity"
              style={{ left: `${progressPct}%`, transform: 'translate(-50%, -50%)' }}
            />
          </div>

          {/* Buttons row */}
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="text-white hover:text-animex-red transition-colors">
              {playing
                ? <Pause className="w-6 h-6" />
                : <Play className="w-6 h-6" />
              }
            </button>

            {/* Skip back 10s */}
            <button onClick={() => seek(currentTime - 10)} className="text-white hover:text-animex-red transition-colors">
              <SkipBack className="w-5 h-5" />
            </button>

            {/* Skip forward 10s */}
            <button onClick={() => seek(currentTime + 10)} className="text-white hover:text-animex-red transition-colors">
              <SkipForward className="w-5 h-5" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 group/vol">
              <button
                onClick={() => {
                  setMuted(!muted);
                  if (videoRef.current) videoRef.current.muted = !muted;
                }}
                className="text-white hover:text-animex-red transition-colors"
              >
                {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (videoRef.current) {
                    videoRef.current.volume = v;
                    videoRef.current.muted = v === 0;
                  }
                  setMuted(v === 0);
                }}
                className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-animex-red"
              />
            </div>

            {/* Time */}
            <span className="text-white text-sm font-mono ml-1">
              {formatTime(currentTime)} / {formatTime(videoDuration)}
            </span>

            <div className="flex-1" />

            {/* Quality selector */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-white hover:text-animex-red transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>

              {showSettings && (
                <div className="absolute bottom-8 right-0 bg-black/90 border border-white/10 rounded-lg p-2 min-w-[140px]">
                  <p className="text-xs text-white/50 px-2 mb-1">Quality</p>
                  {['auto', ...sources.map(s => s.quality)].map((q) => (
                    <button
                      key={q}
                      onClick={() => changeQuality(q)}
                      className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors flex items-center justify-between ${
                        selectedQuality === q
                          ? 'text-animex-red bg-animex-red/10'
                          : 'text-white hover:bg-white/10'
                      }`}
                    >
                      {q === 'auto' ? 'Auto (Recommended)' : q}
                      {selectedQuality === q && <ChevronRight className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="text-white hover:text-animex-red transition-colors">
              {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
