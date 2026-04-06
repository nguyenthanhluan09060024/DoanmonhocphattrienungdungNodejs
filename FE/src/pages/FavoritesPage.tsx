import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchFavorites, removeFavorite } from '../lib/api';
import { fetchMovies, ApiMovie } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { BookOpen, Film } from 'lucide-react';
import { buildMediaUrl } from '../lib/config';

type Series = {
  SeriesID: number;
  Title: string;
  Slug: string;
  CoverURL: string;
  Rating: number;
  ViewCount: number;
  CreatedAt: string;
};

export const FavoritesPage: React.FC = () => {
  const { user } = useAuth();
  const email = useMemo(() => (user?.email as string | undefined) || '', [user]);
  const [activeTab, setActiveTab] = useState<'movies' | 'series'>('movies');
  const [movies, setMovies] = useState<ApiMovie[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (email) {
          const [movieIds, allMovies, seriesPayload] = await Promise.all([
            fetchFavorites(email),
            fetchMovies(),
            fetch(`/api/user/series-favorites?email=${encodeURIComponent(email)}`, {
              headers: { 'x-user-email': email }
            })
              .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
              })
              .catch((err) => {
                console.error('Error fetching series favorites:', err);
                return [];
              })
          ]);

          const seriesRows = Array.isArray(seriesPayload)
            ? seriesPayload
            : (Array.isArray(seriesPayload?.data) ? seriesPayload.data : []);

          console.log('Movie IDs:', movieIds);
          console.log('All Movies:', allMovies);
          console.log('Series Data:', seriesRows);

          if (!cancelled) {
            const map = new Set(movieIds);
            setMovies(allMovies.filter((m) => map.has(m.MovieID)));
            const ids = new Set(
              seriesRows
                .map((item: any) => Number(item?.SeriesID ?? item?.seriesId ?? item))
                .filter((id: number) => Number.isFinite(id) && id > 0)
            );
            setSeries([]);
            if (ids.size > 0) {
              const allSeriesRes = await fetch('/api/stories');
              const allSeriesPayload = await allSeriesRes.json();
              const allSeries = Array.isArray(allSeriesPayload)
                ? allSeriesPayload
                : (Array.isArray(allSeriesPayload?.data) ? allSeriesPayload.data : []);
              setSeries(allSeries.filter((s: Series) => ids.has(s.SeriesID)));
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [email]);

  const handleRemoveMovie = async (movieId: number) => {
    if (!email) return;
    await removeFavorite(email, movieId);
    setMovies(prev => prev.filter(m => m.MovieID !== movieId));
  };

  const handleRemoveSeries = async (seriesId: number) => {
    if (!email) return;
    try {
      await fetch(`/api/stories/${seriesId}/favorite`, {
        method: 'DELETE',
        headers: { 'x-user-email': email }
      });
      setSeries(prev => prev.filter(s => s.SeriesID !== seriesId));
    } catch (error) {
      console.error('Error removing series from favorites:', error);
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-gray-600 dark:text-gray-300">Đang tải danh sách yêu thích...</div>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Danh sách yêu thích</h1>

      {(!email) && (
        <div className="text-gray-600 dark:text-gray-300 mb-6">Vui lòng đăng nhập để xem danh sách yêu thích.</div>
      )}

      {email && (
        <>
          {/* Tabs */}
          <div className="flex space-x-1 mb-6">
            <button
              onClick={() => setActiveTab('movies')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'movies'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <Film className="w-4 h-4 inline mr-2" />
              Phim ({movies.length})
            </button>
            <button
              onClick={() => setActiveTab('series')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'series'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <BookOpen className="w-4 h-4 inline mr-2" />
              Truyện ({series.length})
            </button>
          </div>

          {/* Movies Tab */}
          {activeTab === 'movies' && (
            <>
              {movies.length === 0 && (
                <div className="text-gray-600 dark:text-gray-300">Bạn chưa thêm phim nào vào danh sách yêu thích.</div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {movies.map(movie => (
                  <Card key={movie.MovieID} className="p-3">
                    <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded-md mb-3 overflow-hidden">
                      {movie.PosterURL ? (
                        <img src={buildMediaUrl(movie.PosterURL) || undefined} alt={movie.Title} className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">{movie.Title}</div>
                    <Button variant="secondary" size="sm" onClick={() => handleRemoveMovie(movie.MovieID)}>Xóa khỏi yêu thích</Button>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Series Tab */}
          {activeTab === 'series' && (
            <>
              {series.length === 0 && (
                <div className="text-gray-600 dark:text-gray-300">Bạn chưa thêm truyện nào vào danh sách yêu thích.</div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {series.map(seriesItem => (
                  <Card key={seriesItem.SeriesID} className="p-3">
                    <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded-md mb-3 overflow-hidden">
                      {seriesItem.CoverURL ? (
                        <img src={buildMediaUrl(seriesItem.CoverURL) || undefined} alt={seriesItem.Title} className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">{seriesItem.Title}</div>
                    <Button variant="secondary" size="sm" onClick={() => handleRemoveSeries(seriesItem.SeriesID)}>Xóa khỏi yêu thích</Button>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default FavoritesPage;



