const stripTrailingSlash = (value?: string) =>
  value ? value.replace(/\/+$/, "") : value;

const isHttpsNonLocal = () =>
  typeof window !== "undefined" &&
  window.location.protocol === "https:" &&
  !window.location.hostname.includes("localhost");

const getDefaultApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (isHttpsNonLocal()) {
    return "/api";
  }

  return "/api";
};

const getDefaultMediaBase = () => {
  if (import.meta.env.VITE_VIDEO_BASE_URL) {
    return import.meta.env.VITE_VIDEO_BASE_URL;
  }

  if (isHttpsNonLocal()) {
    return "http://localhost:4000";
  }

  return "http://localhost:4000";
};

export const API_BASE =
  stripTrailingSlash(import.meta.env.VITE_API_URL) ?? getDefaultApiBase();

export const MEDIA_BASE =
  (import.meta.env.VITE_VIDEO_BASE_URL &&
    stripTrailingSlash(import.meta.env.VITE_VIDEO_BASE_URL)) ||
  getDefaultMediaBase();

export const STORAGE_BASE = `${MEDIA_BASE}/storage`;

export const buildApiUrl = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
};

export const apiFetch = (path: string, init?: RequestInit) =>
  fetch(buildApiUrl(path), init);

export const buildMediaUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;

  const normalized = path.startsWith("/") ? path : `/${path}`;
  const relativePath = normalized.replace(/^\/+/, "");

  // Legacy records may store only a filename (e.g. "cover_123.jpg")
  if (!relativePath.includes("/")) {
    return buildStorageUrl(relativePath);
  }

  if (normalized.startsWith("/storage/") || normalized.startsWith("/uploads/")) {
    return buildStorageUrl(normalized);
  }

  const mediaBase = MEDIA_BASE || "http://localhost:4000";
  return `${mediaBase}${normalized}`;
};

export const buildStorageUrl = (filename?: string) => {
  if (!filename) return "";
  if (filename.startsWith("http")) return filename;

  const clean = filename.replace(/^\/?(storage|uploads)\//, "").split("?")[0];
  const storageBase = (STORAGE_BASE || "http://localhost:4000/storage").replace(
    /\/+$/,
    ""
  );
  return `${storageBase}/${clean}`;
};
