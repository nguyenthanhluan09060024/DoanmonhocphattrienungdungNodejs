export interface User {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  avatar?: string;
  role: UserRole;
  isEmailVerified: boolean;
  isActive: boolean;
  isVIP: boolean;
  vipExpiryDate?: string;
  points: number;
  createdAt: string;
}

export interface UserRole {
  id: string;
  name: 'Viewer' | 'Uploader' | 'Author' | 'Translator' | 'Reup' | 'Admin';
  description: string;
}

export interface Movie {
  id: string;
  title: string;
  slug: string;
  description?: string;
  posterUrl?: string;
  trailerUrl?: string;
  releaseYear?: number;
  season?: number;
  duration?: number;
  country?: string;
  director?: string;
  cast?: string;
  status: 'Ongoing' | 'Completed';
  isFree: boolean;
  viewCount: number;
  rating: number;
  totalRatings: number;
  language: string;
  uploaderId: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  categories?: Category[];
  tags?: Tag[];
  episodes?: Episode[];
  uploaderName?: string;
  uploaderRole?: string;
}

export interface Episode {
  id: string;
  movieId: string;
  episodeNumber: number;
  title?: string;
  videoUrl: string;
  duration?: number;
  isFree: boolean;
  viewCount: number;
  createdAt: string;
}

export interface Series {
  id: string;
  title: string;
  slug: string;
  description?: string;
  coverUrl?: string;
  author?: string;
  status: 'Ongoing' | 'Completed';
  isFree: boolean;
  viewCount: number;
  rating: number;
  totalRatings: number;
  language: string;
  uploaderId: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  categories?: Category[];
  tags?: Tag[];
  chapters?: Chapter[];
  uploaderName?: string;
  uploaderRole?: string;
}

export interface Chapter {
  id: string;
  seriesId: string;
  chapterNumber: number;
  title?: string;
  content: string;
  isFree: boolean;
  viewCount: number;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: 'Movie' | 'Series' | 'Both';
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  content?: string;
  relatedUrl?: string;
  isRead: boolean;
  createdAt: string;
}

export interface VIPPackage {
  id: string;
  name: string;
  duration: number;
  price: number;
  description?: string;
  isActive: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  autoplay: boolean;
  quality: 'auto' | '720p' | '1080p';
  notifications: boolean;
}

export interface SearchFilters {
  query?: string;
  categories?: string[];
  tags?: string[];
  year?: number;
  status?: 'Ongoing' | 'Completed';
  type?: 'Movie' | 'Series';
  country?: string;
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}