import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { MovieCard } from '../content/MovieCard';
import { SeriesCard } from '../content/SeriesCard';
import { Movie, Series } from '../../types';

interface ContentSectionProps {
  title: string;
  items: (Movie | Series)[];
  type: 'movie' | 'series';
  viewAllLink?: string;
  icon?: React.ReactNode;
}

export const ContentSection: React.FC<ContentSectionProps> = ({
  title,
  items,
  type,
  viewAllLink,
  icon
}) => {
  // Always use provided items, don't fallback to sample data
  const displayItems = items || [];
  
  // Don't render section if no items
  if (displayItems.length === 0) {
    return null;
  }

  return (
    <section className="py-6">
      <div className="bg-white/5 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {icon && <div className="text-blue-400">{icon}</div>}
            <h2 className="text-2xl font-bold text-white">
              {title}
            </h2>
          </div>
          {viewAllLink && (
            <Link
              to={viewAllLink}
              className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              <span>Xem tất cả</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {displayItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
            >
              {type === 'movie' ? (
                <MovieCard movie={item as Movie} />
              ) : (
                <SeriesCard series={item as Series} />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};