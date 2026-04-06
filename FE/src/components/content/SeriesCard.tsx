import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Star, Eye, Heart, Loader } from 'lucide-react';
import { Card } from '../ui/Card';
import { Series } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface SeriesCardProps {
  series: Series;
  showStats?: boolean;
}

export const SeriesCard: React.FC<SeriesCardProps> = ({ series, showStats = true }) => {
  const { user } = useAuth();
  const email = useMemo(() => (user?.email as string | undefined) || '', [user]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  // Load favorite status on mount or when email changes
  useEffect(() => {
    if (!email || !series.id) {
      setIsFavorite(false);
      return;
    }

    const checkFavorite = async () => {
      try {
        const seriesId = Number(series.id);
        const response = await fetch(`/api/stories/${seriesId}/favorite-status`, {
          headers: { 'x-user-email': email }
        });
        if (response.ok) {
          const data = await response.json();
          setIsFavorite(Boolean(data.isFavorite || data?.data?.isFavorite));
        }
      } catch (error) {
        console.error('Error checking favorite status:', error);
        setIsFavorite(false);
      }
    };

    checkFavorite();
  }, [email, series.id]);

  const handleFavorite = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!email) {
      window.location.href = '/login';
      return;
    }

    if (favoriteLoading) return;

    setFavoriteLoading(true);
    const previousState = isFavorite;

    try {
      const seriesId = Number(series.id);
      const method = isFavorite ? 'DELETE' : 'POST';

      const response = await fetch(`/api/stories/${seriesId}/favorite`, {
        method,
        headers: { 'x-user-email': email },
      });

      if (!response.ok) {
        throw new Error('Failed to update favorite status');
      }

      // Verify status after toggle
      const statusResponse = await fetch(`/api/stories/${seriesId}/favorite-status`, {
        headers: { 'x-user-email': email }
      });

      if (statusResponse.ok) {
        const data = await statusResponse.json();
        setIsFavorite(Boolean(data.isFavorite || data?.data?.isFavorite));
      } else {
        // Revert state if verification failed
        setIsFavorite(previousState);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      // Revert state on error
      setIsFavorite(previousState);
    } finally {
      setFavoriteLoading(false);
    }
  }, [email, series.id, isFavorite, favoriteLoading]);

  return (
    <Link to={`/stories/${series.slug}`}>
      <Card hover className="group overflow-hidden h-full">
        <div className="relative aspect-[2/3] overflow-hidden bg-gray-200 dark:bg-gray-700">
          {/* Series Cover Image */}
          <img
            src={series.coverUrl || 'https://via.placeholder.com/300x450?text=No+Image'}
            alt={series.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'https://via.placeholder.com/300x450?text=No+Image';
            }}
          />

          {/* Gradient Overlay - appears on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              {/* Action Buttons */}
              <div className="flex items-center justify-between mb-3">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-full transition-colors shadow-lg"
                  aria-label="Read story"
                  title="Đọc truyện"
                >
                  <BookOpen className="w-5 h-5" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleFavorite}
                  disabled={favoriteLoading}
                  className={`p-3 rounded-full transition-colors shadow-lg ${
                    isFavorite
                      ? 'bg-red-500/90 hover:bg-red-600 text-white'
                      : 'bg-black/50 hover:bg-black/70 text-white'
                  } ${favoriteLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
                  aria-label={isFavorite ? 'Unlike story' : 'Like story'}
                  title={isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
                >
                  {favoriteLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                  )}
                </motion.button>
              </div>

              {/* Stats Section */}
              {showStats && (
                <div className="space-y-2">
                  {/* Rating, Views, Chapters */}
                  <div className="flex items-center space-x-3 text-white text-xs font-medium">
                    {series.rating > 0 && (
                      <div className="flex items-center space-x-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span>{series.rating.toFixed(1)}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1">
                      <Eye className="w-3 h-3" />
                      <span>{(series.viewCount > 1000 ? (series.viewCount / 1000).toFixed(1) + 'K' : series.viewCount)}</span>
                    </div>
                    {series.chapters && series.chapters.length > 0 && (
                      <div className="flex items-center space-x-1 bg-blue-500/80 px-2 py-0.5 rounded-full">
                        <BookOpen className="w-3 h-3" />
                        <span>{series.chapters.length}</span>
                      </div>
                    )}
                  </div>

                  {/* Category Tags */}
                  {series.categories && series.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {series.categories.slice(0, 2).map((cat: { id: string; name: string }) => (
                        <span
                          key={cat.id}
                          className="text-xs bg-purple-500/80 text-white px-2 py-0.5 rounded-full font-medium"
                        >
                          {cat.name}
                        </span>
                      ))}
                      {series.categories.length > 2 && (
                        <span className="text-xs text-white/80">+{series.categories.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Status Badges */}
          <div className="absolute top-2 left-2 flex gap-2 flex-wrap">
            {!series.isFree && (
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                VIP
              </span>
            )}
            {series.status === 'Ongoing' && (
              <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                Đang cập nhật
              </span>
            )}
          </div>
        </div>

        {/* Series Info Footer */}
        <div className="p-3 bg-white dark:bg-gray-900">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors min-h-[2.5rem]">
            {series.title}
          </h3>

          {/* Author - shown if available */}
          {series.author && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
              {series.author}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
};