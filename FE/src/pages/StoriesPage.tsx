import React, { useEffect, useState } from 'react';
import { SeriesCard } from '../components/content/SeriesCard';
import { Card } from '../components/ui/Card';
import { BookOpen } from 'lucide-react';
import type { Series, Category } from '../types';
import { buildMediaUrl } from '../lib/config';

interface StoryApiResponse {
  SeriesID: number;
  Title: string;
  Slug: string;
  Description?: string;
  CoverURL?: string;
  Author?: string;
  Status: string;
  IsFree?: boolean;
  ViewCount?: number;
  Rating?: number;
  Language?: string;
  UploaderID?: number;
  IsApproved?: boolean;
  CreatedAt?: string;
  UpdatedAt?: string;
  UploaderName?: string;
  UploaderRole?: string;
}

interface CategoryApiResponse {
  CategoryID: number;
  CategoryName: string;
  Slug: string;
}

const StoriesPage: React.FC = () => {
  const [stories, setStories] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStories = async () => {
      try {
        const response = await fetch('/api/stories');
        if (response.ok) {
          const data = await response.json();
          // Map and load categories for each story
          const mappedStories: Series[] = await Promise.all(
            (data as StoryApiResponse[])
              .filter((s: StoryApiResponse) => s.IsApproved !== false)
              .map(async (s: StoryApiResponse) => {
                // Load categories for this story
                let storyCategories: Category[] = [];
                try {
                  const categoriesResponse = await fetch(`/api/stories/${s.SeriesID}/categories`);
                  if (categoriesResponse.ok) {
                    const categoriesData = await categoriesResponse.json();
                    storyCategories = (categoriesData as CategoryApiResponse[]).map((cat: CategoryApiResponse) => ({
                      id: String(cat.CategoryID),
                      name: cat.CategoryName,
                      slug: cat.Slug,
                      type: 'Series' as const
                    }));
                  }
                } catch (error) {
                  console.error(`Error loading categories for story ${s.SeriesID}:`, error);
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
          setStories(mappedStories);
        }
      } catch (error) {
        console.error('Error loading stories:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStories();
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Đang tải truyện...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Truyện
        </h1>
      </div>

      {stories.length === 0 ? (
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
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {stories.map((story) => (
            <SeriesCard key={story.id} series={story} />
          ))}
        </div>
      )}
    </div>
  );
};

export default StoriesPage;
