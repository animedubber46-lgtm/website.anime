'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Bell, User, Menu, X, ChevronDown, Download, Crown } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

export default function Navbar() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fetch unread notification count
  useEffect(() => {
    if (!user) return;
    api.get('/notifications?unreadOnly=true&limit=1')
      .then(res => setNotifCount(res.data.unreadCount))
      .catch(() => {});
  }, [user]);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSuggestions([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search/suggest?q=${encodeURIComponent(q)}`);
        setSuggestions(res.data.data);
        setShowSuggestions(true);
      } catch { setSuggestions([]); }
    }, 300);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowSuggestions(false);
    }
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    clearAuth();
    router.push('/');
  };

  const navLinks = [
    { href: '/anime', label: 'Browse' },
    { href: '/anime?status=RELEASING', label: 'Ongoing' },
    { href: '/anime?sort=trending', label: 'Trending' },
    { href: '/schedule', label: 'Schedule' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-animex-bg/95 backdrop-blur-md border-b border-animex-border shadow-2xl'
        : 'bg-gradient-to-b from-black/60 to-transparent'
    }`}>
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="font-display text-2xl font-bold text-animex-red tracking-wider">
              ANIME<span className="text-white">X</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-1 ml-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-sm text-animex-text/70 hover:text-white transition-colors rounded-md hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex-1" />

          {/* Search */}
          <div ref={searchRef} className="relative hidden md:block">
            <form onSubmit={handleSearchSubmit}>
              <div className="flex items-center bg-white/5 border border-white/10 rounded-full px-3 py-1.5 gap-2 focus-within:border-animex-red/50 focus-within:bg-white/10 transition-all w-48 focus-within:w-72">
                <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search anime..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  className="bg-transparent text-sm text-white placeholder:text-white/30 outline-none w-full"
                />
              </div>
            </form>

            {/* Autocomplete */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full mt-2 w-72 bg-animex-surface border border-animex-border rounded-xl shadow-2xl overflow-hidden">
                {suggestions.map((anime) => (
                  <Link
                    key={anime._id}
                    href={`/anime/${anime.slug}`}
                    onClick={() => setShowSuggestions(false)}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors"
                  >
                    {anime.coverImage?.medium && (
                      <img src={anime.coverImage.medium} alt="" className="w-8 h-10 object-cover rounded" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{anime.title.romaji || anime.title.english}</p>
                      <p className="text-xs text-white/40">{anime.format}</p>
                    </div>
                  </Link>
                ))}
                <Link
                  href={`/search?q=${encodeURIComponent(searchQuery)}`}
                  onClick={() => setShowSuggestions(false)}
                  className="block px-3 py-2 text-xs text-animex-red hover:bg-white/5 text-center border-t border-animex-border"
                >
                  View all results →
                </Link>
              </div>
            )}
          </div>

          {/* Right section */}
          {user ? (
            <div className="flex items-center gap-2">
              {/* Offline downloads */}
              <Link href="/downloads" className="hidden md:flex text-white/60 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors">
                <Download className="w-5 h-5" />
              </Link>

              {/* Notifications */}
              <Link href="/notifications" className="relative text-white/60 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors">
                <Bell className="w-5 h-5" />
                {notifCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-animex-red text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </Link>

              {/* User menu */}
              <div className="relative group">
                <button className="flex items-center gap-2 p-1 rounded-full hover:bg-white/5 transition-colors">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full object-cover border border-animex-border" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-animex-red/20 border border-animex-red/40 flex items-center justify-center">
                      <User className="w-4 h-4 text-animex-red" />
                    </div>
                  )}
                  {user.isPremium && <Crown className="w-3 h-3 text-animex-gold" />}
                </button>

                <div className="absolute right-0 top-full mt-2 w-48 bg-animex-surface border border-animex-border rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="px-3 py-2 border-b border-animex-border">
                    <p className="text-sm font-medium text-white">{user.username}</p>
                    <p className="text-xs text-white/40 truncate">{user.role}</p>
                  </div>
                  {[
                    { href: '/profile', label: 'Profile' },
                    { href: '/watchlist', label: 'Watchlist' },
                    { href: '/history', label: 'Watch History' },
                    { href: '/downloads', label: 'Downloads' },
                    ...(user.role === 'admin' ? [{ href: '/admin', label: 'Admin Dashboard' }] : []),
                  ].map((item) => (
                    <Link key={item.href} href={item.href} className="block px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                      {item.label}
                    </Link>
                  ))}
                  <div className="border-t border-animex-border">
                    <button onClick={logout} className="w-full text-left px-3 py-2 text-sm text-animex-red hover:bg-animex-red/5 transition-colors">
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="text-sm text-white/70 hover:text-white transition-colors px-3 py-1.5">
                Sign In
              </Link>
              <Link href="/register" className="text-sm bg-animex-red hover:bg-animex-red-dark text-white px-4 py-1.5 rounded-full transition-colors font-medium">
                Join Free
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden text-white p-2">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-animex-surface border-t border-animex-border px-4 py-4 space-y-2">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
              className="block py-2 text-white/70 hover:text-white transition-colors">
              {link.label}
            </Link>
          ))}
          <form onSubmit={handleSearchSubmit} className="pt-2">
            <div className="flex items-center bg-white/5 border border-animex-border rounded-full px-3 py-2 gap-2">
              <Search className="w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search anime..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="bg-transparent text-sm text-white placeholder:text-white/30 outline-none flex-1"
              />
            </div>
          </form>
        </div>
      )}
    </nav>
  );
}
