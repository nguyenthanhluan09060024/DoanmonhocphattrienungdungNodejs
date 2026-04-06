import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Film, BookOpen, Grid3X3, List } from 'lucide-react';

interface Category {
  CategoryID: number;
  CategoryName: string;
  Slug: string;
  Description?: string;
  Type: string;
  CreatedAt: string;
}

interface CategoryWithCount extends Category {
  movieCount: number;
  seriesCount: number;
}

const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const loadCategories = async () => {
      try {
        // Load categories
        const categoriesResponse = await fetch('/api/categories');
        if (!categoriesResponse.ok) {
          throw new Error('Failed to fetch categories');
        }
        const categoriesData: Category[] = await categoriesResponse.json();
        
        // Load movie counts for each category
        const categoriesWithCounts = await Promise.all(
          categoriesData.map(async (category) => {
            let movieCount = 0;
            let seriesCount = 0;
            
            // Get movie count if category applies to movies
            if (category.Type === 'Movie' || category.Type === 'Both') {
              try {
                const movieResponse = await fetch(`/api/categories/${category.CategoryID}/movies`);
                if (movieResponse.ok) {
                  const movieData = await movieResponse.json();
                  movieCount = movieData.length;
                }
              } catch (error) {
                console.error(`Error fetching movies for category ${category.CategoryName}:`, error);
              }
            }
            
            // Get series count if category applies to series
            if (category.Type === 'Series' || category.Type === 'Both') {
              try {
                const seriesResponse = await fetch(`/api/categories/${category.CategoryID}/series`);
                if (seriesResponse.ok) {
                  const seriesData = await seriesResponse.json();
                  seriesCount = seriesData.length;
                }
              } catch (error) {
                console.error(`Error fetching series for category ${category.CategoryName}:`, error);
              }
            }
            
            return {
              ...category,
              movieCount,
              seriesCount
            };
          })
        );
        
        setCategories(categoriesWithCounts);
      } catch (error) {
        console.error('Error loading categories:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadCategories();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Thể loại
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Khám phá phim và truyện theo thể loại yêu thích
            </p>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Categories Grid/List */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {categories.map((category) => (
              <Link
                key={category.CategoryID}
                to={`/categories/${category.Slug}`}
                className="group"
              >
                <Card hover className="h-full">
                  <div className="p-6 text-center">
                    {/* Category Icon */}
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
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
                    
                    {/* Category Name */}
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {category.CategoryName}
                    </h3>
                    
                    {/* Description */}
                    {category.Description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                        {category.Description}
                      </p>
                    )}
                    
                    {/* Counts */}
                    <div className="flex items-center justify-center gap-4 text-sm">
                      {(category.Type === 'Movie' || category.Type === 'Both') && (
                        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                          <Film className="w-4 h-4" />
                          <span>{category.movieCount} phim</span>
                        </div>
                      )}
                      {(category.Type === 'Series' || category.Type === 'Both') && (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <BookOpen className="w-4 h-4" />
                          <span>{category.seriesCount} truyện</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => (
              <Link
                key={category.CategoryID}
                to={`/categories/${category.Slug}`}
                className="group"
              >
                <Card hover>
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Category Icon */}
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        {category.Type === 'Movie' ? (
                          <Film className="w-6 h-6 text-white" />
                        ) : category.Type === 'Series' ? (
                          <BookOpen className="w-6 h-6 text-white" />
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <Film className="w-3 h-3 text-white" />
                            <BookOpen className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      
                      {/* Category Info */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {category.CategoryName}
                        </h3>
                        {category.Description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {category.Description}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Counts */}
                    <div className="flex items-center gap-6 text-sm">
                      {(category.Type === 'Movie' || category.Type === 'Both') && (
                        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                          <Film className="w-4 h-4" />
                          <span>{category.movieCount} phim</span>
                        </div>
                      )}
                      {(category.Type === 'Series' || category.Type === 'Both') && (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <BookOpen className="w-4 h-4" />
                          <span>{category.seriesCount} truyện</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Empty State */}
        {categories.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📂</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Chưa có thể loại nào
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Các thể loại sẽ xuất hiện ở đây khi được thêm vào hệ thống.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoriesPage;
