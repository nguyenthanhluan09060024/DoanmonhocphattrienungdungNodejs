import { API_BASE } from "./config";

export type ApiMovie = {
  MovieID: number;
  Title: string;
  Slug: string;
  PosterURL?: string;
  Rating?: number;
  ViewCount?: number;
  UploaderName?: string;
  UploaderRole?: string;
  Status?: string;
};

export async function fetchMovies(): Promise<ApiMovie[]> {
  const res = await fetch(`${API_BASE}/movies`);
  if (!res.ok) throw new Error("Failed to fetch movies");
  return res.json();
}

export async function fetchCategories(): Promise<
  { CategoryID: number; CategoryName: string; Slug: string; Type: string }[]
> {
  const res = await fetch(`${API_BASE}/categories`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

// ==== Admin Categories ====
export type CategoryItem = {
  CategoryID: number;
  CategoryName: string;
  Slug: string;
  Type: "Movie" | "Series" | "Both";
  CreatedAt: string;
};

export async function adminListCategories(email: string): Promise<CategoryItem[]> {
  const res = await fetch(`${API_BASE}/admin/categories`, {
    headers: { "x-user-email": email },
  });
  if (!res.ok) throw new Error("Failed to load categories");
  return res.json();
}

export async function adminCreateCategory(input: {
  email: string;
  name: string;
  type: "Movie" | "Series" | "Both";
}): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-email": input.email },
    body: JSON.stringify({ name: input.name, type: input.type }),
  });
  if (!res.ok) throw new Error("Failed to create category");
}

export async function adminUpdateCategory(input: {
  email: string;
  id: number;
  name?: string;
  type?: "Movie" | "Series" | "Both";
}): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/categories/${input.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-user-email": input.email },
    body: JSON.stringify({ name: input.name, type: input.type }),
  });
  if (!res.ok) throw new Error("Failed to update category");
}

export async function adminDeleteCategory(email: string, id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/categories/${id}`, {
    method: "DELETE",
    headers: { "x-user-email": email },
  });
  if (!res.ok) throw new Error("Failed to delete category");
}

export async function getUserPreferences(
  email: string
): Promise<Record<string, string>> {
  const url = new URL(`${API_BASE}/preferences`, window.location.origin);
  url.searchParams.set("email", email);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to load preferences");
  return res.json();
}

export async function saveUserPreference(
  email: string,
  key: string,
  value: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/preferences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, key, value }),
  });
  if (!res.ok) throw new Error("Failed to save preference");
}

export interface UserProfileDto {
  Username: string;
  FullName?: string;
  Avatar?: string;
  Gender?: string;
  CreatedAt?: string;
}

export async function fetchProfile(email: string): Promise<UserProfileDto> {
  const url = new URL(`${API_BASE}/me`, window.location.origin);
  url.searchParams.set("email", email);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

export async function updateProfile(input: {
  email: string;
  username?: string;
  fullName?: string;
  avatar?: string;
  gender?: string;
  password?: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/me`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to update profile");
}

// ===== Favorites (Movies) =====
export async function fetchFavorites(email: string): Promise<number[]> {
  const url = new URL(`${API_BASE}/favorites`, window.location.origin);
  url.searchParams.set("email", email);
  const res = await fetch(url.toString(), {
    headers: { "x-user-email": email },
  });
  if (!res.ok) throw new Error("Failed to load favorites");
  const payload = await res.json();
  const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
  return rows
    .map((item: any) => Number(item?.MovieID ?? item?.movieId ?? item))
    .filter((id: number) => Number.isFinite(id) && id > 0);
}

export async function addFavorite(
  email: string,
  movieId: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, movieId }),
  });
  if (!res.ok) throw new Error("Failed to add favorite");
}

export async function removeFavorite(
  email: string,
  movieId: number
): Promise<void> {
  const url = new URL(`${API_BASE}/favorites`, window.location.origin);
  url.searchParams.set("email", email);
  url.searchParams.set("movieId", String(movieId));
  const res = await fetch(url.toString(), { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove favorite");
}

// ===== Watch (Movies) =====
export async function fetchMovieDetail(slug: string): Promise<any> {
  const res = await fetch(`${API_BASE}/movies/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error("Failed to fetch movie detail");
  return res.json();
}

export async function fetchMovieEpisodes(
  slug: string
): Promise<
  {
    EpisodeID: number;
    EpisodeNumber: number;
    Title?: string;
    VideoURL: string;
    Duration?: number;
    ViewCount?: number;
  }[]
> {
  const res = await fetch(
    `${API_BASE}/movies/${encodeURIComponent(slug)}/episodes`
  );
  if (!res.ok) throw new Error("Failed to fetch episodes");
  return res.json();
}

export async function saveMovieHistory(
  email: string,
  movieId: number,
  episodeId?: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/history/movie`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, movieId, episodeId }),
  });
  if (!res.ok) throw new Error("Failed to save history");
}

// ===== Comments =====
export type MovieCommentDto = {
  CommentID: number;
  Content: string;
  CreatedAt: string;
  ParentCommentID?: number | null;
  Username: string;
  Avatar?: string;
};

export async function fetchMovieComments(movieId: number): Promise<MovieCommentDto[]> {
  const res = await fetch(`${API_BASE}/movies/${movieId}/comments`);
  if (!res.ok) throw new Error("Failed to fetch comments");
  return res.json();
}

export async function postMovieComment(
  email: string,
  movieId: number,
  content: string,
  parentCommentId?: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/movies/${movieId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-email": email,
    },
    body: JSON.stringify({ content, parentCommentId }),
  });
  if (!res.ok) throw new Error("Failed to add comment");
}

export async function updateMovieComment(
  email: string,
  movieId: number,
  commentId: number,
  content: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/movies/${movieId}/comments/${commentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-user-email": email },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to update comment");
}

export async function deleteMovieComment(
  email: string,
  movieId: number,
  commentId: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/movies/${movieId}/comments/${commentId}`, {
    method: "DELETE",
    headers: { "x-user-email": email },
  });
  if (!res.ok) throw new Error("Failed to delete comment");
}

// ===== Ratings =====
export type MovieRatingsResponse = {
  ratings: { Rating: number; CreatedAt: string; Username: string }[];
  averageRating: number;
  totalRatings: number;
  myRating?: number;
};

export async function fetchMovieRatings(movieId: number, email?: string): Promise<MovieRatingsResponse> {
  const headers: HeadersInit = {};
  if (email) {
    headers["x-user-email"] = email;
  }
  const res = await fetch(`${API_BASE}/movies/${movieId}/ratings`, { headers });
  if (!res.ok) throw new Error("Failed to fetch ratings");
  const payload = await res.json();
  const data = payload?.data ?? payload ?? {};
  return {
    ratings: Array.isArray(data?.ratings) ? data.ratings : [],
    averageRating: Number(data?.averageRating ?? data?.average ?? 0) || 0,
    totalRatings: Number(data?.totalRatings ?? data?.count ?? 0) || 0,
    myRating: data?.myRating != null ? Number(data.myRating) : undefined,
  };
}

export async function submitMovieRating(
  email: string,
  movieId: number,
  rating: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/movies/${movieId}/ratings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-email": email,
    },
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) throw new Error("Failed to submit rating");
}

// ===== History =====
export type MovieHistoryItem = {
  HistoryID: number;
  MovieID: number;
  EpisodeID?: number | null;
  EpisodeNumber?: number | null;
  WatchedAt: string;
  Title: string;
  Slug: string;
};

export async function fetchMovieHistory(
  email: string,
  opts?: { userEmail?: string }
): Promise<MovieHistoryItem[]> {
  const url = new URL(`${API_BASE}/history/movie`, window.location.origin);
  url.searchParams.set("email", email);
  if (opts?.userEmail) url.searchParams.set("userEmail", opts.userEmail);
  const res = await fetch(url.toString(), {
    headers: opts?.userEmail ? { "x-user-email": email } : undefined,
  });
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

// ===== Series History =====
export async function saveSeriesHistory(
  email: string,
  seriesId: number,
  chapterId?: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/history/series`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, seriesId, chapterId }),
  });
  if (!res.ok) throw new Error("Failed to save history");
}

export type SeriesHistoryItem = {
  HistoryID: number;
  SeriesID: number;
  ChapterID?: number | null;
  ReadAt: string;
  Title: string;
  Slug: string;
  ChapterNumber?: number | null;
};

export async function fetchSeriesHistory(
  email: string,
  opts?: { userEmail?: string }
): Promise<SeriesHistoryItem[]> {
  const url = new URL(`${API_BASE}/history/series`, window.location.origin);
  url.searchParams.set("email", email);
  if (opts?.userEmail) url.searchParams.set("userEmail", opts.userEmail);
  const res = await fetch(url.toString(), {
    headers: opts?.userEmail ? { "x-user-email": email } : undefined,
  });
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

// ===== Admin Stats: Movie Views =====
export interface AdminMovieViewStat {
  MovieID: number;
  Title: string;
  Slug: string;
  PosterURL?: string;
  totalViews: number;
  uniqueViewers: number;
  lastWatchedAt: string;
}

export async function adminMovieViewStats(
  email: string,
  options?: { days?: number; limit?: number; offset?: number }
): Promise<AdminMovieViewStat[]> {
  const url = new URL(`${API_BASE}/admin/stats/movies/views`, window.location.origin);
  if (options?.days) url.searchParams.set("days", String(options.days));
  if (options?.limit) url.searchParams.set("limit", String(options.limit));
  if (options?.offset) url.searchParams.set("offset", String(options.offset));
  const res = await fetch(url.toString(), { headers: { "x-user-email": email } });
  if (!res.ok) throw new Error("Failed to load movie view stats");
  return res.json();
}

// ===== Notifications =====
export interface NotificationItemDto {
  NotificationID?: number;
  UserID?: number;
  Type: string;
  Title: string;
  Content?: string;
  RelatedURL?: string;
  IsRead: boolean;
  CreatedAt: string;
}

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  meta?: Record<string, unknown>;
};

export async function fetchNotifications(
  email: string
): Promise<NotificationItemDto[]> {
  const url = new URL(`${API_BASE}/notifications`, window.location.origin);
  url.searchParams.set("email", email);
  const res = await fetch(url.toString(), {
    headers: { "x-user-email": email },
  });
  if (!res.ok) throw new Error("Failed to load notifications");
  const payload = (await res.json()) as ApiEnvelope<NotificationItemDto[]> | NotificationItemDto[];
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function fetchUnreadNotificationCount(
  email: string
): Promise<number> {
  try {
    if (!email) {
      console.warn("fetchUnreadNotificationCount: No email provided");
      return 0;
    }
    const url = new URL(`${API_BASE}/notifications/count`, window.location.origin);
    url.searchParams.set("email", email);
    const res = await fetch(url.toString(), {
      headers: { "x-user-email": email },
    });
    if (!res.ok) {
      console.error(`Notification count failed: ${res.status} ${res.statusText}`);
      return 0;
    }
    const payload = await res.json();
    const count = Number(payload?.data?.count ?? payload?.count ?? 0) || 0;
    return count;
  } catch (error) {
    console.error("Failed to fetch notification count:", error);
    return 0;
  }
}

export async function deleteNotification(notificationId: number, email?: string): Promise<void> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (email) {
    headers["x-user-email"] = email;
  }
  const url = new URL(`${API_BASE}/notifications/${notificationId}`, window.location.origin);
  if (email) {
    url.searchParams.set("email", email);
  }
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete notification");
}

export async function deleteAllNotifications(email?: string): Promise<void> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (email) {
    headers["x-user-email"] = email;
  }
  const url = new URL(`${API_BASE}/notifications`, window.location.origin);
  if (email) {
    url.searchParams.set("email", email);
  }
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete all notifications");
}

export async function markNotificationsRead(
  email: string,
  notificationId?: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/notifications/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-email": email },
    body: JSON.stringify({ email, notificationId }),
  });
  if (!res.ok) throw new Error("Failed to mark notification read");
}

// ===== Admin Uploads =====
export async function adminUploadMovie(input: {
  token?: string; // reserved for future auth header
  title: string;
  description?: string;
  categoryId: number;
  releaseYear?: number;
  duration?: number;
  country?: string;
  director?: string;
  cast?: string;
  isFree?: boolean;
  videoFile?: File;
  coverImage?: File;
}): Promise<void> {
  const form = new FormData();
  form.set("title", input.title);
  if (input.description) form.set("description", input.description);
  form.set("categoryId", String(input.categoryId));
  if (typeof input.releaseYear !== "undefined")
    form.set("releaseYear", String(input.releaseYear));
  if (typeof input.duration !== "undefined")
    form.set("duration", String(input.duration));
  if (input.country) form.set("country", input.country);
  if (input.director) form.set("director", input.director);
  if (input.cast) form.set("cast", input.cast);
  if (typeof input.isFree !== "undefined")
    form.set("isFree", input.isFree ? "1" : "0");
  if (input.videoFile) form.append("videoFile", input.videoFile);
  if (input.coverImage) form.append("coverImage", input.coverImage);

  const res = await fetch(`${API_BASE}/admin/movies`, {
    method: "POST",
    body: form,
    headers: input.token ? { "x-user-email": input.token } : undefined,
  });

  if (!res.ok) {
    let errorMessage = "Failed to upload movie";
    try {
      const errorData = await res.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (e) {
      // If can't parse error response, use default message
      errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    }
    throw new Error(errorMessage);
  }
}

export async function adminUploadStory(input: {
  token?: string;
  title: string;
  description?: string;
  categoryId: number;
  author?: string;
  status?: string;
  coverImage?: File;
  contentFile?: File; // optional text/epub/pdf file
}): Promise<void> {
  const form = new FormData();
  form.set("title", input.title);
  if (input.description) form.set("description", input.description);
  form.set("categoryId", String(input.categoryId));
  if (input.author) form.set("author", input.author);
  if (input.status) form.set("status", input.status);
  if (input.coverImage) form.append("coverImage", input.coverImage);
  if (input.contentFile) form.append("contentFile", input.contentFile);

  const res = await fetch(`${API_BASE}/admin/stories`, {
    method: "POST",
    body: form,
    headers: input.token ? { "x-user-email": input.token } : undefined,
  });
  if (!res.ok) throw new Error("Failed to upload story");
}

export async function fetchCurrentRole(
  email: string
): Promise<{ role: string }> {
  const res = await fetch(`${API_BASE}/auth/role`, {
    headers: { "x-user-email": email },
  });
  if (!res.ok) throw new Error("Failed to fetch role");
  return res.json();
}

// ===== Admin CRUD: Movies =====
export async function adminListMovies(email: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/admin/movies`, {
    headers: { "x-user-email": email },
  });
  if (!res.ok) {
    console.error("Lá»—i khi gá»i API adminListMovies:", await res.text());
    throw new Error("Failed to load movies");
  }
  const movies = await res.json();
  console.log("Danh sÃ¡ch phim:", movies);
  return movies;
}

export async function adminUpdateMovie(
  email: string,
  id: number,
  data: Partial<{
    title: string;
    description: string;
    posterURL: string;
    trailerURL: string;
    status: string;
    isFree: boolean;
  }>
): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/movies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-user-email": email },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update movie");
}

export async function adminDeleteMovie(
  email: string,
  id: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/movies/${id}`, {
    method: "DELETE",
    headers: { "x-user-email": email },
  });
  if (!res.ok) throw new Error("Failed to delete movie");
}

// ===== Admin CRUD: Stories =====
export async function adminListStories(email: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/admin/stories`, {
    headers: { "x-user-email": email },
  });
  if (!res.ok) throw new Error("Failed to load stories");
  return res.json();
}

export async function adminUpdateStory(
  email: string,
  id: number,
  data: Partial<{
    title: string;
    description: string;
    coverURL: string;
    author: string;
    status: string;
    categoryId: number;
    contentURL: string;
  }>
): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/stories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-user-email": email },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update story");
}

export async function adminDeleteStory(
  email: string,
  id: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/stories/${id}`, {
    method: "DELETE",
    headers: { "x-user-email": email },
  });
  if (!res.ok) throw new Error("Failed to delete story");
}

// ===== Experience System =====
export interface UserExperience {
  totalExp: number;
  level: number;
  currentLevelExp: number;
  maxExp: number;
  expToNextLevel: number;
}

export interface ExperienceRewardResponse {
  ok: boolean;
  expGained: number;
  totalExp: number;
  level: number;
  currentLevelExp: number;
  maxExp: number;
  message: string;
}

export async function awardMovieWatchExp(
  email: string,
  movieId: number,
  watchedSeconds: number
): Promise<ExperienceRewardResponse> {
  const res = await fetch(`${API_BASE}/experience/movie-watch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, movieId, watchedSeconds }),
  });
  if (!res.ok) throw new Error("Failed to award movie watch EXP");
  return res.json();
}

export async function awardChapterCompleteExp(
  email: string,
  chapterId: number
): Promise<ExperienceRewardResponse> {
  const res = await fetch(`${API_BASE}/experience/chapter-complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, chapterId }),
  });
  if (!res.ok) throw new Error("Failed to award chapter complete EXP");
  return res.json();
}

export async function getUserExperience(
  email: string
): Promise<UserExperience> {
  const url = new URL(`${API_BASE}/experience/user`, window.location.origin);
  url.searchParams.set("email", email);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch user experience");
  return res.json();
}

// ===== Crawl API =====
export interface CrawlMovieResponse {
  ok: boolean;
  movie: {
    title: string;
    overview: string;
    poster_url: string | null;
    poster_local: string | null;
    trailer_url: string | null;
    release_year: number | null;
    duration: number | null;
    genres: string;
    language: string;
    rating: number;
    country: string | null;
    director: string | null;
    cast: string | null;
  };
}

export interface ChapterMeta {
  ordinal: number;
  title: string;
  url: string;
  slug: string;
}

export interface CrawlStoryResponse {
  ok: boolean;
  series: {
    title: string;
    author: string;
    description: string;
    cover_url: string | null;
    cover_local: string | null;
    source_site?: string;
    story_url?: string;
    chapters?: ChapterMeta[];
  };
}

export interface CrawlChapterResponse {
  ok: boolean;
  site: string;
  chapterUrl: string;
  imageCount: number;
  images: string[];
  savedImages: string[];
  storageFolder: string | null;
}

export async function crawlMovieFromTMDB(
  email: string,
  tmdbId: string,
  downloadPoster: boolean = false
): Promise<CrawlMovieResponse> {
  const url = new URL(`${API_BASE}/crawl/movie/${tmdbId}`, window.location.origin);
  if (downloadPoster) {
    url.searchParams.set("download", "true");
  }
  const res = await fetch(url.toString(), {
    headers: { "x-user-email": email },
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to crawl movie");
  }
  return res.json();
}

// âœ… FIX: Crawl movie tá»« URL (TMDB hoáº·c trang VN) - dÃ¹ng POST nhÆ° crawlStoryFromVN
export async function crawlMovieFromURL(
  email: string,
  movieUrl: string,
  downloadPoster: boolean = false
): Promise<CrawlMovieResponse> {
  const res = await fetch(`${API_BASE}/crawl/movie`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-email": email,
    },
    body: JSON.stringify({ url: movieUrl, download: downloadPoster }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to crawl movie" }));
    throw new Error(error.error || "Failed to crawl movie");
  }
  return res.json();
}

export async function crawlStoryFromVN(
  email: string,
  url: string,
  downloadCover: boolean = false
): Promise<CrawlStoryResponse> {
  const res = await fetch(`${API_BASE}/crawl/story`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-email": email,
    },
    body: JSON.stringify({ url, download: downloadCover }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to crawl story");
  }
  return res.json();
}

export async function crawlChapterImages(
  email: string,
  body: {
    url?: string;
    chapterUrl: string;
    chapterId?: string;
    chapterSlug?: string;
    chapterTitle?: string;
    storySlug?: string;
    storyTitle?: string;
    saveToDisk?: boolean;
  }
): Promise<CrawlChapterResponse> {
  const payload = {
    ...body,
    saveToDisk: body.saveToDisk !== false,
  };
  const res = await fetch(`${API_BASE}/crawl/chapter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-email": email,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Failed to crawl chapter");
  }
  return res.json();
}



