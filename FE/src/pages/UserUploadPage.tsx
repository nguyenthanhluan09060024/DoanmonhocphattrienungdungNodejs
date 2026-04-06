import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Upload, Film, AlertCircle, CheckCircle, Clock, Edit, Trash2, BookOpen } from 'lucide-react';
import { buildMediaUrl } from '../lib/config';

const UserUploadPage: React.FC = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string>('');
  
  // Movie upload states
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createCategoryIds, setCreateCategoryIds] = useState<number[]>([]);
  const [episodeFiles, setEpisodeFiles] = useState<File[]>([]);
  const [episodes, setEpisodes] = useState<Array<{episodeNumber: number, title: string, duration: number, episodeCode?: string}>>([]);
  const [coverFile, setCoverFile] = useState<File | undefined>(undefined);
  
  // Story upload states
  const [createStoryTitle, setCreateStoryTitle] = useState('');
  const [createStoryDescription, setCreateStoryDescription] = useState('');
  const [createStoryAuthor, setCreateStoryAuthor] = useState('');
  const [createStoryCategoryIds, setCreateStoryCategoryIds] = useState<number[]>([]);
  const [storyType, setStoryType] = useState<'Text' | 'Comic'>('Text');
  const [contentFiles, setContentFiles] = useState<File[]>([]);
  const [chapterImages, setChapterImages] = useState<File[]>([]);
  const [storyChapters, setStoryChapters] = useState<Array<{chapterNumber: number, title: string, images?: number[]}>>([]);
  const [storyCoverFile, setStoryCoverFile] = useState<File | undefined>(undefined);
  const [isStoryFree, setIsStoryFree] = useState(true);
  
  // Edit states
  const [editCategoryIds, setEditCategoryIds] = useState<number[]>([]);
  const [editStoryCategoryIds, setEditStoryCategoryIds] = useState<number[]>([]);
  const [userStories, setUserStories] = useState<any[]>([]);
  const [editStoryId, setEditStoryId] = useState<number | null>(null);
  const [editStoryForm, setEditStoryForm] = useState<{
    title?: string;
    description?: string;
    author?: string;
    isFree?: boolean;
  }>({});
  const [editStoryCoverFile, setEditStoryCoverFile] = useState<File | undefined>(undefined);
  
  const [categories, setCategories] = useState<{ CategoryID: number; CategoryName: string; Type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [userContent, setUserContent] = useState<any[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ 
    title?: string; 
    description?: string;
    isFree?: boolean;
    author?: string;
  }>({});
  const [editVideoFile, setEditVideoFile] = useState<File | undefined>(undefined);
  const [editCoverFile, setEditCoverFile] = useState<File | undefined>(undefined);
  
  // Episodes management for Movies (giống Admin)
  const [editEpisodes, setEditEpisodes] = useState<Array<{
    EpisodeID: number;
    EpisodeNumber: number;
    Title?: string;
    VideoURL: string;
    Duration?: number;
    EpisodeCode?: string;
  }>>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [newEpisodeFile, setNewEpisodeFile] = useState<File | undefined>(undefined);
  const [newEpisodeTitle, setNewEpisodeTitle] = useState('');
  const [newEpisodeDuration, setNewEpisodeDuration] = useState(120);
  const [addingEpisode, setAddingEpisode] = useState(false);
  
  // Chapters management for Stories (giống Admin)
  const [editChapters, setEditChapters] = useState<Array<{
    ChapterID: number;
    ChapterNumber: number;
    Title?: string;
    Content?: string;
    ImageCount?: number;
    ViewCount?: number;
    ChapterCode?: string;
  }>>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [newChapterContentFile, setNewChapterContentFile] = useState<File | undefined>(undefined);
  const [newChapterImages, setNewChapterImages] = useState<File[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [addingChapter, setAddingChapter] = useState(false);
  const [storyTypeForEdit, setStoryTypeForEdit] = useState<'Text' | 'Comic'>('Text');
  
  // Tab state để phân biệt Movies và Stories
  const [activeTab, setActiveTab] = useState<'movies' | 'stories'>('movies');

  const loadData = async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Load user role
      try {
        const roleResponse = await fetch('/api/auth/role', {
          headers: { 'x-user-email': user.email }
        });
        if (roleResponse.ok) {
          const roleData = await roleResponse.json();
          setUserRole(roleData.role || '');
        } else {
          console.warn('Failed to load user role:', roleResponse.status);
        }
      } catch (error) {
        console.warn('Error loading user role:', error);
      }

      // Load categories
      try {
        const categoriesResponse = await fetch('/api/categories');
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          setCategories(categoriesData.map((c: any) => ({ 
            CategoryID: c.CategoryID, 
            CategoryName: c.CategoryName, 
            Type: c.Type 
          })));
        } else {
          console.warn('Failed to load categories:', categoriesResponse.status);
        }
      } catch (error) {
        console.warn('Error loading categories:', error);
      }

      // Load user's uploaded movies
      try {
        const contentResponse = await fetch('/api/user/movies', {
          headers: { 'x-user-email': user.email }
        });
        if (contentResponse.ok) {
          const contentData = await contentResponse.json();
          console.log('✅ User movies loaded:', contentData);
          const movies = Array.isArray(contentData) ? contentData : [];
          setUserContent(movies);
          console.log(`📊 User has ${movies.length} movies`);
        } else {
          console.warn('❌ Failed to load user movies:', contentResponse.status, await contentResponse.text());
          setUserContent([]);
        }
      } catch (error) {
        console.error('❌ Error loading user movies:', error);
        setUserContent([]);
      }

      // Load user's uploaded stories
      try {
        const storiesResponse = await fetch('/api/user/stories', {
          headers: { 'x-user-email': user.email }
        });
        if (storiesResponse.ok) {
          const storiesData = await storiesResponse.json();
          console.log('✅ User stories loaded:', storiesData);
          const stories = Array.isArray(storiesData) ? storiesData : [];
          setUserStories(stories);
          console.log(`📊 User has ${stories.length} stories`);
        } else {
          console.warn('❌ Failed to load user stories:', storiesResponse.status, await storiesResponse.text());
          setUserStories([]);
        }
      } catch (error) {
        console.error('❌ Error loading user stories:', error);
        setUserStories([]);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.email) {
      loadData();
    }
  }, [user?.email]);

  // Tự động reload role mỗi 10 giây để cập nhật khi admin thay đổi quyền
  useEffect(() => {
    if (user?.email) {
      const interval = setInterval(async () => {
        try {
          const roleResponse = await fetch('/api/auth/role', {
            headers: { 'x-user-email': user.email }
          });
          if (roleResponse.ok) {
            const roleData = await roleResponse.json();
            const newRole = roleData.role || '';
            // Nếu role thay đổi, reload toàn bộ data
            if (newRole !== userRole) {
              setUserRole(newRole);
              await loadData();
            }
          }
        } catch (error) {
          console.warn('Error checking role update:', error);
        }
      }, 10000); // Check every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [user?.email, userRole]);

  const hasUploadPermission = ['Admin', 'Uploader', 'Author', 'Translator', 'Reup'].includes(userRole);
  
  // Kiểm tra user có còn phim/truyện không (kể cả khi không còn quyền upload)
  const hasExistingContent = userContent.length > 0 || userStories.length > 0;
  
  // Nếu không còn quyền upload và không còn phim/truyện → Đóng trang upload
  const shouldShowPage = hasUploadPermission || hasExistingContent;
  
  // Debug log
  console.log('🔍 Page visibility check:', {
    userRole,
    hasUploadPermission,
    userContentCount: userContent.length,
    hasExistingContent,
    shouldShowPage,
    loading
  });

  const startEdit = async (id: number, title: string, description?: string, isFree?: boolean) => {
    // Chỉ cho phép sửa nếu còn quyền upload
    if (!hasUploadPermission) {
      alert('Bạn không còn quyền sửa phim. Chỉ có thể xem và xóa.');
      return;
    }
    setEditId(id);
    setEditForm({ title, description, isFree });
    setEditCategoryIds([]);
    setEditEpisodes([]);
    setLoadingEpisodes(true);
    setNewEpisodeFile(undefined);
    setNewEpisodeTitle('');
    setNewEpisodeDuration(120);
    
    // Fetch episodes for this movie (giống Admin)
    try {
      const episodesResponse = await fetch(`/api/user/movies/${id}/episodes`, {
        headers: { 'x-user-email': user?.email || '' }
      });
      if (episodesResponse.ok) {
        const episodes = await episodesResponse.json();
        setEditEpisodes(episodes);
      }
    } catch (error) {
      console.error('Error fetching episodes:', error);
    } finally {
      setLoadingEpisodes(false);
    }
    
    // Fetch categories for this movie
    try {
      const categoriesResponse = await fetch(`/api/movies/${id}/categories`);
      if (categoriesResponse.ok) {
        const movieCats = await categoriesResponse.json();
        setEditCategoryIds(movieCats.map((c: any) => c.CategoryID));
      }
    } catch (error) {
      console.error('Error fetching movie categories:', error);
    }
  };

  const startEditStory = async (id: number, title: string, description?: string, author?: string, isFree?: boolean, storyType?: string) => {
    // Chỉ cho phép sửa nếu còn quyền upload
    if (!hasUploadPermission) {
      alert('Bạn không còn quyền sửa truyện. Chỉ có thể xem và xóa.');
      return;
    }
    setEditStoryId(id);
    setEditStoryForm({ title, description, author, isFree });
    setEditStoryCategoryIds([]);
    setEditChapters([]);
    setLoadingChapters(true);
    setNewChapterContentFile(undefined);
    setNewChapterImages([]);
    setNewChapterTitle('');
    setStoryTypeForEdit((storyType as 'Text' | 'Comic') || 'Text');
    
    // Fetch chapters for this story (giống Admin)
    try {
      const chaptersResponse = await fetch(`/api/stories/${id}/chapters`);
      if (chaptersResponse.ok) {
        const chapters = await chaptersResponse.json();
        setEditChapters(chapters);
      }
    } catch (error) {
      console.error('Error fetching chapters:', error);
    } finally {
      setLoadingChapters(false);
    }
    
    // Fetch categories for this story
    try {
      const categoriesResponse = await fetch(`/api/stories/${id}/categories`);
      if (categoriesResponse.ok) {
        const storyCats = await categoriesResponse.json();
        setEditStoryCategoryIds(storyCats.map((c: any) => c.CategoryID));
      }
    } catch (error) {
      console.error('Error fetching story categories:', error);
    }
  };

  const saveEdit = async () => {
    if (!user?.email || editId == null) return;
    
    const formData = new FormData();
    if (editForm.title) formData.append('title', editForm.title);
    if (editForm.description) formData.append('description', editForm.description);
    if (typeof editForm.isFree !== 'undefined') formData.append('isFree', editForm.isFree ? 'true' : 'false');
    if (editVideoFile) formData.append('videoFile', editVideoFile);
    if (editCoverFile) formData.append('coverImage', editCoverFile);
    
    // Add categories array
    editCategoryIds.forEach((catId) => {
      formData.append('categoryIds', String(catId));
    });
    
    try {
      const response = await fetch(`/api/user/movies/${editId}`, {
        method: 'PUT',
        headers: {
          'x-user-email': user.email,
        },
        body: formData,
      });
      
      if (response.ok) {
        // Update episodes if any EpisodeCode changed (giống Admin)
        for (const episode of editEpisodes) {
          try {
            const episodeFormData = new FormData();
            if (episode.EpisodeCode) {
              episodeFormData.append('episodeCode', episode.EpisodeCode);
            }
            if (episode.Title) {
              episodeFormData.append('title', episode.Title);
            }
            if (episode.Duration) {
              episodeFormData.append('duration', String(episode.Duration));
            }
            
            const episodeResponse = await fetch(`/api/user/episodes/${episode.EpisodeID}`, {
              method: 'PUT',
              headers: {
                'x-user-email': user.email,
              },
              body: episodeFormData,
            });
            
            if (!episodeResponse.ok) {
              console.error(`Failed to update episode ${episode.EpisodeID}`);
            }
          } catch (error) {
            console.error(`Error updating episode ${episode.EpisodeID}:`, error);
          }
        }
        
        setEditId(null);
        setEditForm({});
        setEditVideoFile(undefined);
        setEditCoverFile(undefined);
        setEditCategoryIds([]);
        setEditEpisodes([]);
        await loadData();
        setUploadMessage('Video updated successfully!');
        setTimeout(() => setUploadMessage(''), 3000);
      } else {
        const errorData = await response.json();
        setUploadMessage(`Update failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating video:', error);
      setUploadMessage('Network error. Please try again.');
    }
  };

  const saveEditStory = async () => {
    if (!user?.email || editStoryId == null) return;
    
    const formData = new FormData();
    if (editStoryForm.title) formData.append('title', editStoryForm.title);
    if (editStoryForm.description) formData.append('description', editStoryForm.description);
    if (editStoryForm.author) formData.append('author', editStoryForm.author);
    if (typeof editStoryForm.isFree !== 'undefined') formData.append('isFree', editStoryForm.isFree ? 'true' : 'false');
    if (editStoryCoverFile) formData.append('coverImage', editStoryCoverFile);
    
    // Add categories array
    editStoryCategoryIds.forEach((catId) => {
      formData.append('categoryIds', String(catId));
    });
    
    try {
      const response = await fetch(`/api/user/stories/${editStoryId}`, {
        method: 'PUT',
        headers: {
          'x-user-email': user.email,
        },
        body: formData,
      });
      
      if (response.ok) {
        // Update chapters if any ChapterCode changed (giống Admin)
        for (const chapter of editChapters) {
          try {
            const chapterFormData = new FormData();
            if (chapter.ChapterCode) {
              chapterFormData.append('chapterCode', chapter.ChapterCode);
            }
            if (chapter.Title) {
              chapterFormData.append('title', chapter.Title);
            }
            
            const chapterResponse = await fetch(`/api/admin/chapters/${chapter.ChapterID}`, {
              method: 'PUT',
              headers: {
                'x-user-email': user.email,
              },
              body: chapterFormData,
            });
            
            if (!chapterResponse.ok) {
              console.error(`Failed to update chapter ${chapter.ChapterID}`);
            }
          } catch (error) {
            console.error(`Error updating chapter ${chapter.ChapterID}:`, error);
          }
        }
        
        setEditStoryId(null);
        setEditStoryForm({});
        setEditStoryCoverFile(undefined);
        setEditStoryCategoryIds([]);
        setEditChapters([]);
        await loadData();
        setUploadMessage('Story updated successfully!');
        setTimeout(() => setUploadMessage(''), 3000);
      } else {
        const errorData = await response.json();
        setUploadMessage(`Update failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating story:', error);
      setUploadMessage('Network error. Please try again.');
    }
  };

  const deleteVideo = async (id: number) => {
    if (!user?.email) return;
    if (!confirm('Are you sure you want to delete this video?')) return;
    
    try {
      const response = await fetch(`/api/user/movies/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': user.email,
        },
      });
      
      if (response.ok) {
        await loadData();
        setUploadMessage('Video deleted successfully!');
        setTimeout(() => setUploadMessage(''), 3000);
        
        // Kiểm tra lại sau khi xóa: nếu không còn phim và không còn quyền → đóng trang
        // loadData() sẽ tự động cập nhật userContent và hasExistingContent
      } else {
        const errorData = await response.json();
        setUploadMessage(`Delete failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting video:', error);
      setUploadMessage('Network error. Please try again.');
    }
  };

  const deleteStory = async (id: number) => {
    if (!user?.email) return;
    if (!confirm('Are you sure you want to delete this story?')) return;
    
    try {
      const response = await fetch(`/api/user/stories/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': user.email,
        },
      });
      
      if (response.ok) {
        await loadData();
        setUploadMessage('Story deleted successfully!');
        setTimeout(() => setUploadMessage(''), 3000);
      } else {
        const errorData = await response.json();
        setUploadMessage(`Delete failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      setUploadMessage('Network error. Please try again.');
    }
  };

  // Episodes management functions (giống Admin)
  const addNewEpisode = async () => {
    if (!user?.email || editId == null || !newEpisodeFile) {
      alert('Vui lòng chọn file video cho tập phim mới');
      return;
    }

    setAddingEpisode(true);
    try {
      const formData = new FormData();
      formData.append('videoFile', newEpisodeFile);
      formData.append('title', newEpisodeTitle || `Tập ${editEpisodes.length + 1}`);
      formData.append('duration', String(newEpisodeDuration));
      formData.append('isFree', 'true');

      const response = await fetch(`/api/user/movies/${editId}/episodes`, {
        method: 'POST',
        headers: {
          'x-user-email': user.email,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add episode');
      }

      // Refresh episodes list
      const episodesResponse = await fetch(`/api/user/movies/${editId}/episodes`, {
        headers: { 'x-user-email': user.email }
      });
      if (episodesResponse.ok) {
        const episodes = await episodesResponse.json();
        setEditEpisodes(episodes);
      }

      setNewEpisodeFile(undefined);
      setNewEpisodeTitle('');
      setNewEpisodeDuration(120);
      setUploadMessage('Episode added successfully!');
      setTimeout(() => setUploadMessage(''), 3000);
    } catch (error: any) {
      console.error('Error adding episode:', error);
      setUploadMessage(`Failed to add episode: ${error.message || 'Unknown error'}`);
    } finally {
      setAddingEpisode(false);
    }
  };

  const deleteEpisode = async (episodeId: number) => {
    if (!user?.email || editId == null) return;
    if (!confirm('Are you sure you want to delete this episode?')) return;

    try {
      const response = await fetch(`/api/user/episodes/${episodeId}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': user.email,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete episode');
      }

      // Refresh episodes list
      const episodesResponse = await fetch(`/api/user/movies/${editId}/episodes`, {
        headers: { 'x-user-email': user.email }
      });
      if (episodesResponse.ok) {
        const episodes = await episodesResponse.json();
        setEditEpisodes(episodes);
      }

      setUploadMessage('Episode deleted successfully!');
      setTimeout(() => setUploadMessage(''), 3000);
    } catch (error: any) {
      console.error('Error deleting episode:', error);
      setUploadMessage(`Failed to delete episode: ${error.message || 'Unknown error'}`);
    }
  };

  // Chapters management functions (giống Admin)
  const addNewChapter = async () => {
    if (!user?.email || editStoryId == null) {
      alert('Vui lòng chọn truyện để thêm chương');
      return;
    }

    if (storyTypeForEdit === 'Text' && !newChapterContentFile) {
      alert('Vui lòng chọn file content cho chương mới');
      return;
    }

    if (storyTypeForEdit === 'Comic' && newChapterImages.length === 0) {
      alert('Vui lòng chọn ít nhất một ảnh cho chương mới');
      return;
    }

    setAddingChapter(true);
    try {
      const formData = new FormData();
      formData.append('title', newChapterTitle || `Chapter ${editChapters.length + 1}`);
      formData.append('isFree', 'true');

      if (storyTypeForEdit === 'Text') {
        formData.append('contentFile', newChapterContentFile!);
      } else {
        newChapterImages.forEach((image) => {
          formData.append('chapterImages', image);
        });
      }

      const response = await fetch(`/api/admin/stories/${editStoryId}/chapters`, {
        method: 'POST',
        headers: {
          'x-user-email': user.email,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add chapter');
      }

      // Refresh chapters list
      const chaptersResponse = await fetch(`/api/stories/${editStoryId}/chapters`);
      if (chaptersResponse.ok) {
        const chapters = await chaptersResponse.json();
        setEditChapters(chapters);
      }

      setNewChapterContentFile(undefined);
      setNewChapterImages([]);
      setNewChapterTitle('');
      setUploadMessage('Chapter added successfully!');
      setTimeout(() => setUploadMessage(''), 3000);
    } catch (error: any) {
      console.error('Error adding chapter:', error);
      setUploadMessage(`Failed to add chapter: ${error.message || 'Unknown error'}`);
    } finally {
      setAddingChapter(false);
    }
  };

  const deleteChapter = async (chapterId: number) => {
    if (!user?.email || editStoryId == null) return;
    if (!confirm('Are you sure you want to delete this chapter?')) return;

    try {
      const response = await fetch(`/api/admin/chapters/${chapterId}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': user.email,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete chapter');
      }

      // Refresh chapters list
      const chaptersResponse = await fetch(`/api/stories/${editStoryId}/chapters`);
      if (chaptersResponse.ok) {
        const chapters = await chaptersResponse.json();
        setEditChapters(chapters);
      }

      setUploadMessage('Chapter deleted successfully!');
      setTimeout(() => setUploadMessage(''), 3000);
    } catch (error: any) {
      console.error('Error deleting chapter:', error);
      setUploadMessage(`Failed to delete chapter: ${error.message || 'Unknown error'}`);
    }
  };

  const handleStoryUpload = async () => {
    if (!user?.email) return;
    
    if (!createStoryTitle.trim()) {
      setUploadMessage('Vui lòng nhập tiêu đề truyện');
      return;
    }
    if (createStoryCategoryIds.length === 0) {
      setUploadMessage('Vui lòng chọn ít nhất một thể loại');
      return;
    }
    if (!createStoryAuthor.trim()) {
      setUploadMessage('Vui lòng nhập tên tác giả');
      return;
    }
    if (storyType === 'Text' && contentFiles.length === 0) {
      setUploadMessage('Vui lòng chọn ít nhất một file content cho truyện chữ');
      return;
    }
    if (storyType === 'Comic' && chapterImages.length === 0) {
      setUploadMessage('Vui lòng chọn ít nhất một ảnh cho truyện tranh');
      return;
    }
    if (!storyCoverFile) {
      setUploadMessage('Vui lòng chọn ảnh bìa');
      return;
    }

    setUploading(true);
    setUploadMessage('');
    
    try {
      const formData = new FormData();
      formData.append('title', createStoryTitle.trim());
      formData.append('description', createStoryDescription.trim());
      formData.append('author', createStoryAuthor.trim());
      
      // Append multiple category IDs
      createStoryCategoryIds.forEach((catId) => {
        formData.append('categoryIds', String(catId));
      });
      
      formData.append('isFree', isStoryFree ? 'true' : 'false');
      formData.append('storyType', storyType);
      formData.append('coverImage', storyCoverFile);
      
      if (storyType === 'Text') {
        contentFiles.forEach((file) => {
          formData.append('contentFiles', file);
        });
        // Append chapters metadata (giống Admin)
        if (storyChapters.length > 0) {
          formData.append('chapters', JSON.stringify(storyChapters));
        }
      } else if (storyType === 'Comic') {
        chapterImages.forEach((image) => {
          formData.append('chapterImages', image);
        });
        // Append chapters metadata nếu có (giống Admin)
        if (storyChapters.length > 0) {
          formData.append('chapters', JSON.stringify(storyChapters));
        }
      }

      const response = await fetch('/api/user/stories', {
        method: 'POST',
        headers: {
          'x-user-email': user.email,
        },
        body: formData,
      });
      
      if (response.ok) {
        await response.json();
        setUploadMessage(`✅ Upload thành công! Truyện đang chờ Admin duyệt.`);
        
        setCreateStoryTitle('');
        setCreateStoryDescription('');
        setCreateStoryAuthor('');
        setCreateStoryCategoryIds([]);
        setContentFiles([]);
        setChapterImages([]);
        setStoryChapters([]);
        setStoryCoverFile(undefined);
        setStoryType('Text');
        setIsStoryFree(true);
        
        await loadData();
        setTimeout(() => setUploadMessage(''), 5000);
      } else {
        const errorData = await response.json();
        setUploadMessage(`❌ Upload thất bại: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadMessage(`❌ Lỗi mạng: ${error.message || 'Please check your connection'}`);
    } finally {
      setUploading(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
            <div className="h-64 bg-gray-300 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user?.email) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Authentication Required
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Please log in to access this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Nếu không còn quyền upload và không còn phim/truyện → Đóng trang upload
  // CHỈ kiểm tra sau khi đã load xong data (loading = false)
  if (!loading && !shouldShowPage) {
    console.log('🚫 Closing upload page - no permission and no content');
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Trang Upload Đã Đóng
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Bạn không còn quyền upload và không còn phim/truyện nào. Trang upload đã bị đóng.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
              Vai trò hiện tại: <span className="font-medium">{userRole || 'Unknown'}</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Số phim: {userContent.length}
            </p>
            <div className="mt-6">
              <Button onClick={() => window.location.href = '/role-upgrade'}>
                Yêu cầu nâng cấp quyền
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleMovieUpload = async () => {
    if (!user?.email) return;
    
    // Validation
    if (!createTitle.trim()) {
      setUploadMessage('Please enter movie title');
      return;
    }
    if (createCategoryIds.length === 0) {
      setUploadMessage('Vui lòng chọn ít nhất một thể loại');
      return;
    }
    if (episodeFiles.length === 0) {
      setUploadMessage('Vui lòng chọn ít nhất một tập phim');
      return;
    }
    if (!coverFile) {
      setUploadMessage('Vui lòng chọn ảnh bìa');
      return;
    }

    // Validate file sizes (1000MB for video, 10MB for image)
    const maxVideoSize = 1000 * 1024 * 1024; // 1000MB
    const maxImageSize = 10 * 1024 * 1024; // 10MB
    
    for (const videoFile of episodeFiles) {
      if (videoFile.size > maxVideoSize) {
        setUploadMessage(`File video "${videoFile.name}" quá lớn. Kích thước tối đa: 1000MB`);
        return;
      }
    }
    
    if (coverFile.size > maxImageSize) {
      setUploadMessage('Ảnh bìa quá lớn. Kích thước tối đa: 10MB');
      return;
    }

    // Validate file formats
    const allowedVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm'];
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    for (const videoFile of episodeFiles) {
      if (!allowedVideoTypes.includes(videoFile.type)) {
        setUploadMessage(`Định dạng video "${videoFile.name}" không hỗ trợ. Chỉ chấp nhận: MP4, AVI, MOV, MKV, WEBM`);
        return;
      }
    }
    
    if (!allowedImageTypes.includes(coverFile.type)) {
      setUploadMessage('Định dạng ảnh không hỗ trợ. Chỉ chấp nhận: JPG, JPEG, PNG, WEBP');
      return;
    }

    setUploading(true);
    setUploadMessage('');
    
    try {
      const formData = new FormData();
      formData.append('title', createTitle.trim());
      formData.append('description', createDescription.trim());
      
      // Append multiple category IDs
      createCategoryIds.forEach((catId) => {
        formData.append('categoryIds', String(catId));
      });
      
      // Append all episode files
      episodeFiles.forEach((file) => {
        formData.append('episodeFiles', file);
      });
      
      // Append episodes metadata
      formData.append('episodes', JSON.stringify(episodes));
      
      formData.append('coverImage', coverFile);
      
      // User upload phải gọi route /api/user/movies (KHÔNG phải /api/admin/movies)
      const response = await fetch('/api/user/movies', {
        method: 'POST',
        headers: {
          'x-user-email': user.email,
        },
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        // User upload luôn là Pending, cần Admin duyệt
        setUploadMessage(result.message || `Upload successful! Your content is pending admin approval.`);
        
        // Reset form
        setCreateTitle('');
        setCreateDescription('');
        setCreateCategoryIds([]);
        setEpisodeFiles([]);
        setEpisodes([]);
        setCoverFile(undefined);
        
        // Reset file inputs
        const videoInput = document.querySelector('input[type="file"][accept="video/*"]') as HTMLInputElement;
        const coverInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
        if (videoInput) videoInput.value = '';
        if (coverInput) coverInput.value = '';
        
        // Reload data
        await loadData();
        
        // Clear success message after 5 seconds
        setTimeout(() => setUploadMessage(''), 5000);
      } else {
        const errorData = await response.json();
        setUploadMessage(`Upload failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadMessage('Network error. Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Upload className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Upload Content
          </h1>
        </div>

        {/* Tabs để chuyển đổi giữa Movies và Stories */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('movies')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'movies'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Film className="w-4 h-4 inline mr-2" />
              Movies
            </button>
            <button
              onClick={() => setActiveTab('stories')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'stories'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <BookOpen className="w-4 h-4 inline mr-2" />
              Stories
            </button>
          </nav>
        </div>

        {/* Upload Notice */}
        <Card className="mb-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Content Approval Required
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Your uploaded content will be reviewed by administrators before being published. 
                  You will be notified once it's approved or rejected.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Thông báo khi không còn quyền upload nhưng vẫn còn phim */}
        {!hasUploadPermission && hasExistingContent && (
          <Card className="mb-6">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                    Quyền Upload Đã Bị Thu Hồi
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Bạn không còn quyền upload hoặc sửa phim mới. Bạn chỉ có thể xem và xóa các phim/truyện hiện có. 
                    Khi xóa hết phim/truyện, trang upload sẽ bị đóng.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Upload Movie Form - Chỉ hiển thị khi tab Movies được chọn */}
        {activeTab === 'movies' && hasUploadPermission && (
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Film className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Upload New Movie</h2>
            </div>
            <div className="grid gap-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Movie Title *
                  </label>
                  <Input
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="Enter movie title"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="Enter movie description"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                    rows={3}
                  />
                </div>

                {/* Categories - Multiple selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Categories * (Có thể chọn nhiều thể loại)
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-800">
                    {categories.filter((c) => c.Type === 'Movie' || c.Type === 'Both').map((c) => (
                      <label key={c.CategoryID} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 rounded">
                        <input
                          type="checkbox"
                          checked={createCategoryIds.includes(c.CategoryID)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateCategoryIds([...createCategoryIds, c.CategoryID]);
                            } else {
                              setCreateCategoryIds(createCategoryIds.filter(id => id !== c.CategoryID));
                            }
                          }}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">{c.CategoryName}</span>
                      </label>
                    ))}
                  </div>
                  {createCategoryIds.length === 0 && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1">Vui lòng chọn ít nhất một thể loại</p>
                  )}
                </div>

                {/* Episode Files - Multiple upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tập Phim * (Có thể chọn nhiều file, Max 1000MB mỗi file)
                  </label>
                  <input 
                    type="file" 
                    accept="video/*" 
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setEpisodeFiles(files);
                      // Tự động tạo thông tin tập phim với mã định danh (giống Admin)
                      const newEpisodes = files.map((_, index) => ({
                        episodeNumber: index + 1,
                        title: `Tập ${index + 1}`,
                        duration: 120,
                        episodeCode: `EP-${index + 1}` // Mã tạm thời, sẽ được tạo tự động khi upload
                      }));
                      setEpisodes(newEpisodes);
                    }} 
                    className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300" 
                  />
                  {episodeFiles.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Danh sách tập phim ({episodeFiles.length} tập):
                      </p>
                      {episodeFiles.map((file, index) => (
                        <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                📹 {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                              </div>
                              <div className="grid grid-cols-3 gap-3 mt-2">
                                <div>
                                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                    Mã tập phim:
                                  </label>
                                  <Input
                                    value={episodes[index]?.episodeCode || `EP-${index + 1}`}
                                    onChange={(e) => {
                                      const newEpisodes = [...episodes];
                                      newEpisodes[index] = {
                                        ...newEpisodes[index],
                                        episodeCode: e.target.value,
                                        episodeNumber: index + 1,
                                        title: newEpisodes[index]?.title || `Tập ${index + 1}`,
                                        duration: newEpisodes[index]?.duration || 120
                                      };
                                      setEpisodes(newEpisodes);
                                    }}
                                    className="text-xs font-mono bg-white dark:bg-gray-700"
                                    placeholder={`EP-${index + 1}`}
                                  />
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Mã sẽ được tạo tự động: EP[MovieID]-{String(index + 1).padStart(3, '0')}
                                  </p>
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                    Tên tập:
                                  </label>
                                  <Input
                                    value={episodes[index]?.title || `Tập ${index + 1}`}
                                    onChange={(e) => {
                                      const newEpisodes = [...episodes];
                                      newEpisodes[index] = {
                                        ...newEpisodes[index],
                                        title: e.target.value,
                                        episodeNumber: index + 1,
                                        duration: newEpisodes[index]?.duration || 120,
                                        episodeCode: newEpisodes[index]?.episodeCode || `EP-${index + 1}`
                                      };
                                      setEpisodes(newEpisodes);
                                    }}
                                    className="text-xs"
                                    placeholder={`Tập ${index + 1}`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                    Thời lượng (phút):
                                  </label>
                                  <Input
                                    type="number"
                                    value={episodes[index]?.duration || 120}
                                    onChange={(e) => {
                                      const newEpisodes = [...episodes];
                                      newEpisodes[index] = {
                                        ...newEpisodes[index],
                                        duration: Number(e.target.value),
                                        episodeNumber: index + 1,
                                        title: newEpisodes[index]?.title || `Tập ${index + 1}`,
                                        episodeCode: newEpisodes[index]?.episodeCode || `EP-${index + 1}`
                                      };
                                      setEpisodes(newEpisodes);
                                    }}
                                    className="text-xs"
                                    placeholder="120"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cover Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cover Image * (Max 10MB)
                  </label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => setCoverFile(e.target.files?.[0])} 
                    className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300" 
                  />
                  {coverFile && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      🖼️ {coverFile.name} ({(coverFile.size / 1024 / 1024).toFixed(1)} MB)
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex justify-end">
                  <Button 
                    onClick={handleMovieUpload}
                    disabled={uploading}
                    className="flex items-center gap-2"
                  >
                    <Film className="w-4 h-4" />
                    {uploading ? 'Uploading...' : 'Upload Movie'}
                  </Button>
                </div>
            </div>

            {/* Upload Message */}
            {uploadMessage && (
              <div className={`p-3 rounded-md mt-4 ${
                uploadMessage.includes('successful') || uploadMessage.includes('✅')
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
                  : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
              }`}>
                {uploadMessage}
              </div>
            )}
          </div>
        </Card>
        )}

        {/* Upload Story Form - Chỉ hiển thị khi tab Stories được chọn */}
        {activeTab === 'stories' && hasUploadPermission && (
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Upload New Story</h2>
            </div>
            
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Story Title *</label>
                <Input value={createStoryTitle} onChange={(e) => setCreateStoryTitle(e.target.value)} placeholder="Enter story title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Author *</label>
                <Input value={createStoryAuthor} onChange={(e) => setCreateStoryAuthor(e.target.value)} placeholder="Enter author name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea value={createStoryDescription} onChange={(e) => setCreateStoryDescription(e.target.value)} placeholder="Enter story description" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" rows={3} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Categories * (Có thể chọn nhiều thể loại)</label>
                <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-800">
                  {categories.filter((c) => c.Type === "Series" || c.Type === "Both").map((c) => (
                    <label key={c.CategoryID} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 rounded">
                      <input
                        type="checkbox"
                        checked={createStoryCategoryIds.includes(c.CategoryID)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCreateStoryCategoryIds([...createStoryCategoryIds, c.CategoryID]);
                          } else {
                            setCreateStoryCategoryIds(createStoryCategoryIds.filter(id => id !== c.CategoryID));
                          }
                        }}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-sm text-gray-900 dark:text-white">{c.CategoryName}</span>
                    </label>
                  ))}
                </div>
                {createStoryCategoryIds.length === 0 && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">Vui lòng chọn ít nhất một thể loại</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Story Type *</label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value={storyType} onChange={(e) => {
                  setStoryType(e.target.value as 'Text' | 'Comic');
                  setContentFiles([]);
                  setChapterImages([]);
                  setStoryChapters([]);
                }}>
                  <option value="Text">Truyện chữ (Text Story)</option>
                  <option value="Comic">Truyện tranh (Comic/Manga)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cover Image * (Max 10MB)</label>
                <input type="file" accept="image/*" onChange={(e) => setStoryCoverFile(e.target.files?.[0])} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                {storyCoverFile && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    🖼️ {storyCoverFile.name} ({(storyCoverFile.size / 1024 / 1024).toFixed(1)} MB)
                  </div>
                )}
              </div>
              {storyType === 'Text' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Content Files * (Max 50MB per file, up to 50 chapters)</label>
                  <input type="file" accept=".txt,.doc,.docx,.pdf,.epub,.mobi" multiple onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    files.sort((a, b) => a.name.localeCompare(b.name));
                    setContentFiles(files);
                    // Tự động tạo chapters metadata (giống Admin)
                    const newChapters = files.map((_, index) => ({
                      chapterNumber: index + 1,
                      title: `Chapter ${index + 1}`
                    }));
                    setStoryChapters(newChapters);
                  }} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  {contentFiles.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        📖 Đã chọn {contentFiles.length} file
                      </div>
                      {/* Hiển thị danh sách chapters với tên có thể chỉnh sửa (giống Admin) */}
                      <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-gray-50 dark:bg-gray-800">
                        {storyChapters.map((chapter, index) => (
                          <div key={index} className="flex items-center gap-2 py-1">
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-20">
                              Chương {chapter.chapterNumber}:
                            </span>
                            <Input
                              value={chapter.title}
                              onChange={(e) => {
                                const updated = [...storyChapters];
                              updated[index] = { ...updated[index], title: e.target.value };
                              setStoryChapters(updated);
                            }}
                              className="text-xs h-7 flex-1"
                              placeholder={`Chapter ${chapter.chapterNumber}`}
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {contentFiles[index]?.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {storyType === 'Comic' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chapter Images * (Max 5MB per image, up to 500 images)</label>
                  <input type="file" accept="image/*" multiple onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    files.sort((a, b) => a.name.localeCompare(b.name));
                    setChapterImages(files);
                  }} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  {chapterImages.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      📷 Đã chọn {chapterImages.length} ảnh
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isStoryFree} onChange={(e) => setIsStoryFree(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Free to read</span>
                </label>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleStoryUpload} disabled={uploading || !createStoryTitle || !createStoryAuthor || createStoryCategoryIds.length === 0} className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Upload Story'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
        )}

        {/* User's Content Status - Hiển thị theo tab */}
        {activeTab === 'movies' && userContent.length > 0 && (
          <Card className="mt-6">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Film className="w-5 h-5" />
                Your Uploaded Movies ({userContent.length})
              </h2>
              
              {/* Movies Section */}
                <div className="space-y-3">
                  {userContent.map((content, index) => (
                    <div key={`movie-${content.MovieID || index}`} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      {editId === content.MovieID ? (
                        // Edit Mode
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Title *
                            </label>
                            <Input
                              value={editForm.title || ''}
                              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                              placeholder="Enter movie title"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Description
                            </label>
                            <textarea
                              value={editForm.description || ''}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              placeholder="Enter movie description"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                              rows={3}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Categories * (Có thể chọn nhiều thể loại)
                            </label>
                            <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-800">
                              {categories.filter((c) => c.Type === 'Movie' || c.Type === 'Both').map((c) => (
                                <label key={c.CategoryID} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 rounded">
                                  <input
                                    type="checkbox"
                                    checked={editCategoryIds.includes(c.CategoryID)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setEditCategoryIds([...editCategoryIds, c.CategoryID]);
                                      } else {
                                        setEditCategoryIds(editCategoryIds.filter(id => id !== c.CategoryID));
                                      }
                                    }}
                                    className="rounded border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm text-gray-900 dark:text-white">{c.CategoryName}</span>
                                </label>
                              ))}
                            </div>
                            {editCategoryIds.length === 0 && (
                              <p className="text-xs text-red-500 dark:text-red-400 mt-1">Vui lòng chọn ít nhất một thể loại</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Pricing
                            </label>
                            <select
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              value={editForm.isFree ? 'true' : 'false'}
                              onChange={(e) => setEditForm({ ...editForm, isFree: e.target.value === 'true' })}
                            >
                              <option value="true">Free</option>
                              <option value="false">Paid</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              New Video (optional)
                            </label>
                            <input 
                              type="file" 
                              accept="video/*" 
                              onChange={(e) => setEditVideoFile(e.target.files?.[0])} 
                              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300" 
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              New Cover (optional)
                            </label>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => setEditCoverFile(e.target.files?.[0])} 
                              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300" 
                            />
                          </div>

                          {/* Episodes Management */}
                          {loadingEpisodes ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400">Đang tải danh sách tập phim...</div>
                          ) : (
                            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Danh sách tập phim ({editEpisodes.length} tập):
                                </div>
                              </div>
                              
                              {/* Danh sách tập hiện có */}
                              {editEpisodes.length > 0 && (
                                <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
                                  {editEpisodes.map((episode) => (
                                    <div key={episode.EpisodeID} className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 flex-1">
                                          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                            Tập {episode.EpisodeNumber}:
                                          </span>
                                          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                                            {episode.Title || `Tập ${episode.EpisodeNumber}`}
                                          </span>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="danger"
                                          onClick={() => deleteEpisode(episode.EpisodeID)}
                                          className="text-xs h-7 px-3 py-0 bg-red-600 hover:bg-red-700 text-white"
                                        >
                                          🗑️ Delete
                                        </Button>
                                      </div>
                                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                          Mã tập:
                                        </label>
                                        <Input
                                          value={episode.EpisodeCode || ''}
                                          onChange={(e) => {
                                            const updated = editEpisodes.map(ep => 
                                              ep.EpisodeID === episode.EpisodeID 
                                                ? { ...ep, EpisodeCode: e.target.value }
                                                : ep
                                            );
                                            setEditEpisodes(updated);
                                          }}
                                          className="text-sm font-mono h-8 px-3 py-1 bg-gray-50 dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-md"
                                          placeholder={`EP${content.MovieID}-${String(episode.EpisodeNumber).padStart(3, '0')}`}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Form thêm tập mới */}
                              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
                                  ➕ Thêm tập phim mới:
                                </div>
                                <div className="space-y-2">
                                  <div>
                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                      File video:
                                    </label>
                                    <input 
                                      type="file" 
                                      accept="video/*" 
                                      onChange={(e) => setNewEpisodeFile(e.target.files?.[0])} 
                                      className="block w-full text-xs text-gray-500 dark:text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
                                    />
                                    {newEpisodeFile && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        📹 {newEpisodeFile.name} ({(newEpisodeFile.size / 1024 / 1024).toFixed(1)} MB)
                                      </div>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                        Tên tập:
                                      </label>
                                      <Input
                                        value={newEpisodeTitle}
                                        onChange={(e) => setNewEpisodeTitle(e.target.value)}
                                        placeholder={`Tập ${editEpisodes.length + 1}`}
                                        className="text-xs h-7"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                        Thời lượng (phút):
                                      </label>
                                      <Input
                                        type="number"
                                        value={newEpisodeDuration}
                                        onChange={(e) => setNewEpisodeDuration(Number(e.target.value))}
                                        className="text-xs h-7"
                                      />
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={addNewEpisode}
                                    disabled={!newEpisodeFile || addingEpisode}
                                    className="w-full text-xs"
                                  >
                                    {addingEpisode ? 'Đang thêm...' : 'Thêm tập mới'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button onClick={saveEdit} size="sm">
                              Save Changes
                            </Button>
                            <Button 
                              onClick={() => {
                                setEditId(null);
                                setEditForm({});
                                setEditVideoFile(undefined);
                                setEditCoverFile(undefined);
                                setEditCategoryIds([]);
                                setEditEpisodes([]);
                                setNewEpisodeFile(undefined);
                                setNewEpisodeTitle('');
                                setNewEpisodeDuration(120);
                              }} 
                              variant="secondary" 
                              size="sm"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="flex items-start gap-4">
                          {/* Movie Poster */}
                          <div className="flex-shrink-0">
                            <div className="w-20 h-28 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                              {content.PosterURL ? (
                                <img 
                                  src={buildMediaUrl(content.PosterURL) || undefined} 
                                  alt={content.Title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <Film className="w-8 h-8" />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex-1 flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900 dark:text-white">{content.Title}</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Uploaded: {new Date(content.CreatedAt).toLocaleDateString()}
                              </p>
                              {content.Description && (
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                  {content.Description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                {content.Status === 'Approved' && (
                                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs font-medium flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    Approved & Live
                                  </span>
                                )}
                                {content.Status === 'Pending' && (
                                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-medium flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Pending Review
                                  </span>
                                )}
                                {content.Status === 'Rejected' && (
                                  <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-xs font-medium flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Rejected
                                  </span>
                                )}
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  content.IsFree 
                                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                    : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                }`}>
                                  {content.IsFree ? 'Free' : 'Paid'}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                {hasUploadPermission && (
                                  <Button 
                                    onClick={() => startEdit(content.MovieID, content.Title, content.Description, content.IsFree)} 
                                    size="sm" 
                                    variant="secondary"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                )}
                                <Button 
                                  onClick={() => deleteVideo(content.MovieID)} 
                                  size="sm" 
                                  variant="danger"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </Card>
        )}

        {/* Stories Section - Chỉ hiển thị khi tab Stories được chọn */}
        {activeTab === 'stories' && userStories.length > 0 && (
          <Card className="mt-6">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Your Uploaded Stories ({userStories.length})
              </h2>
              <div className="space-y-3">
                  {userStories.map((story, index) => (
                    <div key={`user-story-${story.SeriesID || story.StoryID || index}`} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      {editStoryId === (story.SeriesID || story.StoryID) ? (
                        // Edit Mode
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Title *
                            </label>
                            <Input
                              value={editStoryForm.title || ''}
                              onChange={(e) => setEditStoryForm({ ...editStoryForm, title: e.target.value })}
                              placeholder="Enter story title"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Author *
                            </label>
                            <Input
                              value={editStoryForm.author || ''}
                              onChange={(e) => setEditStoryForm({ ...editStoryForm, author: e.target.value })}
                              placeholder="Enter author name"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Description
                            </label>
                            <textarea
                              value={editStoryForm.description || ''}
                              onChange={(e) => setEditStoryForm({ ...editStoryForm, description: e.target.value })}
                              placeholder="Enter story description"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                              rows={3}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Categories * (Có thể chọn nhiều thể loại)
                            </label>
                            <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-800">
                              {categories.filter((c) => c.Type === 'Series' || c.Type === 'Both').map((c) => (
                                <label key={c.CategoryID} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 rounded">
                                  <input
                                    type="checkbox"
                                    checked={editStoryCategoryIds.includes(c.CategoryID)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setEditStoryCategoryIds([...editStoryCategoryIds, c.CategoryID]);
                                      } else {
                                        setEditStoryCategoryIds(editStoryCategoryIds.filter(id => id !== c.CategoryID));
                                      }
                                    }}
                                    className="rounded border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm text-gray-900 dark:text-white">{c.CategoryName}</span>
                                </label>
                              ))}
                            </div>
                            {editStoryCategoryIds.length === 0 && (
                              <p className="text-xs text-red-500 dark:text-red-400 mt-1">Vui lòng chọn ít nhất một thể loại</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Pricing
                            </label>
                            <select
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              value={editStoryForm.isFree ? 'true' : 'false'}
                              onChange={(e) => setEditStoryForm({ ...editStoryForm, isFree: e.target.value === 'true' })}
                            >
                              <option value="true">Free</option>
                              <option value="false">Paid</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              New Cover (optional)
                            </label>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => setEditStoryCoverFile(e.target.files?.[0])} 
                              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300" 
                            />
                          </div>

                          {/* Chapters Management */}
                          {loadingChapters ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400">Đang tải danh sách chương...</div>
                          ) : (
                            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Danh sách chương ({editChapters.length} chương):
                                </div>
                              </div>
                              
                              {/* Danh sách chương hiện có */}
                              {editChapters.length > 0 && (
                                <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
                                  {editChapters.map((ch) => (
                                    <div key={ch.ChapterID} className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 flex-1">
                                          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                            Chương {ch.ChapterNumber}:
                                          </span>
                                          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                                            {ch.Title || `Chapter ${ch.ChapterNumber}`}
                                          </span>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="danger"
                                          onClick={() => deleteChapter(ch.ChapterID)}
                                          className="text-xs h-7 px-3 py-0 bg-red-600 hover:bg-red-700 text-white"
                                        >
                                          🗑️ Delete
                                        </Button>
                                      </div>
                                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                          Mã chương:
                                        </label>
                                        <Input
                                          value={ch.ChapterCode || ''}
                                          onChange={(e) => {
                                            const updated = editChapters.map(chap => 
                                              chap.ChapterID === ch.ChapterID 
                                                ? { ...chap, ChapterCode: e.target.value }
                                                : chap
                                            );
                                            setEditChapters(updated);
                                          }}
                                          className="text-sm font-mono h-8 px-3 py-1 bg-gray-50 dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-md"
                                          placeholder={`CH${story.SeriesID || story.StoryID}-${String(ch.ChapterNumber).padStart(3, '0')}`}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Form thêm chương mới */}
                              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
                                  ➕ Thêm chương mới:
                                </div>
                                <div className="space-y-2">
                                  <div>
                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                      Tên chương:
                                    </label>
                                    <Input
                                      value={newChapterTitle}
                                      onChange={(e) => setNewChapterTitle(e.target.value)}
                                      placeholder={`Chapter ${editChapters.length + 1}`}
                                      className="text-xs h-7"
                                    />
                                  </div>
                                  {storyTypeForEdit === 'Text' ? (
                                    <div>
                                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                        File content:
                                      </label>
                                      <input 
                                        type="file" 
                                        accept=".txt,.doc,.docx,.pdf,.epub,.mobi" 
                                        onChange={(e) => setNewChapterContentFile(e.target.files?.[0])} 
                                        className="block w-full text-xs text-gray-500 dark:text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
                                      />
                                      {newChapterContentFile && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                          📖 {newChapterContentFile.name} ({(newChapterContentFile.size / 1024 / 1024).toFixed(1)} MB)
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div>
                                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                        Ảnh chương:
                                      </label>
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        multiple
                                        onChange={(e) => {
                                          const files = Array.from(e.target.files || []);
                                          setNewChapterImages(files);
                                        }} 
                                        className="block w-full text-xs text-gray-500 dark:text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
                                      />
                                      {newChapterImages.length > 0 && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                          📷 Đã chọn {newChapterImages.length} ảnh
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <Button
                                    size="sm"
                                    onClick={addNewChapter}
                                    disabled={addingChapter || (storyTypeForEdit === 'Text' && !newChapterContentFile) || (storyTypeForEdit === 'Comic' && newChapterImages.length === 0)}
                                    className="w-full text-xs"
                                  >
                                    {addingChapter ? 'Đang thêm...' : 'Thêm chương mới'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button onClick={saveEditStory} size="sm">
                              Save Changes
                            </Button>
                            <Button 
                              onClick={() => {
                                setEditStoryId(null);
                                setEditStoryForm({});
                                setEditStoryCoverFile(undefined);
                                setEditStoryCategoryIds([]);
                                setEditChapters([]);
                                setNewChapterContentFile(undefined);
                                setNewChapterImages([]);
                                setNewChapterTitle('');
                                setStoryTypeForEdit('Text');
                              }} 
                              variant="secondary" 
                              size="sm"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="flex items-start gap-4">
                          {/* Story Cover */}
                          <div className="flex-shrink-0">
                            <div className="w-20 h-28 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                              {story.CoverURL ? (
                                <img 
                                  src={buildMediaUrl(story.CoverURL) || undefined} 
                                  alt={story.Title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <BookOpen className="w-8 h-8" />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex-1 flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900 dark:text-white">{story.Title}</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Author: {story.Author}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Uploaded: {new Date(story.CreatedAt).toLocaleDateString()}
                              </p>
                              {story.Description && (
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                  {story.Description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                {story.Status === 'Approved' && (
                                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs font-medium flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    Approved & Live
                                  </span>
                                )}
                                {story.Status === 'Pending' && (
                                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-medium flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Pending Review
                                  </span>
                                )}
                                {story.Status === 'Rejected' && (
                                  <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-xs font-medium flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Rejected
                                  </span>
                                )}
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  story.IsFree 
                                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                    : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                }`}>
                                  {story.IsFree ? 'Free' : 'Paid'}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                {hasUploadPermission && (
                                  <Button 
                                    onClick={() => startEditStory(story.SeriesID || story.StoryID, story.Title, story.Description, story.Author, story.IsFree, story.StoryType)} 
                                    size="sm" 
                                    variant="secondary"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                )}
                                <Button 
                                  onClick={() => deleteStory(story.SeriesID || story.StoryID)} 
                                  size="sm" 
                                  variant="danger"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </Card>
        )}

        {/* Empty State - Hiển thị khi không có content trong tab hiện tại */}
        {((activeTab === 'movies' && userContent.length === 0) || (activeTab === 'stories' && userStories.length === 0)) && !hasUploadPermission && (
          <Card className="mt-6">
            <div className="p-6 text-center">
              {activeTab === 'movies' ? (
              <Film className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              ) : (
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              )}
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No {activeTab === 'movies' ? 'Movies' : 'Stories'} Yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {activeTab === 'movies' 
                  ? "You haven't uploaded any movies yet. Use the form above to upload your first movie!"
                  : "You haven't uploaded any stories yet. Use the form above to upload your first story!"
                }
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default UserUploadPage;
