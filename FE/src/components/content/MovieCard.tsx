import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Star, Clock, Eye, Heart } from 'lucide-react';
import { Card } from '../ui/Card';
import { Movie } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { addFavorite, removeFavorite } from '../../lib/api';

interface MovieCardProps {
  movie: Movie;
  showStats?: boolean;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, showStats = true }) => {
  const { user } = useAuth();
  const email = useMemo(() => (user?.email as string | undefined) || '', [user]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load favorite status
  useEffect(() => {
    if (!email || !movie.id) return;
    
    const checkFavorite = async () => {
      try {
        const movieId = Number(movie.id);
        const response = await fetch(`/api/movies/${movieId}/favorite-status`, {
          headers: { 'x-user-email': email }
        });
        if (response.ok) {
          const data = await response.json();
          setIsFavorite(data.isFavorite || false);
        }
      } catch (error) {
        console.error('Error checking favorite status:', error);
      }
    };

    checkFavorite();
  }, [email, movie.id]);

  const handleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!email) {
      // Redirect to login if not authenticated
      window.location.href = '/login';
      return;
    }

    if (loading) return;
    
    setLoading(true);
    const previousState = isFavorite; // Lưu state cũ
    try {
      const movieId = Number(movie.id);
      if (isFavorite) {
        await removeFavorite(email, movieId);
      } else {
        await addFavorite(email, movieId);
      }
      
      // Verify status sau khi toggle để đảm bảo đồng bộ
      const response = await fetch(`/api/movies/${movieId}/favorite-status`, {
        headers: { 'x-user-email': email }
      });
      if (response.ok) {
        const data = await response.json();
        setIsFavorite(data.isFavorite || false);
      } else {
        // Nếu verify thất bại, revert state
        setIsFavorite(previousState);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      // Revert state nếu có lỗi
      setIsFavorite(previousState);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Link to={`/watch/${movie.slug}`}>
      <Card hover className="group overflow-hidden">
        <div className="relative aspect-[2/3] overflow-hidden">
          {/* Movie Poster */}
          <img
            src={movie.posterUrl || 'https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg'}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex items-center justify-between mb-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full transition-colors"
                >
                  <Play className="w-5 h-5" />
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleFavorite}
                  disabled={loading}
                  className={`p-2 rounded-full transition-colors ${
                    isFavorite 
                      ? 'bg-red-500/90 hover:bg-red-600 text-white' 
                      : 'bg-black/50 hover:bg-black/70 text-white'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                </motion.button>
              </div>
              
              {showStats && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-3 text-white text-xs">
                    {movie.rating > 0 && (
                      <div className="flex items-center space-x-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span>{movie.rating.toFixed(1)}</span>
                      </div>
                    )}
                    {movie.duration && (
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{movie.duration}m</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1">
                      <Eye className="w-3 h-3" />
                      <span>{movie.viewCount.toLocaleString()}</span>
                    </div>
                    {movie.episodes && movie.episodes.length > 0 && (
                      <div className="flex items-center space-x-1 bg-blue-500/80 px-2 py-0.5 rounded">
                        <Play className="w-3 h-3" />
                        <span className="font-semibold">{movie.episodes.length} Tập</span>
                      </div>
                    )}
                  </div>
                  {movie.tags && movie.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {movie.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="text-xs bg-purple-500/80 text-white px-2 py-0.5 rounded-full font-medium"
                        >
                          {tag.name}
                        </span>
                      ))}
                      {movie.tags.length > 3 && (
                        <span className="text-xs text-white/80">+{movie.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div className="absolute top-2 left-2">
            {!movie.isFree && (
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                VIP
              </span>
            )}
            {movie.status === 'Ongoing' && (
              <span className="bg-green-500 text-white text-xs font-medium px-2 py-1 rounded-full ml-1">
                Ongoing
              </span>
            )}
          </div>

          {/* Quality Badge */}
          <div className="absolute top-2 right-2">
            <span className="bg-black/70 text-white text-xs font-medium px-2 py-1 rounded">
              HD
            </span>
          </div>
        </div>

        {/* Movie Info - ✅ FIX: Chỉ hiển thị tên và số tập, bỏ thể loại */}
        <div className="p-3">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2 mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors min-h-[2.5rem]">
            {movie.title}
          </h3>
          
          {/* Display episodes count prominently if available */}
          {movie.episodes && movie.episodes.length > 0 && (
            <div className="mt-1 flex items-center space-x-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Play className="w-3 h-3" />
              <span>{movie.episodes.length} Tập</span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
};