'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import api from '@/lib/api';
import AnimeCard from '@/components/ui/AnimeCard';
import SkeletonCard from '@/components/ui/SkeletonCard';

const GENRES = ['Action','Adventure','Comedy','Drama','Fantasy','Horror','Mystery','Romance','Sci-Fi','Slice of Life','Sports','Supernatural','Thriller'];
const YEARS = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);
const FORMATS = ['TV','MOVIE','OVA','ONA','SPECIAL'];
const STATUSES = ['RELEASING','FINISHED','NOT_YET_RELEASED'];

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get('q') || '';
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ genre: '', year: '', format: '', status: '', sort: 'score' });

  const search = async (pg = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, page: String(pg), limit: '24', sort: filters.sort });
      if (filters.genre) params.set('genre', filters.genre);
      if (filters.year) params.set('year', filters.year);
      if (filters.format) params.set('format', filters.format);
      if (filters.status) params.set('status', filters.status);
      const res = await api.get(`/search?${params}`);
      if (pg === 1) setResults(res.data.data);
      else setResults(prev => [...prev, ...res.data.data]);
      setTotal(res.data.pagination.total);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { setPage(1); search(1); }, [q, filters]);

  const setFilter = (key: string, val: string) => setFilters(f => ({ ...f, [key]: f[key as keyof typeof f] === val ? '' : val }));

  const FilterChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${active ? 'bg-animex-red text-white' : 'bg-animex-card border border-animex-border text-white/60 hover:border-animex-red/50 hover:text-white'}`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-animex-bg pt-24 pb-16 px-6 lg:px-16">
      <div className="max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {q ? `Results for "${q}"` : 'Browse Anime'}
            </h1>
            {total > 0 && <p className="text-white/40 text-sm mt-1">{total.toLocaleString()} titles found</p>}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-colors ${showFilters ? 'bg-animex-red border-animex-red text-white' : 'bg-animex-card border-animex-border text-white/60 hover:text-white'}`}>
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="bg-animex-surface border border-animex-border rounded-xl p-5 mb-6 space-y-4">
            <div>
              <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Sort By</p>
              <div className="flex flex-wrap gap-2">
                {[['score','Top Rated'],['trending','Trending'],['popularity','Most Popular'],['newest','Newest']].map(([val, lbl]) => (
                  <FilterChip key={val} label={lbl} active={filters.sort === val} onClick={() => setFilter('sort', val)} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Genre</p>
              <div className="flex flex-wrap gap-2">
                {GENRES.map(g => <FilterChip key={g} label={g} active={filters.genre === g} onClick={() => setFilter('genre', g)} />)}
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Format</p>
                <div className="flex flex-wrap gap-2">{FORMATS.map(f => <FilterChip key={f} label={f} active={filters.format === f} onClick={() => setFilter('format', f)} />)}</div>
              </div>
              <div>
                <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Status</p>
                <div className="flex flex-wrap gap-2">{STATUSES.map(s => <FilterChip key={s} label={s.replace('_',' ')} active={filters.status === s} onClick={() => setFilter('status', s)} />)}</div>
              </div>
              <div>
                <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Year</p>
                <select value={filters.year} onChange={e => setFilter('year', e.target.value)}
                  className="bg-animex-card border border-animex-border text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-animex-red/50">
                  <option value="">Any Year</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            {Object.values(filters).some(Boolean) && (
              <button onClick={() => setFilters({ genre: '', year: '', format: '', status: '', sort: 'score' })}
                className="flex items-center gap-1.5 text-xs text-animex-red hover:underline">
                <X className="w-3 h-3" /> Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {loading && results.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4">
            {Array.from({ length: 24 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4">
              {results.map((a: any) => <AnimeCard key={a._id} anime={a} />)}
            </div>
            {results.length < total && (
              <div className="text-center mt-8">
                <button onClick={() => { const next = page + 1; setPage(next); search(next); }} disabled={loading}
                  className="bg-animex-card border border-animex-border hover:border-animex-red/50 text-white px-8 py-2.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50">
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        ) : !loading ? (
          <div className="text-center py-20 text-white/30">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">No results found{q ? ` for "${q}"` : ''}</p>
            <p className="text-sm mt-1">Try different keywords or filters</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
