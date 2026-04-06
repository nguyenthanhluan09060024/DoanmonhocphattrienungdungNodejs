import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card } from "../components/ui/Card";
import {
  BookOpen,
  AlertCircle,
  CheckCircle,
  Clock,
  Trash2,
  Edit,
  Check,
} from "lucide-react";
import { buildMediaUrl } from "../lib/config";

const StoryUploadPage: React.FC = () => {
  const { user } = useAuth();

  // Story upload states
  const [storyTitle, setStoryTitle] = useState("");
  const [storyDescription, setStoryDescription] = useState("");
  const [storyCategoryIds, setStoryCategoryIds] = useState<number[]>([]);
  const [storyAuthor, setStoryAuthor] = useState("");
  const [storyCoverFile, setStoryCoverFile] = useState<File | undefined>(
    undefined
  );
  const [storyContentFiles, setStoryContentFiles] = useState<File[]>([]); // Changed to array for multiple chapters
  const [storyChapterImages, setStoryChapterImages] = useState<File[]>([]); // All images for comic
  const [chapters, setChapters] = useState<Array<{chapterNumber: number, title: string, images?: number[]}>>([]); // Chapters metadata
  const [storyType, setStoryType] = useState<'Text' | 'Comic'>('Text');
  const [storyIsFree, setStoryIsFree] = useState(true);
  const [userRole, setUserRole] = useState<string>('');

  const [categories, setCategories] = useState<
    { CategoryID: number; CategoryName: string; Type: string }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [userStories, setUserStories] = useState<any[]>([]);
  
  // Edit story states
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    title?: string;
    description?: string;
    author?: string;
    isFree?: boolean;
    status?: string;
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
    Images?: Array<{ ImageID: number; ImageURL: string; ImageOrder: number }>;
  }>>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [storyTypeForEdit, setStoryTypeForEdit] = useState<'Text' | 'Comic'>('Text');
  const [editStoryCategoryIds, setEditStoryCategoryIds] = useState<number[]>([]);
  
  // Add new chapter states
  const [newChapterContentFile, setNewChapterContentFile] = useState<File | undefined>(undefined);
  const [newChapterImages, setNewChapterImages] = useState<File[]>([]);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [addingChapter, setAddingChapter] = useState(false);

  const loadData = async () => {
    try {
      // Load user role
      if (user?.email) {
        try {
          const roleResponse = await fetch('/api/auth/role', {
            headers: { 'x-user-email': user.email }
          });
          if (roleResponse.ok) {
            const roleData = await roleResponse.json();
            setUserRole(roleData.role || '');
          }
        } catch (error) {
          console.warn('Error loading user role:', error);
        }
      }

      // Load categories
      const categoriesResponse = await fetch(
        "/api/categories"
      );
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        setCategories(categoriesData);
      }

      // Load user's stories
      const storiesResponse = await fetch(
        "/api/user/stories",
        {
          headers: { "x-user-email": user?.email || "" },
        }
      );
      if (storiesResponse.ok) {
        const storiesData = await storiesResponse.json();
        setUserStories(storiesData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.email]);

  const handleStoryUpload = async () => {
    if (!user?.email) return;

    // Validation
    if (!storyTitle.trim()) {
      setUploadMessage("Please enter story title");
      return;
    }
    if (storyCategoryIds.length === 0) {
      setUploadMessage("Please select at least one category");
      return;
    }
    if (!storyAuthor.trim()) {
      setUploadMessage("Please enter author name");
      return;
    }
    if (!storyCoverFile) {
      setUploadMessage("Please select a cover image");
      return;
    }
    // Validate based on story type
    if (storyType === 'Text' && storyContentFiles.length === 0) {
      setUploadMessage("Please select at least one content file for text stories");
      return;
    }
    if (storyType === 'Comic' && storyChapterImages.length === 0) {
      setUploadMessage("Please select at least one image for comic stories");
      return;
    }

    // Validate file sizes
    const maxImageSize = 10 * 1024 * 1024; // 10MB
    const maxContentSize = 50 * 1024 * 1024; // 50MB
    const maxChapterImageSize = 5 * 1024 * 1024; // 5MB per image for comics

    if (storyCoverFile.size > maxImageSize) {
      setUploadMessage("Cover image is too large. Maximum size: 10MB");
      return;
    }
    // Validate content files for text stories
    if (storyType === 'Text') {
      for (const file of storyContentFiles) {
        if (file.size > maxContentSize) {
          setUploadMessage(`Content file "${file.name}" is too large. Maximum size: 50MB`);
          return;
        }
      }
    }
    // Validate chapter images for comics
    if (storyType === 'Comic') {
      for (const img of storyChapterImages) {
        if (img.size > maxChapterImageSize) {
          setUploadMessage(`Image "${img.name}" is too large. Maximum size: 5MB per image`);
          return;
        }
      }
    }

    // Validate file formats
    const allowedImageTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    const allowedContentTypes = [
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/pdf",
      "application/epub+zip",
      "application/x-mobipocket-ebook",
    ];

    if (!allowedImageTypes.includes(storyCoverFile.type)) {
      setUploadMessage(
        "Cover image format not supported. Only: JPG, JPEG, PNG, WEBP"
      );
      return;
    }
    // Validate content files format for text stories
    if (storyType === 'Text') {
      for (const file of storyContentFiles) {
        if (!allowedContentTypes.includes(file.type)) {
          setUploadMessage(`Content file "${file.name}" format not supported. Only: TXT, DOC, DOCX, PDF, EPUB, MOBI`);
          return;
        }
      }
    }
    // Validate chapter images for comics
    if (storyType === 'Comic') {
      for (const img of storyChapterImages) {
        if (!allowedImageTypes.includes(img.type)) {
          setUploadMessage(`Image "${img.name}" format not supported. Only: JPG, JPEG, PNG, WEBP`);
          return;
        }
      }
    }

    setUploading(true);
    setUploadMessage("");

    try {
      const formData = new FormData();
      formData.append("title", storyTitle.trim());
      formData.append("description", storyDescription.trim());
      formData.append("author", storyAuthor.trim());
      // Append multiple category IDs (giống UserUploadPage)
      storyCategoryIds.forEach((catId) => {
        formData.append("categoryIds", String(catId));
      });
      formData.append("isFree", storyIsFree ? "true" : "false");
      formData.append("storyType", storyType);
      formData.append("coverImage", storyCoverFile);
      
      // Append files based on story type
      if (storyType === 'Text') {
        // Append all content files (multiple chapters)
        storyContentFiles.forEach((file) => {
          formData.append("contentFiles", file);
        });
        // Append chapters metadata if available (giống UserUploadPage)
        if (chapters.length > 0) {
          formData.append("chapters", JSON.stringify(chapters));
        }
      } else if (storyType === 'Comic') {
        // Append all chapter images
        storyChapterImages.forEach((image) => {
          formData.append("chapterImages", image);
        });
        // Append chapters metadata if available (for grouping images into chapters)
        if (chapters.length > 0) {
          formData.append("chapters", JSON.stringify(chapters));
        }
      }

      console.log("Sending upload request...");
      console.log("Form data contents:");
      for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
      }

      // User upload - ALWAYS use /api/user/stories (pending, needs admin approval)
      const response = await fetch(`/api/user/stories`, {
        method: "POST",
        headers: {
          "x-user-email": user.email,
        },
        body: formData,
      });

      console.log("Upload response status:", response.status);
      console.log("Upload response headers:", response.headers);

      if (response.ok) {
        const result = await response.json();
        console.log("Upload success:", result);
        setUploadMessage(`Story uploaded successfully! ${result.message}`);
        setStoryTitle("");
        setStoryDescription("");
        setStoryAuthor("");
        setStoryCategoryIds([]);
        setStoryCoverFile(undefined);
        setStoryContentFiles([]);
        setStoryChapterImages([]);
        setChapters([]);
        setStoryType('Text');
        setStoryIsFree(true);

        // Reset file inputs
        const coverInput = document.querySelector(
          'input[type="file"][accept="image/*"]'
        ) as HTMLInputElement;
        const contentInput = document.querySelector(
          'input[type="file"][accept=".txt,.doc,.docx,.pdf,.epub,.mobi"]'
        ) as HTMLInputElement;
        if (coverInput) coverInput.value = "";
        if (contentInput) contentInput.value = "";

        await loadData();

        // Clear success message after 5 seconds
        setTimeout(() => setUploadMessage(""), 5000);
      } else {
        let errorMessage = "Unknown error";
        try {
          const errorData = await response.json();
          errorMessage =
            errorData.error || errorData.message || `HTTP ${response.status}`;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        console.error("Upload failed:", {
          status: response.status,
          error: errorMessage,
        });
        setUploadMessage(`Upload failed: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error("Error uploading story:", error);
      setUploadMessage(
        `Network error: ${
          error.message || "Please check your connection and try again."
        }`
      );
    } finally {
      setUploading(false);
    }
  };

  const deleteStory = async (id: number) => {
    if (!user?.email) return;
    if (!confirm("Are you sure you want to delete this story?")) return;

    try {
      const response = await fetch(
        `/api/user/stories/${id}`,
        {
          method: "DELETE",
          headers: {
            "x-user-email": user.email,
          },
        }
      );

      if (response.ok) {
        await loadData();
        setUploadMessage("Story deleted successfully!");
        setTimeout(() => setUploadMessage(""), 3000);
      } else {
        const errorData = await response.json();
        setUploadMessage(
          `Delete failed: ${errorData.error || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Error deleting story:", error);
      setUploadMessage("Network error. Please try again.");
    }
  };

  const startEdit = async (id: number) => {
    setEditId(id);
    setLoadingChapters(true);
    setEditStoryCategoryIds([]);
    try {
      // Find story in userStories to get full info
      const story = userStories.find(s => s.SeriesID === id);
      if (story) {
        setStoryTypeForEdit(story.StoryType || 'Text');
        setEditForm({
          title: story.Title,
          description: story.Description,
          author: story.Author,
          isFree: story.IsFree,
          status: story.Status
        });
      }

      // Load chapters (route accepts seriesId directly)
      const chaptersResponse = await fetch(`/api/stories/${id}/chapters`);
      if (chaptersResponse.ok) {
        const chaptersData = await chaptersResponse.json();
        setEditChapters(chaptersData);
      }
      
      // Fetch categories for this story (giống UserUploadPage)
      try {
        const categoriesResponse = await fetch(`/api/stories/${id}/categories`);
        if (categoriesResponse.ok) {
          const storyCats = await categoriesResponse.json();
          setEditStoryCategoryIds(storyCats.map((c: any) => c.CategoryID));
        }
      } catch (error) {
        console.error('Error fetching story categories:', error);
      }
    } catch (error) {
      console.error("Error loading chapters:", error);
    } finally {
      setLoadingChapters(false);
    }
  };

  const saveEdit = async () => {
    if (!user?.email || editId == null) return;
    
    if (editStoryCategoryIds.length === 0) {
      setUploadMessage('Vui lòng chọn ít nhất một thể loại');
      return;
    }
    
    const formData = new FormData();
    if (editForm.title) formData.append('title', editForm.title);
    if (editForm.description) formData.append('description', editForm.description);
    if (editForm.author) formData.append('author', editForm.author);
    if (typeof editForm.isFree !== 'undefined') formData.append('isFree', editForm.isFree ? 'true' : 'false');
    // Append multiple category IDs (giống UserUploadPage)
    editStoryCategoryIds.forEach((catId) => {
      formData.append('categoryIds', String(catId));
    });
    // Không gửi status - trang user upload không cho phép set status trực tiếp
    if (editCoverFile) formData.append('coverImage', editCoverFile);
    
    try {
      // LUÔN dùng user endpoint - trang /upload/stories là cho user, không phân biệt Admin
      const response = await fetch(`/api/user/stories/${editId}`, {
        method: 'PUT',
        headers: {
          'x-user-email': user.email,
        },
        body: formData,
      });
      
      if (response.ok) {
        // Update ChapterCode nếu có thay đổi (giống UserUploadPage)
        for (const chapter of editChapters) {
          if (chapter.ChapterCode) {
            try {
              await fetch(`/api/admin/chapters/${chapter.ChapterID}`, {
                method: 'PUT',
                headers: {
                  'x-user-email': user.email,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ChapterCode: chapter.ChapterCode }),
              });
            } catch (error) {
              console.error(`Error updating ChapterCode for chapter ${chapter.ChapterID}:`, error);
            }
          }
        }
        
        setEditId(null);
        setEditForm({});
        setEditCoverFile(undefined);
        setEditChapters([]);
        setEditStoryCategoryIds([]);
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

  const deleteChapter = async (chapterId: number) => {
    if (!confirm('Bạn có chắc muốn xóa chương này? Hành động này không thể hoàn tác!')) {
      return;
    }

    if (!user?.email || editId == null) {
      setUploadMessage('Có lỗi xảy ra');
      return;
    }

    try {
      const response = await fetch(`/api/admin/chapters/${chapterId}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': user.email,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete chapter');
      }

      // Refresh chapters list
      const chaptersResponse = await fetch(`/api/stories/${editId}/chapters`);
      if (chaptersResponse.ok) {
        const chaptersData = await chaptersResponse.json();
        setEditChapters(chaptersData);
      }

      setUploadMessage('Chapter deleted successfully!');
      setTimeout(() => setUploadMessage(''), 3000);
    } catch (error: any) {
      console.error('Error deleting chapter:', error);
      setUploadMessage(error.message || 'Có lỗi xảy ra khi xóa chương');
    }
  };

  const addNewChapter = async () => {
    if (!user?.email || editId == null) {
      setUploadMessage("Vui lòng chọn truyện để thêm chương");
      return;
    }

    if (storyTypeForEdit === 'Text' && !newChapterContentFile) {
      setUploadMessage("Vui lòng chọn file content cho chương mới");
      return;
    }
    if (storyTypeForEdit === 'Comic' && newChapterImages.length === 0) {
      setUploadMessage("Vui lòng chọn ít nhất một ảnh cho chương mới");
      return;
    }

    setAddingChapter(true);
    try {
      const formData = new FormData();
      formData.append('title', newChapterTitle || `Chapter ${editChapters.length + 1}`);
      formData.append('storyType', storyTypeForEdit);
      formData.append('isFree', storyIsFree ? 'true' : 'false');

      if (storyTypeForEdit === 'Text' && newChapterContentFile) {
        formData.append('contentFile', newChapterContentFile);
      } else if (storyTypeForEdit === 'Comic') {
        newChapterImages.forEach((image) => {
          formData.append('chapterImages', image);
        });
      }

      // LUÔN dùng user endpoint - trang /upload/stories là cho user, không phân biệt Admin
      const response = await fetch(`/api/user/stories/${editId}/chapters`, {
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
      const chaptersResponse = await fetch(`/api/stories/${editId}/chapters`);
      if (chaptersResponse.ok) {
        const chaptersData = await chaptersResponse.json();
        setEditChapters(chaptersData);
      }

      // Reset form
      setNewChapterContentFile(undefined);
      setNewChapterImages([]);
      setNewChapterTitle('');
      
      setUploadMessage('Đã thêm chương mới thành công!');
      setTimeout(() => setUploadMessage(''), 3000);
    } catch (error: any) {
      console.error('Error adding chapter:', error);
      setUploadMessage(error.message || 'Có lỗi xảy ra khi thêm chương');
    } finally {
      setAddingChapter(false);
    }
  };

  const approveStory = async (id: number) => {
    if (!user?.email) return;
    if (
      !confirm(
        "Are you sure you want to approve this story? It will be published and visible to all users."
      )
    )
      return;

    try {
      const response = await fetch(
        `/api/user/stories/${id}/approve`,
        {
          method: "PUT",
          headers: {
            "x-user-email": user.email,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        await loadData();
        setUploadMessage("Story approved successfully! It is now published.");
        setTimeout(() => setUploadMessage(""), 3000);
      } else {
        const errorData = await response.json();
        setUploadMessage(
          `Approval failed: ${errorData.error || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Error approving story:", error);
      setUploadMessage("Network error. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="text-gray-600 dark:text-gray-300">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Upload Stories
          </h1>
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
                <p className="text-sm text-blue-700 dark:text-blue-200">
                  Your uploaded content will be reviewed by administrators
                  before being published. You will be notified once it's
                  approved or rejected.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Upload Form */}
        <Card>
          <div className="p-6">
            {/* Story Upload Form */}
            <div className="grid gap-4">
              {/* Story Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Story Title *
                </label>
                <Input
                  value={storyTitle}
                  onChange={(e) => setStoryTitle(e.target.value)}
                  placeholder="Enter story title"
                />
              </div>

              {/* Author */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Author *
                </label>
                <Input
                  value={storyAuthor}
                  onChange={(e) => setStoryAuthor(e.target.value)}
                  placeholder="Enter author name"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={storyDescription}
                  onChange={(e) => setStoryDescription(e.target.value)}
                  placeholder="Enter story description"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  rows={3}
                />
              </div>

              {/* Story Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Loại truyện *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  value={storyType}
                  onChange={(e) => {
                    setStoryType(e.target.value as 'Text' | 'Comic');
                    // Reset files when changing type
                    setStoryContentFiles([]);
                    setStoryChapterImages([]);
                    setChapters([]);
                  }}
                >
                  <option value="Text">Truyện chữ (Text Story)</option>
                  <option value="Comic">Truyện tranh (Comic/Manga)</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {storyType === 'Text' 
                    ? 'Upload file văn bản (TXT, DOC, PDF, EPUB, MOBI)'
                    : 'Upload nhiều ảnh theo thứ tự (JPG, PNG, WEBP)'}
                </p>
              </div>

              {/* Categories - Multiple selection (giống UserUploadPage) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Categories * (Có thể chọn nhiều thể loại)
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-800">
                  {categories.filter((c) => c.Type === "Series" || c.Type === "Both").map((c) => (
                    <label key={c.CategoryID} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 rounded">
                      <input
                        type="checkbox"
                        checked={storyCategoryIds.includes(c.CategoryID)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setStoryCategoryIds([...storyCategoryIds, c.CategoryID]);
                          } else {
                            setStoryCategoryIds(storyCategoryIds.filter(id => id !== c.CategoryID));
                          }
                        }}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-sm text-gray-900 dark:text-white">{c.CategoryName}</span>
                    </label>
                  ))}
                </div>
                {storyCategoryIds.length === 0 && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">Vui lòng chọn ít nhất một thể loại</p>
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
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setStoryCoverFile(file);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                {storyCoverFile && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    🖼️ {storyCoverFile.name} (
                    {(storyCoverFile.size / 1024 / 1024).toFixed(1)} MB)
                  </div>
                )}
              </div>

              {/* Story Content - Text Story (Multiple Chapters) */}
              {storyType === 'Text' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Story Content Files * (Max 50MB per file, up to 50 chapters)
                </label>
                <input
                  type="file"
                  accept=".txt,.doc,.docx,.pdf,.epub,.mobi"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    // Sort files by name to maintain order
                    files.sort((a, b) => a.name.localeCompare(b.name));
                    setStoryContentFiles(files);
                    // Auto-generate chapters metadata
                    const newChapters = files.map((_, index) => ({
                      chapterNumber: index + 1,
                      title: `Chapter ${index + 1}`
                    }));
                    setChapters(newChapters);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                {storyContentFiles.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      📖 Đã chọn {storyContentFiles.length} file
                    </div>
                    {/* Hiển thị danh sách chapters với tên có thể chỉnh sửa (giống UserUploadPage) */}
                    <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-gray-50 dark:bg-gray-800">
                      {chapters.map((chapter, index) => (
                        <div key={index} className="flex items-center gap-2 py-1">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-20">
                            Chương {chapter.chapterNumber}:
                          </span>
                          <Input
                            value={chapter.title}
                            onChange={(e) => {
                              const updated = [...chapters];
                              updated[index] = { ...updated[index], title: e.target.value };
                              setChapters(updated);
                            }}
                            className="text-xs h-7 flex-1"
                            placeholder={`Chapter ${chapter.chapterNumber}`}
                          />
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {storyContentFiles[index]?.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Supported formats: TXT, DOC, DOCX, PDF, EPUB, MOBI. Mỗi file = 1 chương.
                </div>
              </div>
              )}

              {/* Chapter Images - Comic Story */}
              {storyType === 'Comic' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Chapter Images * (Max 5MB per image, up to 100 images)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      // Sort files by name to maintain order
                      files.sort((a, b) => a.name.localeCompare(b.name));
                      setStoryChapterImages(files);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  {storyChapterImages.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        📷 Đã chọn {storyChapterImages.length} ảnh:
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {storyChapterImages.map((img, index) => (
                          <div key={index} className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded">
                            <span>
                              {index + 1}. {img.name} ({(img.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const newImages = [...storyChapterImages];
                                newImages.splice(index, 1);
                                setStoryChapterImages(newImages);
                              }}
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    💡 Tip: Đặt tên file theo thứ tự (01.jpg, 02.jpg, ...) để đảm bảo thứ tự hiển thị đúng
                  </div>
                </div>
              )}

              {/* Is Free */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={storyIsFree}
                    onChange={(e) => setStoryIsFree(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Free to read
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleStoryUpload}
                  disabled={
                    uploading || !storyTitle || !storyAuthor || storyCategoryIds.length === 0
                  }
                  className="flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  {uploading ? "Uploading..." : "Upload Story"}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Upload Message */}
        {uploadMessage && (
          <Card className="mt-6">
            <div
              className={`p-4 rounded-lg ${
                uploadMessage.includes("successfully") ||
                uploadMessage.includes("success")
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              }`}
            >
              <div className="flex items-start gap-3">
                {uploadMessage.includes("successfully") ||
                uploadMessage.includes("success") ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <p
                  className={`text-sm ${
                    uploadMessage.includes("successfully") ||
                    uploadMessage.includes("success")
                      ? "text-green-700 dark:text-green-200"
                      : "text-red-700 dark:text-red-200"
                  }`}
                >
                  {uploadMessage}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Your Stories */}
        {userStories.length > 0 && (
          <Card className="mt-8">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Your Stories
              </h2>
              <div className="grid gap-4">
                {userStories.map((story, index) => (
                  <div
                    key={`story-${story.SeriesID || story.StoryID || index}`}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-4">
                      {/* Story Cover Image */}
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

                      {/* Story Info */}
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                          {story.Title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          by {story.Author}
                        </p>
                        {story.Description && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
                            {story.Description}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              story.Status === "Approved"
                                ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                                : story.Status === "Pending"
                                ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                                : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                            }`}
                          >
                            {story.Status}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              story.IsFree
                                ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                                : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                            }`}
                          >
                            {story.IsFree ? "Free" : "VIP"}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {story.ViewCount || 0} views
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex-shrink-0">
                        <div className="flex items-center gap-2">
                          {/* CHỈ Admin mới được approve - User không thể tự approve */}
                          {story.Status === "Pending" && userRole === "Admin" ? (
                            <Button
                              onClick={() => approveStory(story.SeriesID)}
                              size="sm"
                              variant="primary"
                              className="flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              Approve
                            </Button>
                          ) : story.Status !== "Pending" ? (
                            <Button
                              onClick={() => startEdit(story.SeriesID)}
                              size="sm"
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              <Edit className="w-3 h-3" />
                              Edit
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                              Chờ Admin duyệt
                            </span>
                          )}
                          <Button
                            onClick={() => deleteStory(story.SeriesID)}
                            size="sm"
                            variant="danger"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Edit Story - Edit Info & Manage Chapters */}
        {editId !== null && (
          <Card className="mt-8">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Chỉnh sửa truyện - #{editId}
                </h2>
                <Button
                  onClick={() => {
                    setEditId(null);
                    setEditForm({});
                    setEditCoverFile(undefined);
                    setEditChapters([]);
                    setNewChapterContentFile(undefined);
                    setNewChapterImages([]);
                    setNewChapterTitle('');
                  }}
                  size="sm"
                  variant="secondary"
                >
                  Đóng
                </Button>
              </div>

              {/* Edit Story Info Form */}
              <div className="mb-6 border-b border-gray-200 dark:border-gray-700 pb-6">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  Thông tin truyện
                </h3>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tiêu đề *
                    </label>
                    <Input
                      value={editForm.title || ''}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      placeholder="Enter story title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tác giả *
                    </label>
                    <Input
                      value={editForm.author || ''}
                      onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
                      placeholder="Enter author name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Mô tả
                    </label>
                    <textarea
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      placeholder="Enter story description"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ảnh bìa (Max 10MB)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setEditCoverFile(file);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                    {editCoverFile && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        🖼️ {editCoverFile.name} ({(editCoverFile.size / 1024 / 1024).toFixed(1)} MB)
                      </div>
                    )}
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
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.isFree ?? true}
                        onChange={(e) => setEditForm({ ...editForm, isFree: e.target.checked })}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Free to read
                      </span>
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={saveEdit}
                      disabled={!editForm.title || !editForm.author || editStoryCategoryIds.length === 0}
                      className="flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Lưu thay đổi
                    </Button>
                  </div>
                </div>
              </div>

              {/* Current Chapters List */}
              {loadingChapters ? (
                <div className="text-center py-4 text-gray-500">Đang tải danh sách chương...</div>
              ) : (
                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                    Danh sách chương hiện có ({editChapters.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {editChapters.map((chapter) => (
                      <div
                        key={chapter.ChapterID}
                        className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                              Chương {chapter.ChapterNumber}:
                            </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                              {chapter.Title || `Chapter ${chapter.ChapterNumber}`}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => deleteChapter(chapter.ChapterID)}
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
                            value={chapter.ChapterCode || ''}
                            onChange={(e) => {
                              const updated = editChapters.map(ch => 
                                ch.ChapterID === chapter.ChapterID 
                                  ? { ...ch, ChapterCode: e.target.value }
                                  : ch
                              );
                              setEditChapters(updated);
                            }}
                            className="text-sm font-mono h-8 px-3 py-1 bg-gray-50 dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-md"
                            placeholder={`CH${editId}-${String(chapter.ChapterNumber).padStart(3, '0')}`}
                          />
                        </div>
                        {(storyTypeForEdit === 'Comic' && chapter.ImageCount) || (chapter.ViewCount !== undefined) ? (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {storyTypeForEdit === 'Comic' && chapter.ImageCount && (
                              <span>({chapter.ImageCount} ảnh)</span>
                            )}
                            {chapter.ViewCount !== undefined && (
                              <span className="ml-2">{chapter.ViewCount} lượt xem</span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Chapter Form */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                  Thêm chương mới
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tiêu đề chương
                    </label>
                    <Input
                      value={newChapterTitle}
                      onChange={(e) => setNewChapterTitle(e.target.value)}
                      placeholder={`Chapter ${editChapters.length + 1}`}
                    />
                  </div>

                  {storyTypeForEdit === 'Text' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        File content * (Max 50MB)
                      </label>
                      <input
                        type="file"
                        accept=".txt,.doc,.docx,.pdf,.epub,.mobi"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          setNewChapterContentFile(file);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      {newChapterContentFile && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          📖 {newChapterContentFile.name} ({(newChapterContentFile.size / 1024 / 1024).toFixed(2)} MB)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Ảnh chương * (Max 5MB per image, up to 500 images)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          files.sort((a, b) => a.name.localeCompare(b.name));
                          setNewChapterImages(files);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      {newChapterImages.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            📷 Đã chọn {newChapterImages.length} ảnh
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={addNewChapter}
                    disabled={addingChapter || (storyTypeForEdit === 'Text' && !newChapterContentFile) || (storyTypeForEdit === 'Comic' && newChapterImages.length === 0)}
                    className="flex items-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    {addingChapter ? "Đang thêm..." : "Thêm chương"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StoryUploadPage;
