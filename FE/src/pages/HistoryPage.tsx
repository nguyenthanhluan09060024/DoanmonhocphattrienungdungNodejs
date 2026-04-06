import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchMovieHistory, MovieHistoryItem } from '../lib/api';
import { Link } from 'react-router-dom';
import { Film, BookOpen } from 'lucide-react';

interface SeriesHistoryItem {
  HistoryID: number;
  UserID: number;
  SeriesID: number;
  ChapterID: number;
  ReadAt: string;
  Title: string;
  Slug: string;
  ChapterNumber: number;
}

const HistoryPage: React.FC = () => {
  const { user } = useAuth();
  const email = useMemo(() => (user?.email as string | undefined) || '', [user]);
  const [movieItems, setMovieItems] = useState<MovieHistoryItem[]>([]);
  const [seriesItems, setSeriesItems] = useState<SeriesHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'movies' | 'series'>('movies');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (!email) return;
        
        // Load movie history
        const movieData = await fetchMovieHistory(email);
        if (!cancelled) setMovieItems(movieData);
        
        // Load series history
        const seriesUrl = new URL('/api/history/series', window.location.origin);
        seriesUrl.searchParams.set('email', email);
        const seriesResponse = await fetch(seriesUrl.toString(), {
          headers: { 'x-user-email': email }
        });
        if (seriesResponse.ok) {
          const seriesData = await seriesResponse.json();
          if (!cancelled) setSeriesItems(seriesData);
        }

        // Get role to hide history for admin
        try {
          const roleRes = await fetch(`/api/auth/role`, { headers: { 'x-user-email': email } });
          if (roleRes.ok) {
            const data = await roleRes.json();
            if (!cancelled) setIsAdmin(data.role === 'Admin');
          }
        } catch {}
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [email]);

  const deleteMovieHistory = async (historyId: number) => {
    if (!email) return;
    try {
      const url = new URL('/api/history/movie', window.location.origin);
      url.searchParams.set('email', email);
      url.searchParams.set('historyId', String(historyId));
      const res = await fetch(url.toString(), { method: 'DELETE' });
      if (res.ok) {
        setMovieItems((prev) => prev.filter((i) => i.HistoryID !== historyId));
      }
    } catch {}
  };

  const deleteSeriesHistory = async (historyId: number) => {
    if (!email) return;
    try {
      const url = new URL('/api/history/series', window.location.origin);
      url.searchParams.set('email', email);
      url.searchParams.set('historyId', String(historyId));
      const res = await fetch(url.toString(), { method: 'DELETE' });
      if (res.ok) {
        setSeriesItems((prev) => prev.filter((i) => i.HistoryID !== historyId));
      }
    } catch {}
  };

  if (!email) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-gray-600 dark:text-gray-300">Vui lòng đăng nhập để xem lịch sử.</div>;
  }

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-gray-600 dark:text-gray-300">Đang tải lịch sử...</div>;
  }

  if (isAdmin) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-gray-600 dark:text-gray-300">Admin không có trang lịch sử.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Lịch sử xem</h1>
      
      {/* Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('movies')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab === 'movies'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Film className="w-4 h-4" />
          Phim ({movieItems.length})
        </button>
        <button
          onClick={() => setActiveTab('series')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab === 'series'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Truyện ({seriesItems.length})
        </button>
      </div>

      {/* Movies Tab */}
      {activeTab === 'movies' && (
        <div className="space-y-3">
          {movieItems.map(item => (
            <div key={item.HistoryID} className="p-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Film className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.Title}</div>
                  <div className="text-xs text-gray-500">{new Date(item.WatchedAt).toLocaleString()} {item.EpisodeNumber ? `(Tập ${item.EpisodeNumber})` : ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Link 
                  to={`/watch/${item.Slug}${item.EpisodeNumber ? `?episode=${item.EpisodeNumber}` : ''}`} 
                  className="text-blue-600 dark:text-blue-400 text-sm hover:underline font-medium"
                >
                  Xem lại
                </Link>
                {item.EpisodeNumber && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    → Tập {item.EpisodeNumber}
                  </span>
                )}
                <button onClick={() => deleteMovieHistory(item.HistoryID)} className="text-sm text-red-600 dark:text-red-400 hover:underline">Xóa</button>
              </div>
            </div>
          ))}
          {movieItems.length === 0 && (
            <div className="text-center py-8 text-gray-600 dark:text-gray-300">
              <Film className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>Chưa có lịch sử xem phim.</p>
            </div>
          )}
        </div>
      )}

      {/* Series Tab */}
      {activeTab === 'series' && (
        <div className="space-y-3">
          {seriesItems.map(item => (
            <div key={item.HistoryID} className="p-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.Title}</div>
                  <div className="text-xs text-gray-500">{new Date(item.ReadAt).toLocaleString()} (Chương {item.ChapterNumber})</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link 
                  to={`/stories/${item.Slug}${item.ChapterNumber ? `?chapter=${item.ChapterNumber}` : ''}`} 
                  className="text-blue-600 dark:text-blue-400 text-sm hover:underline font-medium"
                >
                  Đọc tiếp
                </Link>
                {item.ChapterNumber && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    → Chương {item.ChapterNumber}
                  </span>
                )}
                <button 
                  onClick={() => deleteSeriesHistory(item.HistoryID)} 
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
          {seriesItems.length === 0 && (
            <div className="text-center py-8 text-gray-600 dark:text-gray-300">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>Chưa có lịch sử đọc truyện.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;


