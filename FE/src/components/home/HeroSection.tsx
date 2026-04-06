import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Plus, Star, Calendar, Clock, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Button } from '../ui/Button';
import { Movie } from '../../types';

interface HeroSectionProps {
  featuredMovies?: Movie[];
}

export const HeroSection: React.FC<HeroSectionProps> = ({ featuredMovies = [] }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Use featured movies or fallback to sample data
  const featuredContent = featuredMovies.length > 0 
    ? featuredMovies.slice(0, 5).map((movie) => ({
        id: movie.id,
        title: movie.title,
        description: movie.description || 'Khám phá bộ phim đặc sắc này ngay bây giờ!',
        backgroundImage: movie.posterUrl || 'https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg',
        rating: movie.rating || 0,
        year: movie.releaseYear,
        duration: movie.duration,
        genre: movie.categories?.slice(0, 3).map(c => c.name) || [],
        slug: movie.slug,
        viewCount: movie.viewCount || 0
      }))
    : [
        {
          id: '1',
          title: 'Chào mừng đến với Fimory',
          description: 'Khám phá bộ sưu tập phim và truyện đa dạng của chúng tôi',
          backgroundImage: 'https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg',
          rating: 0,
          year: undefined,
          duration: undefined,
          genre: [],
          slug: '',
          viewCount: 0
        }
      ];

  useEffect(() => {
    if (featuredContent.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % featuredContent.length);
    }, 8000);

    return () => clearInterval(timer);
  }, [featuredContent.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % featuredContent.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + featuredContent.length) % featuredContent.length);
  };

  const current = featuredContent[currentSlide];

  return (
    <div className="relative h-screen overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {/* Background Image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${current.backgroundImage})` }}
          />
          
          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-black/50" />
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 h-full flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <motion.h1
              key={`title-${currentSlide}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-4xl md:text-6xl font-bold text-white mb-4"
            >
              {current.title}
            </motion.h1>

            <motion.div
              key={`meta-${currentSlide}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="flex items-center flex-wrap gap-4 mb-6"
            >
              {current.rating > 0 && (
                <div className="flex items-center space-x-1">
                  <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  <span className="text-white font-medium">{current.rating.toFixed(1)}</span>
                </div>
              )}
              {current.year && (
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4 text-gray-300" />
                  <span className="text-gray-300">{current.year}</span>
                </div>
              )}
              {current.duration && (
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4 text-gray-300" />
                  <span className="text-gray-300">{current.duration}m</span>
                </div>
              )}
              {current.viewCount > 0 && (
                <div className="flex items-center space-x-1">
                  <Eye className="w-4 h-4 text-gray-300" />
                  <span className="text-gray-300">{current.viewCount.toLocaleString()} lượt xem</span>
                </div>
              )}
            </motion.div>

            {current.genre.length > 0 && (
              <motion.div
                key={`genres-${currentSlide}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="flex flex-wrap gap-2 mb-6"
              >
                {current.genre.map((genre) => (
                  <span
                    key={genre}
                    className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium"
                  >
                    {genre}
                  </span>
                ))}
              </motion.div>
            )}

            <motion.p
              key={`desc-${currentSlide}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-gray-200 text-lg leading-relaxed mb-8 max-w-xl"
            >
              {current.description}
            </motion.p>

            {current.slug && (
              <motion.div
                key={`buttons-${currentSlide}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="flex flex-wrap gap-4"
              >
                <Link to={`/watch/${current.slug}`}>
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/50">
                    <Play className="w-5 h-5 mr-2" />
                    Xem Ngay
                  </Button>
                </Link>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Slide Indicators */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex space-x-2">
        {featuredContent.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              index === currentSlide ? 'bg-white' : 'bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
};