import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MovieCard } from '../components/content/MovieCard';
import { SeriesCard } from '../components/content/SeriesCard';
import { Film, BookOpen, ArrowLeft } from 'lucide-react';
import type { Movie, Series } from '../types';
import { buildMediaUrl } from '../lib/config';

interface CategoryDetail {
  CategoryID: number;
  CategoryName: string;
  Slug: string;
  Description?: string;
  Type: string;
}

const CategoryDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = useState<CategoryDetail | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'movies' | 'series'>('movies');

  useEffect(() => {
    const loadCategoryData = async () => {
      if (!slug) return;
      
      try {
        setLoading(true);
        setMovies([]);
        setSeries([]);
        
        // Load category info
        const categoryResponse = await fetch(`/api/categories`);
        if (categoryResponse.ok) {
          const categories = await categoryResponse.json();
          const categoryData = categories.find((c: CategoryDetail) => c.Slug === slug);
          if (categoryData) {
            setCategory(categoryData);
            
            // Load movies if category applies to movies
            if (categoryData.Type === 'Movie' || categoryData.Type === 'Both') {
              try {
                const moviesResponse = await fetch(`/api/categories/${categoryData.CategoryID}/movies`);
                if (moviesResponse.ok) {
                  const moviesData = await moviesResponse.json();
                  const mappedMovies: Movie[] = moviesData.map((m: any) => ({
                    id: String(m.MovieID),
                    title: m.Title,
                    slug: m.Slug,
                    description: '',
                    posterUrl: buildMediaUrl(m.PosterURL) || '',
                    trailerUrl: '',
                    releaseYear: undefined,
                    season: undefined,
                    duration: undefined,
                    country: 'VN',
                    director: '',
                    cast: '',
                    status: 'Completed',
                    isFree: true,
                    viewCount: m.ViewCount ?? 0,
                    rating: m.Rating ?? 0,
                    totalRatings: 0,
                    language: 'vi',
                    uploaderId: '0',
                    isApproved: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    categories: [],
                    tags: [],
                    episodes: [],
                    uploaderName: '',
                    uploaderRole: '',
                  }));
                  setMovies(mappedMovies);
                }
              } catch (error) {
                console.error('Error loading movies:', error);
              }
            }
            
            // Load series if category applies to series
            if (categoryData.Type === 'Series' || categoryData.Type === 'Both') {
              try {
                const seriesResponse = await fetch(`/api/categories/${categoryData.CategoryID}/series`);
                if (seriesResponse.ok) {
                  const seriesData = await seriesResponse.json();
                  const mappedSeries: Series[] = seriesData.map((s: any) => ({
                    id: String(s.SeriesID),
                    title: s.Title,
                    slug: s.Slug,
                    description: '',
                    coverUrl: buildMediaUrl(s.CoverURL) || '',
                    author: '',
                    status: 'Completed',
                    isFree: true,
                    viewCount: s.ViewCount ?? 0,
                    rating: s.Rating ?? 0,
                    totalRatings: 0,
                    language: 'vi',
                    uploaderId: '0',
                    isApproved: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    categories: [],
                    tags: [],
                    chapters: [],
                  }));
                  setSeries(mappedSeries);
                }
              } catch (error) {
                console.error('Error loading series:', error);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading category data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadCategoryData();
  }, [slug]);

  // Set activeTab based on category type and available data
  useEffect(() => {
    if (!category) return;
    
    if (category.Type === 'Movie') {
      setActiveTab('movies');
    } else if (category.Type === 'Series') {
      setActiveTab('series');
    } else if (category.Type === 'Both') {
      // If Both type, prefer movies if available, otherwise series
      if (movies.length > 0) {
        setActiveTab('movies');
      } else if (series.length > 0) {
        setActiveTab('series');
      }
    }
  }, [category, movies.length, series.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">❌</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Không tìm thấy thể loại
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Thể loại bạn đang tìm kiếm không tồn tại.
            </p>
            <Link 
              to="/categories" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại danh sách thể loại
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/categories" 
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Quay lại danh sách thể loại</span>
          </Link>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              {category.Type === 'Movie' ? (
                <Film className="w-8 h-8 text-white" />
              ) : category.Type === 'Series' ? (
                <BookOpen className="w-8 h-8 text-white" />
              ) : (
                <div className="flex items-center justify-center gap-1">
                  <Film className="w-4 h-4 text-white" />
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {category.CategoryName}
              </h1>
              {category.Description && (
                <p className="text-base text-gray-600 dark:text-gray-300">
                  {category.Description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        {(category.Type === 'Both' || (category.Type === 'Movie' && movies.length > 0) || (category.Type === 'Series' && series.length > 0)) && (
          <div className="flex space-x-1 mb-8 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            {(category.Type === 'Movie' || category.Type === 'Both') && movies.length > 0 && (
              <button
                onClick={() => setActiveTab('movies')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'movies'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <Film className="w-4 h-4" />
                <span>Phim ({movies.length})</span>
              </button>
            )}
            {(category.Type === 'Series' || category.Type === 'Both') && series.length > 0 && (
              <button
                onClick={() => setActiveTab('series')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'series'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Truyện ({series.length})</span>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {/* Movies - Show when category is Movie or Both, and activeTab is movies */}
          {(category.Type === 'Movie' || (category.Type === 'Both' && activeTab === 'movies')) && (
            <>
              {movies.length > 0 ? (
                movies.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} />
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <Film className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Chưa có phim nào
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Chưa có phim nào trong thể loại này.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Series - Show when category is Series or Both, and activeTab is series */}
          {(category.Type === 'Series' || (category.Type === 'Both' && activeTab === 'series')) && (
            <>
              {series.length > 0 ? (
                series.map((seriesItem) => (
                  <SeriesCard key={seriesItem.id} series={seriesItem} />
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Chưa có truyện nào
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Chưa có truyện nào trong thể loại này.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryDetailPage;
