import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SeriesCard } from '../components/content/SeriesCard';
import { Card } from '../components/ui/Card';
import { Loading } from '../components/ui/Loading';
import { BookOpen, Grid3X3, List, SlidersHorizontal } from 'lucide-react';
import type { Series } from '../types';
import { buildMediaUrl } from '../lib/config';

interface Category {
  CategoryID: number;
  CategoryName: string;
  Slug: string;
  Type: string;
}

const StoriesPage: React.FC = () => {
  const [stories, setStories] = useState<Series[]>([]);
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

        const [storiesResponse, categoriesResponse] = await Promise.all([
          fetch('/api/stories'),
          fetch('/api/categories'),
        ]);

        if (!storiesResponse.ok) {
          throw new Error(`Stories HTTP error! status: ${storiesResponse.status}`);
        }
        if (!categoriesResponse.ok) {
          throw new Error(`Categories HTTP error! status: ${categoriesResponse.status}`);
        }

        const [storiesList, categoriesList] = await Promise.all([
          storiesResponse.json(),
          categoriesResponse.json(),
        ]);

        const mappedStories: Series[] = await Promise.all(
          storiesList
            .filter((s: any) => s.IsApproved !== false)
            .map(async (s: any) => {
              let storyCategories: any[] = [];
              try {
                const categoriesResponse = await fetch(`/api/stories/${s.SeriesID}/categories`);
                if (categoriesResponse.ok) {
                  const categoriesData = await categoriesResponse.json();
                  storyCategories = categoriesData.map((cat: any) => ({
                    id: String(cat.CategoryID),
                    name: cat.CategoryName,
                    slug: cat.Slug,
                  }));
                }
              } catch (err) {
                console.error(`Error loading categories for story ${s.SeriesID}:`, err);
              }

              return {
                id: String(s.SeriesID),
                title: s.Title,
                slug: s.Slug,
                description: s.Description || '',
                coverUrl: buildMediaUrl(s.CoverURL) || '',
                author: s.Author || '',
                status: s.Status === 'Ongoing' ? 'Ongoing' : 'Completed',
                isFree: s.IsFree ?? true,
                viewCount: s.ViewCount ?? 0,
                rating: s.Rating ?? 0,
                totalRatings: 0,
                language: s.Language || 'vi',
                uploaderId: String(s.UploaderID || '0'),
                isApproved: s.IsApproved ?? true,
                createdAt: s.CreatedAt || new Date().toISOString(),
                updatedAt: s.UpdatedAt || new Date().toISOString(),
                categories: storyCategories,
                tags: [],
                chapters: [],
                uploaderName: s.UploaderName || '',
                uploaderRole: s.UploaderRole || '',
              };
            })
        );

        const storyCategories = categoriesList.filter(
          (c: Category) => c.Type === 'Story' || c.Type === 'Both'
        );

        setStories(mappedStories);
        setCategories(storyCategories);
      } catch (err) {
        console.error('Error loading stories page:', err);
        setError('Không thể tải dữ liệu. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredStories = useMemo(() => {
    if (selectedCategory === null) return stories;
    return stories.filter((story) =>
      (story.categories || []).some((cat: any) => Number(cat.id) === selectedCategory)
    );
  }, [stories, selectedCategory]);

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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Tất cả truyện</h1>
            <p className="text-gray-600 dark:text-gray-400">Khám phá bộ sưu tập truyện đa dạng của chúng tôi</p>
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
                Tất cả ({stories.length})
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

        {filteredStories.length === 0 ? (
          <Card>
            <div className="p-12 text-center">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                Chưa có truyện nào
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Hiện tại chưa có truyện nào được xuất bản.
              </p>
            </div>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredStories.map((story) => (
              <SeriesCard key={story.id} series={story} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredStories.map((story) => (
              <div
                key={story.id}
                className="flex gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md dark:hover:bg-gray-800 transition-all"
              >
                {story.coverUrl && (
                  <div className="flex-shrink-0 w-20 h-28">
                    <img
                      src={story.coverUrl}
                      alt={story.title}
                      className="w-full h-full object-cover rounded-md"
                    />
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                      <Link to={`/stories/${story.slug}`}>{story.title}</Link>
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{story.author}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {story.categories?.map((cat: any) => (
                        <span
                          key={cat.id}
                          className="inline-block px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        >
                          {cat.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>{story.viewCount.toLocaleString()} lượt xem</span>
                    <span>⭐ {story.rating.toFixed(1)}</span>
                    <span className={`font-medium ${story.status === 'Ongoing' ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                      {story.status === 'Ongoing' ? 'Đang cập nhật' : 'Hoàn thành'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoriesPage;
