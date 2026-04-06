import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import CommentSection from '../components/content/CommentSection';
import { saveSeriesHistory, awardChapterCompleteExp, fetchCurrentRole } from '../lib/api';
import { BookOpen, Calendar, User, Star, Eye, Heart, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { buildMediaUrl } from '../lib/config';

interface ChapterImage {
  ImageID: number;
  ImageURL: string;
  ImageOrder: number;
  FileSize?: number;
  Width?: number;
  Height?: number;
}

interface Chapter {
  ChapterID: number;
  ChapterNumber: number;
  Title: string;
  Content: string;
  IsFree: boolean;
  CreatedAt: string;
  StoryType?: 'Text' | 'Comic';
  Images?: ChapterImage[];
  ImageCount?: number;
  ViewCount?: number;
}

interface Story {
  SeriesID: number;
  Title: string;
  Slug: string;
  Description: string;
  CoverURL: string;
  Author: string;
  Status: string;
  IsFree: boolean;
  ViewCount: number;
  Rating: number;
  StoryType?: 'Text' | 'Comic';
}

const needsVietnameseRepair = (value: string) => /[\u00C2\u00C3]/.test(value);

const repairVietnameseText = (value?: string | null) => {
  if (!value) return '';
  const source = String(value);
  if (!needsVietnameseRepair(source)) return source;

  try {
    const bytes = Uint8Array.from(source, (char) => char.charCodeAt(0) & 0xff);
    const repaired = new TextDecoder('utf-8').decode(bytes).replace(/\u0000/g, '').trim();
    return repaired && repaired !== source ? repaired : source;
  } catch {
    return source;
  }
};

const StoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [story, setStory] = useState<Story | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<{ averageRating: number; totalRatings: number } | null>(null);
  const [myRating, setMyRating] = useState<number>(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showChapterDropdown, setShowChapterDropdown] = useState(false); // âœ… FIX: Dropdown chá»n chÆ°Æ¡ng
  const [hasAwardedExp, setHasAwardedExp] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const email = useMemo(
    () => (user?.email as string | undefined) || "",
    [user]
  );

  useEffect(() => {
    const loadStory = async () => {
      if (!slug) return;
      
      console.log('Loading story with slug:', slug);
      setLoading(true);
      try {
        // Load story details
        const storyResponse = await fetch(`/api/stories/${slug}`);
        console.log('Story API response:', storyResponse.status);
        if (storyResponse.ok) {
          const storyData = await storyResponse.json();
          console.log('Story data:', storyData);
          setStory(storyData);
          
          // Load chapters
          const chaptersResponse = await fetch(`/api/stories/${storyData.SeriesID}/chapters`);
          console.log('Chapters API response:', chaptersResponse.status);
          if (chaptersResponse.ok) {
            const chaptersData = await chaptersResponse.json();
            console.log('Chapters data:', chaptersData);
            setChapters(chaptersData);
            if (chaptersData.length > 0) {
              // Check if there's a chapter query parameter
              const chapterParam = searchParams.get('chapter');
              if (chapterParam) {
                const chapterNumber = parseInt(chapterParam, 10);
                const targetChapter = chaptersData.find(
                  (ch: Chapter) => ch.ChapterNumber === chapterNumber
                );
                if (targetChapter) {
                  setCurrentChapter(targetChapter);
                } else {
                  setCurrentChapter(chaptersData[0]);
                }
              } else {
                setCurrentChapter(chaptersData[0]);
              }
            }
          }
          
          // Load ratings
          const ratingsResponse = await fetch(`/api/stories/${storyData.SeriesID}/ratings`);
          if (ratingsResponse.ok) {
            const ratingsPayload = await ratingsResponse.json();
            const ratingsData = ratingsPayload?.data ?? ratingsPayload ?? {};
            setRatings({
              averageRating: Number(ratingsData.averageRating ?? ratingsData.average ?? 0) || 0,
              totalRatings: Number(ratingsData.totalRatings ?? ratingsData.count ?? 0) || 0,
            });
          }
          
          // Check if user has rated this story
          if (user?.email) {
            try {
              const userRatingResponse = await fetch(`/api/stories/${storyData.SeriesID}/user-rating`, {
                headers: { 'x-user-email': user.email }
              });
              if (userRatingResponse.ok) {
                const userRatingPayload = await userRatingResponse.json();
                const userRatingData = userRatingPayload?.data ?? userRatingPayload ?? {};
                setMyRating(Number(userRatingData.rating ?? 0) || 0);
              }
              
              // Check if story is in favorites
              const favoriteResponse = await fetch(`/api/stories/${storyData.SeriesID}/favorite-status`, {
                headers: { 'x-user-email': user.email }
              });
              if (favoriteResponse.ok) {
                const favoritePayload = await favoriteResponse.json();
                const favoriteData = favoritePayload?.data ?? favoritePayload ?? {};
                setIsFavorite(Boolean(favoriteData.isFavorite));
              }
            } catch (error) {
              console.error('Error loading user data:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error loading story:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStory();
  }, [slug, searchParams]);

  // âœ… Scroll to comments section if URL hash is #comments
  useEffect(() => {
    if (!loading && story && window.location.hash === '#comments') {
      const scrollToComments = () => {
        const commentsSection = document.getElementById('comments');
        if (commentsSection) {
          // TÃ­nh toÃ¡n offset Ä‘á»ƒ trá»« Ä‘i chiá»u cao header (náº¿u cÃ³ fixed header)
          const headerOffset = 80;
          const elementPosition = commentsSection.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
          return true;
        }
        return false;
      };

      // Thá»­ ngay láº­p tá»©c
      if (scrollToComments()) {
        return; // ÄÃ£ scroll thÃ nh cÃ´ng
      }

      // Náº¿u chÆ°a cÃ³, thá»­ láº¡i sau má»™t khoáº£ng thá»i gian ngáº¯n
      const timeouts: NodeJS.Timeout[] = [];
      const attempts = [100, 300, 500];
      
      attempts.forEach((delay) => {
        const timeout = setTimeout(() => {
          if (scrollToComments()) {
            // ÄÃ£ tÃ¬m tháº¥y vÃ  scroll, clear cÃ¡c timeout cÃ²n láº¡i
            timeouts.forEach(t => clearTimeout(t));
          }
        }, delay);
        timeouts.push(timeout);
      });

      return () => {
        timeouts.forEach(t => clearTimeout(t));
      };
    }
  }, [loading, story]);

  const handleChapterSelect = (chapter: Chapter) => {
    setCurrentChapter(chapter);
    // Scroll to top when chapter changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Reset exp flag khi chuyá»ƒn chapter
    setHasAwardedExp(false);
  };

  // Load user role to check if Admin
  useEffect(() => {
    if (!email) return;
    fetchCurrentRole(email)
      .then(({ role }) => setIsAdmin(role === 'Admin'))
      .catch(() => setIsAdmin(false));
  }, [email]);

  // âœ… Save read history when chapter changes
  useEffect(() => {
    if (!email || !story || !currentChapter) return;
    saveSeriesHistory(email, Number(story.SeriesID), currentChapter.ChapterID).catch(
      () => {}
    );
    // Reset exp flag khi chuyá»ƒn chapter
    setHasAwardedExp(false);
  }, [email, story, currentChapter]);

  // âœ… Track scroll Ä‘á»ƒ phÃ¡t hiá»‡n Ä‘á»c háº¿t chapter (cho text story)
  useEffect(() => {
    if (!email || !currentChapter || hasAwardedExp || story?.StoryType === 'Comic' || isAdmin) return;

    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      // Kiá»ƒm tra Ä‘Ã£ scroll Ä‘áº¿n gáº§n cuá»‘i (cÃ²n 100px)
      const isNearBottom = scrollTop + windowHeight >= documentHeight - 100;
      
      if (isNearBottom && !hasAwardedExp) {
        // Äá»c háº¿t chapter, tÄƒng EXP
        awardChapterCompleteExp(email, currentChapter.ChapterID)
          .then((response) => {
            if (response.expGained > 0) {
              setHasAwardedExp(true);
              console.log(`âœ… Nháº­n Ä‘Æ°á»£c ${response.expGained} EXP!`);
            }
          })
          .catch((error) => {
            console.error("Error awarding chapter complete EXP:", error);
          });
      }
    };

    window.addEventListener('scroll', handleScroll);
    // Kiá»ƒm tra ngay khi load náº¿u Ä‘Ã£ á»Ÿ cuá»‘i trang
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [email, currentChapter, hasAwardedExp, story?.StoryType, isAdmin]);

  // âœ… Track viá»‡c xem háº¿t áº£nh (cho comic story)
  useEffect(() => {
    if (!email || !currentChapter || hasAwardedExp || story?.StoryType !== 'Comic' || isAdmin) return;
    if (!currentChapter.Images || currentChapter.Images.length === 0) return;

    // Kiá»ƒm tra khi scroll Ä‘áº¿n áº£nh cuá»‘i cÃ¹ng
    const handleScroll = () => {
      const lastImage = document.querySelector(`img[data-image-id="${currentChapter.Images![currentChapter.Images!.length - 1].ImageID}"]`);
      if (lastImage) {
        const rect = lastImage.getBoundingClientRect();
        // áº¢nh cuá»‘i Ä‘Ã£ hiá»ƒn thá»‹ trÃªn mÃ n hÃ¬nh
        if (rect.top < window.innerHeight && rect.bottom > 0 && !hasAwardedExp) {
          awardChapterCompleteExp(email, currentChapter.ChapterID)
            .then((response) => {
              if (response.expGained > 0) {
                setHasAwardedExp(true);
                console.log(`âœ… Nháº­n Ä‘Æ°á»£c ${response.expGained} EXP!`);
              }
            })
            .catch((error) => {
              console.error("Error awarding chapter complete EXP:", error);
            });
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    // Kiá»ƒm tra ngay khi load
    setTimeout(handleScroll, 500);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [email, currentChapter, hasAwardedExp, story?.StoryType, isAdmin]);

  // âœ… FIX: Sáº¯p xáº¿p chapters - máº·c Ä‘á»‹nh tá»« 1 xuá»‘ng (1, 2, 3...)
  const sortedChapters = useMemo(() => {
    // Sort theo ChapterNumber tÄƒng dáº§n (1, 2, 3...)
    return [...chapters].sort((a, b) => a.ChapterNumber - b.ChapterNumber);
  }, [chapters]);

  // âœ… FIX: Navigate to next/previous chapter - logic Ä‘Ãºng
  // Next = chÆ°Æ¡ng sá»‘ cao hÆ¡n (index + 1), Prev = chÆ°Æ¡ng sá»‘ tháº¥p hÆ¡n (index - 1)
  const currentChapterIndex = sortedChapters.findIndex(
    (ch) => ch.ChapterID === currentChapter?.ChapterID
  );
  
  // sortOrder = 'asc' (1, 2, 3...): next = index + 1, prev = index - 1
  const nextChapter = currentChapterIndex >= 0 && currentChapterIndex < sortedChapters.length - 1
    ? sortedChapters[currentChapterIndex + 1]
    : null;
  
  const prevChapter = currentChapterIndex > 0
    ? sortedChapters[currentChapterIndex - 1]
    : null;


  const handleRate = async (value: number) => {
    if (!user?.email || !story) return;
    setMyRating(value);
    
    try {
      const response = await fetch(`/api/stories/${story.SeriesID}/rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({ rating: value }),
      });

      if (response.ok) {
        // Reload ratings
        const ratingsResponse = await fetch(`/api/stories/${story.SeriesID}/ratings`);
        if (ratingsResponse.ok) {
          const ratingsPayload = await ratingsResponse.json();
          const ratingsData = ratingsPayload?.data ?? ratingsPayload ?? {};
          setRatings({
            averageRating: Number(ratingsData.averageRating ?? ratingsData.average ?? 0) || 0,
            totalRatings: Number(ratingsData.totalRatings ?? ratingsData.count ?? 0) || 0,
          });
        }
      }
    } catch (error) {
      console.error('Error rating story:', error);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user?.email || !story) return;
    
    try {
      const seriesId = story.SeriesID;
      if (isFavorite) {
        // Remove from favorites
        await fetch(`/api/stories/${seriesId}/favorite`, {
          method: 'DELETE',
          headers: { 'x-user-email': user.email },
        });
      } else {
        // Add to favorites
        await fetch(`/api/stories/${seriesId}/favorite`, {
          method: 'POST',
          headers: { 'x-user-email': user.email },
        });
      }
      
      // Verify status sau khi toggle Ä‘á»ƒ Ä‘áº£m báº£o Ä‘á»“ng bá»™
      const response = await fetch(`/api/stories/${seriesId}/favorite-status`, {
        headers: { 'x-user-email': user.email },
      });
      if (response.ok) {
        const data = await response.json();
        setIsFavorite(data.isFavorite || false);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-gray-600 dark:text-gray-300">
        Đang tải...
      </div>
    );
  }

  if (!story) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-gray-600 dark:text-gray-300">
        Không tìm thấy truyện.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Story Header - Fixed at top for comic reading */}
      {story?.StoryType === 'Comic' && currentChapter && (
        <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {story.Title}
                </h1>
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {repairVietnameseText(currentChapter.Title)}
                </span>
              </div>
              
              {/* âœ… FIX: Dropdown chá»n chÆ°Æ¡ng cho Comic */}
              <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                <button
                  onClick={() => setShowChapterDropdown(!showChapterDropdown)}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    Chương {currentChapter.ChapterNumber}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${showChapterDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Dropdown menu */}
                {showChapterDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowChapterDropdown(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                      {sortedChapters.map((chapter) => (
                        <button
                          key={chapter.ChapterID}
                          onClick={() => {
                            handleChapterSelect(chapter);
                            setShowChapterDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                            currentChapter?.ChapterID === chapter.ChapterID
                              ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium"
                              : "text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          Chương {chapter.ChapterNumber}: {repairVietnameseText(chapter.Title) || `Chapter ${chapter.ChapterNumber}`}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {prevChapter && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleChapterSelect(prevChapter)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Trước
                  </Button>
                )}
                {nextChapter && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleChapterSelect(nextChapter)}
                  >
                    Sau
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid gap-6 lg:grid-cols-1">
          {/* Story Info + Content */}
          <div>
          {/* Story Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-32 h-48 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
              {story.CoverURL ? (
                <img 
                  src={buildMediaUrl(story.CoverURL) || undefined} 
                  alt={story.Title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {repairVietnameseText(story.Title)}
              </h1>
              
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>Tác giả: {repairVietnameseText(story.Author)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  <span>{story.ViewCount} lượt xem</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  <span>{story.Rating?.toFixed(1) || '0.0'}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  story.Status === 'Approved' 
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                    : story.Status === 'Pending'
                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                    : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                }`}>
                  {story.Status === 'Approved' ? 'Đã duyệt' : 
                   story.Status === 'Pending' ? 'Chờ duyệt' : 'Bị từ chối'}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  story.IsFree 
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                    : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                }`}>
                  {story.IsFree ? 'Miễn phí' : 'Trả phí'}
                </span>
              </div>
              
              {/* Rating */}
              <div className="mt-3 flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  <span>{ratings?.averageRating?.toFixed(1) || '0.0'} ({ratings?.totalRatings || 0})</span>
                </div>
                {user?.email && (
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(n => (
                      <button
                        key={n}
                        onClick={() => handleRate(n)}
                        className={`text-xl ${n <= myRating ? 'text-yellow-400' : 'text-gray-400'}`}
                        aria-label={`rate-${n}`}
                      >
                        â˜…
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Favorite Button */}
              {user?.email && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleToggleFavorite}
                  >
                    <Heart className={`w-4 h-4 mr-2 ${isFavorite ? 'text-red-500 fill-current' : ''}`} />
                    {isFavorite ? 'Đã yêu thích' : 'Yêu thích'}
                  </Button>
                </div>
              )}
              
              <p className="text-gray-700 dark:text-gray-300">
                {repairVietnameseText(story.Description)}
              </p>
            </div>
          </div>

          {/* Chapter Content */}
          {currentChapter ? (
            <div className={`mb-6 ${story.StoryType === 'Comic' ? '' : ''}`}>
              {story.StoryType !== 'Comic' && (
                <Card className="mb-4">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {repairVietnameseText(currentChapter.Title)}
                      </h2>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{currentChapter.ViewCount?.toLocaleString() || 0} lượt xem</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(currentChapter.CreatedAt).toLocaleDateString()}</span>
                        </div>
                        {currentChapter.ImageCount !== undefined && currentChapter.ImageCount > 0 && (
                          <span>• {currentChapter.ImageCount} trang</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Navigation for Text Stories */}
              {story.StoryType !== 'Comic' && (
                <div className="flex items-center justify-between mb-4 gap-2">
                  {prevChapter ? (
                    <Button
                      variant="secondary"
                      onClick={() => handleChapterSelect(prevChapter)}
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Chương trước
                    </Button>
                  ) : (
                    <div></div>
                  )}
                  {nextChapter && (
                    <Button
                      variant="primary"
                      onClick={() => handleChapterSelect(nextChapter)}
                      className="flex items-center gap-2"
                    >
                      Chương sau
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}

              {story.StoryType !== 'Comic' && (
                <Card>
                  <div className="p-6">
                    {/* Text Story Content */}
                    {story.StoryType === 'Text' && (
                <div className="prose dark:prose-invert max-w-none">
                    {/* Kiá»ƒm tra náº¿u Content lÃ  file PDF (Ä‘Æ°á»ng dáº«n file) */}
                    {(() => {
                      const content = currentChapter.Content || '';
                      const isPDFFile = content.startsWith('/storage/') && 
                                       (content.toLowerCase().endsWith('.pdf') || 
                                        content.toLowerCase().includes('.pdf'));
                      
                      if (isPDFFile) {
                        // Hiá»ƒn thá»‹ PDF viewer
                        return (
                          <div className="w-full">
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 mb-2 flex items-center justify-between">
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                Tài liệu PDF
                              </span>
                              <a
                                href={buildMediaUrl(content) || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                Mở trong tab mới
                              </a>
                            </div>
                            <div className="w-full border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden" style={{ minHeight: '600px' }}>
                              <iframe
                                src={buildMediaUrl(content) || undefined}
                                className="w-full border-0"
                                style={{ minHeight: '600px', height: '80vh' }}
                                title={`PDF Viewer - ${currentChapter.Title}`}
                              >
                                <div className="p-4 text-center">
                                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    Trình duyệt của bạn không hỗ trợ hiển thị PDF.
                                  </p>
                                  <a
                                    href={buildMediaUrl(content) || undefined}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    Tải xuống PDF
                                  </a>
                                </div>
                              </iframe>
                            </div>
                          </div>
                        );
                      } else {
                        // Hiá»ƒn thá»‹ text content nhÆ° bÃ¬nh thÆ°á»ng
                        return (
                  <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
                            {content}
                          </div>
                        );
                      }
                    })()}
                    </div>
                  )}
                  </div>
                </Card>
              )}

              {/* Comic Story Images - Full Width */}
              {story.StoryType !== undefined && story.StoryType === 'Comic' && currentChapter.Images && currentChapter.Images.length > 0 && (
                <div className="w-full bg-white dark:bg-gray-900">
                  {/* Chapter Info Bar for Comic */}
                  <div className="sticky top-[60px] z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-4">
                      <span>{repairVietnameseText(currentChapter.Title)}</span>
                      <span>•</span>
                      <span>{currentChapter.ImageCount || currentChapter.Images.length} trang</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {currentChapter.ViewCount?.toLocaleString() || 0} lượt xem
                      </span>
                    </div>
                  </div>
                  
                  {/* Images - Full Width */}
                  <div className="w-full">
                    {currentChapter.Images.map((image, index) => (
                      <div key={image.ImageID} className="w-full flex justify-center bg-gray-100 dark:bg-gray-800">
                        <img
                          data-image-id={image.ImageID}
                          src={buildMediaUrl(image.ImageURL) || undefined}
                          alt={`${repairVietnameseText(currentChapter.Title)} - Trang ${index + 1}`}
                          className="max-w-full h-auto"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/placeholder-image.png';
                            target.alt = 'Không thể tải ảnh';
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Bottom Navigation for Comic */}
                  <div className="sticky bottom-0 z-30 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                      {prevChapter ? (
                        <Button
                          variant="secondary"
                          onClick={() => handleChapterSelect(prevChapter)}
                          className="flex items-center gap-2"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Chương trước
                        </Button>
                      ) : (
                        <div></div>
                      )}
                      {nextChapter && (
                        <Button
                          variant="primary"
                          onClick={() => handleChapterSelect(nextChapter)}
                          className="flex items-center gap-2"
                        >
                          Chương sau
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Card className="mb-6">
              <div className="p-6 text-center">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Chưa có chương nào
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Truyện này chưa có chương nào được xuất bản.
                </p>
              </div>
            </Card>
          )}

          {/* Comments */}
          <CommentSection 
            contentType="series"
            contentId={story.SeriesID}
            contentTitle={story.Title}
          />
          </div>

          {/* âœ… FIX: ÄÃ£ bá» sidebar danh sÃ¡ch chÆ°Æ¡ng - thay báº±ng dropdown */}
        </div>
      </div>
    </div>
  );
};

export default StoryPage;




