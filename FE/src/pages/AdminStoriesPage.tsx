import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { fetchCategories, crawlStoryFromVN, crawlChapterImages, ChapterMeta } from '../lib/api';
import { Upload, BookOpen, Crown, CheckCircle, Clock, AlertCircle, Download, Loader2 } from 'lucide-react';
import { buildMediaUrl } from '../lib/config';

const AdminStoriesPage: React.FC = () => {
  const { user } = useAuth();
  const email = user?.email || '';
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<{ 
    title?: string; 
    status?: string; 
    description?: string;
    author?: string;
    isFree?: boolean;
  }>({});
  const [editCoverFile, setEditCoverFile] = useState<File | undefined>(undefined);
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
  const [storyTypeForEdit, setStoryTypeForEdit] = useState<'Text' | 'Comic'>('Text');
  const [editCategoryIds, setEditCategoryIds] = useState<number[]>([]);
  const [newChapterContentFile, setNewChapterContentFile] = useState<File | undefined>(undefined);
  const [newChapterImages, setNewChapterImages] = useState<File[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [addingChapter, setAddingChapter] = useState(false);
  const [newChapterCrawlUrl, setNewChapterCrawlUrl] = useState('');
  const [crawlingNewChapter, setCrawlingNewChapter] = useState(false);
  
  // Upload form states
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createAuthor, setCreateAuthor] = useState('');
  const [createCategoryIds, setCreateCategoryIds] = useState<number[]>([]);
  const [storyType, setStoryType] = useState<'Text' | 'Comic'>('Text');
  const [contentFiles, setContentFiles] = useState<File[]>([]);
  const [chapterImages, setChapterImages] = useState<File[]>([]);
  const [chapters, setChapters] = useState<Array<{chapterNumber: number, title: string, images?: number[]}>>([]);
  const [coverFile, setCoverFile] = useState<File | undefined>(undefined);
  const [isFree, setIsFree] = useState(true);
  const [categories, setCategories] = useState<{ CategoryID: number; CategoryName: string; Type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [storyUrl, setStoryUrl] = useState('');
  const [crawlingStory, setCrawlingStory] = useState(false);
  const [crawlCoverUrl, setCrawlCoverUrl] = useState<string | null>(null);
  const [crawledStoryMeta, setCrawledStoryMeta] = useState<{ title: string; story_url?: string | null; source_site?: string | null } | null>(null);
  const [crawledChapterList, setCrawledChapterList] = useState<ChapterMeta[]>([]);
  const [selectedCrawledChapterSlug, setSelectedCrawledChapterSlug] = useState<string>('');
  const [chapterCrawlLoading, setChapterCrawlLoading] = useState(false);
  const [chapterCrawlMessage, setChapterCrawlMessage] = useState('');
  const [chapterPreviewImages, setChapterPreviewImages] = useState<string[]>([]);
  const [chapterPreviewFolder, setChapterPreviewFolder] = useState<string | null>(null);
  const [chapterPreviewSite, setChapterPreviewSite] = useState<string>('');

  const isAdmin = useMemo(() => !!email, [email]);

  const resolveImageSrc = (url: string) => {
    if (!url) return '';
    return url.startsWith('/storage/') ? buildMediaUrl(url) : url;
  };

  const normalizeToStoragePath = (value: string) => {
    if (!value) return '';
    let normalized = value.trim().replace(/\\/g, '/');

    if (/^https?:\/\//i.test(normalized)) {
      try {
        const parsed = new URL(normalized);
        normalized = parsed.pathname || normalized;
      } catch {
        // Ignore URL parsing errors and keep original value
      }
    }

    if (normalized.startsWith('/storage/')) {
      return normalized;
    }

    const uploadsIndex = normalized.indexOf('uploads/');
    if (uploadsIndex >= 0) {
      const suffix = normalized.slice(uploadsIndex + 'uploads/'.length);
      return `/storage/${suffix}`;
    }

    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }

    if (!normalized.startsWith('/storage/')) {
      normalized = `/storage/${normalized.replace(/^\/+/, '')}`;
    }

    return normalized;
  };

  const load = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const response = await fetch('/api/admin/stories', {
        headers: { 'x-user-email': email }
      });
      if (response.ok) {
        const rows = await response.json();
        console.log('Loaded stories:', rows);
        console.log('Admin uploads:', rows.filter((s: any) => s.UploaderRole && s.UploaderRole.trim() === 'Admin'));
        console.log('User uploads:', rows.filter((s: any) => !s.UploaderRole || s.UploaderRole.trim() !== 'Admin'));
        setItems(rows);
      }
    } catch (error) {
      console.error('Error loading stories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    load(); 
    if (email) {
      fetch('/api/auth/role', {
        headers: { 'x-user-email': email }
      })
        .then(res => res.json())
        .then(data => setUserRole(data.role))
        .catch(() => setUserRole(''));
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */ 
  }, [email]);

  useEffect(() => {
    const run = async () => {
      try {
        const list = await fetchCategories();
        setCategories(list.map(c => ({ CategoryID: c.CategoryID, CategoryName: c.CategoryName, Type: c.Type })));
      } catch {}
    };
    run();
  }, []);

  const startEdit = async (id: number, title: string, status: string, description?: string, author?: string, isFree?: boolean, storyType?: string) => {
    setEditId(id);
    setForm({ title, status, description, author, isFree });
    setStoryTypeForEdit((storyType as 'Text' | 'Comic') || 'Text');
    setEditChapters([]);
    setLoadingChapters(true);
    setNewChapterContentFile(undefined);
    setNewChapterImages([]);
    setNewChapterTitle('');
    setEditCategoryIds([]);
    
    try {
      const response = await fetch(`/api/stories/${id}/chapters`);
      if (response.ok) {
        const chapters = await response.json();
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
        setEditCategoryIds(storyCats.map((c: any) => c.CategoryID));
      }
    } catch (error) {
      console.error('Error fetching story categories:', error);
    }
  };

  const save = async () => {
    if (!email || editId == null) return;
    
    const formData = new FormData();
    if (form.title) formData.append('title', form.title);
    if (form.status) formData.append('status', form.status);
    if (form.description) formData.append('description', form.description);
    if (form.author) formData.append('author', form.author);
    if (typeof form.isFree !== 'undefined') formData.append('isFree', form.isFree ? 'true' : 'false');
    if (editCoverFile) formData.append('coverImage', editCoverFile);
    if (storyTypeForEdit) formData.append('storyType', storyTypeForEdit);
    
    // Add categories array
    editCategoryIds.forEach((catId) => {
      formData.append('categoryIds', String(catId));
    });
    
    try {
      const response = await fetch(`/api/admin/stories/${editId}`, {
        method: 'PUT',
        headers: {
          'x-user-email': email,
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to update story');
      }
      
      // Update chapters if any ChapterCode changed
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
              'x-user-email': email,
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
      
      setEditId(null);
      setForm({});
      setEditCoverFile(undefined);
      setEditChapters([]);
      setEditCategoryIds([]);
      setStoryTypeForEdit('Text');
      await load();
      alert('Đã cập nhật truyện thành công!');
    } catch (error) {
      console.error('Error updating story:', error);
      alert('Có lỗi xảy ra khi cập nhật truyện');
    }
  };

  const addNewChapter = async () => {
    if (!email || editId == null) {
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
      formData.append('storyType', storyTypeForEdit);
      formData.append('isFree', isFree ? 'true' : 'false');

      if (storyTypeForEdit === 'Text' && newChapterContentFile) {
        formData.append('contentFile', newChapterContentFile);
      } else if (storyTypeForEdit === 'Comic') {
        newChapterImages.forEach((image) => {
          formData.append('chapterImages', image);
        });
      }

      const response = await fetch(`/api/admin/stories/${editId}/chapters`, {
        method: 'POST',
        headers: {
          'x-user-email': email,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add chapter');
      }

      const chaptersResponse = await fetch(`/api/stories/${editId}/chapters`);
      if (chaptersResponse.ok) {
        const chaptersData = await chaptersResponse.json();
        setEditChapters(chaptersData);
      }

      setNewChapterContentFile(undefined);
      setNewChapterImages([]);
      setNewChapterTitle('');
      alert('Đã thêm chương mới thành công!');
    } catch (error: any) {
      console.error('Error adding chapter:', error);
      alert(error.message || 'Có lỗi xảy ra khi thêm chương');
    } finally {
      setAddingChapter(false);
    }
  };

  const deleteChapter = async (chapterId: number) => {
    if (!confirm('Bạn có chắc muốn xóa chương này?')) return;
    if (!email || editId == null) return;

    try {
      const response = await fetch(`/api/admin/chapters/${chapterId}`, {
        method: 'DELETE',
        headers: { 'x-user-email': email },
      });

      if (!response.ok) throw new Error('Failed to delete chapter');

      const chaptersResponse = await fetch(`/api/stories/${editId}/chapters`);
      if (chaptersResponse.ok) {
        const chaptersData = await chaptersResponse.json();
        setEditChapters(chaptersData);
      }
      alert('Đã xóa chương thành công!');
    } catch (error: any) {
      alert(error.message || 'Có lỗi xảy ra khi xóa chương');
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa truyện này? Hành động này không thể hoàn tác!')) return;
    
    try {
      const response = await fetch(`/api/admin/stories/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': email,
        },
      });
      
      const data = await response.json();
      if (data.success || response.ok) {
        alert(`✅ ${data.message || 'Đã xóa truyện thành công!'}`);
        await load();
      } else {
        alert(`❌ ${data.error || 'Có lỗi xảy ra'}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(`❌ Lỗi kết nối: ${error}`);
    }
  };

  const handleStoryUpload = async () => {
    if (!email) return;
    
    if (!createTitle.trim()) {
      setUploadMessage('Vui lòng nhập tiêu đề truyện');
      return;
    }
    if (createCategoryIds.length === 0) {
      setUploadMessage('Vui lòng chọn ít nhất một thể loại');
      return;
    }
    if (!createAuthor.trim()) {
      setUploadMessage('Vui lòng nhập tên tác giả');
      return;
    }
    if (storyType === 'Text' && contentFiles.length === 0) {
      setUploadMessage('Vui lòng chọn ít nhất một file content cho truyện chữ');
      return;
    }
    if (storyType === 'Comic' && chapterImages.length === 0 && chapterPreviewImages.length === 0) {
      setUploadMessage('Vui lòng chọn ít nhất một ảnh cho truyện tranh');
      return;
    }
    // Nếu không có file upload VÀ không có ảnh từ crawl → báo lỗi
    if (!coverFile && !crawlCoverUrl) {
      setUploadMessage('Vui lòng chọn ảnh bìa hoặc crawl truyện có ảnh bìa');
      return;
    }

    const useCrawledChapterImages =
      storyType === 'Comic' && chapterPreviewImages.length > 0;

    setUploading(true);
    setUploadMessage('');
    
    try {
      const formData = new FormData();
      formData.append('title', createTitle.trim());
      formData.append('description', createDescription.trim());
      formData.append('author', createAuthor.trim());
      
      // Append multiple category IDs
      createCategoryIds.forEach((catId) => {
        formData.append('categoryIds', String(catId));
      });
      
      formData.append('isFree', isFree ? 'true' : 'false');
      formData.append('storyType', storyType);
      
      // Gửi ảnh bìa: ưu tiên cover crawl nếu có, fallback file upload
      if (crawlCoverUrl) {
        formData.append('coverLocal', normalizeToStoragePath(crawlCoverUrl));
      } else if (coverFile) {
        formData.append('coverImage', coverFile);
      }
      
      if (useCrawledChapterImages) {
        const normalizedPreviews = chapterPreviewImages
          .map((imageUrl) => normalizeToStoragePath(imageUrl))
          .filter((url) => !!url);
        formData.append('crawledImages', JSON.stringify(normalizedPreviews));
      }

      if (storyType === 'Text') {
        contentFiles.forEach((file) => {
          formData.append('contentFiles', file);
        });
      } else if (storyType === 'Comic' && !useCrawledChapterImages) {
        chapterImages.forEach((image) => {
          formData.append('chapterImages', image);
        });
      }

      if (chapters.length > 0) {
        formData.append('chapters', JSON.stringify(chapters));
      }

      const response = await fetch('/api/admin/stories', {
        method: 'POST',
        headers: {
          'x-user-email': email,
        },
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        const createdSeriesId = result.storyId || result.seriesId || result.SeriesID;
        const createdChapterId = result.chapterId || result.chapterID || result.existingChapterId;

        // ✅ FIX: Không auto-create chapter nếu:
        // 1. BE đã tạo chapter (createdChapterId có giá trị)
        // 2. Đã có crawledImages (BE đã tự tạo chapter từ crawl)
        // 3. Không có chapterImages để upload
        if (createdChapterId) {
          console.log('✅ BE already created chapter → skip auto-create');
        } else if (useCrawledChapterImages) {
          console.log('✅ BE already created chapter from crawledImages → skip auto-create');
        } else if (
          storyType === 'Comic' &&
          !useCrawledChapterImages &&
          chapterImages.length > 0 &&
          createdSeriesId &&
          !createdChapterId
        ) {
          // Chỉ auto-create nếu không có crawledImages và có chapterImages
          try {
            const chapterForm = new FormData();
            chapterForm.append('title', 'Chapter 1');
            chapterForm.append('storyType', 'Comic');
            chapterForm.append('isFree', isFree ? 'true' : 'false');
            chapterImages.forEach((image) => {
              chapterForm.append('chapterImages', image);
            });

            const chapterResponse = await fetch(`/api/admin/stories/${createdSeriesId}/chapters`, {
              method: 'POST',
              headers: {
                'x-user-email': email,
              },
              body: chapterForm,
            });

            if (!chapterResponse.ok) {
              const chapterError = await chapterResponse.json().catch(() => ({}));
              console.error('❌ Failed to auto-create comic chapter:', chapterError);
            }
          } catch (chapterErr) {
            console.error('❌ Error auto-creating comic chapter:', chapterErr);
          }
        }

        setUploadMessage(`✅ Upload thành công! Truyện đã được tự động duyệt với ${result.chapterCount || (storyType === 'Text' ? contentFiles.length : 1)} chương.`);
        
        setCreateTitle('');
        setCreateDescription('');
        setCreateAuthor('');
        setCreateCategoryIds([]);
        setContentFiles([]);
        setChapterImages([]);
        setChapters([]);
        setChapterPreviewImages([]);
        setChapterPreviewFolder(null);
        setChapterPreviewSite('');
        setCoverFile(undefined);
        setCrawlCoverUrl(null);
        setStoryType('Text');
        setIsFree(true);
        
        await load();
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

  const handleChapterCrawl = async () => {
    if (!email) return;
    if (!selectedCrawledChapterSlug) {
      setChapterCrawlMessage('Vui lòng chọn chapter cần crawl');
      return;
    }
    const targetChapter = crawledChapterList.find((ch) => ch.slug === selectedCrawledChapterSlug);
    if (!targetChapter) {
      setChapterCrawlMessage('Chapter không hợp lệ, vui lòng chọn lại');
      return;
    }

    setChapterCrawlLoading(true);
    setChapterCrawlMessage('');

    try {
      const response = await crawlChapterImages(email, {
        url: crawledStoryMeta?.story_url || storyUrl.trim() || targetChapter.url,
        chapterUrl: targetChapter.url,
        chapterSlug: targetChapter.slug,
        chapterTitle: targetChapter.title,
        storyTitle: crawledStoryMeta?.title || createTitle || targetChapter.title,
      });

      const saved = (response.savedImages ?? []).filter(Boolean);
      const remoteImages = (response.images ?? []).filter(Boolean);
      setChapterPreviewImages(saved.length > 0 ? saved : remoteImages);
      setChapterPreviewFolder(response.storageFolder);
      setChapterPreviewSite(response.site);
      if (saved.length > 0) {
        try {
          const downloadedFiles = await Promise.all(
            saved.map(async (imageUrl, index) => {
              try {
                const resolvedUrl = resolveImageSrc(imageUrl);
                const fileResponse = await fetch(resolvedUrl);
                if (!fileResponse.ok) {
                  throw new Error(`Failed to fetch image: ${resolvedUrl}`);
                }
                const blob = await fileResponse.blob();
                const extension =
                  imageUrl.split(".").pop()?.split("?")[0]?.toLowerCase() ||
                  "jpg";
                const safeSlug =
                  selectedCrawledChapterSlug ||
                  targetChapter.slug ||
                  `chapter-${Date.now()}`;
                const fileName = `${safeSlug}-${String(index + 1).padStart(
                  3,
                  "0"
                )}.${extension}`;
                const inferredType =
                  blob.type ||
                  (extension === "png"
                    ? "image/png"
                    : extension === "webp"
                    ? "image/webp"
                    : "image/jpeg");
                return new File([blob], fileName, { type: inferredType });
              } catch (downloadErr) {
                console.error(
                  "Không thể chuẩn bị ảnh crawl cho form upload:",
                  downloadErr
                );
                return null;
              }
            })
          );
          const validFiles = downloadedFiles.filter(
            (file): file is File => file !== null
          );
          setChapterImages(validFiles);
        } catch (conversionError) {
          console.error(
            "Lỗi khi chuyển ảnh crawl sang File để upload:",
            conversionError
          );
          setChapterImages([]);
        }
      } else {
        setChapterImages([]);
      }
      setChapterCrawlMessage(
        `✅ Đã xử lý ${saved.length || response.imageCount}/${response.imageCount} ảnh từ ${response.site}`
      );
    } catch (error: any) {
      setChapterCrawlMessage(`❌ ${error.message || 'Không thể crawl chapter, vui lòng thử lại'}`);
      setChapterPreviewImages([]);
      setChapterPreviewFolder(null);
      setChapterPreviewSite('');
    } finally {
      setChapterCrawlLoading(false);
    }
  };

  const hasUploadPermission = ['Admin', 'Uploader', 'Author', 'Translator', 'Reup'].includes(userRole);
  const isAdminUser = userRole === 'Admin';
  
  if (!isAdmin) return <div className="p-8">Bạn cần đăng nhập để truy cập trang này.</div>;
  if (!hasUploadPermission) {
    return (
      <div className="p-8 max-w-6xl mx-auto text-white">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold mb-2">Không có quyền upload</h1>
          <p className="text-gray-300 mb-4">Bạn cần có quyền upload để truy cập trang này.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Crown className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Story Management</h1>
          </div>
          <Button onClick={load} variant="secondary">🔄 Refresh</Button>
        </div>

        {/* Upload Form */}
        <Card className="mb-6">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Upload New Story</h2>
            </div>
            
            <div className="grid gap-4">
              {/* Crawl từ URL truyện VN */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Crawl metadata từ URL truyện VN (Tùy chọn)
                  </label>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={storyUrl}
                    onChange={(e) => setStoryUrl(e.target.value)}
                    placeholder="Nhập URL truyện (NetTruyen, TruyenQQ...)"
                    className="flex-1"
                  />
                  <Button
                    onClick={async () => {
                      if (!storyUrl.trim() || !email) {
                        setUploadMessage('Vui lòng nhập URL truyện');
                        return;
                      }
                      setCrawlingStory(true);
                      setUploadMessage('');
                      try {
                        const result = await crawlStoryFromVN(email, storyUrl.trim(), true);
                        if (result.ok && result.series) {
                          const series = result.series;
                          setCreateTitle(series.title || '');
                          setCreateAuthor(series.author || '');
                          setCreateDescription(series.description || '');
                          setCrawledStoryMeta({
                            title: series.title || '',
                            story_url: series.story_url,
                            source_site: series.source_site,
                          });
                          setCrawledChapterList(series.chapters || []);
                          setSelectedCrawledChapterSlug('');
                          setChapterPreviewImages([]);
                          setChapterPreviewFolder(null);
                          setChapterPreviewSite('');
                          setChapterCrawlMessage(
                            (series.chapters && series.chapters.length > 0)
                              ? '✅ Đã có danh sách chapter, chọn một chapter để crawl ảnh'
                              : '⚠️ Chưa tìm thấy danh sách chapter, vui lòng nhập chapter URL thủ công'
                          );
                          // ✅ FIX: Ưu tiên cover_local (ảnh đã tải về server), fallback cover_url nếu không tải được
                          if (series.cover_local) {
                            setCrawlCoverUrl(series.cover_local);
                            setUploadMessage(`✅ Đã crawl thành công: ${series.title} - Ảnh bìa đã tải về server`);
                          } else if (series.cover_url) {
                            // Nếu không tải được về local, vẫn dùng cover_url để hiển thị (FE sẽ proxy qua server)
                            setCrawlCoverUrl(series.cover_url);
                            setUploadMessage(`✅ Đã crawl thành công: ${series.title} - Ảnh bìa từ URL gốc`);
                          } else {
                            setCrawlCoverUrl(null);
                            setUploadMessage(`✅ Đã crawl thành công: ${series.title}. ⚠️ Ảnh bìa chưa tìm thấy, vui lòng upload thủ công.`);
                          }
                        }
                      } catch (error: any) {
                        setUploadMessage(`❌ Lỗi crawl: ${error.message}`);
                        setCrawledChapterList([]);
                        setCrawledStoryMeta(null);
                        setSelectedCrawledChapterSlug('');
                        setChapterPreviewImages([]);
                        setChapterPreviewFolder(null);
                        setChapterPreviewSite('');
                        setChapterCrawlMessage('');
                      } finally {
                        setCrawlingStory(false);
                      }
                    }}
                    disabled={crawlingStory}
                    className="whitespace-nowrap"
                  >
                    {crawlingStory ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang crawl...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Crawl Truyện
                      </>
                    )}
                  </Button>
                </div>
                {crawlCoverUrl && (
                  <div className="mt-3 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      {crawlCoverUrl.startsWith('/storage/') ? '✅ Cover đã tải về server:' : '🌐 Cover từ URL gốc:'}
                    </p>
                    <img 
                      src={crawlCoverUrl.startsWith('/storage/') ? buildMediaUrl(crawlCoverUrl) : crawlCoverUrl} 
                      alt="Cover" 
                      className="w-32 h-48 object-cover rounded"
                      onError={(e) => {
                        console.error('Lỗi load ảnh cover:', crawlCoverUrl);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {crawlCoverUrl.startsWith('/storage/') ? `Path: ${crawlCoverUrl}` : `URL: ${crawlCoverUrl.substring(0, 60)}...`}
                    </p>
                  </div>
                )}
                {crawledStoryMeta && (
                  <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                      <span>🌐 Nguồn: <strong>{crawledStoryMeta.source_site || 'Không xác định'}</strong></span>
                      {crawledStoryMeta.story_url && (
                        <a
                          href={crawledStoryMeta.story_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 dark:text-blue-400 underline break-all"
                        >
                          {crawledStoryMeta.story_url}
                        </a>
                      )}
                    </div>
                    {crawledChapterList.length > 0 ? (
                      <div className="mt-3 space-y-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            📚 Đã tìm thấy {crawledChapterList.length} chapter. Chọn chapter cần crawl ảnh:
                          </p>
                          <div className="flex items-center gap-2 w-full md:w-auto">
                            <select
                              value={selectedCrawledChapterSlug}
                              onChange={(e) => {
                                setSelectedCrawledChapterSlug(e.target.value);
                                setChapterCrawlMessage('');
                              }}
                              className="flex-1 md:flex-none px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                            >
                              <option value="">-- Chọn chapter --</option>
                              {crawledChapterList.map((chapter) => (
                                <option key={chapter.slug} value={chapter.slug}>
                                  Chapter {chapter.ordinal}: {chapter.title}
                                </option>
                              ))}
                            </select>
                            <Button
                              onClick={handleChapterCrawl}
                              disabled={!selectedCrawledChapterSlug || chapterCrawlLoading}
                              className="whitespace-nowrap flex items-center gap-2"
                            >
                              {chapterCrawlLoading ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Đang tải...
                                </>
                              ) : (
                                <>
                                  <Download className="w-4 h-4" />
                                  Crawl chapter
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto border border-dashed border-gray-200 dark:border-gray-700 rounded p-2 bg-gray-50 dark:bg-gray-900/40">
                          {crawledChapterList.slice(0, 40).map((chapter) => (
                            <button
                              key={chapter.slug}
                              onClick={() => {
                                setSelectedCrawledChapterSlug(chapter.slug);
                                setChapterCrawlMessage('');
                              }}
                              className={`w-full text-left px-2 py-1 rounded text-xs mb-1 ${
                                selectedCrawledChapterSlug === chapter.slug
                                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                              }`}
                            >
                              Chapter {chapter.ordinal}: {chapter.title}
                            </button>
                          ))}
                          {crawledChapterList.length > 40 && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                              ...và {crawledChapterList.length - 40} chapter khác
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-300">
                        ⚠️ Không tìm thấy danh sách chapter. Bạn vẫn có thể nhập chapter URL thủ công khi crawl.
                      </p>
                    )}
                    {chapterCrawlMessage && (
                      <div
                        className={`mt-3 text-xs px-2 py-1 rounded ${
                          chapterCrawlMessage.startsWith('✅')
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200'
                        }`}
                      >
                        {chapterCrawlMessage}
                      </div>
                    )}
                    {chapterPreviewImages.length > 0 && (
                      <div className="mt-3">
                        <div className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                          <span>
                            📦 Đã lưu {chapterPreviewImages.length} ảnh
                            {chapterPreviewSite && ` từ ${chapterPreviewSite}`}
                          </span>
                          {chapterPreviewFolder && (
                            <span>📁 Thư mục: {chapterPreviewFolder}</span>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                          {chapterPreviewImages.slice(0, 16).map((imageUrl, idx) => (
                            <img
                              key={`${imageUrl}-${idx}`}
                              src={resolveImageSrc(imageUrl)}
                              alt={`Chapter preview ${idx + 1}`}
                              className="w-full h-32 object-cover rounded border border-gray-200 dark:border-gray-700"
                            />
                          ))}
                        </div>
                        {chapterPreviewImages.length > 16 && (
                          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            Hiển thị 16 ảnh đầu tiên. Tổng cộng {chapterPreviewImages.length} ảnh.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Story Title *</label>
                <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Enter story title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Author *</label>
                <Input value={createAuthor} onChange={(e) => setCreateAuthor(e.target.value)} placeholder="Enter author name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Enter story description" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" rows={3} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Categories * (Có thể chọn nhiều thể loại)</label>
                <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-800">
                  {categories.filter((c) => c.Type === "Series" || c.Type === "Both").map((c) => (
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Story Type *</label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value={storyType} onChange={(e) => {
                  setStoryType(e.target.value as 'Text' | 'Comic');
                  setContentFiles([]);
                  setChapterImages([]);
                  setChapters([]);
                }}>
                  <option value="Text">Truyện chữ (Text Story)</option>
                  <option value="Comic">Truyện tranh (Comic/Manga)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cover Image * (Max 10MB)</label>
                <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0])} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                {coverFile && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    🖼️ {coverFile.name} ({(coverFile.size / 1024 / 1024).toFixed(1)} MB)
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
                    const newChapters = files.map((_, index) => ({
                      chapterNumber: index + 1,
                      title: `Chapter ${index + 1}`
                    }));
                    setChapters(newChapters);
                  }} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  {contentFiles.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      📖 Đã chọn {contentFiles.length} file
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
                  <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Free to read</span>
                </label>
              </div>
              {uploadMessage && (
                <div className={`p-3 rounded-md ${
                  uploadMessage.includes('✅') || uploadMessage.includes('thành công')
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
                    : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                }`}>
                  {uploadMessage}
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleStoryUpload} disabled={uploading || !createTitle || !createAuthor || createCategoryIds.length === 0} className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Upload Story'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Stories Management - Tách Admin và User */}
        {/* Admin Uploads */}
        <Card className="mb-6">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-6 h-6 text-yellow-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Admin Uploads ({items.filter(s => s.UploaderRole && s.UploaderRole.trim() === 'Admin').length})
              </h2>
            </div>
            
            {loading ? (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Cover</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Title</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Author</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Uploader</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Approval</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Free</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {items.filter(s => s.UploaderRole && s.UploaderRole.trim() === 'Admin').length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          Chưa có truyện nào do Admin upload
                        </td>
                      </tr>
                    ) : (
                      items.filter(s => s.UploaderRole && s.UploaderRole.trim() === 'Admin').map((s) => (
                      <tr key={s.SeriesID || s.StoryID} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{s.SeriesID || s.StoryID}</td>
                        <td className="px-4 py-3">
                          <div className="w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                              {s.CoverURL ? (
                                <img 
                                  src={buildMediaUrl(s.CoverURL) || undefined} 
                                  alt={s.Title} 
                                  className="w-full h-full object-cover" 
                                />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <BookOpen className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {editId === (s.SeriesID || s.StoryID) ? (
                            <div className="space-y-2">
                              <Input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                              <div className="text-xs">
                                <label className="block text-gray-500 dark:text-gray-400 mb-1">New Cover (optional):</label>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={(e) => setEditCoverFile(e.target.files?.[0])} 
                                  className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
                                />
                                {editCoverFile && (
                                  <div className="text-gray-500 dark:text-gray-400 mt-1">
                                    🖼️ {editCoverFile.name} ({(editCoverFile.size / 1024 / 1024).toFixed(1)} MB)
                                  </div>
                                )}
                              </div>
                              
                              {/* Categories Management */}
                              <div className="text-xs mt-2">
                                <label className="block text-gray-500 dark:text-gray-400 mb-1">Categories:</label>
                                <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700">
                                  {categories.filter((c) => c.Type === 'Series' || c.Type === 'Both').map((c) => (
                                    <label key={c.CategoryID} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 px-1 rounded">
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
                                      <span className="text-xs text-gray-900 dark:text-white">{c.CategoryName}</span>
                                    </label>
                                  ))}
                                </div>
                                {editCategoryIds.length === 0 && (
                                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">Vui lòng chọn ít nhất một thể loại</p>
                                )}
                              </div>
                              
                              {/* Chapters Management */}
                              {loadingChapters ? (
                                <div className="text-xs text-gray-500 dark:text-gray-400">Đang tải danh sách chương...</div>
                              ) : (
                                <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
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
                                              placeholder={`CH${s.SeriesID || s.StoryID}-${String(ch.ChapterNumber).padStart(3, '0')}`}
                                            />
                                            {ch.ChapterCode && (
                                              <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                                                (Có thể chỉnh sửa)
                                              </span>
                                            )}
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
                                      {/* ✅ FIX: Thêm option crawl chapter */}
                                      {storyTypeForEdit === 'Comic' && (
                                        <div className="mb-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            🌐 Crawl chapter từ URL (Tùy chọn):
                                          </label>
                                          <div className="flex gap-2">
                                            <Input
                                              value={newChapterCrawlUrl}
                                              onChange={(e) => setNewChapterCrawlUrl(e.target.value)}
                                              placeholder="Nhập URL chapter để crawl..."
                                              className="text-xs h-7 flex-1"
                                            />
                                            <Button
                                              size="sm"
                                              onClick={async () => {
                                                if (!newChapterCrawlUrl.trim()) {
                                                  alert('Vui lòng nhập URL chapter');
                                                  return;
                                                }
                                                
                                                setCrawlingNewChapter(true);
                                                try {
                                                  const nextChapterNum = editChapters.length > 0 
                                                    ? Math.max(...editChapters.map(c => c.ChapterNumber)) + 1
                                                    : 1;
                                                    
                                                  const response = await fetch('/api/crawl/chapter', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                      chapterUrl: newChapterCrawlUrl.trim(),
                                                      seriesId: editId,
                                                      chapterNumber: nextChapterNum,
                                                      chapterTitle: newChapterTitle || `Chapter ${nextChapterNum}`,
                                                      isFree: isFree,
                                                      saveToDisk: true,
                                                    }),
                                                  });
                                                  
                                                  if (!response.ok) {
                                                    const error = await response.json();
                                                    throw new Error(error.error || 'Crawl failed');
                                                  }
                                                  
                                                  const result = await response.json();
                                                  alert(`✅ Đã crawl ${result.imageCount} ảnh và tạo chapter ${nextChapterNum}`);
                                                  
                                                  // Reload chapters
                                                  const chaptersResponse = await fetch(`/api/stories/${editId}/chapters`);
                                                  if (chaptersResponse.ok) {
                                                    const chaptersData = await chaptersResponse.json();
                                                    setEditChapters(chaptersData);
                                                  }
                                                  
                                                  setNewChapterCrawlUrl('');
                                                  setNewChapterTitle('');
                                                } catch (error: any) {
                                                  alert(`❌ Lỗi: ${error.message}`);
                                                } finally {
                                                  setCrawlingNewChapter(false);
                                                }
                                              }}
                                              disabled={crawlingNewChapter}
                                              className="text-xs h-7 px-3 bg-green-600 hover:bg-green-700 text-white"
                                            >
                                              {crawlingNewChapter ? (
                                                <>
                                                  <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />
                                                  Crawling...
                                                </>
                                              ) : (
                                                <>
                                                  <Download className="w-3 h-3 mr-1 inline" />
                                                  Crawl
                                                </>
                                              )}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                      
                                      <div>
                                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                          Tên chương:
                                        </label>
                                        <Input
                                          value={newChapterTitle}
                                          onChange={(e) => setNewChapterTitle(e.target.value)}
                                          placeholder={`Chapter ${editChapters.length > 0 ? Math.max(...editChapters.map(c => c.ChapterNumber)) + 1 : 1}`}
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
                            </div>
                          ) : (
                            s.Title
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {editId === (s.SeriesID || s.StoryID) ? (
                            <div className="space-y-2">
                              <div className="text-xs">
                                <label className="block text-gray-500 dark:text-gray-400 mb-1">Author:</label>
                                <Input
                                  value={form.author ?? ''}
                                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                                  className="text-xs"
                                  placeholder="Enter author name"
                                />
                              </div>
                              <div className="text-xs">
                                <label className="block text-gray-500 dark:text-gray-400 mb-1">Description:</label>
                                <textarea 
                                  value={form.description ?? ''} 
                                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" 
                                  rows={3} 
                                />
                              </div>
                              <div className="text-xs">
                                <label className="block text-gray-500 dark:text-gray-400 mb-1">Story Type:</label>
                                <select 
                                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                  value={storyTypeForEdit}
                                  onChange={(e) => setStoryTypeForEdit(e.target.value as 'Text' | 'Comic')}
                                >
                                  <option value="Text">Truyện chữ (Text Story)</option>
                                  <option value="Comic">Truyện tranh (Comic/Manga)</option>
                                </select>
                              </div>
                              <div className="text-xs">
                                <label className="block text-gray-500 dark:text-gray-400 mb-1">Administrator:</label>
                                <div className="text-gray-600 dark:text-gray-400">{email}</div>
                                <div className="mt-1">
                                  <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-full text-xs font-medium">
                                    {userRole || 'Admin'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            s.Author
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                          {s.UploaderName || s.UploaderUsername || s.UploaderEmail || 'N/A'}
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {s.UploaderEmail}
                          </div>
                          <div className="text-xs">
                            <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full font-medium">
                              {s.UploaderRole || 'Admin'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editId === (s.SeriesID || s.StoryID) ? (
                            <select value={form.status ?? ''} onChange={(e) => setForm({ ...form, status: e.target.value })} className="px-2 py-1 border rounded">
                              <option value="Pending">Pending</option>
                              <option value="Approved">Approved</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-1 rounded text-xs ${
                              s.Status === 'Approved' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                              s.Status === 'Pending' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                              'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            }`}>
                              {s.Status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                            s.Status === 'Approved' 
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                              : s.Status === 'Pending' 
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          }`}>
                            {s.Status === 'Approved' && <CheckCircle className="w-3 h-3" />}
                            {s.Status === 'Pending' && <Clock className="w-3 h-3" />}
                            {s.Status === 'Rejected' && <AlertCircle className="w-3 h-3" />}
                            {s.Status === 'Pending' ? 'Awaiting Review' : s.Status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editId === (s.SeriesID || s.StoryID) ? (
                            <select 
                              className="px-2 py-1 border rounded"
                              value={form.isFree ? 'true' : 'false'}
                              onChange={(e) => setForm({ ...form, isFree: e.target.value === 'true' })}
                            >
                              <option value="true">Free</option>
                              <option value="false">Paid</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-1 rounded text-xs ${
                              s.IsFree 
                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            }`}>
                              {s.IsFree ? 'Free' : 'Paid'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm space-x-2">
                          {editId === (s.SeriesID || s.StoryID) ? (
                            <>
                              <Button size="sm" onClick={save}>Lưu</Button>
                              <Button size="sm" variant="ghost" onClick={() => { setEditId(null); setForm({}); setEditCoverFile(undefined); setEditChapters([]); setEditCategoryIds([]); setStoryTypeForEdit('Text'); }}>Hủy</Button>
                            </>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                <Button size="sm" onClick={() => startEdit(s.SeriesID || s.StoryID, s.Title, s.Status, s.Description, s.Author, s.IsFree, s.StoryType)}>Edit</Button>
                                <Button size="sm" variant="danger" onClick={() => remove(s.SeriesID || s.StoryID)}>Delete</Button>
                              </div>
                              {isAdminUser && s.Status === 'Pending' && (
                                <div className="flex gap-1">
                                  <Button 
                                    size="sm" 
                                    variant="primary"
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(`/api/admin/stories/${s.SeriesID || s.StoryID}/status`, {
                                          method: 'PUT',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'x-user-email': email,
                                          },
                                          body: JSON.stringify({ status: 'Approved' }),
                                        });
                                        if (response.ok) {
                                          await load();
                                          alert('Đã duyệt truyện thành công!');
                                        } else {
                                          alert('Có lỗi xảy ra khi duyệt truyện');
                                        }
                                      } catch (error) {
                                        console.error('Error approving story:', error);
                                        alert('Có lỗi xảy ra khi duyệt truyện');
                                      }
                                    }}
                                  >
                                    ✓ Duyệt
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="secondary"
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(`/api/admin/stories/${s.SeriesID || s.StoryID}/status`, {
                                          method: 'PUT',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'x-user-email': email,
                                          },
                                          body: JSON.stringify({ status: 'Rejected' }),
                                        });
                                        if (response.ok) {
                                          await load();
                                          alert('Đã từ chối truyện!');
                                        } else {
                                          alert('Có lỗi xảy ra khi từ chối truyện');
                                        }
                                      } catch (error) {
                                        console.error('Error rejecting story:', error);
                                        alert('Có lỗi xảy ra khi từ chối truyện');
                                      }
                                    }}
                                  >
                                    ✗ Từ chối
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        {/* User Uploads */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                User Uploads ({items.filter(s => !s.UploaderRole || s.UploaderRole.trim() !== 'Admin').length})
              </h2>
            </div>
            
            {loading ? (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Cover</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Title</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Author</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Uploader</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Approval</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Free</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {items.filter(s => !s.UploaderRole || s.UploaderRole.trim() !== 'Admin').length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          Chưa có truyện nào do User upload
                        </td>
                      </tr>
                    ) : (
                      items.filter(s => !s.UploaderRole || s.UploaderRole.trim() !== 'Admin').map((s) => (
                      <tr key={s.SeriesID || s.StoryID} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{s.SeriesID || s.StoryID}</td>
                        <td className="px-4 py-3">
                          <div className="w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                              {s.CoverURL ? (
                                <img 
                                  src={buildMediaUrl(s.CoverURL) || undefined} 
                                  alt={s.Title} 
                                  className="w-full h-full object-cover" 
                                />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <BookOpen className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {editId === (s.SeriesID || s.StoryID) ? (
                            <div className="space-y-2">
                              <Input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                              <div className="text-xs">
                                <label className="block text-gray-500 dark:text-gray-400 mb-1">New Cover (optional):</label>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={(e) => setEditCoverFile(e.target.files?.[0])} 
                                  className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
                                />
                                {editCoverFile && (
                                  <div className="text-gray-500 dark:text-gray-400 mt-1">
                                    🖼️ {editCoverFile.name} ({(editCoverFile.size / 1024 / 1024).toFixed(1)} MB)
                                  </div>
                                )}
                              </div>
                              
                              {/* Categories Management */}
                              <div className="text-xs mt-2">
                                <label className="block text-gray-500 dark:text-gray-400 mb-1">Categories:</label>
                                <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700">
                                  {categories.filter((c) => c.Type === 'Series' || c.Type === 'Both').map((c) => (
                                    <label key={c.CategoryID} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 px-1 rounded">
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
                                      <span className="text-xs text-gray-900 dark:text-white">{c.CategoryName}</span>
                                    </label>
                                  ))}
                                </div>
                                {editCategoryIds.length === 0 && (
                                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">Vui lòng chọn ít nhất một thể loại</p>
                                )}
                              </div>
                              
                              {/* Chapters Management */}
                              {loadingChapters ? (
                                <div className="text-xs text-gray-500 dark:text-gray-400">Đang tải danh sách chương...</div>
                              ) : (
                                <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
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
                                              placeholder={`CH${s.SeriesID || s.StoryID}-${String(ch.ChapterNumber).padStart(3, '0')}`}
                                            />
                                            {ch.ChapterCode && (
                                              <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                                                (Có thể chỉnh sửa)
                                              </span>
                                            )}
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
                            </div>
                          ) : (
                            s.Title
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {editId === (s.SeriesID || s.StoryID) ? (
                            <div className="space-y-2">
                              <div className="text-xs">
                                <label className="block text-gray-500 dark:text-gray-400 mb-1">Author:</label>
                                <Input
                                  value={form.author ?? ''}
                                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                                  className="text-xs"
                                  placeholder="Enter author name"
                                />
                              </div>
                              <div className="text-xs">
                                <label className="block text-gray-500 dark:text-gray-400 mb-1">Description:</label>
                                <textarea 
                                  value={form.description ?? ''} 
                                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" 
                                  rows={3} 
                                />
                              </div>
                              <div className="text-xs">
                                <label className="block text-gray-500 dark:text-gray-400 mb-1">Story Type:</label>
                                <select 
                                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                  value={storyTypeForEdit}
                                  onChange={(e) => setStoryTypeForEdit(e.target.value as 'Text' | 'Comic')}
                                >
                                  <option value="Text">Truyện chữ (Text Story)</option>
                                  <option value="Comic">Truyện tranh (Comic/Manga)</option>
                                </select>
                              </div>
                              <div className="text-xs">
                                <label className="block text-gray-500 dark:text-gray-400 mb-1">Administrator:</label>
                                <div className="text-gray-600 dark:text-gray-400">{email}</div>
                                <div className="mt-1">
                                  <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-full text-xs font-medium">
                                    {userRole || 'Admin'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            s.Author
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                          {s.UploaderName || s.UploaderUsername || s.UploaderEmail || 'N/A'}
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {s.UploaderEmail}
                          </div>
                          <div className="text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${
                              s.UploaderRole && s.UploaderRole.trim() === 'Admin'
                                ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            }`}>
                              {s.UploaderRole || 'User'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editId === (s.SeriesID || s.StoryID) ? (
                            <select value={form.status ?? ''} onChange={(e) => setForm({ ...form, status: e.target.value })} className="px-2 py-1 border rounded">
                              <option value="Pending">Pending</option>
                              <option value="Approved">Approved</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-1 rounded text-xs ${
                              s.Status === 'Approved' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                              s.Status === 'Pending' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                              'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            }`}>
                              {s.Status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                            s.Status === 'Approved' 
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                              : s.Status === 'Pending' 
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          }`}>
                            {s.Status === 'Approved' && <CheckCircle className="w-3 h-3" />}
                            {s.Status === 'Pending' && <Clock className="w-3 h-3" />}
                            {s.Status === 'Rejected' && <AlertCircle className="w-3 h-3" />}
                            {s.Status === 'Pending' ? 'Awaiting Review' : s.Status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editId === (s.SeriesID || s.StoryID) ? (
                            <select 
                              className="px-2 py-1 border rounded"
                              value={form.isFree ? 'true' : 'false'}
                              onChange={(e) => setForm({ ...form, isFree: e.target.value === 'true' })}
                            >
                              <option value="true">Free</option>
                              <option value="false">Paid</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-1 rounded text-xs ${
                              s.IsFree 
                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            }`}>
                              {s.IsFree ? 'Free' : 'Paid'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm space-x-2">
                          {editId === (s.SeriesID || s.StoryID) ? (
                            <>
                              <Button size="sm" onClick={save}>Lưu</Button>
                              <Button size="sm" variant="ghost" onClick={() => { setEditId(null); setForm({}); setEditCoverFile(undefined); setEditChapters([]); setEditCategoryIds([]); setStoryTypeForEdit('Text'); }}>Hủy</Button>
                            </>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                <Button size="sm" onClick={() => startEdit(s.SeriesID || s.StoryID, s.Title, s.Status, s.Description, s.Author, s.IsFree, s.StoryType)}>Edit</Button>
                                <Button size="sm" variant="danger" onClick={() => remove(s.SeriesID || s.StoryID)}>Delete</Button>
                              </div>
                              {isAdminUser && s.Status === 'Pending' && (
                                <div className="flex gap-1">
                                  <Button 
                                    size="sm" 
                                    variant="primary"
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(`/api/admin/stories/${s.SeriesID || s.StoryID}/status`, {
                                          method: 'PUT',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'x-user-email': email,
                                          },
                                          body: JSON.stringify({ status: 'Approved' }),
                                        });
                                        if (response.ok) {
                                          await load();
                                          alert('Đã duyệt truyện thành công!');
                                        } else {
                                          alert('Có lỗi xảy ra khi duyệt truyện');
                                        }
                                      } catch (error) {
                                        console.error('Error approving story:', error);
                                        alert('Có lỗi xảy ra khi duyệt truyện');
                                      }
                                    }}
                                  >
                                    ✓ Duyệt
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="secondary"
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(`/api/admin/stories/${s.SeriesID || s.StoryID}/status`, {
                                          method: 'PUT',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'x-user-email': email,
                                          },
                                          body: JSON.stringify({ status: 'Rejected' }),
                                        });
                                        if (response.ok) {
                                          await load();
                                          alert('Đã từ chối truyện!');
                                        } else {
                                          alert('Có lỗi xảy ra khi từ chối truyện');
                                        }
                                      } catch (error) {
                                        console.error('Error rejecting story:', error);
                                        alert('Có lỗi xảy ra khi từ chối truyện');
                                      }
                                    }}
                                  >
                                    ✗ Từ chối
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
};

export default AdminStoriesPage;
