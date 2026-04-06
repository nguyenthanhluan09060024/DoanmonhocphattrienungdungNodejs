import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { adminListMovies, fetchCategories, crawlMovieFromTMDB, crawlMovieFromURL } from '../lib/api';
import { Upload, Film, AlertCircle, CheckCircle, Clock, Crown, Download, Loader2 } from 'lucide-react';
import { buildMediaUrl } from '../lib/config';

const AdminMoviesPage: React.FC = () => {
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
    isFree?: boolean;
  }>({});
  const [editVideoFile, setEditVideoFile] = useState<File | undefined>(undefined);
  const [editCoverFile, setEditCoverFile] = useState<File | undefined>(undefined);
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
  const [createTitle, setCreateTitle] = useState('');
  const [createCategoryIds, setCreateCategoryIds] = useState<number[]>([]);
  const [episodeFiles, setEpisodeFiles] = useState<File[]>([]);
  const [episodes, setEpisodes] = useState<Array<{episodeNumber: number, title: string, duration: number, episodeCode?: string}>>([]);
  const [coverFile, setCoverFile] = useState<File | undefined>(undefined);
  const [categories, setCategories] = useState<{ CategoryID: number; CategoryName: string; Type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [editCategoryIds, setEditCategoryIds] = useState<number[]>([]);
  const [tmdbId, setTmdbId] = useState('');
  const [crawlingMovie, setCrawlingMovie] = useState(false);
  const [crawlPosterUrl, setCrawlPosterUrl] = useState<string | null>(null);

  const isAdmin = useMemo(() => !!email, [email]);

  const load = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const rows = await adminListMovies(email);
      setItems(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    load(); 
    // Load user role
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

  const startEdit = async (id: number, title: string, status: string, description?: string, isFree?: boolean) => {
    setEditId(id);
    setForm({ title, status, description, isFree });
    setEditEpisodes([]);
    setLoadingEpisodes(true);
    setNewEpisodeFile(undefined);
    setNewEpisodeTitle('');
    setNewEpisodeDuration(120);
    setEditCategoryIds([]);
    
    // Fetch episodes for this movie
    try {
      const response = await fetch(`/api/admin/movies/${id}/episodes`, {
        headers: {
          'x-user-email': email,
        },
      });
      if (response.ok) {
        const episodes = await response.json();
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

  const addNewEpisode = async () => {
    if (!email || editId == null || !newEpisodeFile) {
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

      const response = await fetch(`/api/admin/movies/${editId}/episodes`, {
        method: 'POST',
        headers: {
          'x-user-email': email,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add episode');
      }

      // Refresh episodes list
      const episodesResponse = await fetch(`/api/admin/movies/${editId}/episodes`, {
        headers: {
          'x-user-email': email,
        },
      });
      if (episodesResponse.ok) {
        const episodes = await episodesResponse.json();
        setEditEpisodes(episodes);
      }

      // Reset form
      setNewEpisodeFile(undefined);
      setNewEpisodeTitle('');
      setNewEpisodeDuration(120);
      
      alert('Đã thêm tập phim mới thành công!');
    } catch (error: any) {
      console.error('Error adding episode:', error);
      alert(error.message || 'Có lỗi xảy ra khi thêm tập phim');
    } finally {
      setAddingEpisode(false);
    }
  };

  const deleteEpisode = async (episodeId: number) => {
    if (!confirm('Bạn có chắc muốn xóa tập phim này? Hành động này không thể hoàn tác!')) {
      return;
    }

    if (!email || editId == null) {
      alert('Có lỗi xảy ra');
      return;
    }

    try {
      const response = await fetch(`/api/admin/episodes/${episodeId}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': email,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete episode');
      }

      // Refresh episodes list
      const episodesResponse = await fetch(`/api/admin/movies/${editId}/episodes`, {
        headers: {
          'x-user-email': email,
        },
      });
      if (episodesResponse.ok) {
        const episodes = await episodesResponse.json();
        setEditEpisodes(episodes);
      }

      alert('Đã xóa tập phim thành công!');
    } catch (error: any) {
      console.error('Error deleting episode:', error);
      alert(error.message || 'Có lỗi xảy ra khi xóa tập phim');
    }
  };

  const save = async () => {
    if (!email || editId == null) return;
    
    // Tạo FormData để gửi file
    const formData = new FormData();
    if (form.title) formData.append('title', form.title);
    if (form.status) formData.append('status', form.status);
    if (form.description) formData.append('description', form.description);
    if (typeof form.isFree !== 'undefined') formData.append('isFree', form.isFree ? 'true' : 'false');
    if (editVideoFile) formData.append('videoFile', editVideoFile);
    if (editCoverFile) formData.append('coverImage', editCoverFile);
    
    // Add categories array
    editCategoryIds.forEach((catId) => {
      formData.append('categoryIds', String(catId));
    });
    
    try {
      const response = await fetch(`/api/admin/movies/${editId}`, {
        method: 'PUT',
        headers: {
          'x-user-email': email,
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to update movie');
      }
      
      // Update episodes if any EpisodeCode changed
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
          
          const episodeResponse = await fetch(`/api/admin/episodes/${episode.EpisodeID}`, {
            method: 'PUT',
            headers: {
              'x-user-email': email,
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
      setForm({});
      setEditVideoFile(undefined);
      setEditCoverFile(undefined);
      setEditEpisodes([]);
      setEditCategoryIds([]);
      await load();
      alert('Đã cập nhật phim thành công!');
    } catch (error) {
      console.error('Error updating movie:', error);
      alert('Có lỗi xảy ra khi cập nhật phim');
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa phim này? Hành động này không thể hoàn tác!')) return;
    
    try {
      console.log(`🗑️ Deleting movie ID: ${id}`);
      
      const response = await fetch(`/api/movies/delete/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      console.log('Delete response:', data);
      
      if (data.success) {
        alert(`✅ ${data.message}`);
        await load();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(`❌ Lỗi kết nối: ${error}`);
    }
  };

  // Check if user has upload permissions
  const hasUploadPermission = ['Admin', 'Uploader', 'Author', 'Translator', 'Reup'].includes(userRole);
  const isAdminUser = userRole === 'Admin';
  
  if (!isAdmin) return <div className="p-8">Bạn cần đăng nhập để truy cập trang này.</div>;
  if (!hasUploadPermission) {
    return (
      <div className="p-8 max-w-6xl mx-auto text-white">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold mb-2">Không có quyền upload</h1>
          <p className="text-gray-300 mb-4">
            Bạn cần có quyền upload để truy cập trang này.
          </p>
          <p className="text-sm text-gray-400">
            Vai trò hiện tại: <span className="font-medium">{userRole || 'Chưa xác định'}</span>
          </p>
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Movie Management</h1>
          </div>
          <Button onClick={load} variant="secondary">🔄 Refresh</Button>
        </div>

        {/* Upload Form */}
        <Card className="mb-6">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Upload New Movie</h2>
            </div>
            
            <div className="grid gap-4">
              {/* Crawl từ TMDB */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Crawl metadata từ TMDB (Tùy chọn)
                  </label>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tmdbId}
                    onChange={(e) => setTmdbId(e.target.value)}
                    placeholder="Nhập URL (TMDB hoặc trang VN) hoặc TMDB ID"
                    className="flex-1"
                  />
                  <Button
                    onClick={async () => {
                      if (!tmdbId.trim() || !email) {
                        setUploadMessage('Vui lòng nhập URL hoặc TMDB ID');
                        return;
                      }
                      setCrawlingMovie(true);
                      setUploadMessage('');
                      try {
                        const input = tmdbId.trim();
                        // ✅ FIX: Detect xem là URL hay TMDB ID
                        const isUrl = input.startsWith('http://') || input.startsWith('https://');
                        
                        let result;
                        if (isUrl) {
                          // Gọi crawlMovieFromURL cho URL
                          result = await crawlMovieFromURL(email, input, true);
                        } else {
                          // Gọi crawlMovieFromTMDB cho TMDB ID
                          result = await crawlMovieFromTMDB(email, input, true);
                        }
                        
                        if (result.ok && result.movie) {
                          const movie = result.movie;
                          setCreateTitle(movie.title || '');
                          setCrawlPosterUrl(movie.poster_local || movie.poster_url);
                          
                          // ✅ FIX: Hiển thị message phù hợp - có poster là thành công
                          if (movie.poster_local || movie.poster_url) {
                            if (movie.title) {
                              setUploadMessage(`✅ Đã crawl thành công: ${movie.title}`);
                            } else {
                              setUploadMessage(`✅ Đã lấy được poster! Vui lòng nhập title thủ công.`);
                            }
                          } else if (movie.title) {
                            setUploadMessage(`✅ Đã crawl thành công: ${movie.title} (chưa có poster)`);
                          } else {
                            setUploadMessage(`⚠️ Crawl không hoàn chỉnh. Vui lòng nhập thông tin thủ công.`);
                          }
                          // Có thể thêm các field khác nếu form có
                          // setCreateDescription(movie.overview);
                          // setCreateReleaseYear(movie.release_year);
                          // setCreateDuration(movie.duration);
                        }
                      } catch (error: any) {
                        // ✅ FIX: Ngay cả khi error, vẫn thử lấy poster nếu có thể
                        setUploadMessage(`❌ Lỗi crawl: ${error.message}`);
                        // Có thể thêm logic fallback để lấy poster từ error response nếu có
                      } finally {
                        setCrawlingMovie(false);
                      }
                    }}
                    disabled={crawlingMovie}
                    className="whitespace-nowrap"
                  >
                    {crawlingMovie ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang crawl...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Crawl TMDB
                      </>
                    )}
                  </Button>
                </div>
                {crawlPosterUrl && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                    <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">
                      ✅ Poster đã crawl - Sẽ tự động dùng khi upload (không cần chọn file)
                    </p>
                    <img 
                      src={buildMediaUrl(crawlPosterUrl)} 
                      alt="Poster" 
                      className="w-32 h-48 object-cover rounded border border-green-300 dark:border-green-700"
                      onError={(e) => {
                        console.error('Lỗi load ảnh poster:', crawlPosterUrl);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2 break-all">
                      Path: {crawlPosterUrl}
                    </p>
                  </div>
                )}
              </div>

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

              {/* Episode Files - Multiple upload với mã định danh */}
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
                    // Tự động tạo thông tin tập phim với mã định danh
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
                      <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-lg">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
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
                  {crawlPosterUrl && (
                    <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                      ✅ Đã có poster từ crawl, sẽ tự động dùng
                    </span>
                  )}
                </label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setCoverFile(e.target.files?.[0])} 
                  className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300" 
                />
                {crawlPosterUrl && !coverFile && (
                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-700 dark:text-green-300">
                    ✅ Poster đã crawl sẽ được dùng tự động. Bạn không cần chọn file nếu đã có poster từ crawl.
                  </div>
                )}
                {coverFile && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    🖼️ {coverFile.name} ({(coverFile.size / 1024 / 1024).toFixed(1)} MB)
                  </div>
                )}
              </div>

              {/* Upload Message */}
              {uploadMessage && (
                <div className={`p-3 rounded-md ${
                  uploadMessage.includes('successful') || uploadMessage.includes('thành công')
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
                    : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                }`}>
                  {uploadMessage}
                </div>
              )}

              {/* Upload Button */}
              <div className="flex justify-end">
                <Button 
            onClick={async () => {
              if (!email) return;
              
              // Validation
              if (!createTitle.trim()) {
                setUploadMessage('Vui lòng nhập tiêu đề phim');
                return;
              }
              if (createCategoryIds.length === 0) {
                setUploadMessage('Vui lòng chọn ít nhất một thể loại phim');
                return;
              }
              if (episodeFiles.length === 0) {
                setUploadMessage('Vui lòng chọn ít nhất một tập phim');
                return;
              }
              // ✅ FIX: Cho phép dùng poster đã crawl thay vì upload file
              if (!coverFile && !crawlPosterUrl) {
                setUploadMessage('Vui lòng chọn ảnh bìa hoặc crawl poster');
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
              
              // ✅ FIX: Chỉ validate coverFile nếu có (không có nếu dùng crawlPosterUrl)
              if (coverFile) {
                if (coverFile.size > maxImageSize) {
                  setUploadMessage('Ảnh bìa quá lớn. Kích thước tối đa: 10MB');
                  return;
                }
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
              
              // ✅ FIX: Chỉ validate coverFile type nếu có
              if (coverFile && !allowedImageTypes.includes(coverFile.type)) {
                setUploadMessage('Định dạng ảnh không hỗ trợ. Chỉ chấp nhận: JPG, JPEG, PNG, WEBP');
                return;
              }

              setUploading(true);
              setUploadMessage('');
              
              // Debug info
              console.log('Uploading movie with episodes:', {
                title: createTitle.trim(),
                categoryIds: createCategoryIds,
                episodeFiles: episodeFiles.map(f => ({ name: f.name, size: f.size, type: f.type })),
                episodes: episodes,
                coverFile: coverFile?.name,
                coverSize: coverFile?.size,
                coverType: coverFile?.type
              });
              
              try {
                // Tạo FormData để upload nhiều tập phim
                const formData = new FormData();
                formData.append('title', createTitle.trim());
                
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
                
                // ✅ FIX: Ưu tiên dùng poster đã crawl (posterLocal), fallback coverFile
                if (crawlPosterUrl && crawlPosterUrl.startsWith('/storage/')) {
                  // Poster đã tải về server, dùng posterLocal
                  formData.append('posterLocal', crawlPosterUrl);
                  console.log(`🔍 [FRONTEND] Append posterLocal: ${crawlPosterUrl}`);
                } else if (coverFile) {
                  // Upload file mới
                  formData.append('coverImage', coverFile);
                  console.log(`🔍 [FRONTEND] Append coverImage file: ${coverFile.name}`);
                } else {
                  console.warn(`⚠️ [FRONTEND] Không có cả posterLocal và coverFile!`);
                }
                
                const response = await fetch('/api/admin/movies', {
                  method: 'POST',
                  headers: {
                    'x-user-email': email,
                  },
                  body: formData,
                });
                
                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.error || 'Failed to upload movie');
                }
                
                const result = await response.json();
                
                setUploadMessage(isAdminUser 
                  ? `Tải phim lên thành công với ${result.episodeCount || episodeFiles.length} tập!` 
                  : `Tải phim lên thành công với ${result.episodeCount || episodeFiles.length} tập! Phim đang chờ Admin duyệt.`);
                
                // Reset form
                setCreateTitle('');
                setCreateCategoryIds([]);
                setEpisodeFiles([]);
                setEpisodes([]);
                setCoverFile(undefined);
                setCrawlPosterUrl(null); // ✅ FIX: Reset poster đã crawl
                
                // Reset file inputs
                const videoInput = document.querySelector('input[type="file"][accept="video/*"]') as HTMLInputElement;
                const coverInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
                if (videoInput) videoInput.value = '';
                if (coverInput) coverInput.value = '';
                
                await load();
                
                // Clear success message after 3 seconds
                setTimeout(() => setUploadMessage(''), 3000);
              } catch (error: any) {
                console.error('Upload error:', error);
                
                // Try to get detailed error message
                let errorMessage = 'Có lỗi xảy ra khi tải phim lên. Vui lòng thử lại.';
                
                if (error?.message) {
                  if (error.message.includes('Failed to upload movie')) {
                    errorMessage = 'Lỗi từ server: Không thể tải phim lên. Vui lòng kiểm tra lại thông tin và file.';
                  } else if (error.message.includes('Network')) {
                    errorMessage = 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet.';
                  } else {
                    errorMessage = `Lỗi: ${error.message}`;
                  }
                }
                
                setUploadMessage(errorMessage);
              } finally {
                setUploading(false);
              }
            }}
            disabled={uploading}
          >
                  <Film className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Upload Movie'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Movies Management - Tách Admin và User */}
        {/* Admin Uploads */}
        <Card className="mb-6">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-6 h-6 text-yellow-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Admin Uploads ({items.filter(m => m.UploaderRole === 'Admin').length})
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
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Poster</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Title</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Uploader</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Approval</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Free</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {items.filter(m => m.UploaderRole === 'Admin').length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          Chưa có phim nào do Admin upload
                        </td>
                      </tr>
                    ) : (
                      items.filter(m => m.UploaderRole === 'Admin').map((m) => (
                      <tr key={m.MovieID} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{m.MovieID}</td>
                        <td className="px-4 py-3">
                          <div className="w-14 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                              {m.PosterURL ? (
                                <img 
                                  src={buildMediaUrl(m.PosterURL) || undefined} 
                                  alt={m.Title} 
                                  className="w-full h-full object-cover" 
                                />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <Film className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {editId === m.MovieID ? (
                            <div className="space-y-2">
                              <Input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                              <div className="text-xs">
                                <label className="block text-gray-500 dark:text-gray-400 mb-1">New Video (optional):</label>
                                <input 
                                  type="file" 
                                  accept="video/*" 
                                  onChange={(e) => setEditVideoFile(e.target.files?.[0])} 
                                  className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
                                />
                                {editVideoFile && (
                                  <div className="text-gray-500 dark:text-gray-400 mt-1">
                                    📹 {editVideoFile.name} ({(editVideoFile.size / 1024 / 1024).toFixed(1)} MB)
                                  </div>
                                )}
                              </div>
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
                                  {categories.filter((c) => c.Type === 'Movie' || c.Type === 'Both').map((c) => (
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
                              
                              {/* Episodes Management */}
                              {loadingEpisodes ? (
                                <div className="text-xs text-gray-500 dark:text-gray-400">Đang tải danh sách tập phim...</div>
                              ) : (
                                <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                      Danh sách tập phim ({editEpisodes.length} tập):
                                    </div>
                                  </div>
                                  
                                  {/* Danh sách tập hiện có */}
                                  {editEpisodes.length > 0 && (
                                    <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
                                      {editEpisodes.map((episode) => (
                                        <div key={episode.EpisodeID} className="p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                                          <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                                Tập {episode.EpisodeNumber}:
                                              </span>
                                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                                {episode.Title || `Tập ${episode.EpisodeNumber}`}
                                              </span>
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="danger"
                                              onClick={() => deleteEpisode(episode.EpisodeID)}
                                              className="text-xs h-6 px-2 py-0 bg-red-600 hover:bg-red-700 text-white"
                                            >
                                              🗑️ Delete
                                            </Button>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
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
                                              className="text-xs font-mono h-6 px-2 py-1"
                                              placeholder={`EP${m.MovieID}-${String(episode.EpisodeNumber).padStart(3, '0')}`}
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
                            </div>
                          ) : (
                            m.Title
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                          {m.UploaderName || m.UploaderUsername || m.UploaderEmail || 'N/A'}
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {m.UploaderEmail}
                          </div>
                          <div className="text-xs">
                            <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full font-medium">
                              {m.UploaderRole || 'Admin'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editId === m.MovieID ? (
                            <select value={form.status ?? ''} onChange={(e) => setForm({ ...form, status: e.target.value })} className="px-2 py-1 border rounded">
                              <option value="Pending">Pending</option>
                              <option value="Approved">Approved</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-1 rounded text-xs ${
                              m.Status === 'Approved' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                              m.Status === 'Pending' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                              'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            }`}>
                              {m.Status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                            m.Status === 'Approved' 
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                              : m.Status === 'Pending' 
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          }`}>
                            {m.Status === 'Approved' && <CheckCircle className="w-3 h-3" />}
                            {m.Status === 'Pending' && <Clock className="w-3 h-3" />}
                            {m.Status === 'Rejected' && <AlertCircle className="w-3 h-3" />}
                            {m.Status === 'Pending' ? 'Awaiting Review' : m.Status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editId === m.MovieID ? (
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
                              m.IsFree 
                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            }`}>
                              {m.IsFree ? 'Free' : 'Paid'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm space-x-2">
                          {editId === m.MovieID ? (
                            <>
                              <Button size="sm" onClick={save}>Lưu</Button>
                              <Button size="sm" variant="ghost" onClick={() => { setEditId(null); setForm({}); setEditVideoFile(undefined); setEditCoverFile(undefined); setEditEpisodes([]); }}>Hủy</Button>
                            </>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                <Button size="sm" onClick={() => startEdit(m.MovieID, m.Title, m.Status, m.Description, m.IsFree)}>Edit</Button>
                                <Button size="sm" variant="danger" onClick={() => remove(m.MovieID)}>Delete</Button>
                              </div>
                        {isAdminUser && m.Status === 'Pending' && (
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="primary"
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/admin/movies/${m.MovieID}/status`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'x-user-email': email,
                                    },
                                    body: JSON.stringify({ status: 'Approved' }),
                                  });
                                  if (response.ok) {
                                    await load();
                                    alert('Đã duyệt phim thành công!');
                                  } else {
                                    alert('Có lỗi xảy ra khi duyệt phim');
                                  }
                                } catch (error) {
                                  console.error('Error approving movie:', error);
                                  alert('Có lỗi xảy ra khi duyệt phim');
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
                                  const response = await fetch(`/api/admin/movies/${m.MovieID}/status`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'x-user-email': email,
                                    },
                                    body: JSON.stringify({ status: 'Rejected' }),
                                  });
                                  if (response.ok) {
                                    await load();
                                    alert('Đã từ chối phim!');
                                  } else {
                                    alert('Có lỗi xảy ra khi từ chối phim');
                                  }
                                } catch (error) {
                                  console.error('Error rejecting movie:', error);
                                  alert('Có lỗi xảy ra khi từ chối phim');
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
              <Film className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                User Uploads ({items.filter(m => m.UploaderRole !== 'Admin').length})
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
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Poster</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Title</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Uploader</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Approval</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Free</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {items.filter(m => m.UploaderRole !== 'Admin').length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          Chưa có phim nào do User upload
                        </td>
                      </tr>
                    ) : (
                      items.filter(m => m.UploaderRole !== 'Admin').map((m) => (
                      <tr key={m.MovieID} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{m.MovieID}</td>
                        <td className="px-4 py-3">
                          <div className="w-14 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                              {m.PosterURL ? (
                                <img 
                                  src={buildMediaUrl(m.PosterURL) || undefined} 
                                  alt={m.Title} 
                                  className="w-full h-full object-cover" 
                                />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <Film className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {editId === m.MovieID ? (
                            <div className="space-y-2">
                              <Input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                              <div className="text-xs">
                                <label className="block text-gray-500 dark:text-gray-400 mb-1">New Video (optional):</label>
                                <input 
                                  type="file" 
                                  accept="video/*" 
                                  onChange={(e) => setEditVideoFile(e.target.files?.[0])} 
                                  className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
                                />
                                {editVideoFile && (
                                  <div className="text-gray-500 dark:text-gray-400 mt-1">
                                    📹 {editVideoFile.name} ({(editVideoFile.size / 1024 / 1024).toFixed(1)} MB)
                                  </div>
                                )}
                              </div>
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
                                  {categories.filter((c) => c.Type === 'Movie' || c.Type === 'Both').map((c) => (
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
                              
                              {/* Episodes Management */}
                              {loadingEpisodes ? (
                                <div className="text-xs text-gray-500 dark:text-gray-400">Đang tải danh sách tập phim...</div>
                              ) : (
                                <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                      Danh sách tập phim ({editEpisodes.length} tập):
                                    </div>
                                  </div>
                                  
                                  {/* Danh sách tập hiện có */}
                                  {editEpisodes.length > 0 && (
                                    <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
                                      {editEpisodes.map((episode) => (
                                        <div key={episode.EpisodeID} className="p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                                          <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                                Tập {episode.EpisodeNumber}:
                                              </span>
                                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                                {episode.Title || `Tập ${episode.EpisodeNumber}`}
                                              </span>
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="danger"
                                              onClick={() => deleteEpisode(episode.EpisodeID)}
                                              className="text-xs h-6 px-2 py-0 bg-red-600 hover:bg-red-700 text-white"
                                            >
                                              🗑️ Delete
                                            </Button>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
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
                                              className="text-xs font-mono h-6 px-2 py-1"
                                              placeholder={`EP${m.MovieID}-${String(episode.EpisodeNumber).padStart(3, '0')}`}
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
                            </div>
                          ) : (
                            m.Title
                          )}
                        </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                            {m.UploaderName || m.UploaderUsername || m.UploaderEmail || 'N/A'}
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {m.UploaderEmail}
                            </div>
                            <div className="text-xs">
                              <span className={`px-2 py-0.5 rounded-full font-medium ${
                                m.UploaderRole && m.UploaderRole.trim() === 'Admin'
                                  ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                  : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                              }`}>
                                {m.UploaderRole || 'User'}
                              </span>
                            </div>
                          </td>
                        <td className="px-4 py-3 text-sm">
                          {editId === m.MovieID ? (
                            <select value={form.status ?? ''} onChange={(e) => setForm({ ...form, status: e.target.value })} className="px-2 py-1 border rounded">
                              <option value="Pending">Pending</option>
                              <option value="Approved">Approved</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-1 rounded text-xs ${
                              m.Status === 'Approved' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                              m.Status === 'Pending' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                              'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            }`}>
                              {m.Status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                            m.Status === 'Approved' 
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                              : m.Status === 'Pending' 
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          }`}>
                            {m.Status === 'Approved' && <CheckCircle className="w-3 h-3" />}
                            {m.Status === 'Pending' && <Clock className="w-3 h-3" />}
                            {m.Status === 'Rejected' && <AlertCircle className="w-3 h-3" />}
                            {m.Status === 'Pending' ? 'Awaiting Review' : m.Status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editId === m.MovieID ? (
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
                              m.IsFree 
                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            }`}>
                              {m.IsFree ? 'Free' : 'Paid'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm space-x-2">
                          {editId === m.MovieID ? (
                            <>
                              <Button size="sm" onClick={save}>Lưu</Button>
                              <Button size="sm" variant="ghost" onClick={() => { setEditId(null); setForm({}); setEditVideoFile(undefined); setEditCoverFile(undefined); setEditEpisodes([]); }}>Hủy</Button>
                            </>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                <Button size="sm" onClick={() => startEdit(m.MovieID, m.Title, m.Status, m.Description, m.IsFree)}>Edit</Button>
                                <Button size="sm" variant="danger" onClick={() => remove(m.MovieID)}>Delete</Button>
                              </div>
                        {isAdminUser && m.Status === 'Pending' && (
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="primary"
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/admin/movies/${m.MovieID}/status`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'x-user-email': email,
                                    },
                                    body: JSON.stringify({ status: 'Approved' }),
                                  });
                                  if (response.ok) {
                                    await load();
                                    alert('Đã duyệt phim thành công!');
                                  } else {
                                    alert('Có lỗi xảy ra khi duyệt phim');
                                  }
                                } catch (error) {
                                  console.error('Error approving movie:', error);
                                  alert('Có lỗi xảy ra khi duyệt phim');
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
                                  const response = await fetch(`/api/admin/movies/${m.MovieID}/status`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'x-user-email': email,
                                    },
                                    body: JSON.stringify({ status: 'Rejected' }),
                                  });
                                  if (response.ok) {
                                    await load();
                                    alert('Đã từ chối phim!');
                                  } else {
                                    alert('Có lỗi xảy ra khi từ chối phim');
                                  }
                                } catch (error) {
                                  console.error('Error rejecting movie:', error);
                                  alert('Có lỗi xảy ra khi từ chối phim');
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

export default AdminMoviesPage;


