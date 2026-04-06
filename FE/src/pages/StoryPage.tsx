import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import CommentSection from "../components/content/CommentSection";
import { awardChapterCompleteExp, fetchCurrentRole, saveSeriesHistory } from "../lib/api";
import { buildMediaUrl } from "../lib/config";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  Star,
  User,
} from "lucide-react";

interface ChapterImage {
  ImageID: number;
  ImageURL: string;
  ImageOrder: number;
}

interface Chapter {
  ChapterID: number;
  ChapterNumber: number;
  Title: string;
  Content: string;
  IsFree: boolean;
  CreatedAt: string;
  StoryType?: "Text" | "Comic";
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
  StoryType?: "Text" | "Comic";
}

const repairVietnameseText = (value?: string | null) => {
  if (!value) return "";
  const source = String(value).replace(/\u0000/g, "").trim();
  if (!source) return "";

  const variants: string[] = [source];

  try {
    const bytes = Uint8Array.from(source, (char) => char.charCodeAt(0) & 0xff);
    variants.push(new TextDecoder("utf-8").decode(bytes).replace(/\u0000/g, "").trim());
  } catch {}

  try {
    // Browser legacy trick for "UTF-8 read as Latin-1" strings
    variants.push(decodeURIComponent(escape(source)).replace(/\u0000/g, "").trim());
  } catch {}

  const score = (text: string) => {
    if (!text) return Number.MAX_SAFE_INTEGER;
    const bad = (text.match(/[�]/g) || []).length + (text.match(/[ÃÂâðï]/g) || []).length;
    return bad;
  };

  variants.sort((a, b) => score(a) - score(b));
  return variants[0] || source;
};

const toDisplayText = (value?: string | null, fallback = "") => {
  const fixed = repairVietnameseText(value);
  if (!fixed) return fallback;
  const bad = (fixed.match(/[�]/g) || []).length;
  const ratio = fixed.length > 0 ? bad / fixed.length : 0;
  return ratio > 0.03 ? fallback : fixed;
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
  const [showChapterDropdown, setShowChapterDropdown] = useState(false);
  const [hasAwardedExp, setHasAwardedExp] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const email = useMemo(() => (user?.email as string | undefined) || "", [user]);

  useEffect(() => {
    const loadStory = async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const storyResponse = await fetch(`/api/stories/${slug}`);
        if (!storyResponse.ok) {
          setStory(null);
          return;
        }
        const storyData = await storyResponse.json();
        setStory(storyData);

        const chaptersResponse = await fetch(`/api/stories/${storyData.SeriesID}/chapters`);
        if (chaptersResponse.ok) {
          const chaptersData = await chaptersResponse.json();
          setChapters(chaptersData);
          if (chaptersData.length > 0) {
            const chapterParam = Number(searchParams.get("chapter"));
            const target = chaptersData.find((ch: Chapter) => ch.ChapterNumber === chapterParam);
            setCurrentChapter(target || chaptersData[0]);
          }
        }

        const ratingsResponse = await fetch(`/api/stories/${storyData.SeriesID}/ratings`);
        if (ratingsResponse.ok) {
          const ratingsPayload = await ratingsResponse.json();
          const ratingsData = ratingsPayload?.data ?? ratingsPayload ?? {};
          setRatings({
            averageRating: Number(ratingsData.averageRating ?? ratingsData.average ?? 0) || 0,
            totalRatings: Number(ratingsData.totalRatings ?? ratingsData.count ?? 0) || 0,
          });
        }

        if (user?.email) {
          const [userRatingResponse, favoriteResponse] = await Promise.all([
            fetch(`/api/stories/${storyData.SeriesID}/user-rating`, {
              headers: { "x-user-email": user.email },
            }),
            fetch(`/api/stories/${storyData.SeriesID}/favorite-status`, {
              headers: { "x-user-email": user.email },
            }),
          ]);

          if (userRatingResponse.ok) {
            const userRatingPayload = await userRatingResponse.json();
            const userRatingData = userRatingPayload?.data ?? userRatingPayload ?? {};
            setMyRating(Number(userRatingData.rating ?? 0) || 0);
          }

          if (favoriteResponse.ok) {
            const favoritePayload = await favoriteResponse.json();
            const favoriteData = favoritePayload?.data ?? favoritePayload ?? {};
            setIsFavorite(Boolean(favoriteData.isFavorite));
          }
        }
      } catch (error) {
        console.error("Error loading story:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStory();
  }, [slug, searchParams, user?.email]);

  useEffect(() => {
    if (!email) return;
    fetchCurrentRole(email)
      .then(({ role }) => setIsAdmin(role === "Admin"))
      .catch(() => setIsAdmin(false));
  }, [email]);

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.ChapterNumber - b.ChapterNumber),
    [chapters]
  );

  const currentChapterIndex = sortedChapters.findIndex((ch) => ch.ChapterID === currentChapter?.ChapterID);
  const prevChapter = currentChapterIndex > 0 ? sortedChapters[currentChapterIndex - 1] : null;
  const nextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < sortedChapters.length - 1
      ? sortedChapters[currentChapterIndex + 1]
      : null;

  const handleChapterSelect = (chapter: Chapter) => {
    setCurrentChapter(chapter);
    setShowChapterDropdown(false);
    setHasAwardedExp(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!email || !story || !currentChapter) return;
    saveSeriesHistory(email, Number(story.SeriesID), currentChapter.ChapterID).catch(() => {});
    setHasAwardedExp(false);
  }, [email, story, currentChapter]);

  useEffect(() => {
    if (!email || !currentChapter || hasAwardedExp || isAdmin || story?.StoryType === "Comic") return;
    const handleScroll = () => {
      const isNearBottom =
        (window.pageYOffset || document.documentElement.scrollTop) + window.innerHeight >=
        document.documentElement.scrollHeight - 100;

      if (isNearBottom && !hasAwardedExp) {
        awardChapterCompleteExp(email, currentChapter.ChapterID)
          .then((res) => {
            if (res.expGained > 0) setHasAwardedExp(true);
          })
          .catch(() => {});
      }
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [email, currentChapter, hasAwardedExp, isAdmin, story?.StoryType]);

  useEffect(() => {
    if (!email || !currentChapter || hasAwardedExp || isAdmin || story?.StoryType !== "Comic") return;
    if (!currentChapter.Images?.length) return;

    const handleScroll = () => {
      const lastImage = currentChapter.Images![currentChapter.Images!.length - 1];
      const node = document.querySelector(`img[data-image-id="${lastImage.ImageID}"]`);
      if (!node) return;

      const rect = (node as HTMLImageElement).getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0 && !hasAwardedExp) {
        awardChapterCompleteExp(email, currentChapter.ChapterID)
          .then((res) => {
            if (res.expGained > 0) setHasAwardedExp(true);
          })
          .catch(() => {});
      }
    };

    window.addEventListener("scroll", handleScroll);
    setTimeout(handleScroll, 500);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [email, currentChapter, hasAwardedExp, isAdmin, story?.StoryType]);

  const handleRate = async (value: number) => {
    if (!user?.email || !story) return;
    setMyRating(value);
    try {
      const response = await fetch(`/api/stories/${story.SeriesID}/rating`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": user.email,
        },
        body: JSON.stringify({ rating: value }),
      });
      if (!response.ok) return;

      const ratingsResponse = await fetch(`/api/stories/${story.SeriesID}/ratings`);
      if (!ratingsResponse.ok) return;
      const ratingsPayload = await ratingsResponse.json();
      const ratingsData = ratingsPayload?.data ?? ratingsPayload ?? {};
      setRatings({
        averageRating: Number(ratingsData.averageRating ?? ratingsData.average ?? 0) || 0,
        totalRatings: Number(ratingsData.totalRatings ?? ratingsData.count ?? 0) || 0,
      });
    } catch (error) {
      console.error("Error rating story:", error);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user?.email || !story) return;
    try {
      const endpoint = `/api/stories/${story.SeriesID}/favorite`;
      await fetch(endpoint, {
        method: isFavorite ? "DELETE" : "POST",
        headers: { "x-user-email": user.email },
      });

      const response = await fetch(`/api/stories/${story.SeriesID}/favorite-status`, {
        headers: { "x-user-email": user.email },
      });
      if (response.ok) {
        const data = await response.json();
        const payload = data?.data ?? data ?? {};
        setIsFavorite(Boolean(payload.isFavorite));
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-10 text-gray-600 dark:text-gray-300">Đang tải...</div>;
  }

  if (!story) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-gray-600 dark:text-gray-300">
        Không tìm thấy truyện.
      </div>
    );
  }

  const safeStoryTitle = toDisplayText(story.Title, story.Title || "");
  const safeStoryDescription = toDisplayText(story.Description, "Nội dung đang được cập nhật.");
  const safeAuthor = toDisplayText(story.Author, "Đang cập nhật");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {story.StoryType === "Comic" && currentChapter && (
        <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{safeStoryTitle}</h1>
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {toDisplayText(currentChapter.Title, `Chương ${currentChapter.ChapterNumber}`)}
                </span>
              </div>

              <div className="relative flex-1 min-w-[220px] max-w-[320px]">
                <button
                  onClick={() => setShowChapterDropdown((v) => !v)}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    Chương {currentChapter.ChapterNumber}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-500 transition-transform ${showChapterDropdown ? "rotate-180" : ""}`}
                  />
                </button>
                {showChapterDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowChapterDropdown(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                      {sortedChapters.map((chapter) => (
                        <button
                          key={chapter.ChapterID}
                          onClick={() => handleChapterSelect(chapter)}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            currentChapter.ChapterID === chapter.ChapterID
                              ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium"
                              : "text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          Chương {chapter.ChapterNumber}:{" "}
                          {toDisplayText(chapter.Title, `Chapter ${chapter.ChapterNumber}`)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28">
        <div className="grid gap-6 lg:grid-cols-1">
          <div>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-32 h-48 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                {story.CoverURL ? (
                  <img
                    src={buildMediaUrl(story.CoverURL) || undefined}
                    alt={safeStoryTitle}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{safeStoryTitle}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>Tác giả: {safeAuthor}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    <span>{Number(story.ViewCount || 0).toLocaleString()} lượt xem</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    <span>{Number(story.Rating || 0).toFixed(1)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      story.Status === "Approved"
                        ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                        : story.Status === "Pending"
                        ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                        : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                    }`}
                  >
                    {story.Status === "Approved" ? "Đã duyệt" : story.Status === "Pending" ? "Chờ duyệt" : "Bị từ chối"}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      story.IsFree
                        ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                        : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                    }`}
                  >
                    {story.IsFree ? "Miễn phí" : "Trả phí"}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    <span>
                      {ratings?.averageRating?.toFixed(1) || "0.0"} ({ratings?.totalRatings || 0})
                    </span>
                  </div>
                  {user?.email && (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => handleRate(n)}
                          className={`text-xl ${n <= myRating ? "text-yellow-400" : "text-gray-400"}`}
                          aria-label={`rate-${n}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {user?.email && (
                  <div className="mt-3">
                    <Button size="sm" variant="secondary" onClick={handleToggleFavorite}>
                      <Heart className={`w-4 h-4 mr-2 ${isFavorite ? "text-red-500 fill-current" : ""}`} />
                      {isFavorite ? "Đã yêu thích" : "Yêu thích"}
                    </Button>
                  </div>
                )}

                <p className="text-gray-700 dark:text-gray-300 mt-3">{safeStoryDescription}</p>
              </div>
            </div>

            {currentChapter ? (
              <div className="mb-6">
                {story.StoryType !== "Comic" && (
                  <>
                    <Card className="mb-4">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {toDisplayText(currentChapter.Title, `Chapter ${currentChapter.ChapterNumber}`)}
                          </h2>
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-1">
                              <Eye className="w-4 h-4" />
                              <span>{Number(currentChapter.ViewCount || 0).toLocaleString()} lượt xem</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(currentChapter.CreatedAt).toLocaleDateString()}</span>
                            </div>
                            {typeof currentChapter.ImageCount === "number" && currentChapter.ImageCount > 0 && (
                              <span>• {currentChapter.ImageCount} trang</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card>
                      <div className="p-6">
                        {story.StoryType === "Text" && (
                          <div className="prose dark:prose-invert max-w-none">
                            {(() => {
                              const content = currentChapter.Content || "";
                              const isPDFFile =
                                content.startsWith("/storage/") &&
                                (content.toLowerCase().endsWith(".pdf") || content.toLowerCase().includes(".pdf"));

                              if (isPDFFile) {
                                return (
                                  <div className="w-full">
                                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 mb-2 flex items-center justify-between">
                                      <span className="text-sm text-gray-600 dark:text-gray-400">Tài liệu PDF</span>
                                      <a
                                        href={buildMediaUrl(content) || undefined}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                      >
                                        Mở trong tab mới
                                      </a>
                                    </div>
                                    <div
                                      className="w-full border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden"
                                      style={{ minHeight: "600px" }}
                                    >
                                      <iframe
                                        src={buildMediaUrl(content) || undefined}
                                        className="w-full border-0"
                                        style={{ minHeight: "600px", height: "80vh" }}
                                        title={`PDF Viewer - ${currentChapter.Title}`}
                                      />
                                    </div>
                                  </div>
                                );
                              }

                              const safeContent = toDisplayText(content, "Nội dung chương đang được cập nhật.");
                              return (
                                <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
                                  {safeContent}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </Card>
                  </>
                )}

                {story.StoryType === "Comic" && currentChapter.Images && currentChapter.Images.length > 0 && (
                  <div className="w-full bg-white dark:bg-gray-900">
                    <div className="sticky top-[60px] z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-4">
                        <span>{toDisplayText(currentChapter.Title, `Chapter ${currentChapter.ChapterNumber}`)}</span>
                        <span>•</span>
                        <span>{currentChapter.ImageCount || currentChapter.Images.length} trang</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {Number(currentChapter.ViewCount || 0).toLocaleString()} lượt xem
                        </span>
                      </div>
                    </div>

                    <div className="w-full">
                      {currentChapter.Images.map((image, index) => (
                        <div key={image.ImageID} className="w-full flex justify-center bg-gray-100 dark:bg-gray-800">
                          <img
                            data-image-id={image.ImageID}
                            src={buildMediaUrl(image.ImageURL) || undefined}
                            alt={`${toDisplayText(currentChapter.Title, "Chapter")} - Trang ${index + 1}`}
                            className="max-w-full h-auto"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "/placeholder-image.png";
                              target.alt = "Không thể tải ảnh";
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Card className="mb-6">
                <div className="p-6 text-center">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Chưa có chương nào</h3>
                  <p className="text-gray-500 dark:text-gray-400">Truyện này chưa có chương nào được xuất bản.</p>
                </div>
              </Card>
            )}

            <CommentSection contentType="series" contentId={story.SeriesID} contentTitle={safeStoryTitle} />
          </div>
        </div>
      </div>

      {currentChapter && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(960px,calc(100%-24px))]">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-3 py-2 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Link to="/stories" className="shrink-0">
                  <Button size="sm" variant="secondary">Về trang truyện</Button>
                </Link>
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  Chương {currentChapter.ChapterNumber}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => prevChapter && handleChapterSelect(prevChapter)}
                  disabled={!prevChapter}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Chương trước
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => nextChapter && handleChapterSelect(nextChapter)}
                  disabled={!nextChapter}
                >
                  Chương sau
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryPage;
