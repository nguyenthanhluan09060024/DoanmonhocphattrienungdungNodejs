"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = exports.uploadsRoot = void 0;
exports.normalizeStoragePath = normalizeStoragePath;
exports.safeDeleteStoragePath = safeDeleteStoragePath;
exports.deleteChapterFolderByImageUrl = deleteChapterFolderByImageUrl;
const fs_1 = require("fs");
const path_1 = require("path");
const multer = require("multer");
const uploadsRoot = (0, path_1.resolve)(__dirname, "..", "..", "uploads");
exports.uploadsRoot = uploadsRoot;
if (!(0, fs_1.existsSync)(uploadsRoot)) {
    (0, fs_1.mkdirSync)(uploadsRoot, { recursive: true });
}
function normalizeStoragePath(value) {
    if (!value) {
        return null;
    }
    let normalized = String(value).trim();
    if (!normalized) {
        return null;
    }
    normalized = normalized.replace(/\\/g, "/");
    normalized = normalized.replace(/^[A-Z]:\//i, "/");
    normalized = normalized.replace(/^https?:\/\/[^/]+/i, "");
    if (normalized.startsWith("/storage/")) {
        return normalized.replace(/\/+/g, "/");
    }
    const uploadsIndex = normalized.indexOf("uploads/");
    if (uploadsIndex >= 0) {
        return `/storage/${normalized.slice(uploadsIndex + "uploads/".length)}`.replace(/\/+/g, "/");
    }
    if (!normalized.startsWith("/")) {
        normalized = `/${normalized}`;
    }
    return `/storage/${normalized.replace(/^\/+/, "")}`.replace(/\/+/g, "/");
}
function toAbsoluteStoragePath(storagePath) {
    const normalized = normalizeStoragePath(storagePath);
    if (!normalized) {
        return null;
    }
    return (0, path_1.join)(uploadsRoot, normalized.replace(/^\/storage\//, ""));
}
function safeDeleteStoragePath(storagePath) {
    const absolutePath = toAbsoluteStoragePath(storagePath);
    if (!absolutePath) {
        return;
    }
    if ((0, fs_1.existsSync)(absolutePath)) {
        try {
            (0, fs_1.unlinkSync)(absolutePath);
        }
        catch (_error) {
        }
    }
}
function deleteChapterFolderByImageUrl(imageUrl) {
    if (!imageUrl || !String(imageUrl).startsWith("/storage/chapters/")) {
        return;
    }
    try {
        const urlParts = String(imageUrl).split("/");
        const chaptersIndex = urlParts.indexOf("chapters");
        if (chaptersIndex < 0 || urlParts.length <= chaptersIndex + 1) {
            return;
        }
        const folderName = urlParts[chaptersIndex + 1];
        const chapterFolder = (0, path_1.join)(uploadsRoot, "chapters", folderName);
        if ((0, fs_1.existsSync)(chapterFolder)) {
            (0, fs_1.rmSync)(chapterFolder, { recursive: true, force: true });
        }
    }
    catch (_error) {
    }
}
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsRoot),
    filename: (_req, file, cb) => {
        const ext = (0, path_1.extname)(file.originalname);
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
});
const upload = multer({
    storage,
    limits: {
        fileSize: 1000 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        const imageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        const videoTypes = ["video/mp4", "video/avi", "video/mov", "video/mkv", "video/webm"];
        const contentTypes = [
            "text/plain",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/pdf",
            "application/epub+zip",
            "application/x-mobipocket-ebook",
        ];
        if (["videoFile", "episodeFiles"].includes(file.fieldname)) {
            return cb(null, videoTypes.includes(file.mimetype));
        }
        if (["coverImage", "avatar", "chapterImages"].includes(file.fieldname)) {
            return cb(null, imageTypes.includes(file.mimetype));
        }
        if (["contentFile", "contentFiles"].includes(file.fieldname)) {
            return cb(null, contentTypes.includes(file.mimetype));
        }
        return cb(null, true);
    },
});
exports.upload = upload;
