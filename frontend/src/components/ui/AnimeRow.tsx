'use client';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import AnimeCard from './AnimeCard';

interface AnimeRowProps {
  title: string;
  anime: any[];
  viewAllHref?: string;
}

export default function AnimeRow({ title, anime, viewAllHref }: AnimeRowProps) {
  if (!anime?.length) return null;
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="flex items-center gap-1 text-sm text-animex-red hover:text-animex-red-light transition-colors">
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4">
        {anime.map((a: any) => <AnimeCard key={a._id} anime={a} />)}
      </div>
    </section>
  );
}
