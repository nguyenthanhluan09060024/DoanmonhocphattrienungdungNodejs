import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MovieCard } from '../components/content/MovieCard';
import { Loading } from '../components/ui/Loading';
import { Grid3X3, List, SlidersHorizontal } from 'lucide-react';
import type { Movie } from '../types';
import { buildMediaUrl } from '../lib/config';

interface Category {
  CategoryID: number;
  CategoryName: string;
  Slug: string;
  Type: string;
}

export const MoviesPage: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [moviesResponse, categoriesResponse] = await Promise.all([
          fetch('/api/movies'),
          fetch('/api/categories'),
        ]);

        if (!moviesResponse.ok) {
          throw new Error(`Movies HTTP error! status: ${moviesResponse.status}`);
        }
        if (!categoriesResponse.ok) {
          throw new Error(`Categories HTTP error! status: ${categoriesResponse.status}`);
        }

        const [moviesList, categoriesList] = await Promise.all([
          moviesResponse.json(),
          categoriesResponse.json(),
        ]);

        const mapped: Movie[] = await Promise.all(
          moviesList.map(async (m: any) => {
            let movieCategories: any[] = [];
            try {
              const categoryRes = await fetch(`/api/movies/${m.MovieID}/categories`);
              if (categoryRes.ok) {
                const categoryData = await categoryRes.json();
                movieCategories = categoryData.map((cat: any) => ({
                  id: String(cat.CategoryID),
                  name: cat.CategoryName,
                  slug: cat.Slug,
                }));
              }
            } catch (e) {
              console.error(`Error loading categories for movie ${m.MovieID}:`, e);
            }

            return {
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
              categories: movieCategories,
              tags: [],
              episodes: [],
              uploaderName: m.UploaderName || '',
              uploaderRole: m.UploaderRole || '',
            };
          })
        );

        const movieCategories = categoriesList.filter(
          (c: Category) => c.Type === 'Movie' || c.Type === 'Both'
        );

        setMovies(mapped);
        setCategories(movieCategories);
      } catch (err) {
        console.error('Error loading movies page:', err);
        setError('Không thể tải dữ liệu. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredMovies = useMemo(() => {
    if (selectedCategory === null) return movies;
    return movies.filter((movie) =>
      (movie.categories || []).some((cat: any) => Number(cat.id) === selectedCategory)
    );
  }, [movies, selectedCategory]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-center items-center h-64">
            <Loading />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400 text-lg mb-4">{error}</div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Tất cả phim</h1>
            <p className="text-gray-600 dark:text-gray-400">Khám phá bộ sưu tập phim đa dạng của chúng tôi</p>
          </div>

          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
              aria-label="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {categories.length > 0 && (
          <div className="mb-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
              <SlidersHorizontal className="w-4 h-4" />
              Bộ lọc thể loại
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === null
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Tất cả ({movies.length})
              </button>
              {categories.map((category) => (
                <button
                  key={category.CategoryID}
                  onClick={() => setSelectedCategory(category.CategoryID)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === category.CategoryID
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {category.CategoryName}
                </button>
              ))}
              <Link
                to="/categories"
                className="px-4 py-2 rounded-full text-sm font-medium bg-transparent text-blue-600 dark:text-blue-400 hover:underline"
              >
                Xem trang danh mục
              </Link>
            </div>
          </div>
        )}

        {filteredMovies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-10 text-center">
            <div className="text-gray-700 dark:text-gray-200 text-lg mb-2">Không có phim phù hợp với bộ lọc hiện tại</div>
            <p className="text-gray-500 dark:text-gray-400">Bạn có thể đổi thể loại hoặc quay lại tất cả phim.</p>
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
                : 'space-y-4'
            }
          >
            {filteredMovies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
