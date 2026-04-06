import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Film, BookOpen } from 'lucide-react';
import { Card } from './Card';
import { buildMediaUrl } from '../../lib/config';

interface SearchResult {
  movies: Array<{
    MovieID: number;
    Title: string;
    Slug: string;
    PosterURL?: string;
    ReleaseYear?: number;
    Duration?: number;
    Rating?: number;
    TotalRatings?: number;
  }>;
  series: Array<{
    SeriesID: number;
    Title: string;
    Slug: string;
    CoverURL?: string;
    Rating?: number;
    TotalRatings?: number;
  }>;
}

export const SearchBox: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ movies: [], series: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults({ movies: [], series: [] });
      setIsOpen(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const payload = await res.json();
          const data = payload?.data ?? payload ?? {};
          const movies = Array.isArray(data?.movies) ? data.movies : [];
          const series = Array.isArray(data?.series) ? data.series : [];
          setResults({ movies, series });
          setIsOpen(movies.length + series.length > 0);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (type: 'movie' | 'series', slug: string) => {
    setQuery('');
    setIsOpen(false);
    navigate(type === 'movie' ? `/watch/${slug}` : `/stories/${slug}`);
  };

  const totalResults = (results?.movies?.length ?? 0) + (results?.series?.length ?? 0);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm phim, truyện..."
          className="w-full px-4 py-2 pl-10 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {isOpen && totalResults > 0 && (
        <div className="absolute top-full mt-2 w-full z-50">
          <Card className="max-h-96 overflow-y-auto">
            <div className="p-2">
              {(results?.movies?.length ?? 0) > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Phim</div>
                  {results.movies.map((movie) => (
                    <button
                      key={movie.MovieID}
                      onClick={() => handleSelect('movie', movie.Slug)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-left"
                    >
                      <div className="w-12 h-16 bg-gray-200 dark:bg-gray-600 rounded overflow-hidden flex-shrink-0">
                        {movie.PosterURL ? (
                          <img
                            src={buildMediaUrl(movie.PosterURL) || undefined}
                            alt={movie.Title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {movie.Title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          {movie.ReleaseYear && <span>{movie.ReleaseYear}</span>}
                          {movie.Duration && <span>• {movie.Duration}m</span>}
                          {movie.Rating !== undefined && (
                            <span>
                              ⭐ {movie.Rating.toFixed(1)}
                              {movie.TotalRatings !== undefined && movie.TotalRatings > 0 && (
                                <span className="text-gray-400"> ({movie.TotalRatings} đánh giá)</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {(results?.series?.length ?? 0) > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Truyện</div>
                  {results.series.map((series) => (
                    <button
                      key={series.SeriesID}
                      onClick={() => handleSelect('series', series.Slug)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-left"
                    >
                      <div className="w-12 h-16 bg-gray-200 dark:bg-gray-600 rounded overflow-hidden flex-shrink-0">
                        {series.CoverURL ? (
                          <img
                            src={buildMediaUrl(series.CoverURL) || undefined}
                            alt={series.Title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {series.Title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {series.Rating !== undefined ? (
                            <span>
                              ⭐ {series.Rating.toFixed(1)}
                              {series.TotalRatings !== undefined && series.TotalRatings > 0 && (
                                <span className="text-gray-400"> ({series.TotalRatings} đánh giá)</span>
                              )}
                            </span>
                          ) : (
                            <span>⭐ 0/5 (0 đánh giá)</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
