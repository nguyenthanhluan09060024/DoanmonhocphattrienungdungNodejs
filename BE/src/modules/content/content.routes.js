"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../database/db");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const multer_1 = __importDefault(require("multer")); // 👈 Bổ sung import Multer
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const roles_1 = require("../../constants/roles"); // Cần import ROLE_ID_MAP và Role
const authMiddleware_1 = require("../../middlewares/authMiddleware");
const slugify_1 = __importDefault(require("slugify"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const crawlService_1 = require("../../services/crawlService");
const socketService_1 = require("../../services/socketService");
const router = (0, express_1.Router)();
const normalizeStoragePath = (value) => {
    if (!value)
        return null;
    let normalized = String(value).trim();
    if (!normalized)
        return null;
    // Normalize Windows backslashes to forward slashes
    normalized = normalized.replace(/\\/g, "/");
    // Remove absolute Windows path prefix (C:\Users\...)
    normalized = normalized.replace(/^[A-Z]:\//i, "/");
    // Remove domain/URL prefix if present
    normalized = normalized.replace(/^https?:\/\/[^/]+/i, "");
    // Already a storage path - return as is
    if (normalized.startsWith("/storage/")) {
        return normalized;
    }
    // Extract anything after uploads/ regardless of prefix
    const uploadsIndex = normalized.indexOf("uploads/");
    if (uploadsIndex >= 0) {
        const relative = normalized.slice(uploadsIndex + "uploads/".length);
        return `/storage/${relative}`.replace(/\/+/g, "/"); // Remove duplicate slashes
    }
    // If path contains covers/ or chapters/, assume it's already relative to storage
    if (normalized.includes("covers/") || normalized.includes("chapters/")) {
        if (!normalized.startsWith("/")) {
            normalized = `/${normalized}`;
        }
        if (!normalized.startsWith("/storage/")) {
            normalized = `/storage/${normalized.replace(/^\/+/, "")}`;
        }
        return normalized.replace(/\/+/g, "/");
    }
    // Ensure it starts with /
    if (!normalized.startsWith("/")) {
        normalized = `/${normalized}`;
    }
    // Ensure final path always sits under /storage
    if (!normalized.startsWith("/storage/")) {
        const cleaned = normalized.replace(/^\/+/, "");
        normalized = `/storage/${cleaned}`;
    }
    return normalized.replace(/\/+/g, "/"); // Remove duplicate slashes
};
// ✅ FIX: Helper function để xóa thư mục chapter và tất cả file bên trong
const deleteChapterFolder = (imageUrl, uploadsRoot) => {
    try {
        if (imageUrl && imageUrl.startsWith("/storage/chapters/")) {
            // Extract folder path từ URL: /storage/chapters/folder-name/001.jpg
            const urlParts = imageUrl.split("/");
            const chaptersIndex = urlParts.indexOf("chapters");
            if (chaptersIndex >= 0 && urlParts.length > chaptersIndex + 1) {
                const folderName = urlParts[chaptersIndex + 1];
                const chapterFolder = path_1.default.join(uploadsRoot, "chapters", folderName);
                if (fs_1.default.existsSync(chapterFolder)) {
                    try {
                        // Xóa tất cả file trong thư mục
                        const files = fs_1.default.readdirSync(chapterFolder);
                        for (const file of files) {
                            const filePath = path_1.default.join(chapterFolder, file);
                            try {
                                if (fs_1.default.statSync(filePath).isFile()) {
                                    fs_1.default.unlinkSync(filePath);
                                }
                            }
                            catch (fileError) {
                                console.warn(`⚠️ Không thể xóa file ${filePath}:`, fileError);
                            }
                        }
                        // Xóa thư mục rỗng
                        fs_1.default.rmdirSync(chapterFolder);
                        console.log(`🗑️ Đã xóa thư mục chapter: ${chapterFolder}`);
                    }
                    catch (folderError) {
                        console.warn(`⚠️ Không thể xóa thư mục ${chapterFolder}:`, folderError);
                    }
                }
            }
        }
    }
    catch (error) {
        console.warn(`⚠️ Lỗi khi xóa thư mục chapter từ URL ${imageUrl}:`, error);
    }
};
// Định nghĩa nơi lưu trữ file tạm thời của Multer
const uploadsRoot = path_1.default.resolve(__dirname, "..", "..", "..", "uploads");
if (!fs_1.default.existsSync(uploadsRoot)) {
    try {
        fs_1.default.mkdirSync(uploadsRoot, { recursive: true });
    }
    catch (e) {
        console.error("Cannot create uploads folder:", e);
    }
}
// Cấu hình Multer để giữ lại file extension
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsRoot);
    },
    filename: (req, file, cb) => {
        // Tạo tên file với extension gốc
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const extension = path_1.default.extname(file.originalname);
        cb(null, uniqueSuffix + extension);
    },
});
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 1000 * 1024 * 1024, // 1GB limit
    },
    fileFilter: (req, file, cb) => {
        console.log(`🔍 File filter: fieldname=${file.fieldname}, mimetype=${file.mimetype}, originalname=${file.originalname}`);
        // Chỉ cho phép video, image và content files
        if (file.fieldname === "videoFile" || file.fieldname === "episodeFiles") {
            const allowedTypes = [
                "video/mp4",
                "video/avi",
                "video/mov",
                "video/mkv",
                "video/webm",
            ];
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            }
            else {
                console.error(`❌ Invalid video file type: ${file.mimetype}`);
                cb(new Error("Invalid video file type"), false);
            }
        }
        else if (file.fieldname === "coverImage") {
            const allowedTypes = [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp",
            ];
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            }
            else {
                console.error(`❌ Invalid image file type: ${file.mimetype}`);
                cb(new Error("Invalid image file type"), false);
            }
        }
        else if (file.fieldname === "contentFile") {
            const allowedTypes = [
                "text/plain",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/pdf",
                "application/epub+zip",
                "application/x-mobipocket-ebook",
            ];
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            }
            else {
                console.error(`❌ Invalid content file type: ${file.mimetype}`);
                cb(new Error("Invalid content file type"), false);
            }
        }
        else if (file.fieldname === "chapterImages") {
            // Hỗ trợ upload nhiều ảnh cho truyện tranh
            const allowedTypes = [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp",
            ];
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            }
            else {
                console.error(`❌ Invalid chapter image type: ${file.mimetype}`);
                cb(new Error("Invalid chapter image type"), false);
            }
        }
        else {
            cb(null, true);
        }
    },
});
// Chức năng xác thực: Lấy Role từ DB dựa trên RoleID của User
const authenticate = async (req, res, next) => {
    // Lấy email từ header 'x-user-email' (tạm thời)
    const userEmail = String(req.header("x-user-email") || "").trim();
    if (!userEmail) {
        return res.status(401).json({ message: "Chưa xác thực." });
    }
    try {
        // 1. Truy vấn DB để lấy UserID và RoleID
        const userRes = await (0, db_1.query) `
        SELECT TOP 1 UserID, Email, RoleID 
        FROM dbo.Users 
        WHERE Email = ${userEmail}
    `;
        const userRow = userRes.recordset[0];
        if (!userRow) {
            return res.status(401).json({ error: "Người dùng không tồn tại." });
        }
        // 2. Mapping RoleID (ví dụ: 6) sang RoleName (chuỗi: 'Admin')
        const roleString = roles_1.ROLE_ID_MAP[userRow.RoleID] || "Viewer";
        // 3. Đính kèm thông tin user vào Request
        req.user = {
            id: userRow.UserID.toString(), // Chuyển sang string cho thống nhất
            UserID: userRow.UserID,
            email: userRow.Email,
            role: roleString,
            RoleName: roleString,
            RoleID: userRow.RoleID,
        };
        next(); // Cho phép đi tiếp
    }
    catch (e) {
        console.error("Authentication DB error:", e);
        return res
            .status(500)
            .json({ error: "Lỗi hệ thống trong quá trình xác thực." });
    }
};
// --- CÁC ROUTE CÓ PHÂN QUYỀN (ADMIN/UPLOADER) ---
// 4. ROUTE UPLOAD NỘI DUNG (Phim/Truyện)
// ============================================
// ADMIN UPLOAD - CHỈ DÀNH CHO ADMIN
// Auto approve, IsApproved=1, ApprovedBy=Admin UserID
// ============================================
router.post("/admin/movies", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), // CHỈ Admin mới được upload qua route này
(0, authMiddleware_1.authorize)(["create:content"]), upload.fields([
    { name: "episodeFiles", maxCount: 50 }, // Cho phép upload tối đa 50 tập
    { name: "coverImage", maxCount: 1 },
]), async (req, res) => {
    if (!req.user) {
        return res
            .status(401)
            .json({ message: "Người dùng chưa được xác thực." });
    }
    // Lấy dữ liệu từ body và file
    const { title, description, categoryId, releaseYear, duration, country, director, cast, isFree, episodes, // JSON string chứa thông tin các tập: [{episodeNumber, title, duration}]
     } = req.body;
    const episodeFiles = req.files && req.files["episodeFiles"] ? req.files["episodeFiles"] : [];
    const coverImage = req.files && req.files["coverImage"]
        ? req.files["coverImage"][0]
        : undefined;
    // ✅ FIX: Hỗ trợ posterLocal từ crawl (đã tải về server)
    // Multer parse text fields vào req.body, nhưng có thể là string hoặc undefined
    const posterLocal = req.body?.posterLocal || req.body?.posterLocal?.[0] || null;
    console.log(`🔍 [POSTER] req.body keys:`, Object.keys(req.body || {}));
    console.log(`🔍 [POSTER] req.body.posterLocal raw:`, req.body?.posterLocal);
    // QUAN TRỌNG: Chỉ xử lý nếu có episodeFiles (nhiều tập phim)
    // Nếu không có episodeFiles, trả về lỗi để tránh tạo phim không có tập
    if (!episodeFiles || episodeFiles.length === 0) {
        return res.status(400).json({
            error: "Vui lòng upload ít nhất một tập phim. Route này chỉ hỗ trợ upload nhiều tập phim.",
        });
    }
    // ✅ FIX: Validate: Phải có cover image (file upload) HOẶC posterLocal (từ crawl)
    if (!coverImage && !posterLocal) {
        return res.status(400).json({ error: "Cover image is required (upload file or crawl with poster)" });
    }
    // ✅ FIX: Xác định PosterURL - ưu tiên posterLocal từ crawl, fallback file upload
    // Nếu có cả 2, chỉ dùng posterLocal (từ crawl)
    const timestamp = Date.now();
    let posterUrl = null;
    if (posterLocal) {
        console.log(`🔍 [POSTER] posterLocal nhận được: ${posterLocal}`);
        posterUrl = normalizeStoragePath(posterLocal);
        console.log(`🔍 [POSTER] posterUrl sau normalize: ${posterUrl}`);
    }
    else if (coverImage) {
        posterUrl = `/storage/${coverImage.filename}`;
    }
    if (!posterUrl) {
        console.warn(`⚠️ [POSTER] posterUrl là null! posterLocal=${posterLocal}, coverImage=${!!coverImage}`);
    }
    // Debug log
    console.log("🔍 Upload debug:", {
        title,
        episodeFilesCount: episodeFiles.length,
        coverImage: coverImage
            ? { name: coverImage.filename, size: coverImage.size }
            : null,
        posterLocal: posterLocal || null, // ✅ FIX: Log posterLocal để debug
        posterUrl,
        episodes: episodes,
    });
    // Check if at least one category is provided
    const categoryIds = req.body.categoryIds || (categoryId ? [categoryId] : []);
    const categoryIdsArray = Array.isArray(categoryIds)
        ? categoryIds.map((id) => Number(id))
        : typeof categoryIds === "string"
            ? [Number(categoryIds)]
            : categoryId
                ? [Number(categoryId)]
                : [];
    if (!title || categoryIdsArray.length === 0) {
        return res.status(400).json({ error: "Thiếu Tiêu đề hoặc Thể loại." });
    }
    if (episodeFiles.length === 0) {
        return res
            .status(400)
            .json({ error: "Vui lòng upload ít nhất một tập phim." });
    }
    try {
        // Admin upload - LUÔN auto approve
        const status = "Approved";
        const isApproved = 1; // Admin upload luôn được approve
        const approvedBy = req.user.UserID; // Admin tự approve
        // Parse episodes data nếu có
        let episodesData = [];
        if (episodes) {
            try {
                episodesData = JSON.parse(episodes);
            }
            catch (e) {
                console.warn("Không thể parse episodes data, sử dụng mặc định");
            }
        }
        // Tạo slug và kiểm tra trùng lặp
        const baseSlug = (0, slugify_1.default)(title, { lower: true, strict: true });
        let finalSlug = baseSlug;
        let attempt = 1;
        // Kiểm tra slug trùng lặp
        while (true) {
            const exists = await (0, db_1.query) `
          SELECT COUNT(*) AS cnt FROM dbo.Movies WHERE Slug = ${finalSlug}
        `;
            if (exists.recordset[0].cnt === 0) {
                break; // Slug không trùng, sử dụng
            }
            finalSlug = `${baseSlug}-${attempt}`;
            attempt++;
            if (attempt > 100) {
                // Tránh vòng lặp vô hạn
                finalSlug = `${baseSlug}-${Date.now()}`;
                break;
            }
        }
        const movieResult = await (0, db_1.query) `
        INSERT INTO dbo.Movies (
         Title, Slug, Description, PosterURL, ReleaseYear, Duration, Country, Director, Cast, Status, IsFree, ViewCount, Rating, UploaderID, IsApproved, ApprovedBy, ApprovedAt, CreatedAt, UpdatedAt
        )
        OUTPUT INSERTED.MovieID
        VALUES (
          ${title}, ${finalSlug}, ${description || ""}, ${posterUrl}, ${Number(releaseYear) || null}, ${Number(duration) || null}, ${country || ""}, ${director || ""}, ${cast || ""}, ${status}, ${isFree === "true" || isFree === true ? 1 : 0}, 0, 0, ${Number(req.user.UserID)}, ${isApproved}, ${approvedBy}, GETDATE(), GETDATE(), GETDATE()
        )
      `;
        const movieId = movieResult.recordset[0].MovieID;
        console.log("✅ Đã tạo 1 bản ghi Movies:", {
            movieId,
            title,
            slug: finalSlug,
            status,
        });
        // Thêm liên kết phim-thể loại (hỗ trợ nhiều categories)
        const categoryIds = req.body.categoryIds || (categoryId ? [categoryId] : []);
        // Nếu categoryIds là string (từ FormData), parse nó
        const categoryIdsArray = Array.isArray(categoryIds)
            ? categoryIds.map((id) => Number(id))
            : typeof categoryIds === "string"
                ? [Number(categoryIds)]
                : categoryId
                    ? [Number(categoryId)]
                    : [];
        if (categoryIdsArray.length > 0) {
            for (const catId of categoryIdsArray) {
                if (catId && !isNaN(catId)) {
                    await (0, db_1.query) `
              INSERT INTO MovieCategories (MovieID, CategoryID)
              VALUES (${movieId}, ${catId})
            `;
                }
            }
        }
        // Tạo các tập phim từ danh sách file
        console.log("📹 Bắt đầu tạo các tập phim:", {
            movieId,
            episodeFilesCount: episodeFiles.length,
            episodesDataCount: episodesData.length,
        });
        for (let i = 0; i < episodeFiles.length; i++) {
            const videoFile = episodeFiles[i];
            const episodeNumber = i + 1;
            // Tìm thông tin tập phim tương ứng (nếu có)
            const episodeInfo = episodesData.find((ep) => ep.episodeNumber === episodeNumber || ep.index === i) || {};
            const episodeTitle = episodeInfo.title || `Tập ${episodeNumber}`;
            const episodeDuration = episodeInfo.duration || Number(duration) || 120;
            const videoFileName = `/uploads/${videoFile.filename}`;
            // Tạo mã tập phim: EP{MovieID}-{EpisodeNumber}
            const episodeCode = `EP${movieId}-${String(episodeNumber).padStart(3, "0")}`;
            try {
                // Kiểm tra xem cột EpisodeCode có tồn tại không
                // Nếu có thì insert với EpisodeCode, nếu không thì bỏ qua
                const checkColumn = await (0, db_1.query) `
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'MovieEpisodes' AND COLUMN_NAME = 'EpisodeCode'
          `;
                const hasEpisodeCode = checkColumn.recordset.length > 0;
                if (hasEpisodeCode) {
                    // Bảng có cột EpisodeCode
                    await (0, db_1.query) `
              INSERT INTO dbo.MovieEpisodes (MovieID, EpisodeNumber, Title, VideoURL, Duration, EpisodeCode, IsFree, ViewCount, CreatedAt)
              VALUES (${movieId}, ${episodeNumber}, ${episodeTitle}, ${videoFileName}, ${episodeDuration}, ${episodeCode}, ${isFree === "true" || isFree === true ? 1 : 0}, 0, GETDATE())
            `;
                }
                else {
                    // Bảng chưa có cột EpisodeCode, insert không có EpisodeCode
                    await (0, db_1.query) `
              INSERT INTO dbo.MovieEpisodes (MovieID, EpisodeNumber, Title, VideoURL, Duration, IsFree, ViewCount, CreatedAt)
              VALUES (${movieId}, ${episodeNumber}, ${episodeTitle}, ${videoFileName}, ${episodeDuration}, ${isFree === "true" || isFree === true ? 1 : 0}, 0, GETDATE())
            `;
                }
                console.log(`✅ Đã tạo tập ${episodeNumber}:`, {
                    episodeCode: hasEpisodeCode ? episodeCode : "N/A",
                    title: episodeTitle,
                    videoFile: videoFile.filename,
                });
            }
            catch (episodeError) {
                console.error(`❌ Lỗi khi tạo tập ${episodeNumber}:`, episodeError);
            }
        }
        // TODO: Xóa file tạm thời Multer sau khi lưu thành công
        res.status(201).json({
            success: true,
            message: `[ADMIN] Phim đã được đăng tải và tự động duyệt với ${episodeFiles.length} tập.`,
            movieId,
            episodeCount: episodeFiles.length,
            title,
            uploader: req.user.email,
            uploaderRole: req.user.RoleName,
            isApproved: true,
        });
        console.log("✅ [ADMIN UPLOAD] Phim đã được thêm vào DB:", {
            title,
            status,
            episodeCount: episodeFiles.length,
            uploaderID: req.user.UserID,
            uploaderRole: req.user.RoleName,
            isApproved: true,
        });
    }
    catch (e) {
        console.error("Lỗi khi thêm Movie vào DB:", e);
        return res
            .status(500)
            .json({ error: "Lỗi hệ thống khi lưu trữ nội dung." });
    }
});
// Get user's own movies (cho phép tất cả user xem phim của mình, kể cả Viewer)
router.get("/user/movies", authenticate, (0, authMiddleware_1.authorize)(["read:content"]), async (req, res) => {
    try {
        if (!req.user?.UserID) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Lấy danh sách movies (không có categories để tránh duplicate)
        const moviesResult = await (0, db_1.query) `
        SELECT DISTINCT m.*, u.FullName as UploaderName, r.RoleName as UploaderRole
        FROM Movies m
        LEFT JOIN Users u ON m.UploaderID = u.UserID
        LEFT JOIN Roles r ON u.RoleID = r.RoleID
        WHERE m.UploaderID = ${req.user.UserID}
        ORDER BY m.CreatedAt DESC
      `;
        const movies = moviesResult.recordset;
        // Lấy categories cho từng movie
        for (const movie of movies) {
            const categoriesResult = await (0, db_1.query) `
          SELECT c.CategoryID, c.CategoryName
          FROM MovieCategories mc
          INNER JOIN Categories c ON mc.CategoryID = c.CategoryID
          WHERE mc.MovieID = ${movie.MovieID}
        `;
            movie.Categories = categoriesResult.recordset;
            // Giữ CategoryName cho backward compatibility (lấy category đầu tiên)
            movie.CategoryName =
                categoriesResult.recordset.length > 0
                    ? categoriesResult.recordset[0].CategoryName
                    : null;
        }
        res.json(movies);
    }
    catch (e) {
        console.error("GET /user/movies error:", e);
        res.status(500).json({ error: "Failed to list user movies" });
    }
});
// NOTE: Route POST /admin/movies cũ đã được thay thế bằng route ở trên (dòng 165)
// Route cũ này đã bị xóa vì không hỗ trợ nhiều tập phim
// Tất cả upload phim bây giờ phải sử dụng route ở trên với episodeFiles
// ============================================
// USER UPLOAD - DÀNH CHO USER (Uploader, Author, Translator, Reup)
// KHÔNG cho phép Admin upload qua route này
// Luôn Pending, IsApproved=0, cần Admin duyệt
// ============================================
router.post("/user/movies", authenticate, (0, authMiddleware_1.requireRoles)(["Uploader", "Author", "Translator", "Reup"]), // CHỈ User roles, KHÔNG có Admin
(0, authMiddleware_1.authorize)(["create:content"]), upload.fields([
    { name: "episodeFiles", maxCount: 50 }, // Cho phép upload tối đa 50 tập
    { name: "coverImage", maxCount: 1 },
]), async (req, res) => {
    try {
        const { title, description, categoryId, releaseYear, duration, country, director, cast, isFree, episodes, // JSON string chứa thông tin các tập
         } = req.body;
        // Hỗ trợ nhiều categories (giống route /admin/movies)
        const categoryIds = req.body.categoryIds || (categoryId ? [categoryId] : []);
        // Nếu categoryIds là string (từ FormData), parse nó
        const categoryIdsArray = Array.isArray(categoryIds)
            ? categoryIds.map((id) => Number(id))
            : typeof categoryIds === "string"
                ? [Number(categoryIds)]
                : categoryId
                    ? [Number(categoryId)]
                    : [];
        if (!title || categoryIdsArray.length === 0) {
            return res
                .status(400)
                .json({ error: "Title and category are required" });
        }
        const episodeFiles = req.files && req.files["episodeFiles"] ? req.files["episodeFiles"] : [];
        const coverImage = req.files?.["coverImage"]?.[0];
        if (episodeFiles.length === 0) {
            return res
                .status(400)
                .json({ error: "Vui lòng upload ít nhất một tập phim." });
        }
        // Generate slug
        const slug = (0, slugify_1.default)(title, { lower: true, strict: true });
        // Parse episodes data nếu có
        let episodesData = [];
        if (episodes) {
            try {
                episodesData = JSON.parse(episodes);
            }
            catch (e) {
                console.warn("Không thể parse episodes data, sử dụng mặc định");
            }
        }
        // User upload - LUÔN Pending, cần Admin duyệt
        const isApproved = 0; // User upload cần được duyệt
        const approvedBy = null; // Chưa được duyệt
        // Insert movie
        const result = await (0, db_1.query) `
        INSERT INTO Movies (Title, Slug, Description, PosterURL, ReleaseYear, Duration, Country, Director, Cast, IsFree, Status, UploaderID, IsApproved, ApprovedBy, ApprovedAt, CreatedAt, UpdatedAt)
        VALUES (${title}, ${slug}, ${description || ""}, ${coverImage ? `/uploads/${coverImage.filename}` : null}, ${releaseYear || null}, ${duration || null}, ${country || ""}, ${director || ""}, ${cast || ""}, ${isFree === "true" || isFree === true ? 1 : 0}, 'Pending', ${req.user.UserID}, ${isApproved}, ${approvedBy}, NULL, GETDATE(), GETDATE())
        SELECT SCOPE_IDENTITY() as MovieID
      `;
        const movieId = result.recordset[0].MovieID;
        // Insert movie categories (hỗ trợ nhiều categories)
        if (categoryIdsArray.length > 0) {
            for (const catId of categoryIdsArray) {
                if (catId && !isNaN(catId)) {
                    await (0, db_1.query) `
              INSERT INTO MovieCategories (MovieID, CategoryID)
              VALUES (${movieId}, ${catId})
            `;
                }
            }
        }
        // Tạo các tập phim
        for (let i = 0; i < episodeFiles.length; i++) {
            const videoFile = episodeFiles[i];
            const episodeNumber = i + 1;
            const episodeInfo = episodesData.find((ep) => ep.episodeNumber === episodeNumber || ep.index === i) || {};
            const episodeTitle = episodeInfo.title || `Tập ${episodeNumber}`;
            const episodeDuration = episodeInfo.duration || Number(duration) || 120;
            const videoFileName = `/uploads/${videoFile.filename}`;
            const episodeCode = `EP${movieId}-${String(episodeNumber).padStart(3, "0")}`;
            try {
                // Kiểm tra xem cột EpisodeCode có tồn tại không
                const checkColumn = await (0, db_1.query) `
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'MovieEpisodes' AND COLUMN_NAME = 'EpisodeCode'
          `;
                const hasEpisodeCode = checkColumn.recordset.length > 0;
                if (hasEpisodeCode) {
                    await (0, db_1.query) `
              INSERT INTO dbo.MovieEpisodes (MovieID, EpisodeNumber, Title, VideoURL, Duration, EpisodeCode, IsFree, ViewCount, CreatedAt)
              VALUES (${movieId}, ${episodeNumber}, ${episodeTitle}, ${videoFileName}, ${episodeDuration}, ${episodeCode}, ${isFree === "true" || isFree === true ? 1 : 0}, 0, GETDATE())
            `;
                }
                else {
                    await (0, db_1.query) `
              INSERT INTO dbo.MovieEpisodes (MovieID, EpisodeNumber, Title, VideoURL, Duration, IsFree, ViewCount, CreatedAt)
              VALUES (${movieId}, ${episodeNumber}, ${episodeTitle}, ${videoFileName}, ${episodeDuration}, ${isFree === "true" || isFree === true ? 1 : 0}, 0, GETDATE())
            `;
                }
            }
            catch (episodeError) {
                console.error(`❌ Lỗi khi tạo tập ${episodeNumber}:`, episodeError);
            }
        }
        // Tạo thông báo cho tất cả Admin khi user upload phim
        try {
            const adminUsers = await (0, db_1.query) `
          SELECT u.UserID, u.Email
          FROM Users u
          INNER JOIN Roles r ON u.RoleID = r.RoleID
          WHERE r.RoleName = 'Admin' AND u.IsActive = 1
        `;
            for (const admin of adminUsers.recordset) {
                await (0, db_1.query) `
            INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead, CreatedAt)
            VALUES (
              ${admin.UserID},
              'NewContent',
              N'Phim mới cần duyệt',
              N'${req.user.email} đã upload phim "${title}" và đang chờ duyệt',
              N'/admin/movies',
              0,
              GETDATE()
            )
          `;
            }
            console.log(`✅ Đã tạo thông báo cho ${adminUsers.recordset.length} Admin về phim mới`);
        }
        catch (notifError) {
            console.error("❌ Lỗi khi tạo thông báo cho Admin:", notifError);
        }
        res.json({
            success: true,
            movieId,
            episodeCount: episodeFiles.length,
            message: "[USER] Phim đã được upload và đang chờ Admin duyệt",
            uploader: req.user.email,
            uploaderRole: req.user.RoleName,
            isApproved: false,
            status: "Pending",
        });
        console.log("📤 [USER UPLOAD] Phim đã được upload (chờ duyệt):", {
            title,
            movieId,
            episodeCount: episodeFiles.length,
            uploaderID: req.user.UserID,
            uploaderRole: req.user.RoleName,
            isApproved: false,
        });
    }
    catch (e) {
        console.error("POST /user/movies error:", e);
        res.status(500).json({ error: "Failed to upload movie" });
    }
});
// Admin list movies (management) - Hiển thị thông tin uploader
router.get("/admin/movies", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        // Lấy query params để filter theo uploader nếu có
        const uploaderId = req.query.uploaderId
            ? Number(req.query.uploaderId)
            : null;
        const uploaderRole = req.query.uploaderRole;
        let queryStr = `
        SELECT TOP 200 
          m.MovieID, 
          m.Title, 
          m.Slug, 
          m.PosterURL, 
          m.Status, 
          m.ReleaseYear, 
          m.Duration, 
          m.Country, 
          m.Director, 
          m.Cast, 
          m.IsFree, 
          m.IsApproved,
          m.CreatedAt,
          m.UploaderID,
          u.Username as UploaderUsername,
          u.Email as UploaderEmail,
          u.FullName as UploaderName,
          r.RoleName as UploaderRole,
          m.ApprovedBy,
          approver.Username as ApproverUsername,
          approver.Email as ApproverEmail
        FROM Movies m
        LEFT JOIN Users u ON m.UploaderID = u.UserID
        LEFT JOIN Roles r ON u.RoleID = r.RoleID
        LEFT JOIN Users approver ON m.ApprovedBy = approver.UserID
        WHERE 1=1
      `;
        const params = [];
        if (uploaderId) {
            queryStr += ` AND m.UploaderID = @p${params.length}`;
            params.push(uploaderId);
        }
        if (uploaderRole) {
            queryStr += ` AND r.RoleName = @p${params.length}`;
            params.push(uploaderRole);
        }
        queryStr += ` ORDER BY m.CreatedAt DESC`;
        // Sử dụng query template với params
        let finalQuery;
        if (params.length > 0) {
            finalQuery = (0, db_1.query) `${queryStr}`;
            // Thay thế params
            for (let i = 0; i < params.length; i++) {
                queryStr = queryStr.replace(`@p${i}`, params[i]);
            }
            // Sử dụng raw query với params
            const pool = await Promise.resolve().then(() => __importStar(require("../database/db"))).then((m) => m.getPool());
            const request = (await pool).request();
            params.forEach((p, i) => {
                request.input(`p${i}`, p);
            });
            const result = await request.query(queryStr.replace(/@p\d+/g, (match) => {
                const idx = parseInt(match.replace("@p", ""));
                return `@p${idx}`;
            }));
            res.json(result.recordset);
        }
        else {
            const rows = await (0, db_1.query) `
          SELECT TOP 200 
            m.MovieID, 
            m.Title, 
            m.Slug, 
            m.PosterURL, 
            m.Status, 
            m.ReleaseYear, 
            m.Duration, 
            m.Country, 
            m.Director, 
            m.Cast, 
            m.IsFree, 
            m.IsApproved,
            m.CreatedAt,
            m.UploaderID,
            u.Username as UploaderUsername,
            u.Email as UploaderEmail,
            u.FullName as UploaderName,
            r.RoleName as UploaderRole,
            m.ApprovedBy,
            approver.Username as ApproverUsername,
            approver.Email as ApproverEmail
          FROM Movies m
          LEFT JOIN Users u ON m.UploaderID = u.UserID
          LEFT JOIN Roles r ON u.RoleID = r.RoleID
          LEFT JOIN Users approver ON m.ApprovedBy = approver.UserID
          ORDER BY m.CreatedAt DESC
        `;
            res.json(rows.recordset);
        }
    }
    catch (e) {
        console.error("GET /admin/movies error:", e);
        res.status(500).json({ error: "Failed to list movies" });
    }
});
// Tra cứu phim theo uploader (Admin only)
router.get("/admin/movies/by-uploader", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["read:content"]), async (req, res) => {
    try {
        const uploaderId = req.query.uploaderId
            ? Number(req.query.uploaderId)
            : null;
        const uploaderEmail = req.query.uploaderEmail;
        const uploaderRole = req.query.uploaderRole;
        if (!uploaderId && !uploaderEmail && !uploaderRole) {
            return res.status(400).json({
                error: "Cần cung cấp uploaderId, uploaderEmail hoặc uploaderRole để tra cứu",
            });
        }
        let rows;
        if (uploaderId) {
            rows = await (0, db_1.query) `
          SELECT 
            m.MovieID, 
            m.Title, 
            m.Slug, 
            m.PosterURL, 
            m.Status, 
            m.IsApproved,
            m.IsFree,
            m.CreatedAt,
            m.UploaderID,
            u.Username as UploaderUsername,
            u.Email as UploaderEmail,
            u.FullName as UploaderName,
            r.RoleName as UploaderRole,
            COUNT(me.EpisodeID) as EpisodeCount,
            m.ApprovedBy,
            approver.Username as ApproverUsername,
            approver.Email as ApproverEmail,
            m.ApprovedAt
          FROM Movies m
          LEFT JOIN Users u ON m.UploaderID = u.UserID
          LEFT JOIN Roles r ON u.RoleID = r.RoleID
          LEFT JOIN Users approver ON m.ApprovedBy = approver.UserID
          LEFT JOIN MovieEpisodes me ON m.MovieID = me.MovieID
          WHERE m.UploaderID = ${uploaderId}
          GROUP BY m.MovieID, m.Title, m.Slug, m.PosterURL, m.Status, m.IsApproved, m.IsFree, 
                   m.CreatedAt, m.UploaderID, u.Username, u.Email, u.FullName, r.RoleName, 
                   m.ApprovedBy, approver.Username, approver.Email, m.ApprovedAt
          ORDER BY m.CreatedAt DESC
        `;
        }
        else if (uploaderEmail) {
            rows = await (0, db_1.query) `
          SELECT 
            m.MovieID, 
            m.Title, 
            m.Slug, 
            m.PosterURL, 
            m.Status, 
            m.IsApproved,
            m.IsFree,
            m.CreatedAt,
            m.UploaderID,
            u.Username as UploaderUsername,
            u.Email as UploaderEmail,
            u.FullName as UploaderName,
            r.RoleName as UploaderRole,
            COUNT(me.EpisodeID) as EpisodeCount,
            m.ApprovedBy,
            approver.Username as ApproverUsername,
            approver.Email as ApproverEmail,
            m.ApprovedAt
          FROM Movies m
          LEFT JOIN Users u ON m.UploaderID = u.UserID
          LEFT JOIN Roles r ON u.RoleID = r.RoleID
          LEFT JOIN Users approver ON m.ApprovedBy = approver.UserID
          LEFT JOIN MovieEpisodes me ON m.MovieID = me.MovieID
          WHERE u.Email = ${uploaderEmail}
          GROUP BY m.MovieID, m.Title, m.Slug, m.PosterURL, m.Status, m.IsApproved, m.IsFree, 
                   m.CreatedAt, m.UploaderID, u.Username, u.Email, u.FullName, r.RoleName, 
                   m.ApprovedBy, approver.Username, approver.Email, m.ApprovedAt
          ORDER BY m.CreatedAt DESC
        `;
        }
        else if (uploaderRole) {
            rows = await (0, db_1.query) `
          SELECT 
            m.MovieID, 
            m.Title, 
            m.Slug, 
            m.PosterURL, 
            m.Status, 
            m.IsApproved,
            m.IsFree,
            m.CreatedAt,
            m.UploaderID,
            u.Username as UploaderUsername,
            u.Email as UploaderEmail,
            u.FullName as UploaderName,
            r.RoleName as UploaderRole,
            COUNT(me.EpisodeID) as EpisodeCount,
            m.ApprovedBy,
            approver.Username as ApproverUsername,
            approver.Email as ApproverEmail,
            m.ApprovedAt
          FROM Movies m
          LEFT JOIN Users u ON m.UploaderID = u.UserID
          LEFT JOIN Roles r ON u.RoleID = r.RoleID
          LEFT JOIN Users approver ON m.ApprovedBy = approver.UserID
          LEFT JOIN MovieEpisodes me ON m.MovieID = me.MovieID
          WHERE r.RoleName = ${uploaderRole}
          GROUP BY m.MovieID, m.Title, m.Slug, m.PosterURL, m.Status, m.IsApproved, m.IsFree, 
                   m.CreatedAt, m.UploaderID, u.Username, u.Email, u.FullName, r.RoleName, 
                   m.ApprovedBy, approver.Username, approver.Email, m.ApprovedAt
          ORDER BY m.CreatedAt DESC
        `;
        }
        else {
            return res.status(400).json({ error: "Invalid query parameters" });
        }
        res.json({
            success: true,
            count: rows.recordset.length,
            movies: rows.recordset,
        });
    }
    catch (e) {
        console.error("GET /admin/movies/by-uploader error:", e);
        res.status(500).json({ error: "Failed to search movies by uploader" });
    }
});
// User update own movie
router.put("/user/movies/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["edit:own_content"]), upload.fields([
    { name: "videoFile", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
]), async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        if (!movieId)
            return res.status(400).json({ error: "Invalid id" });
        // Kiểm tra user có quyền edit video này không
        const movieCheck = await (0, db_1.query) `
        SELECT UploaderID FROM Movies WHERE MovieID = ${movieId}
      `;
        if (movieCheck.recordset.length === 0) {
            return res.status(404).json({ error: "Movie not found" });
        }
        // Chỉ cho phép user edit video của chính họ (trừ Admin)
        if (req.user?.RoleName !== "Admin" &&
            movieCheck.recordset[0].UploaderID !== req.user?.UserID) {
            return res
                .status(403)
                .json({ error: "You can only edit your own videos" });
        }
        const { title, description, status, isFree } = req.body;
        const videoFile = req.files && req.files["videoFile"]
            ? req.files["videoFile"][0]
            : undefined;
        const coverImage = req.files && req.files["coverImage"]
            ? req.files["coverImage"][0]
            : undefined;
        // Lấy thông tin file cũ trước khi cập nhật
        const oldMovieInfo = await (0, db_1.query) `
        SELECT PosterURL, TrailerURL FROM Movies WHERE MovieID = ${movieId}
      `;
        const oldMovie = oldMovieInfo.recordset[0];
        // Cập nhật thông tin phim
        if (typeof title !== "undefined") {
            // Tạo slug và kiểm tra trùng lặp
            const baseSlug = (0, slugify_1.default)(title, { lower: true, strict: true });
            let finalSlug = baseSlug;
            let attempt = 1;
            // Kiểm tra slug trùng lặp (trừ phim hiện tại)
            while (true) {
                const exists = await (0, db_1.query) `
            SELECT COUNT(*) AS cnt FROM dbo.Movies 
            WHERE Slug = ${finalSlug} AND MovieID <> ${movieId}
          `;
                if (exists.recordset[0].cnt === 0) {
                    break; // Slug không trùng, sử dụng
                }
                finalSlug = `${baseSlug}-${attempt}`;
                attempt++;
                if (attempt > 100) {
                    // Tránh vòng lặp vô hạn
                    finalSlug = `${baseSlug}-${Date.now()}`;
                    break;
                }
            }
            await (0, db_1.query) `UPDATE dbo.Movies SET Title = ${title}, Slug = ${finalSlug} WHERE MovieID = ${movieId}`;
        }
        if (typeof description !== "undefined") {
            await (0, db_1.query) `UPDATE dbo.Movies SET Description = ${description} WHERE MovieID = ${movieId}`;
        }
        if (typeof status !== "undefined") {
            await (0, db_1.query) `UPDATE dbo.Movies SET Status = ${status} WHERE MovieID = ${movieId}`;
        }
        if (typeof isFree !== "undefined") {
            await (0, db_1.query) `UPDATE dbo.Movies SET IsFree = ${isFree ? 1 : 0} WHERE MovieID = ${movieId}`;
        }
        // Update categories if provided
        if (req.body.categoryIds !== undefined) {
            // Xóa tất cả categories cũ
            await (0, db_1.query) `DELETE FROM MovieCategories WHERE MovieID = ${movieId}`;
            // Thêm categories mới
            const categoryIds = req.body.categoryIds;
            const categoryIdsArray = Array.isArray(categoryIds)
                ? categoryIds.map((id) => Number(id))
                : typeof categoryIds === "string"
                    ? [Number(categoryIds)]
                    : [];
            if (categoryIdsArray.length > 0) {
                for (const catId of categoryIdsArray) {
                    if (catId && !isNaN(catId)) {
                        await (0, db_1.query) `
                INSERT INTO MovieCategories (MovieID, CategoryID)
                VALUES (${movieId}, ${catId})
              `;
                    }
                }
                console.log(`✅ Đã cập nhật ${categoryIdsArray.length} categories cho movie ID: ${movieId}`);
            }
        }
        // Nếu user edit video (không phải admin), chuyển status về Pending để admin duyệt lại
        if (req.user?.RoleName !== "Admin" &&
            (title ||
                description ||
                isFree !== undefined ||
                coverImage ||
                videoFile ||
                req.body.categoryIds !== undefined)) {
            await (0, db_1.query) `UPDATE dbo.Movies SET Status = 'Pending' WHERE MovieID = ${movieId}`;
            console.log(`🔄 User edited video ${movieId}, status changed to Pending for admin review`);
            // Tạo thông báo cho tất cả Admin khi user sửa phim
            try {
                const movieInfo = await (0, db_1.query) `
            SELECT Title FROM Movies WHERE MovieID = ${movieId}
          `;
                const movieTitle = movieInfo.recordset[0]?.Title || "Phim";
                const adminUsers = await (0, db_1.query) `
            SELECT u.UserID, u.Email
            FROM Users u
            INNER JOIN Roles r ON u.RoleID = r.RoleID
            WHERE r.RoleName = 'Admin' AND u.IsActive = 1
          `;
                for (const admin of adminUsers.recordset) {
                    await (0, db_1.query) `
              INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead, CreatedAt)
              VALUES (
                ${admin.UserID},
                'ContentUpdated',
                N'Phim đã được sửa đổi',
                N'${req.user.email} đã sửa phim "${movieTitle}" và đang chờ duyệt lại',
                N'/admin/movies',
                0,
                GETDATE()
              )
            `;
                }
                console.log(`✅ Đã tạo thông báo cho ${adminUsers.recordset.length} Admin về việc user sửa phim`);
            }
            catch (notifError) {
                console.error("❌ Lỗi khi tạo thông báo về việc sửa phim:", notifError);
            }
        }
        // Xử lý file mới
        if (coverImage) {
            const timestamp = Date.now();
            const newPosterUrl = `/storage/${coverImage.filename}?v=${timestamp}`;
            await (0, db_1.query) `UPDATE dbo.Movies SET PosterURL = ${newPosterUrl} WHERE MovieID = ${movieId}`;
            console.log(`🖼️ Cập nhật ảnh bìa mới: ${coverImage.filename}`);
            console.log(`📁 New poster URL: ${newPosterUrl}`);
            // Xóa file poster cũ
            if (oldMovie && oldMovie.PosterURL) {
                const oldPosterFileName = oldMovie.PosterURL.replace("/storage/", "").split("?")[0];
                const oldPosterPath = path_1.default.join(uploadsRoot, oldPosterFileName);
                if (fs_1.default.existsSync(oldPosterPath) &&
                    oldPosterFileName !== coverImage.filename) {
                    try {
                        fs_1.default.unlinkSync(oldPosterPath);
                        console.log(`🗑️ Đã xóa ảnh bìa cũ: ${oldPosterPath}`);
                    }
                    catch (deleteError) {
                        console.log(`⚠️ Không thể xóa ảnh bìa cũ: ${deleteError}`);
                    }
                }
            }
            console.log(`✅ Đã cập nhật ảnh bìa mới cho phim ID: ${movieId}, PosterURL: ${coverImage.filename}, timestamp: ${timestamp}`);
        }
        if (videoFile) {
            // Cách đơn giản: chỉ update database với file mới và reset stream
            const timestamp = Date.now();
            const newVideoUrl = `/storage/${videoFile.filename}?v=${timestamp}`;
            console.log(`🔄 Cập nhật video mới: ${videoFile.filename}`);
            console.log(`📁 New video URL: ${newVideoUrl}`);
            // Update database với file mới
            await (0, db_1.query) `UPDATE Movies SET TrailerURL = ${newVideoUrl} WHERE MovieID = ${movieId}`;
            // Xóa file video cũ
            if (oldMovie && oldMovie.TrailerURL) {
                const oldVideoFileName = oldMovie.TrailerURL.replace("/storage/", "").split("?")[0];
                const oldVideoPath = path_1.default.join(uploadsRoot, oldVideoFileName);
                if (fs_1.default.existsSync(oldVideoPath) &&
                    oldVideoFileName !== videoFile.filename) {
                    try {
                        fs_1.default.unlinkSync(oldVideoPath);
                        console.log(`🗑️ Đã xóa video cũ: ${oldVideoPath}`);
                    }
                    catch (deleteError) {
                        console.log(`⚠️ Không thể xóa video cũ: ${deleteError}`);
                    }
                }
            }
            // Cập nhật episode với video mới
            await (0, db_1.query) `
          UPDATE MovieEpisodes 
          SET VideoURL = ${newVideoUrl}
          WHERE MovieID = ${movieId}
        `;
            console.log(`✅ Đã cập nhật video mới cho phim ID: ${movieId}, VideoURL: ${videoFile.filename}, timestamp: ${timestamp}`);
        }
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("PUT /user/movies/:id error:", e);
        if (e instanceof Error) {
            return res.status(500).json({ error: e.message });
        }
        return res.status(500).json({ error: "Failed to update movie" });
    }
});
// Admin update movie
router.put("/admin/movies/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), upload.fields([
    { name: "videoFile", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
]), async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        if (!movieId)
            return res.status(400).json({ error: "Invalid id" });
        const { title, description, status, isFree } = req.body;
        const videoFile = req.files && req.files["videoFile"]
            ? req.files["videoFile"][0]
            : undefined;
        const coverImage = req.files && req.files["coverImage"]
            ? req.files["coverImage"][0]
            : undefined;
        // Lấy thông tin file cũ trước khi cập nhật
        const oldMovieInfo = await (0, db_1.query) `
        SELECT PosterURL, TrailerURL FROM Movies WHERE MovieID = ${movieId}
      `;
        const oldMovie = oldMovieInfo.recordset[0];
        // Cập nhật thông tin phim
        if (typeof title !== "undefined") {
            // Tạo slug và kiểm tra trùng lặp
            const baseSlug = (0, slugify_1.default)(title, { lower: true, strict: true });
            let finalSlug = baseSlug;
            let attempt = 1;
            // Kiểm tra slug trùng lặp (trừ phim hiện tại)
            while (true) {
                const exists = await (0, db_1.query) `
            SELECT COUNT(*) AS cnt FROM dbo.Movies 
            WHERE Slug = ${finalSlug} AND MovieID <> ${movieId}
          `;
                if (exists.recordset[0].cnt === 0) {
                    break; // Slug không trùng, sử dụng
                }
                finalSlug = `${baseSlug}-${attempt}`;
                attempt++;
                if (attempt > 100) {
                    // Tránh vòng lặp vô hạn
                    finalSlug = `${baseSlug}-${Date.now()}`;
                    break;
                }
            }
            await (0, db_1.query) `UPDATE dbo.Movies SET Title = ${title}, Slug = ${finalSlug} WHERE MovieID = ${movieId}`;
        }
        if (typeof description !== "undefined") {
            await (0, db_1.query) `UPDATE dbo.Movies SET Description = ${description} WHERE MovieID = ${movieId}`;
        }
        if (typeof status !== "undefined") {
            await (0, db_1.query) `UPDATE dbo.Movies SET Status = ${status} WHERE MovieID = ${movieId}`;
        }
        if (typeof isFree !== "undefined") {
            await (0, db_1.query) `UPDATE dbo.Movies SET IsFree = ${isFree ? 1 : 0} WHERE MovieID = ${movieId}`;
        }
        // Nếu user edit video (không phải admin), chuyển status về Pending để admin duyệt lại
        if (req.user?.RoleName !== "Admin" &&
            (title ||
                description ||
                isFree !== undefined ||
                coverImage ||
                videoFile)) {
            await (0, db_1.query) `UPDATE dbo.Movies SET Status = 'Pending' WHERE MovieID = ${movieId}`;
            console.log(`🔄 User edited video ${movieId}, status changed to Pending for admin review`);
        }
        // Xử lý file mới
        if (coverImage) {
            const timestamp = Date.now();
            const newPosterUrl = `/storage/${coverImage.filename}?v=${timestamp}`;
            await (0, db_1.query) `UPDATE dbo.Movies SET PosterURL = ${newPosterUrl} WHERE MovieID = ${movieId}`;
            console.log(`🖼️ Cập nhật ảnh bìa mới: ${coverImage.filename}`);
            console.log(`📁 New poster URL: ${newPosterUrl}`);
            // Xóa file poster cũ
            if (oldMovie && oldMovie.PosterURL) {
                const oldPosterFileName = oldMovie.PosterURL.replace("/storage/", "").split("?")[0];
                const oldPosterPath = path_1.default.join(uploadsRoot, oldPosterFileName);
                if (fs_1.default.existsSync(oldPosterPath) &&
                    oldPosterFileName !== coverImage.filename) {
                    try {
                        fs_1.default.unlinkSync(oldPosterPath);
                        console.log(`🗑️ Đã xóa ảnh bìa cũ: ${oldPosterPath}`);
                    }
                    catch (deleteError) {
                        console.log(`⚠️ Không thể xóa ảnh bìa cũ: ${deleteError}`);
                    }
                }
            }
            console.log(`✅ Đã cập nhật ảnh bìa mới cho phim ID: ${movieId}, PosterURL: ${coverImage.filename}, timestamp: ${timestamp}`);
        }
        if (videoFile) {
            // Cách đơn giản: chỉ update database với file mới và reset stream
            const timestamp = Date.now();
            const newVideoUrl = `/storage/${videoFile.filename}?v=${timestamp}`;
            console.log(`🔄 Cập nhật video mới: ${videoFile.filename}`);
            console.log(`📁 New video URL: ${newVideoUrl}`);
            // Cập nhật database với file mới + timestamp để reset stream
            await (0, db_1.query) `UPDATE dbo.Movies SET TrailerURL = ${newVideoUrl} WHERE MovieID = ${movieId}`;
            // Cập nhật episode với file mới
            try {
                await (0, db_1.query) `UPDATE dbo.MovieEpisodes SET VideoURL = ${videoFile.filename} WHERE MovieID = ${movieId} AND EpisodeNumber = 1`;
                console.log(`✅ Đã cập nhật video mới cho phim ID: ${movieId}, VideoURL: ${videoFile.filename}, timestamp: ${timestamp}`);
            }
            catch (episodeError) {
                console.error(`❌ Lỗi khi cập nhật episode cho phim ID: ${movieId}:`, episodeError);
            }
            // Xóa file cũ nếu có (để tránh file rác)
            if (oldMovie && oldMovie.TrailerURL) {
                const oldVideoFileName = oldMovie.TrailerURL.replace("/storage/", "").split("?")[0];
                const oldVideoPath = path_1.default.join(uploadsRoot, oldVideoFileName);
                if (fs_1.default.existsSync(oldVideoPath) &&
                    oldVideoFileName !== videoFile.filename) {
                    try {
                        fs_1.default.unlinkSync(oldVideoPath);
                        console.log(`🗑️ Đã xóa file cũ: ${oldVideoPath}`);
                    }
                    catch (deleteError) {
                        console.log(`⚠️ Không thể xóa file cũ: ${deleteError}`);
                    }
                }
            }
        }
        // Update categories if provided
        if (req.body.categoryIds !== undefined) {
            // Xóa tất cả categories cũ
            await (0, db_1.query) `DELETE FROM MovieCategories WHERE MovieID = ${movieId}`;
            // Thêm categories mới
            const categoryIds = req.body.categoryIds;
            const categoryIdsArray = Array.isArray(categoryIds)
                ? categoryIds.map((id) => Number(id))
                : typeof categoryIds === "string"
                    ? [Number(categoryIds)]
                    : [];
            if (categoryIdsArray.length > 0) {
                for (const catId of categoryIdsArray) {
                    if (catId && !isNaN(catId)) {
                        await (0, db_1.query) `
                INSERT INTO MovieCategories (MovieID, CategoryID)
                VALUES (${movieId}, ${catId})
              `;
                    }
                }
                console.log(`✅ Đã cập nhật ${categoryIdsArray.length} categories cho phim ID: ${movieId}`);
            }
        }
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("PUT /admin/movies/:id error:", e);
        if (e instanceof Error) {
            return res.status(500).json({ error: e.message });
        }
        return res.status(500).json({ error: "Failed to update movie" });
    }
});
// Admin update movie status (approve/reject)
router.put("/admin/movies/:id/status", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const { status } = req.body;
        if (!movieId)
            return res.status(400).json({ error: "Invalid movie ID" });
        if (!status || !["Approved", "Rejected", "Pending"].includes(status)) {
            return res.status(400).json({
                error: "Invalid status. Must be 'Approved', 'Rejected', or 'Pending'",
            });
        }
        // Update movie status
        await (0, db_1.query) `
        UPDATE dbo.Movies 
        SET Status = ${status}, UpdatedAt = GETDATE()
        WHERE MovieID = ${movieId}
      `;
        // Log activity
        await (0, db_1.query) `
        INSERT INTO ActivityLogs (UserID, Action, TableName, RecordID, NewValue, IPAddress, UserAgent)
        VALUES (${req.user?.UserID}, 'UPDATE_MOVIE_STATUS', 'Movies', ${movieId}, 
                ${JSON.stringify({ status, movieId })}, 
                ${req.ip}, ${req.get("User-Agent")})
      `;
        // Get movie info for notification
        const movieResult = await (0, db_1.query) `
        SELECT m.Title, m.UploaderID, u.Email as UploaderEmail
        FROM Movies m
        JOIN Users u ON m.UploaderID = u.UserID
        WHERE m.MovieID = ${movieId}
      `;
        if (movieResult.recordset.length > 0) {
            const movie = movieResult.recordset[0];
            // Send notification to uploader
            const notificationTitle = status === "Approved" ? "Phim đã được duyệt" : "Phim bị từ chối";
            const notificationContent = status === "Approved"
                ? `Phim "${movie.Title}" của bạn đã được admin duyệt và hiển thị trên trang chủ.`
                : `Phim "${movie.Title}" của bạn đã bị admin từ chối.`;
            await (0, db_1.query) `
          INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL)
          VALUES (${movie.UploaderID}, 'ContentApproval', ${notificationTitle}, ${notificationContent}, '/upload')
        `;
        }
        res.json({ ok: true, message: `Movie status updated to ${status}` });
    }
    catch (e) {
        console.error("PUT /admin/movies/:id/status error:", e);
        if (e instanceof Error) {
            return res.status(500).json({ error: e.message });
        }
        return res.status(500).json({ error: "Failed to update movie status" });
    }
});
// Admin delete any movie
router.delete("/admin/movies/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["delete:any_content"]), async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        if (!movieId)
            return res.status(400).json({ error: "Invalid id" });
        // Admin có thể xóa bất kỳ phim nào
        // Xóa tất cả dữ liệu liên quan trước khi xóa phim
        try {
            await (0, db_1.query) `DELETE FROM MovieComments WHERE MovieID = ${movieId}`;
            console.log(`Đã xóa MovieComments cho phim ID: ${movieId}`);
        }
        catch (e) {
            console.log(`Không có MovieComments cho phim ID: ${movieId}`);
        }
        try {
            await (0, db_1.query) `DELETE FROM MovieRatings WHERE MovieID = ${movieId}`;
            console.log(`Đã xóa MovieRatings cho phim ID: ${movieId}`);
        }
        catch (e) {
            console.log(`Không có MovieRatings cho phim ID: ${movieId}`);
        }
        try {
            await (0, db_1.query) `DELETE FROM MovieFavorites WHERE MovieID = ${movieId}`;
            console.log(`Đã xóa MovieFavorites cho phim ID: ${movieId}`);
        }
        catch (e) {
            console.log(`Không có MovieFavorites cho phim ID: ${movieId}`);
        }
        try {
            await (0, db_1.query) `DELETE FROM MovieHistory WHERE MovieID = ${movieId}`;
            console.log(`Đã xóa MovieHistory cho phim ID: ${movieId}`);
        }
        catch (e) {
            console.log(`Không có MovieHistory cho phim ID: ${movieId}`);
        }
        try {
            await (0, db_1.query) `DELETE FROM MovieEpisodes WHERE MovieID = ${movieId}`;
            console.log(`Đã xóa MovieEpisodes cho phim ID: ${movieId}`);
        }
        catch (e) {
            console.log(`Không có MovieEpisodes cho phim ID: ${movieId}`);
        }
        try {
            await (0, db_1.query) `DELETE FROM MovieCategories WHERE MovieID = ${movieId}`;
            console.log(`Đã xóa MovieCategories cho phim ID: ${movieId}`);
        }
        catch (e) {
            console.log(`Không có MovieCategories cho phim ID: ${movieId}`);
        }
        // Lấy thông tin phim trước khi xóa (bao gồm UploaderID và Title)
        const movieInfo = await (0, db_1.query) `
        SELECT PosterURL, TrailerURL, UploaderID, Title FROM Movies WHERE MovieID = ${movieId}
      `;
        const movie = movieInfo.recordset[0];
        if (!movie) {
            return res.status(404).json({ error: "Movie not found" });
        }
        // Tạo thông báo cho Uploader và Admin khi phim bị xóa
        try {
            // Thông báo cho Uploader
            await (0, db_1.query) `
          INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead, CreatedAt)
          VALUES (
            ${movie.UploaderID},
            'ContentDeleted',
            N'Phim của bạn đã bị xóa',
            N'Phim "${movie.Title}" đã bị Admin ${req.user.email} xóa',
            N'/user/movies',
            0,
            GETDATE()
          )
        `;
            // Thông báo cho tất cả Admin (trừ Admin đã xóa)
            const adminUsers = await (0, db_1.query) `
          SELECT u.UserID, u.Email
          FROM Users u
          INNER JOIN Roles r ON u.RoleID = r.RoleID
          WHERE r.RoleName = 'Admin' AND u.IsActive = 1 AND u.UserID != ${req.user.UserID}
        `;
            for (const admin of adminUsers.recordset) {
                await (0, db_1.query) `
            INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead, CreatedAt)
            VALUES (
              ${admin.UserID},
              'ContentDeleted',
              N'Phim đã bị xóa',
              N'Admin ${req.user.email} đã xóa phim "${movie.Title}"',
              N'/admin/movies',
              0,
              GETDATE()
            )
          `;
            }
            console.log(`✅ Đã tạo thông báo cho Uploader và ${adminUsers.recordset.length} Admin về việc xóa phim`);
        }
        catch (notifError) {
            console.error("❌ Lỗi khi tạo thông báo về việc xóa phim:", notifError);
        }
        // ✅ FIX: Lấy thông tin episodes TRƯỚC KHI xóa phim để có thể xóa file video
        const episodesInfo = await (0, db_1.query) `
        SELECT VideoURL FROM MovieEpisodes WHERE MovieID = ${movieId}
      `;
        // Cuối cùng xóa phim
        await (0, db_1.query) `DELETE FROM Movies WHERE MovieID = ${movieId}`;
        console.log(`Đã xóa phim ID: ${movieId}`);
        // ✅ FIX: Xóa file trong uploads/ - bao gồm poster, trailer và TẤT CẢ video episodes
        let deletedFilesCount = 0;
        if (movie) {
            try {
                // Xóa poster - xử lý path có thể trong uploads/posters/ hoặc uploads/
                if (movie.PosterURL) {
                    let posterFileName = movie.PosterURL.replace("/storage/", "").split("?")[0];
                    let posterPath = path_1.default.join(uploadsRoot, posterFileName);
                    // Nếu không tìm thấy, thử tìm trong uploads/posters/
                    if (!fs_1.default.existsSync(posterPath) && !posterFileName.startsWith("posters/")) {
                        posterPath = path_1.default.join(uploadsRoot, "posters", path_1.default.basename(posterFileName));
                    }
                    if (fs_1.default.existsSync(posterPath)) {
                        try {
                            fs_1.default.unlinkSync(posterPath);
                            deletedFilesCount++;
                            console.log(`🗑️ Đã xóa file poster: ${posterPath}`);
                        }
                        catch (posterError) {
                            console.error(`❌ Lỗi khi xóa poster ${posterPath}:`, posterError);
                        }
                    }
                    else {
                        console.log(`⚠️ File poster không tồn tại: ${posterPath}`);
                    }
                }
                // Xóa trailer
                if (movie.TrailerURL) {
                    const videoFileName = movie.TrailerURL.replace("/storage/", "").split("?")[0];
                    const videoPath = path_1.default.join(uploadsRoot, videoFileName);
                    if (fs_1.default.existsSync(videoPath)) {
                        try {
                            fs_1.default.unlinkSync(videoPath);
                            deletedFilesCount++;
                            console.log(`🗑️ Đã xóa file trailer: ${videoPath}`);
                        }
                        catch (trailerError) {
                            console.error(`❌ Lỗi khi xóa trailer ${videoPath}:`, trailerError);
                        }
                    }
                    else {
                        console.log(`⚠️ File trailer không tồn tại: ${videoPath}`);
                    }
                }
                // ✅ FIX: Xóa TẤT CẢ video episodes
                console.log(`🗑️ Bắt đầu xóa ${episodesInfo.recordset.length} video episodes...`);
                for (const episode of episodesInfo.recordset) {
                    if (episode.VideoURL) {
                        let videoFileName = episode.VideoURL;
                        if (videoFileName.startsWith("/uploads/")) {
                            videoFileName = videoFileName.replace("/uploads/", "");
                        }
                        else if (videoFileName.startsWith("/storage/")) {
                            videoFileName = videoFileName.replace("/storage/", "");
                        }
                        videoFileName = videoFileName.split("?")[0];
                        const videoPath = path_1.default.join(uploadsRoot, videoFileName);
                        if (fs_1.default.existsSync(videoPath)) {
                            try {
                                fs_1.default.unlinkSync(videoPath);
                                deletedFilesCount++;
                                console.log(`🗑️ Đã xóa file video episode: ${videoPath}`);
                            }
                            catch (episodeFileError) {
                                console.error(`❌ Lỗi khi xóa file video episode ${videoPath}:`, episodeFileError);
                            }
                        }
                        else {
                            console.log(`⚠️ File video episode không tồn tại: ${videoPath}`);
                        }
                    }
                }
                console.log(`✅ Đã xóa tổng cộng ${deletedFilesCount} file (poster, trailer, video episodes)`);
            }
            catch (fileError) {
                console.error("❌ Lỗi khi xóa file:", fileError);
            }
        }
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("DELETE /admin/movies/:id error:", e);
        return res.status(500).json({ error: "Failed to delete movie" });
    }
});
// User delete own movie (hoặc Admin delete any movie)
router.delete("/user/movies/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        if (!movieId)
            return res.status(400).json({ error: "Invalid id" });
        // Kiểm tra quyền: User chỉ có thể xóa video của chính họ (trừ Admin)
        if (req.user?.RoleName !== "Admin") {
            const movieCheck = await (0, db_1.query) `
          SELECT UploaderID FROM Movies WHERE MovieID = ${movieId}
        `;
            if (movieCheck.recordset.length === 0) {
                return res.status(404).json({ error: "Movie not found" });
            }
            if (movieCheck.recordset[0].UploaderID !== req.user?.UserID) {
                return res
                    .status(403)
                    .json({ error: "You can only delete your own videos" });
            }
        }
        // Xóa tất cả dữ liệu liên quan trước khi xóa phim
        try {
            await (0, db_1.query) `DELETE FROM MovieComments WHERE MovieID = ${movieId}`;
            console.log(`Đã xóa MovieComments cho phim ID: ${movieId}`);
        }
        catch (e) {
            console.log(`Không có MovieComments cho phim ID: ${movieId}`);
        }
        try {
            await (0, db_1.query) `DELETE FROM MovieRatings WHERE MovieID = ${movieId}`;
            console.log(`Đã xóa MovieRatings cho phim ID: ${movieId}`);
        }
        catch (e) {
            console.log(`Không có MovieRatings cho phim ID: ${movieId}`);
        }
        try {
            await (0, db_1.query) `DELETE FROM MovieFavorites WHERE MovieID = ${movieId}`;
            console.log(`Đã xóa MovieFavorites cho phim ID: ${movieId}`);
        }
        catch (e) {
            console.log(`Không có MovieFavorites cho phim ID: ${movieId}`);
        }
        try {
            await (0, db_1.query) `DELETE FROM MovieHistory WHERE MovieID = ${movieId}`;
            console.log(`Đã xóa MovieHistory cho phim ID: ${movieId}`);
        }
        catch (e) {
            console.log(`Không có MovieHistory cho phim ID: ${movieId}`);
        }
        try {
            await (0, db_1.query) `DELETE FROM MovieEpisodes WHERE MovieID = ${movieId}`;
            console.log(`Đã xóa MovieEpisodes cho phim ID: ${movieId}`);
        }
        catch (e) {
            console.log(`Không có MovieEpisodes cho phim ID: ${movieId}`);
        }
        try {
            await (0, db_1.query) `DELETE FROM MovieCategories WHERE MovieID = ${movieId}`;
            console.log(`Đã xóa MovieCategories cho phim ID: ${movieId}`);
        }
        catch (e) {
            console.log(`Không có MovieCategories cho phim ID: ${movieId}`);
        }
        // ✅ FIX: Lấy thông tin file và episodes TRƯỚC KHI xóa phim
        const movieInfo = await (0, db_1.query) `
        SELECT PosterURL, TrailerURL FROM Movies WHERE MovieID = ${movieId}
      `;
        const movie = movieInfo.recordset[0];
        // Lấy thông tin tất cả episodes để xóa file video
        const episodesInfo = await (0, db_1.query) `
        SELECT VideoURL FROM MovieEpisodes WHERE MovieID = ${movieId}
      `;
        // Cuối cùng xóa phim
        await (0, db_1.query) `DELETE FROM Movies WHERE MovieID = ${movieId}`;
        console.log(`Đã xóa phim ID: ${movieId}`);
        // ✅ FIX: Xóa file trong uploads/ - bao gồm poster, trailer và tất cả video episodes
        if (movie) {
            try {
                // Xóa poster - xử lý path có thể trong uploads/posters/
                if (movie.PosterURL) {
                    let posterFileName = movie.PosterURL.replace("/storage/", "").split("?")[0];
                    let posterPath = path_1.default.join(uploadsRoot, posterFileName);
                    // Nếu không tìm thấy, thử tìm trong uploads/posters/
                    if (!fs_1.default.existsSync(posterPath) && !posterFileName.startsWith("posters/")) {
                        posterPath = path_1.default.join(uploadsRoot, "posters", path_1.default.basename(posterFileName));
                    }
                    if (fs_1.default.existsSync(posterPath)) {
                        fs_1.default.unlinkSync(posterPath);
                        console.log(`🗑️ Đã xóa file poster: ${posterPath}`);
                    }
                    else {
                        console.log(`⚠️ File poster không tồn tại: ${posterPath}`);
                    }
                }
                // Xóa trailer
                if (movie.TrailerURL) {
                    const videoFileName = movie.TrailerURL.replace("/storage/", "").split("?")[0];
                    const videoPath = path_1.default.join(uploadsRoot, videoFileName);
                    if (fs_1.default.existsSync(videoPath)) {
                        fs_1.default.unlinkSync(videoPath);
                        console.log(`🗑️ Đã xóa file trailer: ${videoPath}`);
                    }
                    else {
                        console.log(`⚠️ File trailer không tồn tại: ${videoPath}`);
                    }
                }
                // ✅ FIX: Xóa tất cả video episodes
                for (const episode of episodesInfo.recordset) {
                    if (episode.VideoURL) {
                        let videoFileName = episode.VideoURL;
                        if (videoFileName.startsWith("/uploads/")) {
                            videoFileName = videoFileName.replace("/uploads/", "");
                        }
                        else if (videoFileName.startsWith("/storage/")) {
                            videoFileName = videoFileName.replace("/storage/", "");
                        }
                        videoFileName = videoFileName.split("?")[0];
                        const videoPath = path_1.default.join(uploadsRoot, videoFileName);
                        if (fs_1.default.existsSync(videoPath)) {
                            try {
                                fs_1.default.unlinkSync(videoPath);
                                console.log(`🗑️ Đã xóa file video episode: ${videoPath}`);
                            }
                            catch (episodeFileError) {
                                console.error(`❌ Lỗi khi xóa file video episode ${videoPath}:`, episodeFileError);
                            }
                        }
                        else {
                            console.log(`⚠️ File video episode không tồn tại: ${videoPath}`);
                        }
                    }
                }
            }
            catch (fileError) {
                console.error("❌ Lỗi khi xóa file:", fileError);
            }
        }
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("DELETE /admin/movies/:id error:", e);
        return res.status(500).json({ error: "Failed to delete movie" });
    }
});
// Lấy vai trò hiện tại của user (dựa trên header x-user-email)
router.get("/auth/role", authenticate, (req, res) => {
    return res.json({ role: req.user.role });
});
// Admin upload story - Auto approve, nhiều chương
router.post("/admin/stories", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), // CHỈ Admin mới được upload qua route này
(0, authMiddleware_1.authorize)(["create:content"]), upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "contentFiles", maxCount: 50 }, // Cho phép upload tối đa 50 chương cho truyện chữ
    { name: "chapterImages", maxCount: 5000 }, // Cho phép upload tối đa 5000 ảnh cho truyện tranh (50 chương x 100 ảnh)
]), async (req, res) => {
    if (!req.user) {
        return res
            .status(401)
            .json({ message: "Người dùng chưa được xác thực." });
    }
    try {
        const { title, description, categoryId, author, isFree, storyType, chapters, } = req.body;
        // Check if at least one category is provided
        const categoryIds = req.body.categoryIds || (categoryId ? [categoryId] : []);
        const categoryIdsArray = Array.isArray(categoryIds)
            ? categoryIds.map((id) => Number(id))
            : typeof categoryIds === "string"
                ? [Number(categoryIds)]
                : categoryId
                    ? [Number(categoryId)]
                    : [];
        if (!title || categoryIdsArray.length === 0 || !author) {
            return res
                .status(400)
                .json({ error: "Title, category, and author are required" });
        }
        // Validate storyType
        const validStoryType = storyType === "Comic" ? "Comic" : "Text";
        if (!["Text", "Comic"].includes(validStoryType)) {
            return res
                .status(400)
                .json({ error: "Invalid story type. Must be 'Text' or 'Comic'" });
        }
        // Handle file uploads
        const coverImage = req.files?.["coverImage"]?.[0];
        const contentFiles = req.files?.["contentFiles"] || [];
        const chapterImages = req.files?.["chapterImages"] || [];
        const coverLocal = req.body.coverLocal; // Ảnh từ crawl (đã tải về server)
        const crawledImagesRaw = req.body["crawledImages[]"] ?? req.body.crawledImages;
        let crawledImages = [];
        const coerceCrawledArray = (payload) => {
            if (!payload)
                return [];
            if (Array.isArray(payload)) {
                return payload;
            }
            if (typeof payload === "string") {
                try {
                    const parsed = JSON.parse(payload);
                    if (Array.isArray(parsed)) {
                        return parsed;
                    }
                }
                catch {
                    // treat as single string path
                    return [payload];
                }
            }
            if (typeof payload === "object") {
                return Object.values(payload);
            }
            return [];
        };
        crawledImages = coerceCrawledArray(crawledImagesRaw)
            .map((value) => normalizeStoragePath(value))
            .filter((value) => Boolean(value));
        const hasUploadedChapterImages = Array.isArray(chapterImages) && chapterImages.length > 0;
        const hasCrawledChapterImages = crawledImages.length > 0;
        // ✅ FIX: Chỉ dùng 1 nguồn ảnh - ưu tiên crawledImages nếu có
        // Nếu có cả 2 nguồn, chỉ dùng crawledImages và bỏ qua chapterImages
        const useCrawledImages = hasCrawledChapterImages;
        const useUploadedImages = hasUploadedChapterImages && !hasCrawledChapterImages;
        let autoChapterId = null;
        let totalChaptersPersisted = 0;
        // Validate: Phải có cover image (file upload) HOẶC coverLocal (từ crawl)
        if (!coverImage && !coverLocal) {
            return res.status(400).json({ error: "Cover image is required (upload file or crawl with cover)" });
        }
        // Validate based on story type
        if (validStoryType === "Text" &&
            (!contentFiles || contentFiles.length === 0)) {
            return res.status(400).json({
                error: "At least one content file is required for text stories",
            });
        }
        if (validStoryType === "Comic" &&
            !useCrawledImages &&
            !useUploadedImages) {
            return res.status(400).json({
                error: "At least one chapter image is required for comic stories",
            });
        }
        // ✅ FIX: Generate slug và kiểm tra truyện đã tồn tại
        // Logic: Nếu truyện đã tồn tại (theo title sau khi normalize), có thể cập nhật thay vì tạo mới
        // Tuy nhiên, để tránh nhầm lẫn, hệ thống vẫn tạo mới nếu slug khác
        // Frontend có thể kiểm tra và gọi API update thay vì create nếu muốn cập nhật truyện đã tồn tại
        const baseSlug = (0, slugify_1.default)(title, { lower: true, strict: true });
        let finalSlug = baseSlug;
        let attempt = 1;
        // Kiểm tra slug trùng lặp
        while (true) {
            const exists = await (0, db_1.query) `
          SELECT COUNT(*) AS cnt FROM Series WHERE Slug = ${finalSlug}
        `;
            if (exists.recordset[0].cnt === 0) {
                break;
            }
            finalSlug = `${baseSlug}-${attempt}`;
            attempt++;
            if (attempt > 100) {
                finalSlug = `${baseSlug}-${Date.now()}`;
                break;
            }
        }
        // Admin upload - LUÔN auto approve
        const status = "Approved";
        const isApproved = 1;
        const approvedBy = req.user.UserID;
        // ✅ FIX: Xác định CoverURL - ưu tiên coverLocal từ crawl, fallback file upload
        // Nếu có cả 2, chỉ dùng coverLocal (từ crawl)
        let coverURL = null;
        if (coverLocal) {
            coverURL = normalizeStoragePath(coverLocal);
        }
        else if (coverImage) {
            coverURL = `/storage/${coverImage.filename}`;
        }
        if (!coverURL) {
            return res.status(400).json({ error: "Cover image is required" });
        }
        // Insert story with StoryType
        const result = await (0, db_1.query) `
        INSERT INTO Series (Title, Slug, Description, CoverURL, Author, IsFree, Status, StoryType, UploaderID, IsApproved, ApprovedBy, ApprovedAt, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.SeriesID
        VALUES (${title}, ${finalSlug}, ${description || ""}, ${coverURL}, ${author}, ${isFree === "true"}, ${status}, ${validStoryType}, ${req.user.UserID}, ${isApproved}, ${approvedBy}, GETDATE(), GETDATE(), GETDATE())
      `;
        const seriesId = result.recordset[0].SeriesID;
        const checkExistingChapter = async (chapterNumber) => {
            const existing = await (0, db_1.query) `
          SELECT TOP 1 ChapterID
          FROM Chapters
          WHERE SeriesID = ${seriesId} AND ChapterNumber = ${chapterNumber}
        `;
            return existing.recordset[0]?.ChapterID || null;
        };
        const rememberFirstChapter = (chapterNumber, chapterId) => {
            if (chapterNumber === 1 && chapterId && !autoChapterId) {
                autoChapterId = chapterId;
            }
        };
        // Insert story categories (hỗ trợ nhiều categories)
        // Sử dụng categoryIdsArray đã được khai báo ở trên
        if (categoryIdsArray.length > 0) {
            for (const catId of categoryIdsArray) {
                if (catId && !isNaN(catId)) {
                    await (0, db_1.query) `
              INSERT INTO SeriesCategories (SeriesID, CategoryID)
              VALUES (${seriesId}, ${catId})
            `;
                }
            }
        }
        // Parse chapters data nếu có
        let chaptersData = [];
        if (chapters) {
            try {
                chaptersData = JSON.parse(chapters);
            }
            catch (e) {
                console.warn("Không thể parse chapters data, sử dụng mặc định");
            }
        }
        // Insert multiple chapters based on story type
        if (validStoryType === "Text") {
            // Truyện chữ: upload nhiều file content
            for (let i = 0; i < contentFiles.length; i++) {
                const contentFile = contentFiles[i];
                const chapterNumber = i + 1;
                // Tìm thông tin chương tương ứng (nếu có)
                const chapterInfo = chaptersData.find((ch) => ch.chapterNumber === chapterNumber || ch.index === i) || {};
                const chapterTitle = chapterInfo.title || `Chapter ${chapterNumber}`;
                await (0, db_1.query) `
            INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
            VALUES (${seriesId}, ${chapterNumber}, ${chapterTitle}, ${`/storage/${contentFile.filename}`}, ${isFree === "true"}, 0, GETDATE())
          `;
            }
        }
        else {
            // ✅ FIX: Truyện tranh - chỉ dùng 1 nguồn ảnh (crawledImages HOẶC chapterImages)
            const resolveChapterImageRefs = (references = []) => {
                if (!Array.isArray(references))
                    return [];
                const resolved = [];
                references.forEach((ref) => {
                    if (typeof ref === "number") {
                        // ✅ FIX: Ưu tiên crawledImages nếu có
                        if (useCrawledImages && ref >= 0 && ref < crawledImages.length) {
                            const normalized = normalizeStoragePath(crawledImages[ref]);
                            if (normalized) {
                                resolved.push({ url: normalized, size: 0 });
                            }
                        }
                        else if (useUploadedImages && ref >= 0 && ref < chapterImages.length) {
                            const file = chapterImages[ref];
                            resolved.push({
                                url: `/storage/${file.filename}`,
                                size: file.size,
                            });
                        }
                    }
                    else if (typeof ref === "string" && ref.trim()) {
                        const normalized = normalizeStoragePath(ref);
                        if (normalized) {
                            resolved.push({ url: normalized, size: 0 });
                        }
                    }
                    else if (ref &&
                        typeof ref === "object" &&
                        typeof ref.url === "string") {
                        const normalized = normalizeStoragePath(ref.url);
                        if (normalized) {
                            resolved.push({
                                url: normalized,
                                size: typeof ref.size === "number" && ref.size > 0 ? ref.size : 0,
                            });
                        }
                    }
                });
                return resolved;
            };
            // Truyện tranh: upload nhiều nhóm ảnh (mỗi nhóm là 1 chương)
            // Cần phân chia chapterImages/crawledImages thành các nhóm theo chapters data hoặc theo số lượng ảnh
            // Nếu có chapters data với thông tin số ảnh mỗi chương
            if (chaptersData.length > 0) {
                for (let i = 0; i < chaptersData.length; i++) {
                    const chapterInfo = chaptersData[i];
                    const chapterNumber = chapterInfo.chapterNumber || i + 1;
                    const chapterTitle = chapterInfo.title || `Chapter ${chapterNumber}`;
                    const chapterImageEntries = resolveChapterImageRefs(chapterInfo.images || []);
                    const imageCount = chapterImageEntries.length;
                    if (imageCount === 0)
                        continue;
                    const existingChapterId = await checkExistingChapter(chapterNumber);
                    if (existingChapterId) {
                        console.log(`↪️ Chapter ${chapterNumber} already exists — skipping auto-create`);
                        rememberFirstChapter(chapterNumber, existingChapterId);
                        continue;
                    }
                    const chapterResult = await (0, db_1.query) `
              INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
              OUTPUT INSERTED.ChapterID
              VALUES (${seriesId}, ${chapterNumber}, ${chapterTitle}, '', ${isFree === "true"}, ${imageCount}, GETDATE())
            `;
                    const chapterId = chapterResult.recordset[0].ChapterID;
                    totalChaptersPersisted++;
                    rememberFirstChapter(chapterNumber, chapterId);
                    // Insert ảnh cho chương này
                    for (let j = 0; j < chapterImageEntries.length; j++) {
                        const entry = chapterImageEntries[j];
                        await (0, db_1.query) `
                INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
                VALUES (${chapterId}, ${entry.url}, ${j + 1}, ${entry.size}, GETDATE())
              `;
                    }
                }
            }
            else if (useCrawledImages) {
                // ✅ FIX: Chỉ dùng crawledImages, không dùng chapterImages
                const existingChapterId = await checkExistingChapter(1);
                if (existingChapterId) {
                    console.log("↪️ Chapter 1 already exists — skipping auto-create from crawl");
                    rememberFirstChapter(1, existingChapterId);
                }
                else {
                    // Auto tạo chương 1 từ ảnh crawl để hiển thị ngay trên trang chủ
                    const chapterInsert = await (0, db_1.query) `
              INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
              OUTPUT INSERTED.ChapterID
              VALUES (${seriesId}, 1, 'Chapter 1', '', ${isFree === "true"}, ${crawledImages.length}, GETDATE())
            `;
                    const chapterId = chapterInsert.recordset[0].ChapterID;
                    totalChaptersPersisted++;
                    rememberFirstChapter(1, chapterId);
                    await Promise.all(crawledImages.map((url, index) => {
                        const normalized = normalizeStoragePath(url);
                        if (!normalized)
                            return Promise.resolve();
                        return (0, db_1.query) `
                  INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
                  VALUES (${chapterId}, ${normalized}, ${index + 1}, 0, GETDATE())
                `;
                    }));
                }
            }
            else if (useUploadedImages) {
                // ✅ FIX: Chỉ dùng chapterImages khi không có crawledImages
                let finalImages = [];
                finalImages = [...chapterImages]
                    .sort((a, b) => a.originalname.localeCompare(b.originalname))
                    .map((file) => ({
                    url: `/storage/${file.filename}`,
                    size: file.size,
                }));
                if (finalImages.length === 0) {
                    return res.status(400).json({
                        error: "Comic stories require at least one uploaded chapter image",
                    });
                }
                const existingChapterId = await checkExistingChapter(1);
                if (existingChapterId) {
                    console.log("↪️ Chapter 1 already exists — skipping auto-create from uploads");
                    rememberFirstChapter(1, existingChapterId);
                }
                else {
                    const chapterResult = await (0, db_1.query) `
              INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
              OUTPUT INSERTED.ChapterID
              VALUES (${seriesId}, 1, 'Chapter 1', '', ${isFree === "true"}, ${finalImages.length}, GETDATE())
            `;
                    const chapterId = chapterResult.recordset[0].ChapterID;
                    totalChaptersPersisted++;
                    rememberFirstChapter(1, chapterId);
                    // Insert từng ảnh vào ChapterImages
                    for (let i = 0; i < finalImages.length; i++) {
                        const entry = finalImages[i];
                        await (0, db_1.query) `
                INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
                VALUES (${chapterId}, ${entry.url}, ${i + 1}, ${entry.size}, GETDATE())
              `;
                    }
                }
            }
        }
        const reportedChapterCount = validStoryType === "Text"
            ? contentFiles.length
            : totalChaptersPersisted || (autoChapterId ? 1 : 0);
        res.json({
            success: true,
            seriesId,
            storyType: validStoryType,
            chapterId: autoChapterId,
            chapterCount: reportedChapterCount,
            message: `[ADMIN] Story (${validStoryType}) uploaded successfully and auto-approved with ${validStoryType === "Text" ? contentFiles.length : reportedChapterCount} chapters`,
            uploader: req.user.email,
            uploaderRole: req.user.RoleName,
            isApproved: true,
            status: "Approved",
        });
    }
    catch (e) {
        console.error("POST /admin/stories error:", e);
        res.status(500).json({ error: "Failed to upload story" });
    }
});
// User upload story - Dựa theo mẫu upload phim, hỗ trợ nhiều chương
router.post("/user/stories", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["create:content"]), upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "contentFiles", maxCount: 50 }, // Cho phép upload tối đa 50 chương cho truyện chữ
    { name: "chapterImages", maxCount: 5000 }, // Cho phép upload tối đa 5000 ảnh cho truyện tranh (50 chương x 100 ảnh)
]), async (req, res) => {
    try {
        const { title, description, categoryId, author, isFree, storyType, chapters, } = req.body;
        // Check if at least one category is provided
        const categoryIds = req.body.categoryIds || (categoryId ? [categoryId] : []);
        const categoryIdsArray = Array.isArray(categoryIds)
            ? categoryIds.map((id) => Number(id))
            : typeof categoryIds === "string"
                ? [Number(categoryIds)]
                : categoryId
                    ? [Number(categoryId)]
                    : [];
        if (!title || categoryIdsArray.length === 0 || !author) {
            return res
                .status(400)
                .json({ error: "Title, category, and author are required" });
        }
        // Validate storyType
        const validStoryType = storyType === "Comic" ? "Comic" : "Text";
        if (!["Text", "Comic"].includes(validStoryType)) {
            return res
                .status(400)
                .json({ error: "Invalid story type. Must be 'Text' or 'Comic'" });
        }
        // Generate slug
        const baseSlug = (0, slugify_1.default)(title, { lower: true, strict: true });
        let finalSlug = baseSlug;
        let attempt = 1;
        // Kiểm tra slug trùng lặp
        while (true) {
            const exists = await (0, db_1.query) `
          SELECT COUNT(*) AS cnt FROM Series WHERE Slug = ${finalSlug}
        `;
            if (exists.recordset[0].cnt === 0) {
                break;
            }
            finalSlug = `${baseSlug}-${attempt}`;
            attempt++;
            if (attempt > 100) {
                finalSlug = `${baseSlug}-${Date.now()}`;
                break;
            }
        }
        // Handle file uploads
        const coverImage = req.files?.["coverImage"]?.[0];
        const contentFiles = req.files?.["contentFiles"] || [];
        const chapterImages = req.files?.["chapterImages"] || [];
        if (!coverImage) {
            return res.status(400).json({ error: "Cover image is required" });
        }
        // Validate based on story type
        if (validStoryType === "Text" &&
            (!contentFiles || contentFiles.length === 0)) {
            return res.status(400).json({
                error: "At least one content file is required for text stories",
            });
        }
        if (validStoryType === "Comic" &&
            (!chapterImages || chapterImages.length === 0)) {
            return res.status(400).json({
                error: "At least one chapter image is required for comic stories",
            });
        }
        // User upload - LUÔN Pending, cần Admin duyệt
        const isApproved = 0;
        const approvedBy = null;
        // Insert story with StoryType
        const result = await (0, db_1.query) `
        INSERT INTO Series (Title, Slug, Description, CoverURL, Author, IsFree, Status, StoryType, UploaderID, IsApproved, ApprovedBy, ApprovedAt, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.SeriesID
        VALUES (${title}, ${finalSlug}, ${description || ""}, ${`/storage/${coverImage.filename}`}, ${author}, ${isFree === "true"}, 'Pending', ${validStoryType}, ${req.user.UserID}, ${isApproved}, ${approvedBy}, NULL, GETDATE(), GETDATE())
      `;
        const seriesId = result.recordset[0].SeriesID;
        // Insert story categories (hỗ trợ nhiều categories)
        // Sử dụng categoryIdsArray đã được khai báo ở trên
        if (categoryIdsArray.length > 0) {
            for (const catId of categoryIdsArray) {
                if (catId && !isNaN(catId)) {
                    await (0, db_1.query) `
              INSERT INTO SeriesCategories (SeriesID, CategoryID)
              VALUES (${seriesId}, ${catId})
            `;
                }
            }
        }
        // Parse chapters data nếu có
        let chaptersData = [];
        if (chapters) {
            try {
                chaptersData = JSON.parse(chapters);
            }
            catch (e) {
                console.warn("Không thể parse chapters data, sử dụng mặc định");
            }
        }
        // Insert multiple chapters based on story type
        if (validStoryType === "Text") {
            // Truyện chữ: upload nhiều file content
            for (let i = 0; i < contentFiles.length; i++) {
                const contentFile = contentFiles[i];
                const chapterNumber = i + 1;
                // Tìm thông tin chương tương ứng (nếu có)
                const chapterInfo = chaptersData.find((ch) => ch.chapterNumber === chapterNumber || ch.index === i) || {};
                const chapterTitle = chapterInfo.title || `Chapter ${chapterNumber}`;
                await (0, db_1.query) `
            INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
            VALUES (${seriesId}, ${chapterNumber}, ${chapterTitle}, ${`/storage/${contentFile.filename}`}, ${isFree === "true"}, 0, GETDATE())
          `;
            }
        }
        else {
            // Truyện tranh: upload nhiều nhóm ảnh (mỗi nhóm là 1 chương)
            // Nếu có chapters data với thông tin số ảnh mỗi chương
            if (chaptersData.length > 0) {
                for (let i = 0; i < chaptersData.length; i++) {
                    const chapterInfo = chaptersData[i];
                    const chapterNumber = chapterInfo.chapterNumber || i + 1;
                    const chapterTitle = chapterInfo.title || `Chapter ${chapterNumber}`;
                    const imageCount = chapterInfo.images?.length || 0;
                    if (imageCount === 0)
                        continue;
                    const chapterResult = await (0, db_1.query) `
              INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
              OUTPUT INSERTED.ChapterID
              VALUES (${seriesId}, ${chapterNumber}, ${chapterTitle}, '', ${isFree === "true"}, ${imageCount}, GETDATE())
            `;
                    const chapterId = chapterResult.recordset[0].ChapterID;
                    // Insert ảnh cho chương này
                    const chapterImageIndices = chapterInfo.images || [];
                    for (let j = 0; j < chapterImageIndices.length; j++) {
                        const imageIndexInArray = chapterImageIndices[j];
                        if (imageIndexInArray >= 0 &&
                            imageIndexInArray < chapterImages.length) {
                            const image = chapterImages[imageIndexInArray];
                            await (0, db_1.query) `
                  INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
                  VALUES (${chapterId}, ${`/storage/${image.filename}`}, ${j + 1}, ${image.size}, GETDATE())
                `;
                        }
                    }
                }
            }
            else {
                // Không có chapters data, tất cả ảnh vào chương 1
                const chapterResult = await (0, db_1.query) `
            INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
            OUTPUT INSERTED.ChapterID
            VALUES (${seriesId}, 1, 'Chapter 1', '', ${isFree === "true"}, ${chapterImages.length}, GETDATE())
          `;
                const chapterId = chapterResult.recordset[0].ChapterID;
                // Sắp xếp ảnh theo tên file
                const sortedImages = [...chapterImages].sort((a, b) => {
                    return a.originalname.localeCompare(b.originalname);
                });
                // Insert từng ảnh vào ChapterImages
                for (let i = 0; i < sortedImages.length; i++) {
                    const image = sortedImages[i];
                    await (0, db_1.query) `
              INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
              VALUES (${chapterId}, ${`/storage/${image.filename}`}, ${i + 1}, ${image.size}, GETDATE())
            `;
                }
            }
        }
        // Tạo thông báo cho tất cả Admin khi user upload truyện
        try {
            const adminUsers = await (0, db_1.query) `
          SELECT u.UserID, u.Email
          FROM Users u
          INNER JOIN Roles r ON u.RoleID = r.RoleID
          WHERE r.RoleName = 'Admin' AND u.IsActive = 1
        `;
            for (const admin of adminUsers.recordset) {
                await (0, db_1.query) `
            INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead, CreatedAt)
            VALUES (
              ${admin.UserID},
              'NewContent',
              N'Truyện mới cần duyệt',
              N'${req.user.email} đã upload truyện "${title}" và đang chờ duyệt',
              N'/admin/stories',
              0,
              GETDATE()
            )
          `;
            }
            console.log(`✅ Đã tạo thông báo cho ${adminUsers.recordset.length} Admin về truyện mới`);
        }
        catch (notifError) {
            console.error("❌ Lỗi khi tạo thông báo cho Admin:", notifError);
        }
        res.json({
            success: true,
            seriesId,
            storyType: validStoryType,
            chapterCount: validStoryType === "Text"
                ? contentFiles.length
                : chaptersData.length || 1,
            message: `[USER] Story (${validStoryType}) uploaded successfully with ${validStoryType === "Text"
                ? contentFiles.length
                : chaptersData.length || 1} chapters and pending approval`,
            uploader: req.user.email,
            uploaderRole: req.user.RoleName,
            isApproved: false,
            status: "Pending",
        });
    }
    catch (e) {
        console.error("POST /user/stories error:", e);
        res.status(500).json({ error: "Failed to upload story" });
    }
});
// Get user's own stories
router.get("/user/stories", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), async (req, res) => {
    try {
        if (!req.user?.UserID) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Lấy danh sách stories (không có categories để tránh duplicate)
        const storiesResult = await (0, db_1.query) `
        SELECT DISTINCT s.*, u.FullName as UploaderName, r.RoleName as UploaderRole
        FROM Series s
        LEFT JOIN Users u ON s.UploaderID = u.UserID
        LEFT JOIN Roles r ON u.RoleID = r.RoleID
        WHERE s.UploaderID = ${req.user.UserID}
        ORDER BY s.CreatedAt DESC
      `;
        const stories = storiesResult.recordset;
        // Lấy categories cho từng story
        for (const story of stories) {
            const categoriesResult = await (0, db_1.query) `
          SELECT c.CategoryID, c.CategoryName
          FROM SeriesCategories sc
          INNER JOIN Categories c ON sc.CategoryID = c.CategoryID
          WHERE sc.SeriesID = ${story.SeriesID}
        `;
            story.Categories = categoriesResult.recordset;
            // Giữ CategoryName cho backward compatibility (lấy category đầu tiên)
            story.CategoryName =
                categoriesResult.recordset.length > 0
                    ? categoriesResult.recordset[0].CategoryName
                    : null;
        }
        res.json(stories);
    }
    catch (e) {
        console.error("GET /user/stories error:", e);
        res.status(500).json({ error: "Failed to list user stories" });
    }
});
// User delete own story
router.delete("/user/stories/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), async (req, res) => {
    try {
        const storyId = Number(req.params.id);
        if (!storyId)
            return res.status(400).json({ error: "Invalid id" });
        // Kiểm tra quyền: User chỉ có thể xóa story của chính họ (trừ Admin)
        if (req.user?.RoleName !== "Admin") {
            const storyCheck = await (0, db_1.query) `
          SELECT UploaderID FROM Series WHERE SeriesID = ${storyId}
        `;
            if (storyCheck.recordset.length === 0) {
                return res.status(404).json({ error: "Story not found" });
            }
            if (storyCheck.recordset[0].UploaderID !== req.user?.UserID) {
                return res
                    .status(403)
                    .json({ error: "You can only delete your own stories" });
            }
        }
        // Xóa tất cả dữ liệu liên quan trước khi xóa story (theo thứ tự để tránh foreign key constraint)
        try {
            // Xóa SeriesHistory trước (có foreign key đến Chapters)
            await (0, db_1.query) `DELETE FROM SeriesHistory WHERE SeriesID = ${storyId}`;
            console.log(`Đã xóa SeriesHistory cho story ID: ${storyId}`);
        }
        catch (e) {
            console.log(`Không có SeriesHistory cho story ID: ${storyId}`);
        }
        try {
            // ✅ FIX: Lấy danh sách ảnh chapter trước khi xóa để xóa file và thư mục trong storage
            const chapterImagesResult = await (0, db_1.query) `
          SELECT ci.ImageURL, ci.ChapterID
          FROM ChapterImages ci
          INNER JOIN Chapters c ON ci.ChapterID = c.ChapterID
          WHERE c.SeriesID = ${storyId}
        `;
            // ✅ FIX: Thu thập các thư mục chapter để xóa (tránh xóa trùng)
            const chapterFolders = new Set();
            // Xóa file ảnh chapter trong storage và thu thập thư mục
            if (chapterImagesResult.recordset.length > 0) {
                for (const img of chapterImagesResult.recordset) {
                    try {
                        if (img.ImageURL) {
                            // Xóa file riêng lẻ (nếu không nằm trong thư mục chapters/)
                            if (!img.ImageURL.startsWith("/storage/chapters/")) {
                                const imageFileName = img.ImageURL.replace("/storage/", "").split("?")[0];
                                const imagePath = path_1.default.join(uploadsRoot, imageFileName);
                                if (fs_1.default.existsSync(imagePath)) {
                                    fs_1.default.unlinkSync(imagePath);
                                    console.log(`🗑️ Đã xóa ảnh chapter: ${imagePath}`);
                                }
                            }
                            else {
                                // Thu thập thư mục chapter để xóa sau
                                const urlParts = img.ImageURL.split("/");
                                const chaptersIndex = urlParts.indexOf("chapters");
                                if (chaptersIndex >= 0 && urlParts.length > chaptersIndex + 1) {
                                    const folderName = urlParts[chaptersIndex + 1];
                                    chapterFolders.add(folderName);
                                }
                            }
                        }
                    }
                    catch (imgError) {
                        console.error(`⚠️ Lỗi khi xóa ảnh chapter ${img.ImageURL}:`, imgError);
                    }
                }
                // ✅ FIX: Xóa các thư mục chapter đã thu thập
                for (const folderName of chapterFolders) {
                    const chapterFolder = path_1.default.join(uploadsRoot, "chapters", folderName);
                    if (fs_1.default.existsSync(chapterFolder)) {
                        try {
                            // Xóa tất cả file trong thư mục
                            const files = fs_1.default.readdirSync(chapterFolder);
                            for (const file of files) {
                                const filePath = path_1.default.join(chapterFolder, file);
                                try {
                                    if (fs_1.default.statSync(filePath).isFile()) {
                                        fs_1.default.unlinkSync(filePath);
                                    }
                                }
                                catch (fileError) {
                                    console.warn(`⚠️ Không thể xóa file ${filePath}:`, fileError);
                                }
                            }
                            // Xóa thư mục rỗng
                            fs_1.default.rmdirSync(chapterFolder);
                            console.log(`🗑️ Đã xóa thư mục chapter: ${chapterFolder}`);
                        }
                        catch (folderError) {
                            console.warn(`⚠️ Không thể xóa thư mục ${chapterFolder}:`, folderError);
                        }
                    }
                }
            }
            // Xóa ChapterImages trong database (có foreign key đến Chapters)
            await (0, db_1.query) `
          DELETE FROM ChapterImages 
          WHERE ChapterID IN (SELECT ChapterID FROM Chapters WHERE SeriesID = ${storyId})
        `;
            console.log(`Đã xóa ChapterImages cho story ID: ${storyId}`);
        }
        catch (e) {
            console.log(`Không có ChapterImages cho story ID: ${storyId}`);
        }
        try {
            // Xóa chapters
            await (0, db_1.query) `DELETE FROM Chapters WHERE SeriesID = ${storyId}`;
            console.log(`Đã xóa Chapters cho story ID: ${storyId}`);
        }
        catch (e) {
            console.log(`Không có Chapters cho story ID: ${storyId}`);
        }
        try {
            // Xóa comments
            await (0, db_1.query) `DELETE FROM SeriesComments WHERE SeriesID = ${storyId}`;
            console.log(`Đã xóa SeriesComments cho story ID: ${storyId}`);
        }
        catch (e) {
            console.log(`Không có SeriesComments cho story ID: ${storyId}`);
        }
        try {
            // Xóa ratings
            await (0, db_1.query) `DELETE FROM SeriesRatings WHERE SeriesID = ${storyId}`;
            console.log(`Đã xóa SeriesRatings cho story ID: ${storyId}`);
        }
        catch (e) {
            console.log(`Không có SeriesRatings cho story ID: ${storyId}`);
        }
        try {
            // Xóa favorites
            await (0, db_1.query) `DELETE FROM SeriesFavorites WHERE SeriesID = ${storyId}`;
            console.log(`Đã xóa SeriesFavorites cho story ID: ${storyId}`);
        }
        catch (e) {
            console.log(`Không có SeriesFavorites cho story ID: ${storyId}`);
        }
        try {
            // Xóa categories
            await (0, db_1.query) `DELETE FROM SeriesCategories WHERE SeriesID = ${storyId}`;
            console.log(`Đã xóa SeriesCategories cho story ID: ${storyId}`);
        }
        catch (e) {
            console.log(`Không có SeriesCategories cho story ID: ${storyId}`);
        }
        // Lấy thông tin file trước khi xóa story
        const storyInfo = await (0, db_1.query) `
        SELECT CoverURL FROM Series WHERE SeriesID = ${storyId}
      `;
        const story = storyInfo.recordset[0];
        // Cuối cùng xóa story
        await (0, db_1.query) `DELETE FROM Series WHERE SeriesID = ${storyId}`;
        console.log(`Đã xóa story ID: ${storyId}`);
        // ✅ FIX: Xóa file cover trong uploads/
        if (story) {
            try {
                if (story.CoverURL) {
                    const coverFileName = story.CoverURL.replace("/storage/", "").split("?")[0];
                    const coverPath = path_1.default.join(uploadsRoot, coverFileName);
                    if (fs_1.default.existsSync(coverPath)) {
                        fs_1.default.unlinkSync(coverPath);
                        console.log(`🗑️ Đã xóa file cover: ${coverPath}`);
                    }
                    else {
                        console.log(`⚠️ File cover không tồn tại: ${coverPath}`);
                    }
                }
            }
            catch (fileError) {
                console.error("❌ Lỗi khi xóa file cover:", fileError);
            }
        }
        return res.json({ ok: true, message: "Story deleted successfully" });
    }
    catch (e) {
        console.error("DELETE /user/stories/:id error:", e);
        return res.status(500).json({ error: "Failed to delete story" });
    }
});
// Test route để kiểm tra database connection
router.get("/test-db", async (req, res) => {
    try {
        console.log("Testing database connection...");
        const result = await (0, db_1.query) `SELECT TOP 1 * FROM dbo.Users`;
        console.log("Database test result:", result);
        res.json({
            success: true,
            message: "Database connected",
            data: result.recordset,
        });
    }
    catch (error) {
        console.error("Database test error:", error);
        res
            .status(500)
            .json({ error: "Database connection failed", message: error.message });
    }
});
// Admin list stories
router.get("/admin/stories", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (_req, res) => {
    try {
        const rows = await (0, db_1.query) `
        SELECT TOP 200 
          s.SeriesID, s.Title, s.Slug, s.CoverURL, s.Author, s.Status, s.IsFree, s.ViewCount, s.Rating, s.CreatedAt, s.StoryType,
          u.FullName as UploaderName, u.Username as UploaderUsername, u.Email as UploaderEmail,
          r.RoleName as UploaderRole
        FROM Series s
        LEFT JOIN Users u ON s.UploaderID = u.UserID
        LEFT JOIN Roles r ON u.RoleID = r.RoleID
        ORDER BY s.CreatedAt DESC
      `;
        return res.json(rows.recordset);
    }
    catch (e) {
        console.error("GET /admin/stories error:", e);
        return res.status(500).json({ error: "Failed to list stories" });
    }
});
// Get stories for public viewing
router.get("/stories", async (_req, res) => {
    try {
        const result = await (0, db_1.query) `
      SELECT TOP 50 
        s.SeriesID, s.Title, s.Slug, s.CoverURL, s.Rating, s.ViewCount, s.CreatedAt, s.Status,
        u.Username as UploaderName, r.RoleName as UploaderRole
      FROM Series s
      JOIN Users u ON s.UploaderID = u.UserID
      JOIN Roles r ON u.RoleID = r.RoleID
      WHERE s.Status = 'Approved'
      ORDER BY s.CreatedAt DESC
    `;
        res.json(result.recordset);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch stories" });
    }
});
// Get story detail by slug
router.get("/stories/:slug", async (req, res) => {
    try {
        const slug = req.params.slug;
        const result = await (0, db_1.query) `
      SELECT TOP 1 SeriesID, Title, Slug, Description, CoverURL, Author, Status, IsFree, ViewCount, Rating, StoryType
      FROM Series WHERE Slug = ${slug}
    `;
        const story = result.recordset[0];
        if (!story)
            return res.status(404).json({ error: "Story not found" });
        return res.json(story);
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Failed to fetch story" });
    }
});
// ===== CHAPTER MANAGEMENT ROUTES =====
// Add chapter to story
router.post("/stories/:seriesId/chapters", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["create:content"]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const { title, content, chapterNumber, isFree } = req.body;
        if (!seriesId || !title || !content) {
            return res
                .status(400)
                .json({ error: "Missing seriesId, title, or content" });
        }
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        // Check if user owns the series or is admin
        const seriesCheck = await (0, db_1.query) `
        SELECT UploaderID FROM Series WHERE SeriesID = ${seriesId}
      `;
        if (seriesCheck.recordset.length === 0) {
            return res.status(404).json({ error: "Series not found" });
        }
        if (req.user.RoleName !== "Admin" &&
            seriesCheck.recordset[0].UploaderID !== req.user.UserID) {
            return res
                .status(403)
                .json({ error: "You can only add chapters to your own series" });
        }
        // Get next chapter number if not provided
        let finalChapterNumber = chapterNumber;
        if (!finalChapterNumber) {
            const lastChapter = await (0, db_1.query) `
          SELECT MAX(ChapterNumber) as MaxChapter FROM Chapters WHERE SeriesID = ${seriesId}
        `;
            finalChapterNumber = (lastChapter.recordset[0]?.MaxChapter || 0) + 1;
        }
        const chapterResult = await (0, db_1.query) `
        INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, CreatedAt)
        OUTPUT INSERTED.ChapterID
        VALUES (${seriesId}, ${finalChapterNumber}, ${title}, ${content}, ${isFree ? 1 : 0}, GETDATE())
      `;
        const chapterId = chapterResult.recordset[0].ChapterID;
        res.status(201).json({
            message: "Chapter added successfully",
            chapterId,
            chapterNumber: finalChapterNumber,
        });
    }
    catch (e) {
        console.error("POST /stories/:seriesId/chapters error:", e);
        res.status(500).json({ error: "Failed to add chapter" });
    }
});
// Get chapters of a story
router.get("/stories/:seriesId/chapters", async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        if (!seriesId)
            return res.status(400).json({ error: "Invalid series ID" });
        // Get story type first
        const storyInfo = await (0, db_1.query) `
      SELECT StoryType FROM Series WHERE SeriesID = ${seriesId}
    `;
        const storyType = storyInfo.recordset[0]?.StoryType || "Text";
        // Check if ChapterCode column exists
        const checkColumn = await (0, db_1.query) `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Chapters' AND COLUMN_NAME = 'ChapterCode'
    `;
        const hasChapterCode = checkColumn.recordset.length > 0;
        // Get chapters - use different queries based on whether ChapterCode exists
        let chapters;
        if (hasChapterCode) {
            chapters = await (0, db_1.query) `
        SELECT ChapterID, ChapterNumber, Title, Content, IsFree, ImageCount, ViewCount, CreatedAt, ChapterCode
        FROM Chapters 
        WHERE SeriesID = ${seriesId}
        ORDER BY ChapterNumber ASC
      `;
        }
        else {
            chapters = await (0, db_1.query) `
        SELECT ChapterID, ChapterNumber, Title, Content, IsFree, ImageCount, ViewCount, CreatedAt
        FROM Chapters 
        WHERE SeriesID = ${seriesId}
        ORDER BY ChapterNumber ASC
      `;
        }
        // If comic, get images for each chapter
        if (storyType === "Comic") {
            const chaptersWithImages = await Promise.all(chapters.recordset.map(async (chapter) => {
                const images = await (0, db_1.query) `
            SELECT ImageID, ImageURL, ImageOrder, FileSize, Width, Height
            FROM ChapterImages
            WHERE ChapterID = ${chapter.ChapterID}
            ORDER BY ImageOrder ASC
          `;
                return {
                    ...chapter,
                    Images: images.recordset,
                    StoryType: "Comic",
                    ChapterCode: hasChapterCode ? chapter.ChapterCode : undefined,
                };
            }));
            return res.json(chaptersWithImages);
        }
        // For text stories, return as is
        const textChapters = chapters.recordset.map((ch) => ({
            ...ch,
            StoryType: "Text",
            ChapterCode: hasChapterCode ? ch.ChapterCode : undefined,
        }));
        res.json(textChapters);
    }
    catch (e) {
        console.error("GET /stories/:seriesId/chapters error:", e);
        res.status(500).json({ error: "Failed to fetch chapters" });
    }
});
// Update chapter
router.put("/stories/:seriesId/chapters/:chapterId", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["edit:own_content"]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const chapterId = Number(req.params.chapterId);
        const { title, content, chapterNumber, isFree } = req.body;
        if (!seriesId || !chapterId) {
            return res.status(400).json({ error: "Invalid series or chapter ID" });
        }
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        // Check ownership
        const seriesCheck = await (0, db_1.query) `
        SELECT UploaderID FROM Series WHERE SeriesID = ${seriesId}
      `;
        if (seriesCheck.recordset.length === 0) {
            return res.status(404).json({ error: "Series not found" });
        }
        if (req.user.RoleName !== "Admin" &&
            seriesCheck.recordset[0].UploaderID !== req.user.UserID) {
            return res
                .status(403)
                .json({ error: "You can only edit chapters of your own series" });
        }
        // Update chapter
        if (title) {
            await (0, db_1.query) `UPDATE Chapters SET Title = ${title} WHERE ChapterID = ${chapterId}`;
        }
        if (content) {
            await (0, db_1.query) `UPDATE Chapters SET Content = ${content} WHERE ChapterID = ${chapterId}`;
        }
        if (chapterNumber) {
            await (0, db_1.query) `UPDATE Chapters SET ChapterNumber = ${chapterNumber} WHERE ChapterID = ${chapterId}`;
        }
        if (typeof isFree !== "undefined") {
            await (0, db_1.query) `UPDATE Chapters SET IsFree = ${isFree ? 1 : 0} WHERE ChapterID = ${chapterId}`;
        }
        res.json({ message: "Chapter updated successfully" });
    }
    catch (e) {
        console.error("PUT /stories/:seriesId/chapters/:chapterId error:", e);
        res.status(500).json({ error: "Failed to update chapter" });
    }
});
// Delete chapter
router.delete("/stories/:seriesId/chapters/:chapterId", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["delete:any_content"]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const chapterId = Number(req.params.chapterId);
        if (!seriesId || !chapterId) {
            return res.status(400).json({ error: "Invalid series or chapter ID" });
        }
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        // Check ownership
        const seriesCheck = await (0, db_1.query) `
        SELECT UploaderID FROM Series WHERE SeriesID = ${seriesId}
      `;
        if (seriesCheck.recordset.length === 0) {
            return res.status(404).json({ error: "Series not found" });
        }
        if (req.user.RoleName !== "Admin" &&
            seriesCheck.recordset[0].UploaderID !== req.user.UserID) {
            return res
                .status(403)
                .json({ error: "You can only delete chapters of your own series" });
        }
        // ✅ FIX: Xóa ChapterImages và ảnh chapter trong storage (bao gồm cả thư mục) trước khi xóa chapter
        try {
            // Lấy danh sách ảnh chapter để xóa file và thư mục
            const chapterImagesResult = await (0, db_1.query) `
          SELECT ImageURL FROM ChapterImages WHERE ChapterID = ${chapterId}
        `;
            // ✅ FIX: Thu thập thư mục chapter để xóa
            const chapterFolders = new Set();
            // Xóa file ảnh chapter trong storage và thu thập thư mục
            if (chapterImagesResult.recordset.length > 0) {
                for (const img of chapterImagesResult.recordset) {
                    try {
                        if (img.ImageURL) {
                            // Xóa file riêng lẻ (nếu không nằm trong thư mục chapters/)
                            if (!img.ImageURL.startsWith("/storage/chapters/")) {
                                const imageFileName = img.ImageURL.replace("/storage/", "").split("?")[0];
                                const imagePath = path_1.default.join(uploadsRoot, imageFileName);
                                if (fs_1.default.existsSync(imagePath)) {
                                    fs_1.default.unlinkSync(imagePath);
                                    console.log(`🗑️ Đã xóa ảnh chapter: ${imagePath}`);
                                }
                            }
                            else {
                                // Thu thập thư mục chapter để xóa sau
                                const urlParts = img.ImageURL.split("/");
                                const chaptersIndex = urlParts.indexOf("chapters");
                                if (chaptersIndex >= 0 && urlParts.length > chaptersIndex + 1) {
                                    const folderName = urlParts[chaptersIndex + 1];
                                    chapterFolders.add(folderName);
                                }
                            }
                        }
                    }
                    catch (imgError) {
                        console.error(`⚠️ Lỗi khi xóa ảnh chapter ${img.ImageURL}:`, imgError);
                    }
                }
                // ✅ FIX: Xóa các thư mục chapter đã thu thập
                for (const folderName of chapterFolders) {
                    const chapterFolder = path_1.default.join(uploadsRoot, "chapters", folderName);
                    if (fs_1.default.existsSync(chapterFolder)) {
                        try {
                            // Xóa tất cả file trong thư mục
                            const files = fs_1.default.readdirSync(chapterFolder);
                            for (const file of files) {
                                const filePath = path_1.default.join(chapterFolder, file);
                                try {
                                    if (fs_1.default.statSync(filePath).isFile()) {
                                        fs_1.default.unlinkSync(filePath);
                                    }
                                }
                                catch (fileError) {
                                    console.warn(`⚠️ Không thể xóa file ${filePath}:`, fileError);
                                }
                            }
                            // Xóa thư mục rỗng
                            fs_1.default.rmdirSync(chapterFolder);
                            console.log(`🗑️ Đã xóa thư mục chapter: ${chapterFolder}`);
                        }
                        catch (folderError) {
                            console.warn(`⚠️ Không thể xóa thư mục ${chapterFolder}:`, folderError);
                        }
                    }
                }
            }
            // Xóa ChapterImages trong database
            await (0, db_1.query) `DELETE FROM ChapterImages WHERE ChapterID = ${chapterId}`;
            console.log(`Đã xóa ChapterImages cho chapter ID: ${chapterId}`);
        }
        catch (e) {
            console.log(`Không có ChapterImages cho chapter ID: ${chapterId}`);
        }
        // Cuối cùng xóa chapter
        await (0, db_1.query) `DELETE FROM Chapters WHERE ChapterID = ${chapterId}`;
        console.log(`Đã xóa chapter ID: ${chapterId}`);
        res.json({ message: "Chapter deleted successfully" });
    }
    catch (e) {
        console.error("DELETE /stories/:seriesId/chapters/:chapterId error:", e);
        res.status(500).json({ error: "Failed to delete chapter" });
    }
});
// Route này đã được di chuyển xuống dưới để tránh trùng lặp
// Xem route PUT /user/stories/:id ở dòng 4399
// Approve story - CHỈ Admin mới được approve
router.put("/user/stories/:id/approve", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), // CHỈ Admin mới được approve
(0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const storyId = Number(req.params.id);
        if (!storyId)
            return res.status(400).json({ error: "Invalid story ID" });
        // Kiểm tra user có quyền approve story này không
        const storyCheck = await (0, db_1.query) `
        SELECT UploaderID, Status FROM Series WHERE SeriesID = ${storyId}
      `;
        if (storyCheck.recordset.length === 0) {
            return res.status(404).json({ error: "Story not found" });
        }
        const story = storyCheck.recordset[0];
        // CHỈ Admin mới được approve - User KHÔNG THỂ tự approve
        if (req.user?.RoleName !== "Admin") {
            return res.status(403).json({
                error: "Only Admin can approve stories. Your story needs admin approval.",
            });
        }
        // Chỉ cho phép approve story đang ở trạng thái Pending
        if (story.Status !== "Pending") {
            return res.status(400).json({
                error: `Story is already ${story.Status}. Only Pending stories can be approved.`,
            });
        }
        // Update story status to Approved
        await (0, db_1.query) `
        UPDATE Series 
        SET Status = 'Approved', UpdatedAt = GETDATE()
        WHERE SeriesID = ${storyId}
      `;
        // Log activity
        await (0, db_1.query) `
        INSERT INTO ActivityLogs (UserID, Action, TableName, RecordID, NewValue, IPAddress, UserAgent)
        VALUES (${req.user?.UserID}, 'APPROVE_STORY', 'Series', ${storyId}, 
                ${JSON.stringify({ status: "Approved", storyId })}, 
                ${req.ip}, ${req.get("User-Agent")})
      `;
        // Send notification to uploader (if not self-approving)
        if (req.user?.UserID !== story.UploaderID) {
            const uploaderResult = await (0, db_1.query) `
          SELECT Email FROM Users WHERE UserID = ${story.UploaderID}
        `;
            if (uploaderResult.recordset.length > 0) {
                await (0, db_1.query) `
            INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL)
            VALUES (${story.UploaderID}, 'ContentApproval', 'Truyện đã được duyệt', 
                    'Truyện của bạn đã được admin duyệt và hiển thị trên trang chủ.', '/upload')
          `;
            }
        }
        console.log(`✅ Story ${storyId} approved by user ${req.user?.UserID}`);
        res.json({ ok: true, message: "Story approved successfully" });
    }
    catch (e) {
        console.error("PUT /user/stories/:id/approve error:", e);
        if (e instanceof Error) {
            return res.status(500).json({ error: e.message });
        }
        return res.status(500).json({ error: "Failed to approve story" });
    }
});
// Route DELETE /user/stories/:id đã được định nghĩa ở trên (dòng 2203)
// Admin delete story
router.delete("/admin/stories/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["delete:any_content"]), async (req, res) => {
    try {
        const storyId = Number(req.params.id);
        if (!storyId)
            return res.status(400).json({ error: "Invalid id" });
        // Xóa tất cả dữ liệu liên quan trước khi xóa story
        try {
            await (0, db_1.query) `DELETE FROM SeriesComments WHERE SeriesID = ${storyId}`;
            console.log(`Đã xóa SeriesComments cho story ID: ${storyId}`);
        }
        catch (e) {
            console.log(`Không có SeriesComments cho story ID: ${storyId}`);
        }
        try {
            await (0, db_1.query) `DELETE FROM SeriesRatings WHERE SeriesID = ${storyId}`;
            console.log(`Đã xóa SeriesRatings cho story ID: ${storyId}`);
        }
        catch (e) {
            console.log(`Không có SeriesRatings cho story ID: ${storyId}`);
        }
        try {
            await (0, db_1.query) `DELETE FROM SeriesFavorites WHERE SeriesID = ${storyId}`;
            console.log(`Đã xóa SeriesFavorites cho story ID: ${storyId}`);
        }
        catch (e) {
            console.log(`Không có SeriesFavorites cho story ID: ${storyId}`);
        }
        try {
            await (0, db_1.query) `DELETE FROM SeriesHistory WHERE SeriesID = ${storyId}`;
            console.log(`Đã xóa SeriesHistory cho story ID: ${storyId}`);
        }
        catch (e) {
            console.log(`Không có SeriesHistory cho story ID: ${storyId}`);
        }
        // ✅ FIX: Xóa ChapterImages và ảnh chapter trong storage (bao gồm cả thư mục) trước khi xóa Chapters
        try {
            // Lấy danh sách tất cả ảnh chapter để xóa file và thư mục
            const chapterImagesResult = await (0, db_1.query) `
          SELECT ci.ImageURL, ci.ChapterID
          FROM ChapterImages ci
          INNER JOIN Chapters c ON ci.ChapterID = c.ChapterID
          WHERE c.SeriesID = ${storyId}
        `;
            // ✅ FIX: Thu thập các thư mục chapter để xóa (tránh xóa trùng)
            const chapterFolders = new Set();
            // Xóa file ảnh chapter trong storage và thu thập thư mục
            if (chapterImagesResult.recordset.length > 0) {
                for (const img of chapterImagesResult.recordset) {
                    try {
                        if (img.ImageURL) {
                            // Xóa file riêng lẻ (nếu không nằm trong thư mục chapters/)
                            if (!img.ImageURL.startsWith("/storage/chapters/")) {
                                const imageFileName = img.ImageURL.replace("/storage/", "").split("?")[0];
                                const imagePath = path_1.default.join(uploadsRoot, imageFileName);
                                if (fs_1.default.existsSync(imagePath)) {
                                    fs_1.default.unlinkSync(imagePath);
                                    console.log(`🗑️ Đã xóa ảnh chapter: ${imagePath}`);
                                }
                            }
                            else {
                                // Thu thập thư mục chapter để xóa sau
                                const urlParts = img.ImageURL.split("/");
                                const chaptersIndex = urlParts.indexOf("chapters");
                                if (chaptersIndex >= 0 && urlParts.length > chaptersIndex + 1) {
                                    const folderName = urlParts[chaptersIndex + 1];
                                    chapterFolders.add(folderName);
                                }
                            }
                        }
                    }
                    catch (imgError) {
                        console.error(`⚠️ Lỗi khi xóa ảnh chapter ${img.ImageURL}:`, imgError);
                    }
                }
                // ✅ FIX: Xóa các thư mục chapter đã thu thập
                for (const folderName of chapterFolders) {
                    const chapterFolder = path_1.default.join(uploadsRoot, "chapters", folderName);
                    if (fs_1.default.existsSync(chapterFolder)) {
                        try {
                            // Xóa tất cả file trong thư mục
                            const files = fs_1.default.readdirSync(chapterFolder);
                            for (const file of files) {
                                const filePath = path_1.default.join(chapterFolder, file);
                                try {
                                    if (fs_1.default.statSync(filePath).isFile()) {
                                        fs_1.default.unlinkSync(filePath);
                                    }
                                }
                                catch (fileError) {
                                    console.warn(`⚠️ Không thể xóa file ${filePath}:`, fileError);
                                }
                            }
                            // Xóa thư mục rỗng
                            fs_1.default.rmdirSync(chapterFolder);
                            console.log(`🗑️ Đã xóa thư mục chapter: ${chapterFolder}`);
                        }
                        catch (folderError) {
                            console.warn(`⚠️ Không thể xóa thư mục ${chapterFolder}:`, folderError);
                        }
                    }
                }
            }
            // Xóa ChapterImages trong database
            await (0, db_1.query) `
          DELETE FROM ChapterImages 
          WHERE ChapterID IN (SELECT ChapterID FROM Chapters WHERE SeriesID = ${storyId})
        `;
            console.log(`Đã xóa ChapterImages cho story ID: ${storyId}`);
        }
        catch (e) {
            console.log(`Không có ChapterImages cho story ID: ${storyId}`);
        }
        try {
            // Xóa chapters
            await (0, db_1.query) `DELETE FROM Chapters WHERE SeriesID = ${storyId}`;
            console.log(`Đã xóa Chapters cho story ID: ${storyId}`);
        }
        catch (e) {
            console.log(`Không có Chapters cho story ID: ${storyId}`);
        }
        try {
            await (0, db_1.query) `DELETE FROM SeriesCategories WHERE SeriesID = ${storyId}`;
            console.log(`Đã xóa SeriesCategories cho story ID: ${storyId}`);
        }
        catch (e) {
            console.log(`Không có SeriesCategories cho story ID: ${storyId}`);
        }
        // Lấy thông tin file trước khi xóa story
        const storyInfo = await (0, db_1.query) `
        SELECT CoverURL FROM Series WHERE SeriesID = ${storyId}
      `;
        const story = storyInfo.recordset[0];
        // Cuối cùng xóa story
        await (0, db_1.query) `DELETE FROM Series WHERE SeriesID = ${storyId}`;
        console.log(`Đã xóa story ID: ${storyId}`);
        // ✅ FIX: Xóa file cover trong uploads/
        if (story) {
            try {
                if (story.CoverURL) {
                    // Loại bỏ query string (?v=timestamp) khỏi URL
                    const coverFileName = story.CoverURL.replace("/storage/", "").split("?")[0];
                    const coverPath = path_1.default.join(uploadsRoot, coverFileName);
                    if (fs_1.default.existsSync(coverPath)) {
                        fs_1.default.unlinkSync(coverPath);
                        console.log(`🗑️ Đã xóa file cover: ${coverPath}`);
                    }
                    else {
                        console.log(`⚠️ File cover không tồn tại: ${coverPath}`);
                    }
                }
            }
            catch (fileError) {
                console.error("❌ Lỗi khi xóa file cover:", fileError);
            }
        }
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("DELETE /admin/stories/:id error:", e);
        return res.status(500).json({ error: "Failed to delete story" });
    }
});
// =============================================
// ADMIN USER MANAGEMENT ROUTES
// =============================================
// Get all users for admin
router.get("/admin/users", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["view:any_user"]), async (_req, res) => {
    try {
        const users = await (0, db_1.query) `
        SELECT 
          u.UserID, u.Username, u.Email, u.FullName, u.IsActive, u.IsEmailVerified,
          u.CreatedAt, u.LastLoginAt, r.RoleName,
          CAST(
            CASE 
              WHEN ue.TotalExp IS NULL THEN 1
              ELSE FLOOR(ue.TotalExp / 100) + 1
            END AS INT
          ) as Level
        FROM Users u
        JOIN Roles r ON u.RoleID = r.RoleID
        LEFT JOIN UserExp ue ON u.UserID = ue.UserID
        ORDER BY u.CreatedAt DESC
      `;
        res.json(users.recordset);
    }
    catch (e) {
        console.error("GET /admin/users error:", e);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});
// Update user role
router.put("/admin/users/:id/role", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_user"]), async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const { role } = req.body;
        if (!userId || !role) {
            return res.status(400).json({ error: "Invalid user ID or role" });
        }
        // Get role ID
        const roleResult = await (0, db_1.query) `SELECT RoleID FROM Roles WHERE RoleName = ${role}`;
        if (roleResult.recordset.length === 0) {
            return res.status(400).json({ error: "Invalid role" });
        }
        const roleId = roleResult.recordset[0].RoleID;
        // Lấy thông tin user trước khi update (bao gồm role cũ)
        const userInfo = await (0, db_1.query) `
        SELECT u.Email, u.FullName, u.RoleID, r.RoleName
        FROM Users u
        INNER JOIN Roles r ON u.RoleID = r.RoleID
        WHERE u.UserID = ${userId}
      `;
        const targetUser = userInfo.recordset[0];
        if (!targetUser) {
            return res.status(404).json({ error: "User not found" });
        }
        const oldRoleId = targetUser.RoleID;
        const oldRoleName = targetUser.RoleName;
        const isDowngrade = roleId < oldRoleId; // RoleID nhỏ hơn = quyền thấp hơn
        const isUpgrade = roleId > oldRoleId; // RoleID lớn hơn = quyền cao hơn
        // Update user role
        await (0, db_1.query) `UPDATE Users SET RoleID = ${roleId}, UpdatedAt = GETDATE() WHERE UserID = ${userId}`;
        // Tạo thông báo cho user khi quyền được cập nhật (phân biệt nâng cấp/giảm cấp)
        try {
            let notificationTitle = "";
            let notificationContent = "";
            let notificationType = "RoleUpgrade";
            if (isDowngrade) {
                notificationTitle = "Quyền của bạn đã bị giảm cấp";
                notificationContent = `Admin ${req.user.email} đã giảm quyền của bạn từ ${oldRoleName} xuống ${role}. Bạn sẽ mất một số quyền truy cập.`;
                notificationType = "RoleDowngrade";
            }
            else if (isUpgrade) {
                notificationTitle = "Quyền của bạn đã được nâng cấp";
                notificationContent = `Admin ${req.user.email} đã nâng cấp quyền của bạn từ ${oldRoleName} lên ${role}.`;
                notificationType = "RoleUpgrade";
            }
            else {
                // Cùng role (không thay đổi)
                notificationTitle = "Quyền của bạn đã được cập nhật";
                notificationContent = `Admin ${req.user.email} đã cập nhật quyền của bạn thành ${role}`;
                notificationType = "RoleUpgrade";
            }
            // Sử dụng biến riêng để tránh lỗi template literal
            const notifTitleVar = notificationTitle;
            const notifContentVar = notificationContent;
            await (0, db_1.query) `
          INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead, CreatedAt)
          VALUES (
            ${userId},
            ${notificationType},
            ${notifTitleVar},
            ${notifContentVar},
            N'/profile',
            0,
            GETDATE()
          )
        `;
            console.log(`✅ Đã tạo thông báo cho user ${targetUser.Email} về việc ${isDowngrade ? "giảm cấp" : isUpgrade ? "nâng cấp" : "cập nhật"} quyền`);
        }
        catch (notifError) {
            console.error("❌ Lỗi khi tạo thông báo về việc cập nhật quyền:", notifError);
        }
        // Log activity
        await (0, db_1.query) `
        INSERT INTO ActivityLogs (UserID, Action, TableName, RecordID, NewValue, IPAddress, UserAgent)
        VALUES (${req.user?.UserID}, 'UPDATE_USER_ROLE', 'Users', ${userId}, 
                ${JSON.stringify({ role, roleId })}, ${req.ip}, ${req.get("User-Agent")})
      `;
        res.json({ ok: true });
    }
    catch (e) {
        console.error("PUT /admin/users/:id/role error:", e);
        res.status(500).json({ error: "Failed to update user role" });
    }
});
// Update user status (active/inactive)
router.put("/admin/users/:id/status", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_user"]), async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const { isActive } = req.body;
        if (!userId || typeof isActive !== "boolean") {
            return res.status(400).json({ error: "Invalid user ID or status" });
        }
        // Update user status
        await (0, db_1.query) `UPDATE Users SET IsActive = ${isActive ? 1 : 0}, UpdatedAt = GETDATE() WHERE UserID = ${userId}`;
        // Log activity
        await (0, db_1.query) `
        INSERT INTO ActivityLogs (UserID, Action, TableName, RecordID, NewValue, IPAddress, UserAgent)
        VALUES (${req.user?.UserID}, 'UPDATE_USER_STATUS', 'Users', ${userId}, 
                ${JSON.stringify({ isActive })}, ${req.ip}, ${req.get("User-Agent")})
      `;
        res.json({ ok: true });
    }
    catch (e) {
        console.error("PUT /admin/users/:id/status error:", e);
        res.status(500).json({ error: "Failed to update user status" });
    }
});
// =============================================
// ROLE UPGRADE REQUEST ROUTES
// =============================================
// Get all role upgrade requests for admin
router.get("/admin/role-upgrade-requests", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["view:any_user"]), async (_req, res) => {
    try {
        const requests = await (0, db_1.query) `
        SELECT 
          rur.RequestID, rur.Reason, rur.Status, rur.ReviewNote,
          rur.RequestedAt, rur.ReviewedAt,
          u.Username, u.Email,
          cr.RoleName as CurrentRole,
          rr.RoleName as RequestedRole
        FROM RoleUpgradeRequests rur
        LEFT JOIN Users u ON rur.UserID = u.UserID
        LEFT JOIN Roles cr ON u.RoleID = cr.RoleID
        LEFT JOIN Roles rr ON rur.RequestedRoleID = rr.RoleID
        ORDER BY rur.RequestedAt DESC
      `;
        res.json(requests.recordset);
    }
    catch (e) {
        console.error("GET /admin/role-upgrade-requests error:", e);
        res.status(500).json({ error: "Failed to fetch upgrade requests" });
    }
});
// Handle role upgrade request (approve/reject)
router.put("/admin/role-upgrade-requests/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_user"]), async (req, res) => {
    try {
        console.log(`🔍 [DEBUG] PUT /admin/role-upgrade-requests/:id - Start`);
        console.log(`🔍 [DEBUG] Request ID: ${req.params.id}`);
        console.log(`🔍 [DEBUG] Body:`, req.body);
        if (!req.user || !req.user.UserID) {
            console.error("❌ [DEBUG] No user or UserID");
            return res.status(401).json({ error: "Authentication required" });
        }
        const requestId = Number(req.params.id);
        const { action, note, force } = req.body;
        console.log(`🔍 [DEBUG] Parsed requestId: ${requestId}, action: ${action}`);
        if (!requestId || !action || !["approve", "reject"].includes(action)) {
            console.error("❌ [DEBUG] Invalid request ID or action");
            return res.status(400).json({ error: "Invalid request ID or action" });
        }
        // Get request details
        console.log(`🔍 [DEBUG] Fetching request details for ID: ${requestId}`);
        const requestResult = await (0, db_1.query) `
        SELECT TOP 1
          rur.RequestID,
          rur.UserID,
          rur.RequestedRoleID,
          rur.Status,
          rur.Reason,
          rur.RequestedAt,
          u.Username,
          u.Email,
          u.RoleID as CurrentRoleID
        FROM RoleUpgradeRequests rur
        LEFT JOIN Users u ON rur.UserID = u.UserID
        WHERE rur.RequestID = ${requestId}
      `;
        console.log(`🔍 [DEBUG] Request result count: ${requestResult.recordset.length}`);
        if (requestResult.recordset.length === 0) {
            console.error("❌ [DEBUG] Request not found");
            return res.status(404).json({ error: "Request not found" });
        }
        const request = requestResult.recordset[0];
        // Đảm bảo UserID là số, không phải array
        const userId = Array.isArray(request.UserID)
            ? request.UserID[0]
            : Number(request.UserID);
        const requestedRoleId = Number(request.RequestedRoleID);
        const currentRoleId = request.CurrentRoleID
            ? Number(request.CurrentRoleID)
            : null;
        console.log(`🔍 [DEBUG] Request details:`, {
            RequestID: request.RequestID,
            UserID: userId,
            UserIDRaw: request.UserID,
            RequestedRoleID: requestedRoleId,
            CurrentRoleID: currentRoleId,
            Status: request.Status,
        });
        if (!userId || isNaN(userId) || userId <= 0) {
            console.error("❌ [DEBUG] Invalid UserID:", request.UserID);
            return res
                .status(404)
                .json({ error: "User not found for this request" });
        }
        // Tạo object request mới với UserID đã được normalize
        const normalizedRequest = {
            ...request,
            UserID: userId,
            RequestedRoleID: requestedRoleId,
            CurrentRoleID: currentRoleId,
        };
        const newStatus = action === "approve" ? "Approved" : "Rejected";
        console.log(`🔍 [DEBUG] New status: ${newStatus}`);
        // If approved, update user role FIRST (even if request already processed)
        if (action === "approve") {
            try {
                // Lấy role hiện tại của user TRƯỚC khi update (từ request hoặc query lại)
                const currentRoleId = normalizedRequest.CurrentRoleID || 0;
                // Lấy role names để tạo thông báo (query riêng để tránh lỗi)
                let currentRoleName = "Unknown";
                let requestedRoleName = "Unknown";
                if (currentRoleId > 0) {
                    try {
                        const currentRoleResult = await (0, db_1.query) `
                SELECT RoleName FROM Roles WHERE RoleID = ${currentRoleId}
              `;
                        currentRoleName =
                            currentRoleResult.recordset[0]?.RoleName || "Unknown";
                    }
                    catch (e) {
                        console.warn("⚠️ Không thể lấy current role name:", e);
                    }
                }
                try {
                    const requestedRoleResult = await (0, db_1.query) `
              SELECT RoleName FROM Roles WHERE RoleID = ${normalizedRequest.RequestedRoleID}
            `;
                    requestedRoleName =
                        requestedRoleResult.recordset[0]?.RoleName || "Unknown";
                }
                catch (e) {
                    console.warn("⚠️ Không thể lấy requested role name:", e);
                }
                // Update user role
                await (0, db_1.query) `
            UPDATE Users 
            SET RoleID = ${normalizedRequest.RequestedRoleID}, UpdatedAt = GETDATE()
            WHERE UserID = ${normalizedRequest.UserID}
          `;
                console.log(`✅ Updated user ${normalizedRequest.UserID} role from ${currentRoleName} (${currentRoleId}) to ${requestedRoleName} (${normalizedRequest.RequestedRoleID})`);
                // Tạo thông báo cho user về việc nâng cấp quyền
                try {
                    const isUpgrade = normalizedRequest.RequestedRoleID > currentRoleId;
                    const notificationTitle = isUpgrade
                        ? "Quyền của bạn đã được nâng cấp"
                        : "Quyền của bạn đã được cập nhật";
                    const notificationContent = isUpgrade
                        ? `Admin ${req.user.email} đã nâng cấp quyền của bạn từ ${currentRoleName} lên ${requestedRoleName}.`
                        : `Admin ${req.user.email} đã cập nhật quyền của bạn thành ${requestedRoleName}`;
                    // Sử dụng biến riêng để tránh lỗi template literal
                    const notifTitleStr = notificationTitle;
                    const notifContentStr = notificationContent;
                    await (0, db_1.query) `
              INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead, CreatedAt)
              VALUES (
                ${normalizedRequest.UserID},
                'RoleUpgrade',
                ${notifTitleStr},
                ${notifContentStr},
                N'/profile',
                0,
                GETDATE()
              )
            `;
                    console.log(`✅ Đã tạo thông báo cho user ${normalizedRequest.UserID} về việc ${isUpgrade ? "nâng cấp" : "cập nhật"} quyền`);
                }
                catch (notifError) {
                    console.error("❌ Lỗi khi tạo thông báo về việc nâng cấp quyền:", notifError);
                    console.error("Notification error details:", notifError?.message);
                    // Không throw error, chỉ log để không làm gián đoạn flow
                }
            }
            catch (approveError) {
                console.error("❌ Lỗi khi approve role upgrade:", approveError);
                throw approveError; // Throw để catch ở ngoài xử lý
            }
        }
        // Update request status (only if still pending)
        console.log(`🔍 [DEBUG] Current request status: ${normalizedRequest.Status}`);
        if (normalizedRequest.Status === "Pending") {
            console.log(`🔍 [DEBUG] Updating request status to ${newStatus}`);
            const reviewNote = note || null;
            try {
                await (0, db_1.query) `
            UPDATE RoleUpgradeRequests 
            SET Status = ${newStatus}, ReviewNote = ${reviewNote}, 
                ReviewedBy = ${req.user.UserID}, ReviewedAt = GETDATE()
            WHERE RequestID = ${requestId}
          `;
                console.log(`✅ Đã cập nhật trạng thái request ${requestId} thành ${newStatus}`);
            }
            catch (updateError) {
                console.error("❌ [DEBUG] Lỗi khi update request status:", updateError);
                throw updateError;
            }
        }
        else {
            console.log(`⚠️ [DEBUG] Request status is ${normalizedRequest.Status}, không cần update`);
        }
        // Log activity
        if (action === "approve") {
            try {
                await (0, db_1.query) `
            INSERT INTO ActivityLogs (UserID, Action, TableName, RecordID, NewValue, IPAddress, UserAgent)
            VALUES (${req.user.UserID}, 'APPROVE_ROLE_UPGRADE', 'Users', ${normalizedRequest.UserID}, 
                    ${JSON.stringify({
                    newRoleId: normalizedRequest.RequestedRoleID,
                    requestId,
                })}, 
                    ${req.ip}, ${req.get("User-Agent")})
          `;
            }
            catch (logError) {
                console.error("❌ Lỗi khi log activity:", logError);
                // Không throw error, chỉ log
            }
        }
        else {
            // Send notification to user when rejected
            try {
                const rejectReason = note || "Không có lý do cụ thể";
                const rejectTitle = "Yêu cầu nâng cấp quyền bị từ chối";
                const rejectContent = `Yêu cầu nâng cấp quyền của bạn đã bị từ chối. Lý do: ${rejectReason}`;
                // Sử dụng biến riêng để tránh lỗi template literal
                const rejectTitleStr = rejectTitle;
                const rejectContentStr = rejectContent;
                await (0, db_1.query) `
            INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead, CreatedAt)
            VALUES (
              ${normalizedRequest.UserID}, 
              'RoleUpgrade', 
              ${rejectTitleStr}, 
              ${rejectContentStr}, 
              N'/role-upgrade', 
              0, 
              GETDATE()
            )
          `;
                console.log(`✅ Đã tạo thông báo từ chối cho user ${normalizedRequest.UserID}`);
            }
            catch (notifError) {
                console.error("❌ Lỗi khi tạo thông báo từ chối:", notifError);
                // Không throw error, chỉ log
            }
        }
        console.log(`✅ [DEBUG] Successfully processed request ${requestId} with action ${action}`);
        res.json({
            ok: true,
            message: `Request ${action === "approve" ? "approved" : "rejected"} successfully`,
        });
    }
    catch (e) {
        console.error("❌ [DEBUG] PUT /admin/role-upgrade-requests/:id error:", e);
        console.error("❌ [DEBUG] Error details:", {
            message: e?.message,
            stack: e?.stack,
            requestId: req.params.id,
            action: req.body?.action,
            errorName: e?.name,
            errorCode: e?.code,
        });
        res.status(500).json({
            error: "Failed to process upgrade request",
            details: e?.message || "Unknown error",
        });
    }
});
// =============================================
// USER ROLE UPGRADE REQUEST ROUTES
// =============================================
// Get available roles
router.get("/roles", async (_req, res) => {
    try {
        const roles = await (0, db_1.query) `SELECT RoleID, RoleName, Description FROM Roles ORDER BY RoleID`;
        res.json(roles.recordset);
    }
    catch (e) {
        console.error("GET /roles error:", e);
        res.status(500).json({ error: "Failed to fetch roles" });
    }
});
// Submit role upgrade request
router.post("/user/role-upgrade-request", authenticate, async (req, res) => {
    try {
        const { requestedRole, reason } = req.body;
        if (!requestedRole || !reason) {
            return res
                .status(400)
                .json({ error: "Requested role and reason are required" });
        }
        // Check if user has pending request
        const existingRequest = await (0, db_1.query) `
        SELECT RequestID FROM RoleUpgradeRequests 
        WHERE UserID = ${req.user?.UserID} AND Status = 'Pending'
      `;
        if (existingRequest.recordset.length > 0) {
            return res
                .status(400)
                .json({ error: "You already have a pending upgrade request" });
        }
        // Get requested role ID
        const roleResult = await (0, db_1.query) `SELECT RoleID FROM Roles WHERE RoleName = ${requestedRole}`;
        if (roleResult.recordset.length === 0) {
            return res.status(400).json({ error: "Invalid role" });
        }
        const requestedRoleId = roleResult.recordset[0].RoleID;
        // Check if user is trying to upgrade to a lower or same role
        if (requestedRoleId <= (req.user?.RoleID || 0)) {
            return res
                .status(400)
                .json({ error: "Cannot upgrade to same or lower role" });
        }
        // Create upgrade request
        await (0, db_1.query) `
        INSERT INTO RoleUpgradeRequests (UserID, RequestedRoleID, Reason, Status)
        VALUES (${req.user?.UserID}, ${requestedRoleId}, ${reason}, 'Pending')
      `;
        // Tạo thông báo cho tất cả Admin khi user xin nâng cấp tài khoản
        try {
            const adminUsers = await (0, db_1.query) `
          SELECT u.UserID, u.Email
          FROM Users u
          INNER JOIN Roles r ON u.RoleID = r.RoleID
          WHERE r.RoleName = 'Admin' AND u.IsActive = 1
        `;
            for (const admin of adminUsers.recordset) {
                await (0, db_1.query) `
            INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead, CreatedAt)
            VALUES (
              ${admin.UserID},
              'RoleUpgradeRequest',
              N'Yêu cầu nâng cấp tài khoản',
              N'${req.user.email} đã gửi yêu cầu nâng cấp quyền thành ${requestedRole}',
              N'/admin/users',
              0,
              GETDATE()
            )
          `;
            }
            console.log(`✅ Đã tạo thông báo cho ${adminUsers.recordset.length} Admin về yêu cầu nâng cấp tài khoản`);
        }
        catch (notifError) {
            console.error("❌ Lỗi khi tạo thông báo về yêu cầu nâng cấp:", notifError);
        }
        res.json({ ok: true });
    }
    catch (e) {
        console.error("POST /user/role-upgrade-request error:", e);
        res.status(500).json({ error: "Failed to submit upgrade request" });
    }
});
// Get user's role upgrade requests
router.get("/user/role-upgrade-requests", authenticate, async (req, res) => {
    try {
        const requests = await (0, db_1.query) `
        SELECT 
          rur.RequestID, rur.Reason, rur.Status, rur.ReviewNote,
          rur.RequestedAt, rur.ReviewedAt,
          r.RoleName as RequestedRoleName
        FROM RoleUpgradeRequests rur
        JOIN Roles r ON rur.RequestedRoleID = r.RoleID
        WHERE rur.UserID = ${req.user?.UserID}
        ORDER BY rur.RequestedAt DESC
      `;
        res.json(requests.recordset);
    }
    catch (e) {
        console.error("GET /user/role-upgrade-requests error:", e);
        res.status(500).json({ error: "Failed to fetch upgrade requests" });
    }
});
// 1. Route chỉ dành cho ADMIN (Quản lý người dùng)
router.delete("/users/:id", authenticate, (0, authMiddleware_1.authorize)(["manage:users"]), (req, res) => {
    // Logic xóa/chặn người dùng
    res.json({ message: "Đã xóa người dùng." });
});
// 2. Route dành cho ADMIN và EDITOR (Chỉnh sửa nội dung bất kỳ)
router.put("/content/:id", authenticate, (0, authMiddleware_1.authorize)(["edit:any_content"]), (req, res) => {
    // Logic chỉnh sửa nội dung
    res.json({ message: "Đã cập nhật nội dung của người khác." });
});
// 3. Route mặc định (Chỉ cần đăng nhập để xem)
router.get("/dashboard", authenticate, (0, authMiddleware_1.authorize)(["read:content"]), (req, res) => {
    res.json({
        message: `Chào mừng ${req.user.email}, bạn là ${req.user.role}`,
    });
});
// In-memory fallback store for preferences when DB is unavailable
// Keyed by user email -> { [key]: value }
const inMemoryPreferences = new Map();
// In-memory fallback for user profiles keyed by email
const inMemoryUsers = new Map();
// In-memory favorites: email -> Set of movie IDs
const inMemoryFavorites = new Map();
const inMemoryNotifications = new Map();
// In-memory watch history: email -> array of { MovieID, EpisodeID?, WatchedAt }
const inMemoryMovieHistory = new Map();
router.get("/categories", async (_req, res) => {
    try {
        const result = await (0, db_1.query) `SELECT CategoryID, CategoryName, Slug, Description, Type, CreatedAt FROM Categories ORDER BY CategoryName`;
        res.json(result.recordset);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch categories" });
    }
});
// --- Admin Categories CRUD ---
router.get("/admin/categories", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), async (_req, res) => {
    try {
        const result = await (0, db_1.query) `SELECT CategoryID, CategoryName, Slug, Description, Type, CreatedAt FROM Categories ORDER BY CategoryName`;
        res.json(result.recordset);
    }
    catch (e) {
        console.error("GET /admin/categories error:", e);
        res.status(500).json({ error: "Failed to fetch categories" });
    }
});
router.post("/admin/categories", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), async (req, res) => {
    try {
        const { name, type } = req.body;
        const trimmedName = String(name || "").trim();
        const normalizedType = String(type || "Both").trim();
        if (!trimmedName) {
            return res.status(400).json({ error: "Category name is required" });
        }
        if (!["Movie", "Series", "Both"].includes(normalizedType)) {
            return res.status(400).json({ error: "Invalid category type" });
        }
        const baseSlug = (0, slugify_1.default)(trimmedName, { lower: true, strict: true });
        // Ensure slug uniqueness by appending -n if exists
        let finalSlug = baseSlug;
        let attempt = 1;
        while (true) {
            const exists = await (0, db_1.query) `SELECT COUNT(*) AS cnt FROM Categories WHERE Slug = ${finalSlug}`;
            if ((exists.recordset[0]?.cnt ?? 0) === 0)
                break;
            attempt += 1;
            finalSlug = `${baseSlug}-${attempt}`;
        }
        await (0, db_1.query) `
        INSERT INTO Categories (CategoryName, Slug, Description, Type, CreatedAt)
        VALUES (${trimmedName}, ${finalSlug}, ${null}, ${normalizedType}, GETDATE())
      `;
        res.status(201).json({
            message: "Category created",
            CategoryName: trimmedName,
            Slug: finalSlug,
            Type: normalizedType,
        });
    }
    catch (e) {
        console.error("POST /admin/categories error:", e);
        res.status(500).json({ error: "Failed to create category" });
    }
});
router.put("/admin/categories/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), async (req, res) => {
    try {
        const categoryId = Number(req.params.id);
        if (!Number.isFinite(categoryId)) {
            return res.status(400).json({ error: "Invalid category id" });
        }
        const { name, type } = req.body;
        // Load current
        const current = await (0, db_1.query) `
        SELECT TOP 1 CategoryID, CategoryName, Slug, Description, Type
        FROM Categories WHERE CategoryID = ${categoryId}
      `;
        const row = current.recordset[0];
        if (!row)
            return res.status(404).json({ error: "Category not found" });
        let newName = typeof name === "string" && name.trim()
            ? name.trim()
            : row.CategoryName;
        let newType = typeof type === "string" && type.trim() ? type.trim() : row.Type;
        if (!["Movie", "Series", "Both"].includes(newType))
            newType = row.Type;
        let newSlug = row.Slug;
        if (name && name.trim() && name.trim() !== row.CategoryName) {
            const baseSlug = (0, slugify_1.default)(name.trim(), { lower: true, strict: true });
            let finalSlug = baseSlug;
            let attempt = 1;
            while (true) {
                const exists = await (0, db_1.query) `SELECT COUNT(*) AS cnt FROM Categories WHERE Slug = ${finalSlug} AND CategoryID <> ${categoryId}`;
                if ((exists.recordset[0]?.cnt ?? 0) === 0)
                    break;
                attempt += 1;
                finalSlug = `${baseSlug}-${attempt}`;
            }
            newSlug = finalSlug;
        }
        await (0, db_1.query) `
        UPDATE Categories
        SET CategoryName = ${newName},
            Slug = ${newSlug},
            Description = ${null},
            Type = ${newType}
        WHERE CategoryID = ${categoryId}
      `;
        res.json({ message: "Category updated" });
    }
    catch (e) {
        console.error("PUT /admin/categories/:id error:", e);
        res.status(500).json({ error: "Failed to update category" });
    }
});
router.delete("/admin/categories/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), async (req, res) => {
    try {
        const categoryId = Number(req.params.id);
        if (!Number.isFinite(categoryId)) {
            return res.status(400).json({ error: "Invalid category id" });
        }
        // Remove relations first
        await (0, db_1.query) `DELETE FROM MovieCategories WHERE CategoryID = ${categoryId}`;
        await (0, db_1.query) `DELETE FROM SeriesCategories WHERE CategoryID = ${categoryId}`;
        const result = await (0, db_1.query) `DELETE FROM Categories WHERE CategoryID = ${categoryId}`;
        const rows = result.rowsAffected?.[0] ?? 0;
        if (!rows)
            return res.status(404).json({ error: "Category not found" });
        res.json({ message: "Category deleted" });
    }
    catch (e) {
        console.error("DELETE /admin/categories/:id error:", e);
        res.status(500).json({ error: "Failed to delete category" });
    }
});
// Get categories for a specific movie
router.get("/movies/:movieId/categories", async (req, res) => {
    try {
        const movieId = Number(req.params.movieId);
        const result = await (0, db_1.query) `
      SELECT c.CategoryID, c.CategoryName, c.Slug
      FROM Categories c
      INNER JOIN MovieCategories mc ON c.CategoryID = mc.CategoryID
      WHERE mc.MovieID = ${movieId}
      ORDER BY c.CategoryName
    `;
        res.json(result.recordset);
    }
    catch (e) {
        console.error("GET /movies/:movieId/categories error:", e);
        res.status(500).json({ error: "Failed to fetch movie categories" });
    }
});
// Get movies by category
router.get("/categories/:categoryId/movies", async (req, res) => {
    try {
        const categoryId = Number(req.params.categoryId);
        const result = await (0, db_1.query) `
      SELECT m.MovieID, m.Title, m.Slug, m.PosterURL, m.Rating, m.ViewCount
      FROM Movies m
      INNER JOIN MovieCategories mc ON m.MovieID = mc.MovieID
      WHERE mc.CategoryID = ${categoryId} AND m.Status = 'Approved'
      ORDER BY m.CreatedAt DESC
    `;
        res.json(result.recordset);
    }
    catch (e) {
        console.error("GET /categories/:categoryId/movies error:", e);
        res.status(500).json({ error: "Failed to fetch movies by category" });
    }
});
// Get series by category
router.get("/categories/:categoryId/series", async (req, res) => {
    try {
        const categoryId = Number(req.params.categoryId);
        const result = await (0, db_1.query) `
      SELECT s.SeriesID, s.Title, s.Slug, s.CoverURL, s.Rating, s.ViewCount
      FROM Series s
      INNER JOIN SeriesCategories sc ON s.SeriesID = sc.SeriesID
      WHERE sc.CategoryID = ${categoryId} AND s.Status = 'Approved'
      ORDER BY s.CreatedAt DESC
    `;
        res.json(result.recordset);
    }
    catch (e) {
        console.error("GET /categories/:categoryId/series error:", e);
        res.status(500).json({ error: "Failed to fetch series by category" });
    }
});
// Get categories for a story
router.get("/stories/:storyId/categories", async (req, res) => {
    try {
        const storyId = Number(req.params.storyId);
        const result = await (0, db_1.query) `
      SELECT c.CategoryID, c.CategoryName, c.Slug
      FROM Categories c
      INNER JOIN SeriesCategories sc ON c.CategoryID = sc.CategoryID
      WHERE sc.SeriesID = ${storyId}
      ORDER BY c.CategoryName
    `;
        res.json(result.recordset);
    }
    catch (e) {
        console.error("GET /stories/:storyId/categories error:", e);
        res.status(500).json({ error: "Failed to fetch story categories" });
    }
});
// Get tags for a movie (using categories as tags for now)
router.get("/movies/:id/tags", async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        // For now, return categories as tags
        // If you have a separate Tags table, modify this query
        const result = await (0, db_1.query) `
      SELECT c.CategoryID as TagID, c.CategoryName as TagName, c.Slug
      FROM Categories c
      INNER JOIN MovieCategories mc ON c.CategoryID = mc.CategoryID
      WHERE mc.MovieID = ${movieId}
      ORDER BY c.CategoryName
    `;
        res.json(result.recordset);
    }
    catch (e) {
        console.error("GET /movies/:id/tags error:", e);
        res.status(500).json({ error: "Failed to fetch movie tags" });
    }
});
// Get tags for a story/series (using categories as tags for now)
router.get("/stories/:id/tags", async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        // For now, return categories as tags
        // If you have a separate Tags table, modify this query
        const result = await (0, db_1.query) `
      SELECT c.CategoryID as TagID, c.CategoryName as TagName, c.Slug
      FROM Categories c
      INNER JOIN SeriesCategories sc ON c.CategoryID = sc.CategoryID
      WHERE sc.SeriesID = ${seriesId}
      ORDER BY c.CategoryName
    `;
        res.json(result.recordset);
    }
    catch (e) {
        console.error("GET /stories/:id/tags error:", e);
        res.status(500).json({ error: "Failed to fetch story tags" });
    }
});
router.get("/movies", async (_req, res) => {
    try {
        const result = await (0, db_1.query) `
      SELECT TOP 50 
        m.MovieID, m.Title, m.Slug, m.PosterURL, m.Rating, m.ViewCount, m.CreatedAt, m.Status,
        u.Username as UploaderName, r.RoleName as UploaderRole
      FROM Movies m
      JOIN Users u ON m.UploaderID = u.UserID
      JOIN Roles r ON u.RoleID = r.RoleID
      WHERE m.Status = 'Approved'
      ORDER BY m.CreatedAt DESC
    `;
        res.json(result.recordset);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch movies" });
    }
});
// Debug endpoint to see all movies (including pending)
router.get("/movies/debug", async (_req, res) => {
    try {
        const result = await (0, db_1.query) `
      SELECT TOP 50 
        m.MovieID, m.Title, m.Slug, m.PosterURL, m.Rating, m.ViewCount, m.CreatedAt, m.Status,
        u.Username as UploaderName, r.RoleName as UploaderRole
      FROM Movies m
      JOIN Users u ON m.UploaderID = u.UserID
      JOIN Roles r ON u.RoleID = r.RoleID
      ORDER BY m.CreatedAt DESC
    `;
        res.json(result.recordset);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch movies" });
    }
});
// Auto-approve all pending movies (for testing)
router.post("/movies/auto-approve", async (_req, res) => {
    try {
        const result = await (0, db_1.query) `
      UPDATE Movies 
      SET Status = 'Approved', UpdatedAt = GETDATE()
      WHERE Status = 'Pending'
    `;
        const countResult = await (0, db_1.query) `
      SELECT COUNT(*) as count FROM Movies WHERE Status = 'Approved'
    `;
        res.json({
            message: "Auto-approved all pending movies",
            approvedCount: countResult.recordset[0].count,
        });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to auto-approve movies" });
    }
});
// Debug endpoint to check current user
router.get("/debug/user", authenticate, (req, res) => {
    res.json({
        user: req.user,
        headers: {
            "x-user-email": req.header("x-user-email"),
            "user-agent": req.get("User-Agent"),
        },
    });
});
// Simple delete endpoint - always returns JSON
router.delete("/movies/delete/:id", async (req, res) => {
    try {
        const movieId = parseInt(req.params.id);
        console.log(`🗑️ Delete movie ID: ${movieId}`);
        if (!movieId || isNaN(movieId)) {
            return res.status(400).json({
                success: false,
                error: "Invalid movie ID",
                movieId: req.params.id,
            });
        }
        // Check if movie exists
        const movieResult = await (0, db_1.query) `
      SELECT MovieID, Title FROM Movies WHERE MovieID = ${movieId}
    `;
        if (!movieResult.recordset || movieResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Movie not found",
                movieId: movieId,
            });
        }
        const movieTitle = movieResult.recordset[0].Title;
        console.log(`✅ Found movie: ${movieTitle}`);
        // Lấy thông tin UploaderID trước khi xóa
        const uploaderInfo = await (0, db_1.query) `
      SELECT UploaderID FROM Movies WHERE MovieID = ${movieId}
    `;
        const uploaderId = uploaderInfo.recordset[0]?.UploaderID;
        // ✅ FIX: Lấy thông tin phim và episodes TRƯỚC KHI xóa để có thể xóa file
        const movieInfo = await (0, db_1.query) `
      SELECT PosterURL, TrailerURL FROM Movies WHERE MovieID = ${movieId}
    `;
        const movie = movieInfo.recordset[0];
        // Lấy thông tin tất cả episodes để xóa file video
        const episodesInfo = await (0, db_1.query) `
      SELECT VideoURL FROM MovieEpisodes WHERE MovieID = ${movieId}
    `;
        // Delete related data
        await (0, db_1.query) `DELETE FROM MovieComments WHERE MovieID = ${movieId}`;
        await (0, db_1.query) `DELETE FROM MovieRatings WHERE MovieID = ${movieId}`;
        await (0, db_1.query) `DELETE FROM MovieFavorites WHERE MovieID = ${movieId}`;
        await (0, db_1.query) `DELETE FROM MovieHistory WHERE MovieID = ${movieId}`;
        await (0, db_1.query) `DELETE FROM MovieEpisodes WHERE MovieID = ${movieId}`;
        await (0, db_1.query) `DELETE FROM MovieCategories WHERE MovieID = ${movieId}`;
        // Delete movie
        await (0, db_1.query) `DELETE FROM Movies WHERE MovieID = ${movieId}`;
        console.log(`✅ Successfully deleted movie: ${movieTitle}`);
        // ✅ FIX: Xóa file trong uploads/ - bao gồm poster, trailer và TẤT CẢ video episodes
        let deletedFilesCount = 0;
        if (movie) {
            try {
                // Xóa poster - xử lý path có thể trong uploads/posters/ hoặc uploads/
                if (movie.PosterURL) {
                    let posterFileName = movie.PosterURL.replace("/storage/", "").split("?")[0];
                    let posterPath = path_1.default.join(uploadsRoot, posterFileName);
                    // Nếu không tìm thấy, thử tìm trong uploads/posters/
                    if (!fs_1.default.existsSync(posterPath) && !posterFileName.startsWith("posters/")) {
                        posterPath = path_1.default.join(uploadsRoot, "posters", path_1.default.basename(posterFileName));
                    }
                    if (fs_1.default.existsSync(posterPath)) {
                        try {
                            fs_1.default.unlinkSync(posterPath);
                            deletedFilesCount++;
                            console.log(`🗑️ Đã xóa file poster: ${posterPath}`);
                        }
                        catch (posterError) {
                            console.error(`❌ Lỗi khi xóa poster ${posterPath}:`, posterError);
                        }
                    }
                    else {
                        console.log(`⚠️ File poster không tồn tại: ${posterPath}`);
                    }
                }
                // Xóa trailer
                if (movie.TrailerURL) {
                    const videoFileName = movie.TrailerURL.replace("/storage/", "").split("?")[0];
                    const videoPath = path_1.default.join(uploadsRoot, videoFileName);
                    if (fs_1.default.existsSync(videoPath)) {
                        try {
                            fs_1.default.unlinkSync(videoPath);
                            deletedFilesCount++;
                            console.log(`🗑️ Đã xóa file trailer: ${videoPath}`);
                        }
                        catch (trailerError) {
                            console.error(`❌ Lỗi khi xóa trailer ${videoPath}:`, trailerError);
                        }
                    }
                    else {
                        console.log(`⚠️ File trailer không tồn tại: ${videoPath}`);
                    }
                }
                // ✅ FIX: Xóa TẤT CẢ video episodes
                console.log(`🗑️ Bắt đầu xóa ${episodesInfo.recordset.length} video episodes...`);
                for (const episode of episodesInfo.recordset) {
                    if (episode.VideoURL) {
                        let videoFileName = episode.VideoURL;
                        if (videoFileName.startsWith("/uploads/")) {
                            videoFileName = videoFileName.replace("/uploads/", "");
                        }
                        else if (videoFileName.startsWith("/storage/")) {
                            videoFileName = videoFileName.replace("/storage/", "");
                        }
                        videoFileName = videoFileName.split("?")[0];
                        const videoPath = path_1.default.join(uploadsRoot, videoFileName);
                        if (fs_1.default.existsSync(videoPath)) {
                            try {
                                fs_1.default.unlinkSync(videoPath);
                                deletedFilesCount++;
                                console.log(`🗑️ Đã xóa file video episode: ${videoPath}`);
                            }
                            catch (episodeFileError) {
                                console.error(`❌ Lỗi khi xóa file video episode ${videoPath}:`, episodeFileError);
                            }
                        }
                        else {
                            console.log(`⚠️ File video episode không tồn tại: ${videoPath}`);
                        }
                    }
                }
                console.log(`✅ Đã xóa tổng cộng ${deletedFilesCount} file (poster, trailer, video episodes)`);
            }
            catch (fileError) {
                console.error("❌ Lỗi khi xóa file:", fileError);
            }
        }
        // Tạo thông báo cho Uploader và Admin khi phim bị xóa
        if (uploaderId) {
            try {
                // Thông báo cho Uploader
                await (0, db_1.query) `
          INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead, CreatedAt)
          VALUES (
            ${uploaderId},
            'ContentDeleted',
            N'Phim của bạn đã bị xóa',
            N'Phim "${movieTitle}" đã bị xóa',
            N'/user/movies',
            0,
            GETDATE()
          )
        `;
                // Thông báo cho tất cả Admin
                const adminUsers = await (0, db_1.query) `
          SELECT u.UserID
          FROM Users u
          INNER JOIN Roles r ON u.RoleID = r.RoleID
          WHERE r.RoleName = 'Admin' AND u.IsActive = 1
        `;
                for (const admin of adminUsers.recordset) {
                    await (0, db_1.query) `
            INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead, CreatedAt)
            VALUES (
              ${admin.UserID},
              'ContentDeleted',
              N'Phim đã bị xóa',
              N'Phim "${movieTitle}" đã bị xóa',
              N'/admin/movies',
              0,
              GETDATE()
            )
          `;
                }
                console.log(`✅ Đã tạo thông báo cho Uploader và ${adminUsers.recordset.length} Admin về việc xóa phim`);
            }
            catch (notifError) {
                console.error("❌ Lỗi khi tạo thông báo về việc xóa phim:", notifError);
            }
        }
        res.json({
            success: true,
            message: `Movie "${movieTitle}" deleted successfully`,
            deletedMovie: movieTitle,
            movieId: movieId,
        });
    }
    catch (e) {
        console.error("❌ Delete error:", e);
        res.status(500).json({
            success: false,
            error: "Failed to delete movie",
            details: e.message || "Unknown error",
            movieId: req.params.id,
        });
    }
});
// Check if movie is in user's favorites (must be before /movies/:slug route)
router.get("/movies/:id/favorite-status", async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const email = req.headers["x-user-email"];
        if (!movieId) {
            return res.status(400).json({ error: "Invalid movie ID" });
        }
        if (!email) {
            return res.status(400).json({ error: "Missing email" });
        }
        const userRes = await (0, db_1.query) `
      SELECT TOP 1 UserID FROM Users WHERE Email = ${email}
    `;
        const user = userRes.recordset[0];
        if (!user) {
            // Check in-memory favorites
            const set = inMemoryFavorites.get(email) || new Set();
            return res.json({ isFavorite: set.has(movieId) });
        }
        const favorite = await (0, db_1.query) `
      SELECT FavoriteID FROM MovieFavorites 
      WHERE MovieID = ${movieId} AND UserID = ${user.UserID}
    `;
        res.json({ isFavorite: favorite.recordset.length > 0 });
    }
    catch (e) {
        console.error("GET /movies/:id/favorite-status error:", e);
        res.status(500).json({ error: "Failed to check favorite status" });
    }
});
// Movie detail by slug
router.get("/movies/:slug", async (req, res) => {
    try {
        const slug = req.params.slug;
        const result = await (0, db_1.query) `
      SELECT TOP 1 MovieID, Title, Slug, Description, PosterURL, TrailerURL, ReleaseYear, Duration, Country, Director, Cast, Status, IsFree, ViewCount, Rating
      FROM Movies WHERE Slug = ${slug}
    `;
        const movie = result.recordset[0];
        if (!movie)
            return res.status(404).json({ error: "Movie not found" });
        return res.json(movie);
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Failed to fetch movie" });
    }
});
// Movie episodes by slug
router.get("/movies/:slug/episodes", async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`📺 GET /movies/${slug}/episodes - Fetching episodes for slug: ${slug}`);
        const movieRes = await (0, db_1.query) `SELECT TOP 1 MovieID FROM dbo.Movies WHERE Slug = ${slug}`;
        const movie = movieRes.recordset[0];
        if (!movie) {
            console.log(`❌ Movie not found for slug: ${slug}`);
            return res.status(404).json({ error: "Movie not found" });
        }
        console.log(`✅ Found movie ID: ${movie.MovieID} for slug: ${slug}`);
        // Kiểm tra xem cột EpisodeCode có tồn tại không
        const checkColumn = await (0, db_1.query) `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'MovieEpisodes' AND COLUMN_NAME = 'EpisodeCode'
    `;
        const hasEpisodeCode = checkColumn.recordset.length > 0;
        let rows;
        if (hasEpisodeCode) {
            rows = await (0, db_1.query) `
        SELECT EpisodeID, EpisodeNumber, Title, VideoURL, Duration, EpisodeCode, IsFree, ViewCount, CreatedAt
        FROM dbo.MovieEpisodes 
        WHERE MovieID = ${movie.MovieID}
        ORDER BY EpisodeNumber ASC
      `;
        }
        else {
            rows = await (0, db_1.query) `
        SELECT EpisodeID, EpisodeNumber, Title, VideoURL, Duration, IsFree, ViewCount, CreatedAt
        FROM dbo.MovieEpisodes 
        WHERE MovieID = ${movie.MovieID}
        ORDER BY EpisodeNumber ASC
      `;
        }
        console.log(`✅ Found ${rows.recordset.length} episodes for movie ID ${movie.MovieID}:`, rows.recordset.map((ep) => ({
            EpisodeID: ep.EpisodeID,
            EpisodeNumber: ep.EpisodeNumber,
            Title: ep.Title,
            EpisodeCode: hasEpisodeCode ? ep.EpisodeCode : "N/A",
        })));
        return res.json(rows.recordset);
    }
    catch (e) {
        console.error("❌ GET /movies/:slug/episodes error:", e);
        return res.status(500).json({ error: "Failed to fetch episodes" });
    }
});
// Get episodes by movie ID (for management)
router.get("/admin/movies/:movieId/episodes", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["read:content"]), async (req, res) => {
    try {
        const movieId = Number(req.params.movieId);
        // Kiểm tra xem cột EpisodeCode có tồn tại không
        const checkColumn = await (0, db_1.query) `
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'MovieEpisodes' AND COLUMN_NAME = 'EpisodeCode'
      `;
        const hasEpisodeCode = checkColumn.recordset.length > 0;
        let rows;
        if (hasEpisodeCode) {
            rows = await (0, db_1.query) `
          SELECT EpisodeID, EpisodeNumber, Title, VideoURL, Duration, EpisodeCode, IsFree, ViewCount, CreatedAt
          FROM dbo.MovieEpisodes 
          WHERE MovieID = ${movieId}
          ORDER BY EpisodeNumber ASC
        `;
        }
        else {
            rows = await (0, db_1.query) `
          SELECT EpisodeID, EpisodeNumber, Title, VideoURL, Duration, IsFree, ViewCount, CreatedAt
          FROM dbo.MovieEpisodes 
          WHERE MovieID = ${movieId}
          ORDER BY EpisodeNumber ASC
        `;
        }
        res.json(rows.recordset);
    }
    catch (e) {
        console.error("GET /admin/movies/:movieId/episodes error:", e);
        res.status(500).json({ error: "Failed to fetch episodes" });
    }
});
// Add new chapter to existing story (Text or Comic)
router.post("/admin/stories/:seriesId/chapters", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["create:content"]), upload.fields([
    { name: "contentFile", maxCount: 1 }, // For Text stories
    { name: "chapterImages", maxCount: 500 }, // For Comic stories
]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const { chapterNumber, title, storyType, isFree } = req.body;
        const contentFile = req.files?.["contentFile"]?.[0];
        const chapterImages = req.files?.["chapterImages"] || [];
        // Get story type from database
        const storyRes = await (0, db_1.query) `
        SELECT StoryType FROM Series WHERE SeriesID = ${seriesId}
      `;
        const dbStoryType = storyRes.recordset[0]?.StoryType || storyType || "Text";
        // Validate based on story type
        if (dbStoryType === "Text" && !contentFile) {
            return res
                .status(400)
                .json({ error: "Content file is required for text stories" });
        }
        if (dbStoryType === "Comic" && chapterImages.length === 0) {
            return res
                .status(400)
                .json({ error: "At least one image is required for comic stories" });
        }
        // Get next chapter number if not provided
        let nextChapterNumber = chapterNumber ? Number(chapterNumber) : null;
        if (!nextChapterNumber) {
            const maxChapter = await (0, db_1.query) `
          SELECT MAX(ChapterNumber) as MaxChapter 
          FROM Chapters 
          WHERE SeriesID = ${seriesId}
        `;
            nextChapterNumber = (maxChapter.recordset[0].MaxChapter || 0) + 1;
        }
        // ✅ FIX: Validate ChapterNumber không trùng (Admin route)
        const duplicateCheck = await (0, db_1.query) `
        SELECT TOP 1 ChapterID, ChapterNumber
        FROM Chapters
        WHERE SeriesID = ${seriesId} AND ChapterNumber = ${nextChapterNumber}
      `;
        if (duplicateCheck.recordset.length > 0) {
            return res.status(400).json({
                error: `Chapter ${nextChapterNumber} already exists. Please choose a different chapter number.`,
            });
        }
        const chapterTitle = title || `Chapter ${nextChapterNumber}`;
        const chapterIsFree = isFree === "true" || isFree === true;
        // Check if ChapterCode column exists
        const checkColumn = await (0, db_1.query) `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Chapters' AND COLUMN_NAME = 'ChapterCode'
      `;
        const hasChapterCode = checkColumn.recordset.length > 0;
        // Generate ChapterCode if column exists
        const chapterCode = hasChapterCode
            ? `CH${seriesId}-${String(nextChapterNumber).padStart(3, "0")}`
            : null;
        if (dbStoryType === "Text") {
            // Text story: insert chapter with content file
            if (hasChapterCode) {
                await (0, db_1.query) `
            INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, ChapterCode, CreatedAt)
            VALUES (${seriesId}, ${nextChapterNumber}, ${chapterTitle}, ${`/storage/${contentFile.filename}`}, ${chapterIsFree ? 1 : 0}, 0, ${chapterCode}, GETDATE())
          `;
            }
            else {
                await (0, db_1.query) `
            INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
            VALUES (${seriesId}, ${nextChapterNumber}, ${chapterTitle}, ${`/storage/${contentFile.filename}`}, ${chapterIsFree ? 1 : 0}, 0, GETDATE())
          `;
            }
        }
        else {
            // Comic story: insert chapter and images
            const chapterResult = hasChapterCode
                ? await (0, db_1.query) `
          INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, ChapterCode, CreatedAt)
          OUTPUT INSERTED.ChapterID
          VALUES (${seriesId}, ${nextChapterNumber}, ${chapterTitle}, '', ${chapterIsFree ? 1 : 0}, ${chapterImages.length}, ${chapterCode}, GETDATE())
        `
                : await (0, db_1.query) `
          INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
          OUTPUT INSERTED.ChapterID
          VALUES (${seriesId}, ${nextChapterNumber}, ${chapterTitle}, '', ${chapterIsFree ? 1 : 0}, ${chapterImages.length}, GETDATE())
        `;
            const chapterId = chapterResult.recordset[0].ChapterID;
            // Sort images by name
            const sortedImages = [...chapterImages].sort((a, b) => {
                return a.originalname.localeCompare(b.originalname);
            });
            // Insert images
            for (let i = 0; i < sortedImages.length; i++) {
                const image = sortedImages[i];
                await (0, db_1.query) `
            INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
            VALUES (${chapterId}, ${`/storage/${image.filename}`}, ${i + 1}, ${image.size}, GETDATE())
          `;
            }
        }
        res.json({
            success: true,
            message: "Chapter added successfully",
            chapterNumber: nextChapterNumber,
        });
    }
    catch (e) {
        console.error("POST /admin/stories/:seriesId/chapters error:", e);
        res.status(500).json({ error: "Failed to add chapter" });
    }
});
// Add new chapter to existing story (User route)
router.post("/user/stories/:seriesId/chapters", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["create:content"]), upload.fields([
    { name: "contentFile", maxCount: 1 }, // For Text stories
    { name: "chapterImages", maxCount: 500 }, // For Comic stories
]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const { chapterNumber, title, storyType, isFree } = req.body;
        const contentFile = req.files?.["contentFile"]?.[0];
        const chapterImages = req.files?.["chapterImages"] || [];
        // Verify user owns this story
        const storyRes = await (0, db_1.query) `
        SELECT StoryType, UploaderID FROM Series WHERE SeriesID = ${seriesId}
      `;
        const story = storyRes.recordset[0];
        if (!story) {
            return res.status(404).json({ error: "Story not found" });
        }
        if (story.UploaderID !== req.user.UserID &&
            req.user.RoleName !== "Admin") {
            return res.status(403).json({
                error: "You don't have permission to add chapters to this story",
            });
        }
        const dbStoryType = story.StoryType || storyType || "Text";
        // Validate based on story type
        if (dbStoryType === "Text" && !contentFile) {
            return res
                .status(400)
                .json({ error: "Content file is required for text stories" });
        }
        if (dbStoryType === "Comic" && chapterImages.length === 0) {
            return res
                .status(400)
                .json({ error: "At least one image is required for comic stories" });
        }
        // Get next chapter number if not provided
        let nextChapterNumber = chapterNumber ? Number(chapterNumber) : null;
        if (!nextChapterNumber) {
            const maxChapter = await (0, db_1.query) `
          SELECT MAX(ChapterNumber) as MaxChapter 
          FROM Chapters 
          WHERE SeriesID = ${seriesId}
        `;
            nextChapterNumber = (maxChapter.recordset[0].MaxChapter || 0) + 1;
        }
        // ✅ FIX: Validate ChapterNumber không trùng (User route)
        const duplicateCheck = await (0, db_1.query) `
        SELECT TOP 1 ChapterID, ChapterNumber
        FROM Chapters
        WHERE SeriesID = ${seriesId} AND ChapterNumber = ${nextChapterNumber}
      `;
        if (duplicateCheck.recordset.length > 0) {
            return res.status(400).json({
                error: `Chapter ${nextChapterNumber} already exists. Please choose a different chapter number.`,
            });
        }
        const chapterTitle = title || `Chapter ${nextChapterNumber}`;
        const chapterIsFree = isFree === "true" || isFree === true;
        if (dbStoryType === "Text") {
            // Text story: insert chapter with content file
            await (0, db_1.query) `
          INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
          VALUES (${seriesId}, ${nextChapterNumber}, ${chapterTitle}, ${`/storage/${contentFile.filename}`}, ${chapterIsFree ? 1 : 0}, 0, GETDATE())
        `;
        }
        else {
            // Comic story: insert chapter and images
            const chapterResult = await (0, db_1.query) `
          INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
          OUTPUT INSERTED.ChapterID
          VALUES (${seriesId}, ${nextChapterNumber}, ${chapterTitle}, '', ${chapterIsFree ? 1 : 0}, ${chapterImages.length}, GETDATE())
        `;
            const chapterId = chapterResult.recordset[0].ChapterID;
            // Sort images by name
            const sortedImages = [...chapterImages].sort((a, b) => {
                return a.originalname.localeCompare(b.originalname);
            });
            // Insert images
            for (let i = 0; i < sortedImages.length; i++) {
                const image = sortedImages[i];
                await (0, db_1.query) `
            INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
            VALUES (${chapterId}, ${`/storage/${image.filename}`}, ${i + 1}, ${image.size}, GETDATE())
          `;
            }
        }
        res.json({
            success: true,
            message: "Chapter added successfully",
            chapterNumber: nextChapterNumber,
        });
    }
    catch (e) {
        console.error("POST /user/stories/:seriesId/chapters error:", e);
        res.status(500).json({ error: "Failed to add chapter" });
    }
});
// Update story (Admin)
router.put("/admin/stories/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), upload.fields([{ name: "coverImage", maxCount: 1 }]), async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        if (!seriesId)
            return res.status(400).json({ error: "Invalid id" });
        // Parse FormData - multer sẽ parse text fields vào req.body
        const title = req.body?.title;
        const description = req.body?.description;
        const author = req.body?.author;
        const status = req.body?.status;
        // isFree có thể là string "true"/"false" từ FormData
        const isFreeValue = req.body?.isFree;
        const isFree = isFreeValue === "true" || isFreeValue === true;
        const coverImage = req.files?.["coverImage"]?.[0];
        // ✅ FIX: Nhận coverLocal từ crawl (đã tải về server)
        const coverLocal = req.body?.coverLocal;
        // Lấy thông tin file cũ trước khi cập nhật
        const oldStoryInfo = await (0, db_1.query) `
        SELECT CoverURL FROM Series WHERE SeriesID = ${seriesId}
      `;
        if (oldStoryInfo.recordset.length === 0) {
            return res.status(404).json({ error: "Story not found" });
        }
        const oldStory = oldStoryInfo.recordset[0];
        // Cập nhật thông tin truyện
        if (title !== undefined && title !== null && title !== "") {
            // Tạo slug và kiểm tra trùng lặp
            const baseSlug = (0, slugify_1.default)(title, { lower: true, strict: true });
            let finalSlug = baseSlug;
            let attempt = 1;
            // Kiểm tra slug trùng lặp (trừ truyện hiện tại)
            while (true) {
                const exists = await (0, db_1.query) `
            SELECT COUNT(*) AS cnt FROM Series 
            WHERE Slug = ${finalSlug} AND SeriesID <> ${seriesId}
          `;
                if (exists.recordset[0].cnt === 0) {
                    break;
                }
                finalSlug = `${baseSlug}-${attempt}`;
                attempt++;
                if (attempt > 100) {
                    finalSlug = `${baseSlug}-${Date.now()}`;
                    break;
                }
            }
            await (0, db_1.query) `UPDATE Series SET Title = ${title}, Slug = ${finalSlug} WHERE SeriesID = ${seriesId}`;
        }
        if (description !== undefined && description !== null) {
            await (0, db_1.query) `UPDATE Series SET Description = ${description} WHERE SeriesID = ${seriesId}`;
        }
        if (status !== undefined && status !== null) {
            await (0, db_1.query) `UPDATE Series SET Status = ${status} WHERE SeriesID = ${seriesId}`;
        }
        if (isFreeValue !== undefined && isFreeValue !== null) {
            await (0, db_1.query) `UPDATE Series SET IsFree = ${isFree ? 1 : 0} WHERE SeriesID = ${seriesId}`;
        }
        if (author !== undefined && author !== null && author !== "") {
            await (0, db_1.query) `UPDATE Series SET Author = ${author} WHERE SeriesID = ${seriesId}`;
        }
        // ✅ FIX: Xử lý cover - ưu tiên coverLocal (từ crawl), fallback coverImage (file upload)
        if (coverLocal) {
            const coverUrl = normalizeStoragePath(coverLocal);
            if (coverUrl) {
                await (0, db_1.query) `UPDATE Series SET CoverURL = ${coverUrl} WHERE SeriesID = ${seriesId}`;
                console.log(`✅ Đã cập nhật cover từ crawl: ${coverUrl}`);
            }
        }
        else if (coverImage) {
            const coverUrl = `/storage/${coverImage.filename}`;
            await (0, db_1.query) `UPDATE Series SET CoverURL = ${coverUrl} WHERE SeriesID = ${seriesId}`;
            // Xóa file cover cũ nếu có
            if (oldStory && oldStory.CoverURL) {
                const oldCoverFileName = oldStory.CoverURL.replace("/storage/", "").split("?")[0];
                const oldCoverPath = path_1.default.join(uploadsRoot, oldCoverFileName);
                if (fs_1.default.existsSync(oldCoverPath) &&
                    oldCoverFileName !== coverImage.filename) {
                    try {
                        fs_1.default.unlinkSync(oldCoverPath);
                        console.log(`🗑️ Đã xóa ảnh bìa cũ: ${oldCoverPath}`);
                    }
                    catch (deleteError) {
                        console.log(`⚠️ Không thể xóa ảnh bìa cũ: ${deleteError}`);
                    }
                }
            }
            console.log(`✅ Đã cập nhật ảnh bìa mới cho story ID: ${seriesId}`);
        }
        // Update categories if provided
        if (req.body.categoryIds !== undefined) {
            // Xóa tất cả categories cũ
            await (0, db_1.query) `DELETE FROM SeriesCategories WHERE SeriesID = ${seriesId}`;
            // Thêm categories mới
            const categoryIds = req.body.categoryIds;
            const categoryIdsArray = Array.isArray(categoryIds)
                ? categoryIds.map((id) => Number(id))
                : typeof categoryIds === "string"
                    ? [Number(categoryIds)]
                    : [];
            if (categoryIdsArray.length > 0) {
                for (const catId of categoryIdsArray) {
                    if (catId && !isNaN(catId)) {
                        await (0, db_1.query) `
                INSERT INTO SeriesCategories (SeriesID, CategoryID)
                VALUES (${seriesId}, ${catId})
              `;
                    }
                }
                console.log(`✅ Đã cập nhật ${categoryIdsArray.length} categories cho story ID: ${seriesId}`);
            }
        }
        // ✅ FIX: Đồng bộ metadata - cập nhật UpdatedAt để đảm bảo dữ liệu mới nhất
        // Khi edit story, metadata đã được đồng bộ vào:
        // - Bảng Series (title, description, author, status, coverURL, isFree)
        // - Bảng SeriesCategories (thể loại liên kết)
        // - Slug được cập nhật tự động khi title thay đổi
        await (0, db_1.query) `UPDATE Series SET UpdatedAt = GETDATE() WHERE SeriesID = ${seriesId}`;
        // ✅ FIX: Log để theo dõi thay đổi metadata
        console.log(`✅ Đã cập nhật và đồng bộ metadata cho story ID: ${seriesId} - Title: ${title || 'không đổi'}, Author: ${author || 'không đổi'}, Status: ${status || 'không đổi'}`);
        res.json({ success: true, message: "Story updated successfully" });
    }
    catch (e) {
        console.error("PUT /admin/stories/:id error:", e);
        res.status(500).json({ error: "Failed to update story" });
    }
});
// User update own story
router.put("/user/stories/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["edit:own_content"]), upload.fields([{ name: "coverImage", maxCount: 1 }]), async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        if (!seriesId)
            return res.status(400).json({ error: "Invalid id" });
        // Kiểm tra user có quyền edit truyện này không
        const storyCheck = await (0, db_1.query) `
        SELECT UploaderID FROM Series WHERE SeriesID = ${seriesId}
      `;
        if (storyCheck.recordset.length === 0) {
            return res.status(404).json({ error: "Story not found" });
        }
        // Chỉ cho phép user edit truyện của chính họ (trừ Admin)
        if (req.user?.RoleName !== "Admin" &&
            storyCheck.recordset[0].UploaderID !== req.user?.UserID) {
            return res
                .status(403)
                .json({ error: "You can only edit your own stories" });
        }
        // Parse FormData - multer sẽ parse text fields vào req.body
        const title = req.body?.title;
        const description = req.body?.description;
        const author = req.body?.author;
        // isFree có thể là string "true"/"false" từ FormData
        const isFreeValue = req.body?.isFree;
        const isFree = isFreeValue === "true" || isFreeValue === true;
        const coverImage = req.files?.["coverImage"]?.[0];
        // Lấy thông tin file cũ trước khi cập nhật
        const oldStoryInfo = await (0, db_1.query) `
        SELECT CoverURL FROM Series WHERE SeriesID = ${seriesId}
      `;
        const oldStory = oldStoryInfo.recordset[0];
        // Cập nhật thông tin truyện
        if (title !== undefined && title !== null && title !== "") {
            // Tạo slug và kiểm tra trùng lặp
            const baseSlug = (0, slugify_1.default)(title, { lower: true, strict: true });
            let finalSlug = baseSlug;
            let attempt = 1;
            while (true) {
                const exists = await (0, db_1.query) `
            SELECT COUNT(*) AS cnt FROM Series 
            WHERE Slug = ${finalSlug} AND SeriesID <> ${seriesId}
          `;
                if (exists.recordset[0].cnt === 0) {
                    break;
                }
                finalSlug = `${baseSlug}-${attempt}`;
                attempt++;
                if (attempt > 100) {
                    finalSlug = `${baseSlug}-${Date.now()}`;
                    break;
                }
            }
            await (0, db_1.query) `UPDATE Series SET Title = ${title}, Slug = ${finalSlug} WHERE SeriesID = ${seriesId}`;
        }
        if (description !== undefined && description !== null) {
            await (0, db_1.query) `UPDATE Series SET Description = ${description} WHERE SeriesID = ${seriesId}`;
        }
        if (isFreeValue !== undefined && isFreeValue !== null) {
            await (0, db_1.query) `UPDATE Series SET IsFree = ${isFree ? 1 : 0} WHERE SeriesID = ${seriesId}`;
        }
        if (author !== undefined && author !== null && author !== "") {
            await (0, db_1.query) `UPDATE Series SET Author = ${author} WHERE SeriesID = ${seriesId}`;
        }
        // Update categories if provided
        if (req.body.categoryIds !== undefined) {
            // Xóa tất cả categories cũ
            await (0, db_1.query) `DELETE FROM SeriesCategories WHERE SeriesID = ${seriesId}`;
            // Thêm categories mới
            const categoryIds = req.body.categoryIds;
            const categoryIdsArray = Array.isArray(categoryIds)
                ? categoryIds.map((id) => Number(id))
                : typeof categoryIds === "string"
                    ? [Number(categoryIds)]
                    : [];
            if (categoryIdsArray.length > 0) {
                for (const catId of categoryIdsArray) {
                    if (catId && !isNaN(catId)) {
                        await (0, db_1.query) `
                INSERT INTO SeriesCategories (SeriesID, CategoryID)
                VALUES (${seriesId}, ${catId})
              `;
                    }
                }
                console.log(`✅ Đã cập nhật ${categoryIdsArray.length} categories cho story ID: ${seriesId}`);
            }
        }
        // Nếu user edit (không phải admin), chuyển status về Pending để admin duyệt lại
        if (req.user?.RoleName !== "Admin" &&
            (title ||
                description ||
                isFreeValue !== undefined ||
                coverImage ||
                author ||
                req.body.categoryIds !== undefined)) {
            await (0, db_1.query) `UPDATE Series SET Status = 'Pending' WHERE SeriesID = ${seriesId}`;
            console.log(`🔄 User edited story ${seriesId}, status changed to Pending for admin review`);
            // Tạo thông báo cho tất cả Admin khi user sửa truyện
            try {
                const storyInfo = await (0, db_1.query) `
            SELECT Title FROM Series WHERE SeriesID = ${seriesId}
          `;
                const storyTitle = storyInfo.recordset[0]?.Title || "Truyện";
                const adminUsers = await (0, db_1.query) `
            SELECT u.UserID, u.Email
            FROM Users u
            INNER JOIN Roles r ON u.RoleID = r.RoleID
            WHERE r.RoleName = 'Admin' AND u.IsActive = 1
          `;
                for (const admin of adminUsers.recordset) {
                    await (0, db_1.query) `
              INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead, CreatedAt)
              VALUES (
                ${admin.UserID},
                'ContentUpdated',
                N'Truyện đã được sửa đổi',
                N'${req.user.email} đã sửa truyện "${storyTitle}" và đang chờ duyệt lại',
                N'/admin/stories',
                0,
                GETDATE()
              )
            `;
                }
                console.log(`✅ Đã tạo thông báo cho ${adminUsers.recordset.length} Admin về việc user sửa truyện`);
            }
            catch (notifError) {
                console.error("❌ Lỗi khi tạo thông báo về việc sửa truyện:", notifError);
            }
        }
        // Xử lý file mới
        if (coverImage) {
            const coverUrl = `/storage/${coverImage.filename}`;
            await (0, db_1.query) `UPDATE Series SET CoverURL = ${coverUrl} WHERE SeriesID = ${seriesId}`;
            // Xóa file cover cũ nếu có
            if (oldStory && oldStory.CoverURL) {
                const oldCoverFileName = oldStory.CoverURL.replace("/storage/", "").split("?")[0];
                const oldCoverPath = path_1.default.join(uploadsRoot, oldCoverFileName);
                if (fs_1.default.existsSync(oldCoverPath) &&
                    oldCoverFileName !== coverImage.filename) {
                    try {
                        fs_1.default.unlinkSync(oldCoverPath);
                        console.log(`🗑️ Đã xóa ảnh bìa cũ: ${oldCoverPath}`);
                    }
                    catch (deleteError) {
                        console.log(`⚠️ Không thể xóa ảnh bìa cũ: ${deleteError}`);
                    }
                }
            }
            console.log(`✅ Đã cập nhật ảnh bìa mới cho story ID: ${seriesId}`);
        }
        // ✅ FIX: Đồng bộ metadata - cập nhật UpdatedAt để đảm bảo dữ liệu mới nhất
        // Khi edit story, metadata đã được đồng bộ vào:
        // - Bảng Series (title, description, author, status, coverURL, isFree)
        // - Bảng SeriesCategories (thể loại liên kết)
        // - Slug được cập nhật tự động khi title thay đổi
        // - Status được chuyển về Pending nếu user edit (không phải admin)
        await (0, db_1.query) `UPDATE Series SET UpdatedAt = GETDATE() WHERE SeriesID = ${seriesId}`;
        // ✅ FIX: Log để theo dõi thay đổi metadata
        console.log(`✅ Đã cập nhật và đồng bộ metadata cho story ID: ${seriesId} - Title: ${title || 'không đổi'}, Author: ${author || 'không đổi'}`);
        res.json({ success: true, message: "Story updated successfully" });
    }
    catch (e) {
        console.error("PUT /user/stories/:id error:", e);
        res.status(500).json({ error: "Failed to update story" });
    }
});
// Update chapter
router.put("/admin/chapters/:chapterId", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), upload.fields([
    { name: "contentFile", maxCount: 1 }, // For Text stories
    { name: "chapterImages", maxCount: 500 }, // For Comic stories
]), async (req, res) => {
    try {
        const chapterId = Number(req.params.chapterId);
        const { title, isFree, chapterNumber } = req.body;
        const contentFile = req.files?.["contentFile"]?.[0];
        const chapterImages = req.files?.["chapterImages"] || [];
        // Get current chapter
        const currentChapter = await (0, db_1.query) `
        SELECT * FROM Chapters WHERE ChapterID = ${chapterId}
      `;
        if (currentChapter.recordset.length === 0) {
            return res.status(404).json({ error: "Chapter not found" });
        }
        const chapter = currentChapter.recordset[0];
        // Get story type
        const storyRes = await (0, db_1.query) `
        SELECT StoryType FROM Series WHERE SeriesID = ${chapter.SeriesID}
      `;
        const storyType = storyRes.recordset[0]?.StoryType || "Text";
        // Check if ChapterCode column exists
        const checkColumn = await (0, db_1.query) `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Chapters' AND COLUMN_NAME = 'ChapterCode'
      `;
        const hasChapterCode = checkColumn.recordset.length > 0;
        // Update fields
        if (title) {
            await (0, db_1.query) `UPDATE Chapters SET Title = ${title} WHERE ChapterID = ${chapterId}`;
        }
        if (typeof isFree !== "undefined") {
            await (0, db_1.query) `UPDATE Chapters SET IsFree = ${isFree ? 1 : 0} WHERE ChapterID = ${chapterId}`;
        }
        // ✅ FIX: Validate ChapterNumber không trùng khi đổi số
        if (chapterNumber && chapterNumber !== chapter.ChapterNumber) {
            const duplicateCheck = await (0, db_1.query) `
          SELECT TOP 1 ChapterID
          FROM Chapters
          WHERE SeriesID = ${chapter.SeriesID} AND ChapterNumber = ${Number(chapterNumber)} AND ChapterID <> ${chapterId}
        `;
            if (duplicateCheck.recordset.length > 0) {
                return res.status(400).json({
                    error: `Chapter ${chapterNumber} already exists. Please choose a different chapter number.`,
                });
            }
            await (0, db_1.query) `UPDATE Chapters SET ChapterNumber = ${Number(chapterNumber)} WHERE ChapterID = ${chapterId}`;
        }
        if (hasChapterCode && req.body.chapterCode) {
            await (0, db_1.query) `UPDATE Chapters SET ChapterCode = ${req.body.chapterCode} WHERE ChapterID = ${chapterId}`;
        }
        // Update content for Text stories
        if (storyType === "Text" && contentFile) {
            const contentUrl = `/storage/${contentFile.filename}`;
            await (0, db_1.query) `UPDATE Chapters SET Content = ${contentUrl} WHERE ChapterID = ${chapterId}`;
        }
        // ✅ FIX: Update images for Comic stories - xóa file ảnh cũ trước khi insert mới
        if (storyType === "Comic" && chapterImages.length > 0) {
            // Lấy danh sách ảnh cũ để xóa file vật lý
            const oldImages = await (0, db_1.query) `
          SELECT ImageURL FROM ChapterImages WHERE ChapterID = ${chapterId}
        `;
            // Xóa file ảnh cũ
            const uploadsRoot = path_1.default.resolve(__dirname, "..", "..", "..", "uploads");
            for (const img of oldImages.recordset) {
                try {
                    if (img.ImageURL && img.ImageURL.startsWith("/storage/")) {
                        const relativePath = img.ImageURL.replace("/storage/", "");
                        const filePath = path_1.default.join(uploadsRoot, relativePath);
                        if (fs_1.default.existsSync(filePath)) {
                            fs_1.default.unlinkSync(filePath);
                            console.log(`✅ Đã xóa file ảnh cũ: ${filePath}`);
                        }
                    }
                }
                catch (fileError) {
                    console.warn(`⚠️ Không thể xóa file ${img.ImageURL}:`, fileError);
                }
            }
            // Xóa folder chapter cũ nếu rỗng (tương tự logic delete)
            try {
                if (oldImages.recordset.length > 0) {
                    const firstImageUrl = oldImages.recordset[0].ImageURL;
                    if (firstImageUrl && firstImageUrl.startsWith("/storage/chapters/")) {
                        const urlParts = firstImageUrl.split("/");
                        const chaptersIndex = urlParts.indexOf("chapters");
                        if (chaptersIndex >= 0 && urlParts.length > chaptersIndex + 1) {
                            const folderName = urlParts[chaptersIndex + 1];
                            const chapterFolder = path_1.default.join(uploadsRoot, "chapters", folderName);
                            if (fs_1.default.existsSync(chapterFolder)) {
                                try {
                                    const files = fs_1.default.readdirSync(chapterFolder);
                                    if (files.length === 0) {
                                        fs_1.default.rmdirSync(chapterFolder);
                                        console.log(`✅ Đã xóa folder rỗng: ${chapterFolder}`);
                                    }
                                }
                                catch (e) {
                                    // Folder không rỗng
                                }
                            }
                        }
                    }
                }
            }
            catch (folderError) {
                console.warn("⚠️ Không thể xóa folder chapter cũ:", folderError);
            }
            // Delete old images trong DB
            await (0, db_1.query) `DELETE FROM ChapterImages WHERE ChapterID = ${chapterId}`;
            // Insert new images
            const sortedImages = [...chapterImages].sort((a, b) => {
                return a.originalname.localeCompare(b.originalname);
            });
            for (let i = 0; i < sortedImages.length; i++) {
                const image = sortedImages[i];
                await (0, db_1.query) `
            INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
            VALUES (${chapterId}, ${`/storage/${image.filename}`}, ${i + 1}, ${image.size}, GETDATE())
          `;
            }
            // Update ImageCount
            await (0, db_1.query) `UPDATE Chapters SET ImageCount = ${sortedImages.length} WHERE ChapterID = ${chapterId}`;
        }
        res.json({ success: true, message: "Chapter updated successfully" });
    }
    catch (e) {
        console.error("PUT /admin/chapters/:chapterId error:", e);
        res.status(500).json({ error: "Failed to update chapter" });
    }
});
// Delete chapter
router.delete("/admin/chapters/:chapterId", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["delete:any_content"]), async (req, res) => {
    try {
        const chapterId = Number(req.params.chapterId);
        // ✅ FIX: Lấy thông tin chapter và ảnh trước khi xóa
        const chapterInfo = await (0, db_1.query) `
        SELECT ChapterID, SeriesID, ChapterNumber 
        FROM Chapters 
        WHERE ChapterID = ${chapterId}
      `;
        if (chapterInfo.recordset.length === 0) {
            return res.status(404).json({ error: "Chapter not found" });
        }
        // ✅ FIX: Lấy danh sách ảnh để xóa file vật lý
        const imagesInfo = await (0, db_1.query) `
        SELECT ImageURL 
        FROM ChapterImages 
        WHERE ChapterID = ${chapterId}
      `;
        // ✅ FIX: Xóa file ảnh vật lý
        const uploadsRoot = path_1.default.resolve(__dirname, "..", "..", "..", "uploads");
        for (const img of imagesInfo.recordset) {
            try {
                if (img.ImageURL && img.ImageURL.startsWith("/storage/")) {
                    // Convert /storage/... to uploads/...
                    const relativePath = img.ImageURL.replace("/storage/", "");
                    const filePath = path_1.default.join(uploadsRoot, relativePath);
                    if (fs_1.default.existsSync(filePath)) {
                        fs_1.default.unlinkSync(filePath);
                        console.log(`✅ Đã xóa file: ${filePath}`);
                    }
                }
            }
            catch (fileError) {
                console.warn(`⚠️ Không thể xóa file ${img.ImageURL}:`, fileError);
            }
        }
        // ✅ FIX: Xóa folder chapter vật lý (tìm theo pattern từ ImageURL)
        try {
            // Tìm folder từ ImageURL đầu tiên
            if (imagesInfo.recordset.length > 0) {
                const firstImageUrl = imagesInfo.recordset[0].ImageURL;
                if (firstImageUrl && firstImageUrl.startsWith("/storage/chapters/")) {
                    // Extract folder path từ URL: /storage/chapters/folder-name/001.jpg
                    const urlParts = firstImageUrl.split("/");
                    const chaptersIndex = urlParts.indexOf("chapters");
                    if (chaptersIndex >= 0 && urlParts.length > chaptersIndex + 1) {
                        const folderName = urlParts[chaptersIndex + 1];
                        const chapterFolder = path_1.default.join(uploadsRoot, "chapters", folderName);
                        if (fs_1.default.existsSync(chapterFolder)) {
                            try {
                                // Xóa toàn bộ folder và nội dung
                                fs_1.default.rmSync(chapterFolder, { recursive: true, force: true });
                                console.log(`✅ Đã xóa folder chapter: ${chapterFolder}`);
                            }
                            catch (rmError) {
                                console.warn(`⚠️ Không thể xóa folder ${chapterFolder}:`, rmError);
                                // Thử xóa từng file nếu không xóa được folder
                                try {
                                    const files = fs_1.default.readdirSync(chapterFolder);
                                    for (const file of files) {
                                        const filePath = path_1.default.join(chapterFolder, file);
                                        try {
                                            fs_1.default.unlinkSync(filePath);
                                        }
                                        catch (e) {
                                            // Ignore individual file errors
                                        }
                                    }
                                    // Thử xóa folder lại sau khi xóa file
                                    try {
                                        fs_1.default.rmdirSync(chapterFolder);
                                    }
                                    catch (e) {
                                        // Ignore
                                    }
                                }
                                catch (e) {
                                    // Ignore
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (folderError) {
            console.warn("⚠️ Không thể xóa folder chapter:", folderError);
        }
        // Xóa các bản ghi trong SeriesHistory có ChapterID này trước
        try {
            await (0, db_1.query) `DELETE FROM SeriesHistory WHERE ChapterID = ${chapterId}`;
            console.log(`Đã xóa SeriesHistory cho chapter ID: ${chapterId}`);
        }
        catch (historyError) {
            console.error("Lỗi khi xóa SeriesHistory:", historyError);
        }
        // Xóa ảnh trong ChapterImages trước
        try {
            await (0, db_1.query) `DELETE FROM ChapterImages WHERE ChapterID = ${chapterId}`;
            console.log(`Đã xóa ChapterImages cho chapter ID: ${chapterId}`);
        }
        catch (imagesError) {
            console.error("Lỗi khi xóa ChapterImages:", imagesError);
        }
        // Xóa chapter
        await (0, db_1.query) `DELETE FROM Chapters WHERE ChapterID = ${chapterId}`;
        // ✅ FIX: Reindex ChapterNumber sau khi xóa để đảm bảo thứ tự liên tục
        try {
            const remainingChapters = await (0, db_1.query) `
          SELECT ChapterID, ChapterNumber
          FROM Chapters
          WHERE SeriesID = ${chapterInfo.recordset[0].SeriesID}
          ORDER BY ChapterNumber ASC
        `;
            // Reindex từ 1 đến N
            for (let i = 0; i < remainingChapters.recordset.length; i++) {
                const newNumber = i + 1;
                const oldNumber = remainingChapters.recordset[i].ChapterNumber;
                if (oldNumber !== newNumber) {
                    await (0, db_1.query) `
              UPDATE Chapters
              SET ChapterNumber = ${newNumber}
              WHERE ChapterID = ${remainingChapters.recordset[i].ChapterID}
            `;
                    console.log(`✅ Reindexed chapter ${oldNumber} → ${newNumber}`);
                }
            }
        }
        catch (reindexError) {
            console.warn("⚠️ Không thể reindex chapters:", reindexError);
        }
        res.json({ success: true, message: "Chapter deleted successfully" });
    }
    catch (e) {
        console.error("DELETE /admin/chapters/:chapterId error:", e);
        res.status(500).json({ error: "Failed to delete chapter" });
    }
});
// Update story status only
router.put("/admin/stories/:seriesId/status", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const { status } = req.body;
        if (!status || !["Approved", "Pending", "Rejected"].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        await (0, db_1.query) `UPDATE Series SET Status = ${status} WHERE SeriesID = ${seriesId}`;
        // If approved, set IsApproved and ApprovedBy
        if (status === "Approved") {
            await (0, db_1.query) `
          UPDATE Series 
          SET IsApproved = 1, ApprovedBy = ${req.user.UserID}, ApprovedAt = GETDATE()
          WHERE SeriesID = ${seriesId}
        `;
        }
        // Log activity
        await (0, db_1.query) `
        INSERT INTO ActivityLogs (UserID, Action, TableName, RecordID, NewValue, IPAddress, UserAgent)
        VALUES (${req.user?.UserID}, 'UPDATE_STORY_STATUS', 'Series', ${seriesId}, 
                ${JSON.stringify({ status, seriesId })}, 
                ${req.ip}, ${req.get("User-Agent")})
      `;
        // Get story info for notification
        const storyResult = await (0, db_1.query) `
        SELECT s.Title, s.UploaderID, u.Email as UploaderEmail
        FROM Series s
        JOIN Users u ON s.UploaderID = u.UserID
        WHERE s.SeriesID = ${seriesId}
      `;
        if (storyResult.recordset.length > 0) {
            const story = storyResult.recordset[0];
            // Send notification to uploader (if not self-approving)
            if (req.user?.UserID !== story.UploaderID) {
                const notificationTitle = status === "Approved"
                    ? "Truyện đã được duyệt"
                    : status === "Rejected"
                        ? "Truyện bị từ chối"
                        : "Truyện đang chờ duyệt";
                const notificationContent = status === "Approved"
                    ? `Truyện "${story.Title}" của bạn đã được admin duyệt và hiển thị trên trang chủ.`
                    : status === "Rejected"
                        ? `Truyện "${story.Title}" của bạn đã bị admin từ chối.`
                        : `Truyện "${story.Title}" của bạn đang chờ admin duyệt.`;
                await (0, db_1.query) `
            INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead, CreatedAt)
            VALUES (${story.UploaderID}, 'ContentApproval', ${notificationTitle}, ${notificationContent}, '/upload', 0, GETDATE())
          `;
            }
        }
        res.json({ success: true, message: "Story status updated successfully" });
    }
    catch (e) {
        console.error("PUT /admin/stories/:seriesId/status error:", e);
        res.status(500).json({ error: "Failed to update story status" });
    }
});
// Add new episode to existing movie
router.post("/admin/movies/:movieId/episodes", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["create:content"]), upload.fields([{ name: "videoFile", maxCount: 1 }]), async (req, res) => {
    try {
        const movieId = Number(req.params.movieId);
        const { episodeNumber, title, duration, isFree } = req.body;
        const videoFile = req.files?.["videoFile"]?.[0];
        if (!videoFile) {
            return res.status(400).json({ error: "Video file is required" });
        }
        // Get next episode number if not provided
        let nextEpisodeNumber = episodeNumber;
        if (!nextEpisodeNumber) {
            const maxEpisode = await (0, db_1.query) `
          SELECT MAX(EpisodeNumber) as MaxEpisode 
          FROM dbo.MovieEpisodes 
          WHERE MovieID = ${movieId}
        `;
            nextEpisodeNumber = (maxEpisode.recordset[0].MaxEpisode || 0) + 1;
        }
        const episodeTitle = title || `Tập ${nextEpisodeNumber}`;
        const episodeDuration = Number(duration) || 120;
        const videoFileName = `/uploads/${videoFile.filename}`;
        const episodeCode = `EP${movieId}-${String(nextEpisodeNumber).padStart(3, "0")}`;
        // Kiểm tra xem cột EpisodeCode có tồn tại không
        const checkColumn = await (0, db_1.query) `
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'MovieEpisodes' AND COLUMN_NAME = 'EpisodeCode'
      `;
        const hasEpisodeCode = checkColumn.recordset.length > 0;
        if (hasEpisodeCode) {
            await (0, db_1.query) `
          INSERT INTO dbo.MovieEpisodes (MovieID, EpisodeNumber, Title, VideoURL, Duration, EpisodeCode, IsFree, ViewCount, CreatedAt)
          VALUES (${movieId}, ${nextEpisodeNumber}, ${episodeTitle}, ${videoFileName}, ${episodeDuration}, ${episodeCode}, ${isFree === "true" || isFree === true ? 1 : 0}, 0, GETDATE())
        `;
        }
        else {
            await (0, db_1.query) `
          INSERT INTO dbo.MovieEpisodes (MovieID, EpisodeNumber, Title, VideoURL, Duration, IsFree, ViewCount, CreatedAt)
          VALUES (${movieId}, ${nextEpisodeNumber}, ${episodeTitle}, ${videoFileName}, ${episodeDuration}, ${isFree === "true" || isFree === true ? 1 : 0}, 0, GETDATE())
        `;
        }
        res.json({
            success: true,
            message: "Episode added successfully",
            episodeCode,
        });
    }
    catch (e) {
        console.error("POST /admin/movies/:movieId/episodes error:", e);
        res.status(500).json({ error: "Failed to add episode" });
    }
});
// Update episode
router.put("/admin/episodes/:episodeId", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), upload.fields([{ name: "videoFile", maxCount: 1 }]), async (req, res) => {
    try {
        const episodeId = Number(req.params.episodeId);
        const { title, duration, isFree, episodeNumber, episodeCode } = req.body;
        const videoFile = req.files?.["videoFile"]?.[0];
        // Get current episode
        const currentEpisode = await (0, db_1.query) `
        SELECT * FROM dbo.MovieEpisodes WHERE EpisodeID = ${episodeId}
      `;
        if (currentEpisode.recordset.length === 0) {
            return res.status(404).json({ error: "Episode not found" });
        }
        const episode = currentEpisode.recordset[0];
        // Kiểm tra xem cột EpisodeCode có tồn tại không
        const checkColumn = await (0, db_1.query) `
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'MovieEpisodes' AND COLUMN_NAME = 'EpisodeCode'
      `;
        const hasEpisodeCode = checkColumn.recordset.length > 0;
        // Update fields
        if (title) {
            await (0, db_1.query) `UPDATE dbo.MovieEpisodes SET Title = ${title} WHERE EpisodeID = ${episodeId}`;
        }
        if (duration) {
            await (0, db_1.query) `UPDATE dbo.MovieEpisodes SET Duration = ${Number(duration)} WHERE EpisodeID = ${episodeId}`;
        }
        if (typeof isFree !== "undefined") {
            await (0, db_1.query) `UPDATE dbo.MovieEpisodes SET IsFree = ${isFree ? 1 : 0} WHERE EpisodeID = ${episodeId}`;
        }
        if (episodeNumber && episodeNumber !== episode.EpisodeNumber) {
            if (hasEpisodeCode) {
                // Update episode code if number changes
                const newEpisodeCode = `EP${episode.MovieID}-${String(episodeNumber).padStart(3, "0")}`;
                await (0, db_1.query) `UPDATE dbo.MovieEpisodes SET EpisodeNumber = ${episodeNumber}, EpisodeCode = ${newEpisodeCode} WHERE EpisodeID = ${episodeId}`;
            }
            else {
                await (0, db_1.query) `UPDATE dbo.MovieEpisodes SET EpisodeNumber = ${episodeNumber} WHERE EpisodeID = ${episodeId}`;
            }
        }
        // Update EpisodeCode directly if provided
        if (hasEpisodeCode &&
            episodeCode &&
            episodeCode !== episode.EpisodeCode) {
            await (0, db_1.query) `UPDATE dbo.MovieEpisodes SET EpisodeCode = ${episodeCode} WHERE EpisodeID = ${episodeId}`;
        }
        if (videoFile) {
            const videoFileName = `/uploads/${videoFile.filename}`;
            await (0, db_1.query) `UPDATE dbo.MovieEpisodes SET VideoURL = ${videoFileName} WHERE EpisodeID = ${episodeId}`;
        }
        res.json({ success: true, message: "Episode updated successfully" });
    }
    catch (e) {
        console.error("PUT /admin/episodes/:episodeId error:", e);
        res.status(500).json({ error: "Failed to update episode" });
    }
});
// Delete episode
router.delete("/admin/episodes/:episodeId", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["delete:any_content"]), async (req, res) => {
    try {
        const episodeId = Number(req.params.episodeId);
        // Lấy thông tin episode trước khi xóa để xóa file video
        const episodeInfo = await (0, db_1.query) `
        SELECT VideoURL FROM dbo.MovieEpisodes WHERE EpisodeID = ${episodeId}
      `;
        const episode = episodeInfo.recordset[0];
        // Xóa các bản ghi trong MovieHistory có EpisodeID này trước
        try {
            await (0, db_1.query) `DELETE FROM dbo.MovieHistory WHERE EpisodeID = ${episodeId}`;
            console.log(`Đã xóa MovieHistory cho episode ID: ${episodeId}`);
        }
        catch (e) {
            console.log(`Không có MovieHistory cho episode ID: ${episodeId} hoặc đã xóa`);
        }
        // Xóa file video nếu có
        if (episode && episode.VideoURL) {
            try {
                // Xử lý VideoURL có thể có format /uploads/filename hoặc /storage/filename hoặc chỉ filename
                let videoFileName = episode.VideoURL;
                if (videoFileName.startsWith("/uploads/")) {
                    videoFileName = videoFileName.replace("/uploads/", "");
                }
                else if (videoFileName.startsWith("/storage/")) {
                    videoFileName = videoFileName.replace("/storage/", "");
                }
                // Loại bỏ query string nếu có
                videoFileName = videoFileName.split("?")[0];
                const videoPath = path_1.default.join(uploadsRoot, videoFileName);
                if (fs_1.default.existsSync(videoPath)) {
                    fs_1.default.unlinkSync(videoPath);
                    console.log(`🗑️ Đã xóa file video episode: ${videoPath}`);
                }
                else {
                    console.log(`⚠️ File video episode không tồn tại: ${videoPath}`);
                }
            }
            catch (fileError) {
                console.error("❌ Lỗi khi xóa file video episode:", fileError);
                // Không throw error, tiếp tục xóa episode trong database
            }
        }
        // Sau đó mới xóa episode
        await (0, db_1.query) `DELETE FROM dbo.MovieEpisodes WHERE EpisodeID = ${episodeId}`;
        console.log(`✅ Đã xóa episode ID: ${episodeId}`);
        res.json({ success: true, message: "Episode deleted successfully" });
    }
    catch (e) {
        console.error("DELETE /admin/episodes/:episodeId error:", e);
        res.status(500).json({ error: "Failed to delete episode" });
    }
});
// Save movie watch history
router.post("/history/movie", async (req, res) => {
    try {
        const { email, movieId, episodeId } = req.body;
        if (!movieId)
            return res.status(400).json({ error: "Missing movieId" });
        // Cập nhật ViewCount cho phim và episode (kể cả không đăng nhập)
        try {
            // Cập nhật ViewCount cho Movies
            await (0, db_1.query) `
        UPDATE Movies 
        SET ViewCount = ViewCount + 1 
        WHERE MovieID = ${Number(movieId)}
      `;
            // Cập nhật ViewCount cho MovieEpisodes nếu có episodeId
            if (episodeId) {
                await (0, db_1.query) `
          UPDATE MovieEpisodes 
          SET ViewCount = ViewCount + 1 
          WHERE EpisodeID = ${Number(episodeId)}
        `;
            }
        }
        catch (viewCountError) {
            console.error("Error updating view count:", viewCountError);
            // Không throw error, chỉ log để không ảnh hưởng đến lịch sử
        }
        // Nếu không có email, chỉ cập nhật view count, không lưu lịch sử
        if (!email) {
            return res.json({ ok: true, persisted: false, reason: "no_email" });
        }
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user) {
            // User chưa đăng ký, lưu vào memory
            const list = inMemoryMovieHistory.get(email) || [];
            // Kiểm tra xem đã có trong list chưa
            const existingIndex = list.findIndex((item) => item.MovieID === Number(movieId) &&
                (episodeId ? item.EpisodeID === Number(episodeId) : !item.EpisodeID));
            if (existingIndex >= 0) {
                // Đã có, cập nhật thời gian và đưa lên đầu
                list[existingIndex].WatchedAt = new Date().toISOString();
                list.splice(existingIndex, 1);
                list.unshift(list[existingIndex]);
            }
            else {
                // Chưa có, thêm mới
                list.unshift({
                    MovieID: Number(movieId),
                    EpisodeID: episodeId ? Number(episodeId) : undefined,
                    WatchedAt: new Date().toISOString(),
                });
            }
            inMemoryMovieHistory.set(email, list);
            return res.json({ ok: true, persisted: false, storage: "memory" });
        }
        // User đã đăng ký, kiểm tra xem đã có trong lịch sử chưa
        let existingHistory;
        if (episodeId) {
            existingHistory = await (0, db_1.query) `
        SELECT TOP 1 HistoryID 
        FROM MovieHistory 
        WHERE UserID = ${user.UserID} 
          AND MovieID = ${Number(movieId)}
          AND EpisodeID = ${Number(episodeId)}
      `;
        }
        else {
            existingHistory = await (0, db_1.query) `
        SELECT TOP 1 HistoryID 
        FROM MovieHistory 
        WHERE UserID = ${user.UserID} 
          AND MovieID = ${Number(movieId)}
          AND EpisodeID IS NULL
      `;
        }
        if (existingHistory.recordset.length > 0) {
            // Đã có, chỉ cập nhật thời gian
            await (0, db_1.query) `
        UPDATE MovieHistory 
        SET WatchedAt = GETDATE() 
        WHERE HistoryID = ${existingHistory.recordset[0].HistoryID}
      `;
            return res.json({ ok: true, updated: true });
        }
        else {
            // Chưa có, thêm mới
            await (0, db_1.query) `
        INSERT INTO MovieHistory (UserID, MovieID, EpisodeID, WatchedAt)
        VALUES (${user.UserID}, ${Number(movieId)}, ${episodeId ? Number(episodeId) : null}, GETDATE())
      `;
            return res.json({ ok: true, inserted: true });
        }
    }
    catch (e) {
        console.error("POST /history/movie error:", e);
        const { email, movieId, episodeId } = req.body;
        if (email && movieId) {
            const list = inMemoryMovieHistory.get(email) || [];
            const existingIndex = list.findIndex((item) => item.MovieID === Number(movieId) &&
                (episodeId ? item.EpisodeID === Number(episodeId) : !item.EpisodeID));
            if (existingIndex >= 0) {
                list[existingIndex].WatchedAt = new Date().toISOString();
                list.splice(existingIndex, 1);
                list.unshift(list[existingIndex]);
            }
            else {
                list.unshift({
                    MovieID: Number(movieId),
                    EpisodeID: episodeId ? Number(episodeId) : undefined,
                    WatchedAt: new Date().toISOString(),
                });
            }
            inMemoryMovieHistory.set(email, list);
            return res.json({ ok: true, persisted: false, storage: "memory" });
        }
        return res.status(400).json({ error: "Invalid request" });
    }
});
// Danh sách lịch sử xem phim
router.get("/history/movie", async (req, res) => {
    try {
        const email = req.query.email || "";
        const targetEmail = req.query.userEmail || email;
        if (!targetEmail)
            return res.status(400).json({ error: "Missing email" });
        // Check admin ability when querying other user's history
        let requesterIsAdmin = false;
        try {
            const requester = String(req.header("x-user-email") || "");
            if (requester) {
                const roleRes = await (0, db_1.query) `SELECT r.RoleName FROM Users u JOIN Roles r ON u.RoleID = r.RoleID WHERE u.Email = ${requester}`;
                requesterIsAdmin = roleRes.recordset[0]?.RoleName === "Admin";
            }
        }
        catch { }
        if (targetEmail !== email && !requesterIsAdmin) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${targetEmail}`;
        const user = userRes.recordset[0];
        if (!user)
            return res.json([]);
        const rows = await (0, db_1.query) `
      SELECT TOP 200 
        h.HistoryID, 
        h.MovieID, 
        h.EpisodeID, 
        h.WatchedAt, 
        m.Title, 
        m.Slug,
        me.EpisodeNumber
      FROM MovieHistory h
      JOIN Movies m ON h.MovieID = m.MovieID
      LEFT JOIN MovieEpisodes me ON h.EpisodeID = me.EpisodeID
      WHERE h.UserID = ${user.UserID}
      ORDER BY h.WatchedAt DESC
    `;
        res.json(rows.recordset);
    }
    catch (e) {
        console.error("GET /history/movie error:", e);
        res.status(500).json({ error: "Failed to fetch history" });
    }
});
// Save story read history and track view count
router.post("/history/series", async (req, res) => {
    try {
        const { email, seriesId, chapterId } = req.body;
        if (!seriesId)
            return res.status(400).json({ error: "Missing seriesId" });
        // Cập nhật ViewCount cho Series và Chapter (kể cả không đăng nhập)
        try {
            // Cập nhật ViewCount cho Series
            await (0, db_1.query) `
        UPDATE Series 
        SET ViewCount = ViewCount + 1 
        WHERE SeriesID = ${Number(seriesId)}
      `;
            // Cập nhật ViewCount cho Chapters nếu có chapterId
            if (chapterId) {
                await (0, db_1.query) `
          UPDATE Chapters 
          SET ViewCount = ViewCount + 1 
          WHERE ChapterID = ${Number(chapterId)}
        `;
            }
        }
        catch (viewCountError) {
            console.error("Error updating view count:", viewCountError);
            // Không throw error, chỉ log để không ảnh hưởng đến lịch sử
        }
        // Nếu không có email, chỉ cập nhật view count, không lưu lịch sử
        if (!email) {
            return res.json({ ok: true, persisted: false, reason: "no_email" });
        }
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user) {
            // User chưa đăng ký, không lưu lịch sử
            return res.json({ ok: true, persisted: false, reason: "user_not_found" });
        }
        // User đã đăng ký, kiểm tra xem đã có trong lịch sử chưa
        let existingHistory;
        if (chapterId) {
            existingHistory = await (0, db_1.query) `
        SELECT TOP 1 HistoryID 
        FROM SeriesHistory 
        WHERE UserID = ${user.UserID} 
          AND SeriesID = ${Number(seriesId)}
          AND ChapterID = ${Number(chapterId)}
      `;
        }
        else {
            existingHistory = await (0, db_1.query) `
        SELECT TOP 1 HistoryID 
        FROM SeriesHistory 
        WHERE UserID = ${user.UserID} 
          AND SeriesID = ${Number(seriesId)}
          AND ChapterID IS NULL
      `;
        }
        if (existingHistory.recordset.length > 0) {
            // Đã có, chỉ cập nhật thời gian
            await (0, db_1.query) `
        UPDATE SeriesHistory 
        SET ReadAt = GETDATE() 
        WHERE HistoryID = ${existingHistory.recordset[0].HistoryID}
      `;
            return res.json({ ok: true, updated: true });
        }
        else {
            // Chưa có, thêm mới
            await (0, db_1.query) `
        INSERT INTO SeriesHistory (UserID, SeriesID, ChapterID, ReadAt)
        VALUES (${user.UserID}, ${Number(seriesId)}, ${chapterId ? Number(chapterId) : null}, GETDATE())
      `;
            return res.json({ ok: true, inserted: true });
        }
    }
    catch (e) {
        console.error("POST /history/series error:", e);
        return res.status(500).json({ error: "Failed to save history" });
    }
});
// Danh sách lịch sử đọc truyện
router.get("/history/series", async (req, res) => {
    try {
        const email = req.query.email || "";
        const targetEmail = req.query.userEmail || email;
        if (!targetEmail)
            return res.status(400).json({ error: "Missing email" });
        // Check admin ability when querying other user's history
        let requesterIsAdmin = false;
        try {
            const requester = String(req.header("x-user-email") || "");
            if (requester) {
                const roleRes = await (0, db_1.query) `SELECT r.RoleName FROM Users u JOIN Roles r ON u.RoleID = r.RoleID WHERE u.Email = ${requester}`;
                requesterIsAdmin = roleRes.recordset[0]?.RoleName === "Admin";
            }
        }
        catch { }
        if (targetEmail !== email && !requesterIsAdmin) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${targetEmail}`;
        const user = userRes.recordset[0];
        if (!user)
            return res.json([]);
        const rows = await (0, db_1.query) `
      SELECT TOP 200 
        h.HistoryID, 
        h.SeriesID, 
        h.ChapterID, 
        h.ReadAt, 
        s.Title, 
        s.Slug,
        c.ChapterNumber
      FROM SeriesHistory h
      JOIN Series s ON h.SeriesID = s.SeriesID
      LEFT JOIN Chapters c ON h.ChapterID = c.ChapterID
      WHERE h.UserID = ${user.UserID}
      ORDER BY h.ReadAt DESC
    `;
        res.json(rows.recordset);
    }
    catch (e) {
        console.error("GET /history/series error:", e);
        res.status(500).json({ error: "Failed to fetch history" });
    }
});
// =============================================
// EXPERIENCE SYSTEM - TĂNG EXP KHI XEM PHIM/ĐỌC TRUYỆN
// =============================================
// Tăng EXP khi xem phim 30s
router.post("/experience/movie-watch", async (req, res) => {
    try {
        const { email, movieId, watchedSeconds } = req.body;
        if (!email || !movieId || typeof watchedSeconds !== "number") {
            return res.status(400).json({ error: "Missing email, movieId, or watchedSeconds" });
        }
        // Kiểm tra đã xem 30s chưa
        if (watchedSeconds < 30) {
            return res.json({ ok: true, expGained: 0, message: "Chưa xem đủ 30 giây" });
        }
        // Lấy UserID và Role
        const userRes = await (0, db_1.query) `
      SELECT TOP 1 u.UserID, u.RoleID 
      FROM Users u
      WHERE u.Email = ${email}
    `;
        const user = userRes.recordset[0];
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        // Kiểm tra nếu là Admin thì không tăng EXP
        const roleRes = await (0, db_1.query) `
      SELECT TOP 1 RoleName FROM Roles WHERE RoleID = ${user.RoleID}
    `;
        if (roleRes.recordset[0]?.RoleName === 'Admin') {
            return res.json({ ok: true, expGained: 0, message: "Admin không nhận EXP" });
        }
        // Kiểm tra đã nhận EXP cho phim này chưa
        const watchedCheck = await (0, db_1.query) `
      SELECT TOP 1 UserID FROM UserWatchedMovies 
      WHERE UserID = ${user.UserID} AND MovieID = ${Number(movieId)} AND Watched = 1
    `;
        if (watchedCheck.recordset.length > 0) {
            return res.json({ ok: true, expGained: 0, message: "Đã nhận EXP cho phim này rồi" });
        }
        // Tăng EXP: 10 EXP cho phim
        const expGain = 10;
        // Lấy hoặc tạo UserExp record
        const expRes = await (0, db_1.query) `
      SELECT TOP 1 UserID, TotalExp, MaxExp FROM UserExp WHERE UserID = ${user.UserID}
    `;
        let newTotalExp;
        let newMaxExp;
        if (expRes.recordset.length === 0) {
            // Tạo mới UserExp
            newTotalExp = expGain;
            newMaxExp = 100;
            await (0, db_1.query) `
        INSERT INTO UserExp (UserID, TotalExp, MaxExp)
        VALUES (${user.UserID}, ${newTotalExp}, ${newMaxExp})
      `;
        }
        else {
            // Cập nhật EXP
            const currentExp = expRes.recordset[0];
            newTotalExp = currentExp.TotalExp + expGain;
            newMaxExp = currentExp.MaxExp;
            // Tính level mới (mỗi 100 EXP = 1 level)
            const newLevel = Math.floor(newTotalExp / 100);
            const currentLevel = Math.floor(currentExp.TotalExp / 100);
            // Nếu level up, cập nhật MaxExp
            if (newLevel > currentLevel) {
                newMaxExp = 100; // Reset về 100 cho level mới
            }
            await (0, db_1.query) `
        UPDATE UserExp 
        SET TotalExp = ${newTotalExp}, MaxExp = ${newMaxExp}
        WHERE UserID = ${user.UserID}
      `;
        }
        // Đánh dấu đã xem phim này
        await (0, db_1.query) `
      IF EXISTS (SELECT 1 FROM UserWatchedMovies WHERE UserID = ${user.UserID} AND MovieID = ${Number(movieId)})
        UPDATE UserWatchedMovies SET Watched = 1 WHERE UserID = ${user.UserID} AND MovieID = ${Number(movieId)}
      ELSE
        INSERT INTO UserWatchedMovies (UserID, MovieID, Watched) VALUES (${user.UserID}, ${Number(movieId)}, 1)
    `;
        const level = Math.floor(newTotalExp / 100) + 1; // Level bắt đầu từ 1
        const currentLevelExp = newTotalExp % 100;
        return res.json({
            ok: true,
            expGained: expGain,
            totalExp: newTotalExp,
            level: level,
            currentLevelExp: currentLevelExp,
            maxExp: newMaxExp,
            message: `Nhận được ${expGain} EXP!`
        });
    }
    catch (e) {
        console.error("POST /experience/movie-watch error:", e);
        return res.status(500).json({ error: "Failed to award movie watch EXP" });
    }
});
// Tăng EXP khi đọc hết 1 chapter
router.post("/experience/chapter-complete", async (req, res) => {
    try {
        const { email, chapterId } = req.body;
        if (!email || !chapterId) {
            return res.status(400).json({ error: "Missing email or chapterId" });
        }
        // Lấy UserID và Role
        const userRes = await (0, db_1.query) `
      SELECT TOP 1 u.UserID, u.RoleID 
      FROM Users u
      WHERE u.Email = ${email}
    `;
        const user = userRes.recordset[0];
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        // Kiểm tra nếu là Admin thì không tăng EXP
        const roleRes = await (0, db_1.query) `
      SELECT TOP 1 RoleName FROM Roles WHERE RoleID = ${user.RoleID}
    `;
        if (roleRes.recordset[0]?.RoleName === 'Admin') {
            return res.json({ ok: true, expGained: 0, message: "Admin không nhận EXP" });
        }
        // Kiểm tra đã nhận EXP cho chapter này chưa
        const readCheck = await (0, db_1.query) `
      SELECT TOP 1 UserID FROM UserReadChapters 
      WHERE UserID = ${user.UserID} AND ChapterID = ${Number(chapterId)} AND [Read] = 1
    `;
        if (readCheck.recordset.length > 0) {
            return res.json({ ok: true, expGained: 0, message: "Đã nhận EXP cho chapter này rồi" });
        }
        // Tăng EXP: 5 EXP cho chapter
        const expGain = 5;
        // Lấy hoặc tạo UserExp record
        const expRes = await (0, db_1.query) `
      SELECT TOP 1 UserID, TotalExp, MaxExp FROM UserExp WHERE UserID = ${user.UserID}
    `;
        let newTotalExp;
        let newMaxExp;
        if (expRes.recordset.length === 0) {
            // Tạo mới UserExp
            newTotalExp = expGain;
            newMaxExp = 100;
            await (0, db_1.query) `
        INSERT INTO UserExp (UserID, TotalExp, MaxExp)
        VALUES (${user.UserID}, ${newTotalExp}, ${newMaxExp})
      `;
        }
        else {
            // Cập nhật EXP
            const currentExp = expRes.recordset[0];
            newTotalExp = currentExp.TotalExp + expGain;
            newMaxExp = currentExp.MaxExp;
            // Tính level mới (mỗi 100 EXP = 1 level)
            const newLevel = Math.floor(newTotalExp / 100);
            const currentLevel = Math.floor(currentExp.TotalExp / 100);
            // Nếu level up, cập nhật MaxExp
            if (newLevel > currentLevel) {
                newMaxExp = 100; // Reset về 100 cho level mới
            }
            await (0, db_1.query) `
        UPDATE UserExp 
        SET TotalExp = ${newTotalExp}, MaxExp = ${newMaxExp}
        WHERE UserID = ${user.UserID}
      `;
        }
        // Đánh dấu đã đọc chapter này
        await (0, db_1.query) `
      IF EXISTS (SELECT 1 FROM UserReadChapters WHERE UserID = ${user.UserID} AND ChapterID = ${Number(chapterId)})
        UPDATE UserReadChapters SET [Read] = 1 WHERE UserID = ${user.UserID} AND ChapterID = ${Number(chapterId)}
      ELSE
        INSERT INTO UserReadChapters (UserID, ChapterID, [Read]) VALUES (${user.UserID}, ${Number(chapterId)}, 1)
    `;
        const level = Math.floor(newTotalExp / 100) + 1; // Level bắt đầu từ 1
        const currentLevelExp = newTotalExp % 100;
        return res.json({
            ok: true,
            expGained: expGain,
            totalExp: newTotalExp,
            level: level,
            currentLevelExp: currentLevelExp,
            maxExp: newMaxExp,
            message: `Nhận được ${expGain} EXP!`
        });
    }
    catch (e) {
        console.error("POST /experience/chapter-complete error:", e);
        return res.status(500).json({ error: "Failed to award chapter complete EXP" });
    }
});
// Lấy thông tin EXP/Level của user
router.get("/experience/user", async (req, res) => {
    try {
        const email = req.query.email || "";
        if (!email) {
            return res.status(400).json({ error: "Missing email" });
        }
        // Lấy UserID
        const userRes = await (0, db_1.query) `
      SELECT TOP 1 UserID FROM Users WHERE Email = ${email}
    `;
        const user = userRes.recordset[0];
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        // Lấy UserExp
        const expRes = await (0, db_1.query) `
      SELECT TOP 1 UserID, TotalExp, MaxExp FROM UserExp WHERE UserID = ${user.UserID}
    `;
        if (expRes.recordset.length === 0) {
            // Chưa có EXP, trả về mặc định
            return res.json({
                totalExp: 0,
                level: 1,
                currentLevelExp: 0,
                maxExp: 100,
                expToNextLevel: 100
            });
        }
        const exp = expRes.recordset[0];
        const level = Math.floor(exp.TotalExp / 100) + 1; // Level bắt đầu từ 1
        const currentLevelExp = exp.TotalExp % 100;
        const expToNextLevel = exp.MaxExp - currentLevelExp;
        return res.json({
            totalExp: exp.TotalExp,
            level: level,
            currentLevelExp: currentLevelExp,
            maxExp: exp.MaxExp,
            expToNextLevel: expToNextLevel
        });
    }
    catch (e) {
        console.error("GET /experience/user error:", e);
        return res.status(500).json({ error: "Failed to fetch user experience" });
    }
});
// ===== SEARCH =====
router.get("/search", async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();
        if (!q)
            return res.json({ movies: [], series: [] });
        const movies = await (0, db_1.query) `
      SELECT TOP 10 MovieID, Title, Slug, PosterURL, ReleaseYear, Duration, Rating, ISNULL(TotalRatings, 0) AS TotalRatings
      FROM Movies
      WHERE Status = 'Approved' AND Title LIKE ${"%" + q + "%"}
      ORDER BY ISNULL(Rating, 0) DESC, ISNULL(TotalRatings, 0) DESC, ViewCount DESC
    `;
        const series = await (0, db_1.query) `
      SELECT TOP 10 SeriesID, Title, Slug, CoverURL, Rating, ISNULL(TotalRatings, 0) AS TotalRatings
      FROM Series
      WHERE Status = 'Approved' AND Title LIKE ${"%" + q + "%"}
      ORDER BY ISNULL(Rating, 0) DESC, ISNULL(TotalRatings, 0) DESC, ViewCount DESC
    `;
        res.json({
            movies: movies.recordset,
            series: series.recordset,
        });
    }
    catch (e) {
        console.error("GET /search error:", e);
        res.status(500).json({ error: "Search failed" });
    }
});
// ===== ADMIN MOVIE VIEW STATS =====
router.get("/admin/stats/movies/views", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), async (req, res) => {
    try {
        const days = Number(req.query.days ?? 0);
        const limit = Math.min(Number(req.query.limit ?? 100), 500);
        const offset = Number(req.query.offset ?? 0);
        // Build simple SQL query
        let sql = `
        SELECT 
          h.MovieID,
          m.Title,
          m.Slug,
          m.PosterURL,
          COUNT(*) AS totalViews,
          COUNT(DISTINCT h.UserID) AS uniqueViewers,
          MAX(h.WatchedAt) AS lastWatchedAt
        FROM MovieHistory h
        JOIN Movies m ON m.MovieID = h.MovieID
      `;
        if (days > 0) {
            sql += ` WHERE h.WatchedAt >= DATEADD(day, -${days}, GETDATE())`;
        }
        sql += `
        GROUP BY h.MovieID, m.Title, m.Slug, m.PosterURL
        ORDER BY totalViews DESC
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
      `;
        const pool = await (0, db_1.getPool)();
        const result = await pool.request().query(sql);
        res.json(result.recordset);
    }
    catch (e) {
        console.error("GET /admin/stats/movies/views error:", e);
        res.status(500).json({ error: "Failed to fetch movie view stats" });
    }
});
// Delete a movie watch history item
router.delete("/history/movie", async (req, res) => {
    try {
        const email = String(req.query.email || "");
        const historyId = Number(req.query.historyId);
        if (!email || !historyId)
            return res.status(400).json({ error: "Missing email or historyId" });
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user)
            return res.status(404).json({ error: "User not found" });
        // Ensure the history item belongs to this user
        const item = await (0, db_1.query) `SELECT COUNT(*) as cnt FROM MovieHistory WHERE HistoryID = ${historyId} AND UserID = ${user.UserID}`;
        if ((item.recordset[0]?.cnt ?? 0) === 0)
            return res.status(404).json({ error: "History item not found" });
        await (0, db_1.query) `DELETE FROM MovieHistory WHERE HistoryID = ${historyId}`;
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("DELETE /history/movie error:", e);
        res.status(500).json({ error: "Failed to delete history" });
    }
});
// Delete series history
router.delete("/history/series", async (req, res) => {
    try {
        const email = String(req.query.email || "");
        const historyId = Number(req.query.historyId);
        if (!email || !historyId)
            return res.status(400).json({ error: "Missing email or historyId" });
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user)
            return res.status(404).json({ error: "User not found" });
        // Ensure the history item belongs to this user
        const item = await (0, db_1.query) `SELECT COUNT(*) as cnt FROM SeriesHistory WHERE HistoryID = ${historyId} AND UserID = ${user.UserID}`;
        if ((item.recordset[0]?.cnt ?? 0) === 0)
            return res.status(404).json({ error: "History item not found" });
        await (0, db_1.query) `DELETE FROM SeriesHistory WHERE HistoryID = ${historyId}`;
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("DELETE /history/series error:", e);
        res.status(500).json({ error: "Failed to delete history" });
    }
});
// Danh sách lịch sử đọc truyện
router.get("/user/series-history", authenticate, async (req, res) => {
    try {
        const userId = req.user.UserID;
        const rows = await (0, db_1.query) `
      SELECT TOP 200 h.HistoryID, h.UserID, h.SeriesID, h.ChapterID, h.ReadAt, 
             s.Title, s.Slug, c.ChapterNumber
      FROM SeriesHistory h
      JOIN Series s ON h.SeriesID = s.SeriesID
      LEFT JOIN Chapters c ON h.ChapterID = c.ChapterID
      WHERE h.UserID = ${userId}
      ORDER BY h.ReadAt DESC
    `;
        res.json(rows.recordset);
    }
    catch (e) {
        console.error("GET /user/series-history error:", e);
        res.status(500).json({ error: "Failed to fetch series history" });
    }
});
// Auth endpoints (fallback when Supabase is not configured)
router.post("/auth/register", async (req, res) => {
    try {
        const { email, username, fullName, password } = req.body;
        if (!email || !username || !password) {
            return res.status(400).json({ error: "Missing fields" });
        } // Check duplicates first for clearer error (avoid reserved keyword alias)
        const dup = await (0, db_1.query) `
      SELECT COUNT(1) AS cnt FROM Users WHERE Email = ${email} OR Username = ${username}
    `;
        if ((dup.recordset[0]?.cnt ?? 0) > 0) {
            return res
                .status(409)
                .json({ error: "Email or username already exists" });
        }
        const passwordHash = bcryptjs_1.default.hashSync(password, 10); // RoleID default 1 (Viewer)
        await (0, db_1.query) `
      INSERT INTO Users (Username, Email, PasswordHash, FullName, RoleID, IsEmailVerified, IsActive)
      VALUES (${username}, ${email}, ${passwordHash}, ${fullName ?? ""}, 1, 0, 1)
    `;
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("Register error:", e);
        const msg = e?.originalError?.info?.message || e?.message || "Registration failed";
        return res.status(500).json({ error: msg });
    }
});
router.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await (0, db_1.query) `
      SELECT UserID, PasswordHash FROM Users WHERE Email = ${email}
    `;
        const user = result.recordset[0];
        if (!user)
            return res.status(401).json({ error: "Invalid credentials" });
        const ok = bcryptjs_1.default.compareSync(password, user.PasswordHash);
        if (!ok)
            return res.status(401).json({ error: "Invalid credentials" });
        return res.json({ ok: true, userId: user.UserID });
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Login failed" });
    }
});
// Get current user's profile by email
router.get("/me", async (req, res) => {
    try {
        const email = req.query.email ?? "";
        if (!email)
            return res.status(400).json({ error: "Missing email" });
        const result = await (0, db_1.query) `
      SELECT TOP 1 Username, FullName, Avatar, CreatedAt, UserID FROM Users WHERE Email = ${email}
    `;
        const row = result.recordset[0];
        if (row) {
            // Load Gender from preferences
            let gender = null;
            try {
                const genderResult = await (0, db_1.query) `
          SELECT PreferenceValue FROM UserPreferences 
          WHERE UserID = ${row.UserID} AND PreferenceKey = 'gender'
        `;
                if (genderResult.recordset[0]) {
                    gender = genderResult.recordset[0].PreferenceValue;
                }
            }
            catch {
                // If preference not found, continue without gender
            }
            return res.json({
                Username: row.Username,
                FullName: row.FullName || "",
                Avatar: row.Avatar || "",
                Gender: gender || "Không xác định",
                CreatedAt: row.CreatedAt ? row.CreatedAt.toISOString() : undefined,
            });
        }
        // Not found in DB → return memory or minimal default
        const mem = inMemoryUsers.get(email);
        if (mem)
            return res.json({
                ...mem,
                Gender: "Không xác định",
                CreatedAt: undefined,
            });
        return res.json({
            Username: email.split("@")[0] || "",
            FullName: "",
            Avatar: "",
            Gender: "Không xác định",
            CreatedAt: undefined,
        });
    }
    catch (e) {
        console.error("GET /me error:", e);
        const email = req.query.email ?? "";
        const fallback = inMemoryUsers.get(email);
        if (fallback)
            return res.json({
                ...fallback,
                Gender: "Không xác định",
                CreatedAt: undefined,
            });
        return res.status(404).json({ error: "User not found" });
    }
});
// Update current user's profile by email
router.post("/me", async (req, res) => {
    try {
        const { email, username, fullName, avatar, gender, password } = req.body;
        if (!email)
            return res.status(400).json({ error: "Missing email" }); // Ensure user exists
        const exists = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = exists.recordset[0];
        if (!user) {
            // If not in DB, persist to in-memory instead of failing
            const current = inMemoryUsers.get(email) || {
                Username: "",
                FullName: "",
                Avatar: "",
            };
            if (typeof username !== "undefined")
                current.Username = username;
            if (typeof fullName !== "undefined")
                current.FullName = fullName;
            if (typeof avatar !== "undefined")
                current.Avatar = avatar;
            inMemoryUsers.set(email, current);
            // Save gender to in-memory preferences
            if (typeof gender !== "undefined") {
                const prefs = inMemoryPreferences.get(email) || {};
                prefs.gender = gender;
                inMemoryPreferences.set(email, prefs);
            }
            return res.json({ ok: true, persisted: false, storage: "memory" });
        } // Update only provided fields
        if (typeof username !== "undefined") {
            await (0, db_1.query) `UPDATE Users SET Username = ${username} WHERE UserID = ${user.UserID}`;
        }
        if (typeof fullName !== "undefined") {
            await (0, db_1.query) `UPDATE Users SET FullName = ${fullName} WHERE UserID = ${user.UserID}`;
        }
        if (typeof avatar !== "undefined") {
            await (0, db_1.query) `UPDATE Users SET Avatar = ${avatar} WHERE UserID = ${user.UserID}`;
        }
        if (typeof password !== "undefined" && password) {
            const passwordHash = bcryptjs_1.default.hashSync(password, 10);
            await (0, db_1.query) `UPDATE Users SET PasswordHash = ${passwordHash} WHERE UserID = ${user.UserID}`;
        }
        // Update gender in preferences
        if (typeof gender !== "undefined") {
            const checkPref = await (0, db_1.query) `
        SELECT COUNT(1) AS Cnt FROM UserPreferences WHERE UserID = ${user.UserID} AND PreferenceKey = 'gender'
      `;
            if (checkPref.recordset[0]?.Cnt > 0) {
                await (0, db_1.query) `
          UPDATE UserPreferences SET PreferenceValue = ${String(gender)}
          WHERE UserID = ${user.UserID} AND PreferenceKey = 'gender'
        `;
            }
            else {
                await (0, db_1.query) `
          INSERT INTO UserPreferences (UserID, PreferenceKey, PreferenceValue)
          VALUES (${user.UserID}, 'gender', ${String(gender)})
        `;
            }
        }
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("POST /me error:", e);
        const { email, username, fullName, avatar, gender, password } = req.body;
        if (email) {
            const current = inMemoryUsers.get(email) || {
                Username: "",
                FullName: "",
                Avatar: "",
            };
            if (typeof username !== "undefined")
                current.Username = username;
            if (typeof fullName !== "undefined")
                current.FullName = fullName;
            if (typeof avatar !== "undefined")
                current.Avatar = avatar;
            inMemoryUsers.set(email, current);
            // Save gender to in-memory preferences
            if (typeof gender !== "undefined") {
                const prefs = inMemoryPreferences.get(email) || {};
                prefs.gender = gender;
                inMemoryPreferences.set(email, prefs);
            }
            return res.json({ ok: true, persisted: false, storage: "memory" });
        }
        return res.status(400).json({ error: "Invalid request" });
    }
});
// Avatar upload endpoint
router.post("/me/avatar", upload.single("avatar"), async (req, res) => {
    try {
        const email = req.body.email || "";
        if (!email)
            return res.status(400).json({ error: "Missing email" });
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: "No file uploaded" });
        // Check file size (5MB limit for avatar)
        if (file.size > 5 * 1024 * 1024) {
            // Delete the uploaded file if too large
            fs_1.default.unlinkSync(file.path);
            return res.status(400).json({ error: "File size must be less than 5MB" });
        }
        // Check if it's an image
        if (!file.mimetype.startsWith("image/")) {
            fs_1.default.unlinkSync(file.path);
            return res.status(400).json({ error: "File must be an image" });
        }
        const avatarUrl = `/uploads/${file.filename}`;
        // Update user's avatar in database
        const exists = await (0, db_1.query) `
      SELECT TOP 1 UserID FROM Users WHERE Email = ${email}
    `;
        const user = exists.recordset[0];
        if (user) {
            await (0, db_1.query) `UPDATE Users SET Avatar = ${avatarUrl} WHERE UserID = ${user.UserID}`;
        }
        else {
            // If not in DB, save to in-memory
            const current = inMemoryUsers.get(email) || {
                Username: "",
                FullName: "",
                Avatar: "",
            };
            current.Avatar = avatarUrl;
            inMemoryUsers.set(email, current);
        }
        return res.json({ ok: true, avatarUrl });
    }
    catch (e) {
        console.error("POST /me/avatar error:", e);
        // Clean up file if uploaded
        if (req.file) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch {
                // Ignore cleanup errors
            }
        }
        return res.status(500).json({ error: "Failed to upload avatar" });
    }
});
// Favorites: list movies favorited by user (email)
router.get("/favorites", async (req, res) => {
    try {
        const email = req.query.email ?? "";
        if (!email)
            return res.status(400).json({ error: "Missing email" });
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user) {
            // fallback
            const set = inMemoryFavorites.get(email) || new Set();
            return res.json(Array.from(set));
        }
        const rows = await (0, db_1.query) `
      SELECT MF.MovieID FROM MovieFavorites MF WHERE MF.UserID = ${user.UserID}
    `;
        return res.json(rows.recordset.map((r) => r.MovieID));
    }
    catch (e) {
        console.error("GET /favorites error:", e);
        const email = req.query.email ?? "";
        const set = inMemoryFavorites.get(email) || new Set();
        return res.json(Array.from(set));
    }
});
// Add favorite
router.post("/favorites", async (req, res) => {
    try {
        const { email, movieId } = req.body;
        if (!email || !movieId)
            return res.status(400).json({ error: "Missing email or movieId" });
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user) {
            const set = inMemoryFavorites.get(email) || new Set();
            set.add(Number(movieId));
            inMemoryFavorites.set(email, set);
            return res.json({ ok: true, persisted: false, storage: "memory" });
        }
        await (0, db_1.query) `INSERT INTO MovieFavorites (UserID, MovieID) VALUES (${user.UserID}, ${Number(movieId)})`;
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("POST /favorites error:", e);
        const { email, movieId } = req.body;
        if (email && movieId) {
            const set = inMemoryFavorites.get(email) || new Set();
            set.add(Number(movieId));
            inMemoryFavorites.set(email, set);
            return res.json({ ok: true, persisted: false, storage: "memory" });
        }
        return res.status(400).json({ error: "Invalid request" });
    }
});
// Remove favorite
router.delete("/favorites", async (req, res) => {
    try {
        const email = req.query.email ?? "";
        const movieId = Number(req.query.movieId);
        if (!email || !movieId)
            return res.status(400).json({ error: "Missing email or movieId" });
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user) {
            const set = inMemoryFavorites.get(email) || new Set();
            set.delete(movieId);
            inMemoryFavorites.set(email, set);
            return res.json({ ok: true, persisted: false, storage: "memory" });
        }
        await (0, db_1.query) `DELETE FROM MovieFavorites WHERE UserID = ${user.UserID} AND MovieID = ${movieId}`;
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("DELETE /favorites error:", e);
        const email = req.query.email ?? "";
        const movieId = Number(req.query.movieId);
        if (email && movieId) {
            const set = inMemoryFavorites.get(email) || new Set();
            set.delete(movieId);
            inMemoryFavorites.set(email, set);
            return res.json({ ok: true, persisted: false, storage: "memory" });
        }
        return res.status(400).json({ error: "Invalid request" });
    }
});
// ===== Notifications =====
// List notifications
router.get("/notifications", async (req, res) => {
    try {
        let email = req.query.email ?? "";
        // Decode email nếu bị encode
        try {
            email = decodeURIComponent(email);
        }
        catch {
            // Nếu không decode được, dùng email gốc
        }
        console.log("📥 GET /notifications - Email (decoded):", email);
        if (!email)
            return res.status(400).json({ error: "Missing email" });
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user) {
            const list = inMemoryNotifications.get(email) || [];
            return res.json(list);
        }
        const rows = await (0, db_1.query) `
      SELECT NotificationID, Type, Title, Content, RelatedURL, IsRead, CreatedAt
      FROM Notifications WHERE UserID = ${user.UserID}
      ORDER BY CreatedAt DESC
    `;
        console.log("📊 Total notifications for user:", rows.recordset.length);
        const unreadCount = rows.recordset.filter((r) => !r.IsRead).length;
        console.log("📊 Unread notifications:", unreadCount);
        return res.json(rows.recordset);
    }
    catch (e) {
        console.error("GET /notifications error:", e);
        let email = req.query.email ?? "";
        try {
            email = decodeURIComponent(email);
        }
        catch { }
        const list = inMemoryNotifications.get(email) || [];
        return res.json(list);
    }
});
// Create notification (for demo/testing)
router.post("/notifications", async (req, res) => {
    try {
        const { email, type, title, content, relatedURL } = req.body;
        if (!email || !type || !title)
            return res.status(400).json({ error: "Missing email/type/title" });
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user) {
            const list = inMemoryNotifications.get(email) || [];
            list.unshift({
                Type: type,
                Title: title,
                Content: content,
                RelatedURL: relatedURL,
                IsRead: false,
                CreatedAt: new Date().toISOString(),
            });
            inMemoryNotifications.set(email, list);
            (0, socketService_1.emitNotificationCreated)(String(email), list[0]);
            return res.json({ ok: true, persisted: false, storage: "memory" });
        }
        await (0, db_1.query) `
      INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead)
      VALUES (${user.UserID}, ${type}, ${title}, ${content ?? ""}, ${relatedURL ?? ""}, 0)
    `;
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("POST /notifications error:", e);
        const { email, type, title, content, relatedURL } = req.body;
        if (email && type && title) {
            const list = inMemoryNotifications.get(email) || [];
            list.unshift({
                Type: String(type),
                Title: String(title),
                Content: String(content ?? ""),
                RelatedURL: String(relatedURL ?? ""),
                IsRead: false,
                CreatedAt: new Date().toISOString(),
            });
            inMemoryNotifications.set(email, list);
            return res.json({ ok: true, persisted: false, storage: "memory" });
        }
        return res.status(400).json({ error: "Invalid request" });
    }
});
// Get unread notification count
router.get("/notifications/count", async (req, res) => {
    try {
        let email = req.query.email ?? "";
        // Decode email nếu bị encode
        try {
            email = decodeURIComponent(email);
        }
        catch {
            // Nếu không decode được, dùng email gốc
        }
        console.log("📥 GET /notifications/count - Email (decoded):", email);
        if (!email)
            return res.status(400).json({ error: "Missing email" });
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user) {
            const list = inMemoryNotifications.get(email) || [];
            const count = list.filter((n) => !n.IsRead).length;
            console.log("📊 In-memory notifications count:", count);
            return res.json({ count });
        }
        // Query tất cả notifications để đếm manual (SQL Server BIT có thể trả về 0/1 hoặc true/false)
        const allNotifications = await (0, db_1.query) `
      SELECT IsRead FROM Notifications WHERE UserID = ${user.UserID}
    `;
        // Đếm unread: IsRead = 0, false, null, hoặc undefined
        const unreadCount = allNotifications.recordset.filter((r) => {
            const isRead = r.IsRead;
            return (isRead === 0 ||
                isRead === false ||
                isRead === null ||
                isRead === undefined);
        }).length;
        console.log("📊 All notifications:", allNotifications.recordset.length, "for UserID:", user.UserID);
        console.log("📊 Unread notifications (manual count):", unreadCount);
        console.log("📊 Notification details:", allNotifications.recordset.map((r) => ({
            IsRead: r.IsRead,
            type: typeof r.IsRead,
        })));
        return res.json({ count: unreadCount });
    }
    catch (e) {
        console.error("GET /notifications/count error:", e);
        const email = req.query.email ?? "";
        const list = inMemoryNotifications.get(email) || [];
        const count = list.filter((n) => !n.IsRead).length;
        console.log("📊 Fallback in-memory count:", count);
        return res.json({ count });
    }
});
// Mark as read
router.post("/notifications/read", async (req, res) => {
    try {
        const { email, notificationId } = req.body;
        if (!email)
            return res.status(400).json({ error: "Missing email" });
        if (!notificationId) {
            // mark all
            const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
            const user = userRes.recordset[0];
            if (!user) {
                const list = inMemoryNotifications.get(email) || [];
                list.forEach((n) => (n.IsRead = true));
                inMemoryNotifications.set(email, list);
                return res.json({ ok: true, persisted: false, storage: "memory" });
            }
            await (0, db_1.query) `UPDATE Notifications SET IsRead = 1 WHERE UserID = ${user.UserID}`;
            return res.json({ ok: true });
        }
        else {
            const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
            const user = userRes.recordset[0];
            if (!user) {
                const list = inMemoryNotifications.get(email) || [];
                const target = list.find((_, idx) => idx + 1 === Number(notificationId));
                if (target)
                    target.IsRead = true;
                inMemoryNotifications.set(email, list);
                return res.json({ ok: true, persisted: false, storage: "memory" });
            }
            await (0, db_1.query) `UPDATE Notifications SET IsRead = 1 WHERE NotificationID = ${Number(notificationId)} AND UserID = ${user.UserID}`;
            return res.json({ ok: true });
        }
    }
    catch (e) {
        console.error("POST /notifications/read error:", e);
        const { email, notificationId } = req.body;
        const list = inMemoryNotifications.get(email) || [];
        if (!notificationId)
            list.forEach((n) => (n.IsRead = true));
        inMemoryNotifications.set(email, list);
        return res.json({ ok: true, persisted: false, storage: "memory" });
    }
});
// User Preferences: get current preferences by email (for simple demo)
router.get("/preferences", async (req, res) => {
    try {
        const email = req.query.email ?? "";
        if (!email) {
            return res.status(400).json({ error: "Missing email" });
        } // Find user id by email
        const userRes = await (0, db_1.query) `
      SELECT UserID FROM Users WHERE Email = ${email}
    `;
        const user = userRes.recordset[0];
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        } // Load preferences into key-value map
        const prefs = await (0, db_1.query) `
      SELECT PreferenceKey, PreferenceValue FROM UserPreferences WHERE UserID = ${user.UserID}
    `;
        const map = {};
        for (const row of prefs.recordset) {
            map[row.PreferenceKey] = row.PreferenceValue;
        }
        return res.json(map);
    }
    catch (e) {
        // Graceful fallback: when DB is unavailable or any error occurs, use in-memory store
        console.error("GET /preferences error:", e);
        const email = req.query.email ?? "";
        const fallback = inMemoryPreferences.get(email) || {};
        return res.json(fallback);
    }
});
// Save a single preference key/value for a user identified by email
router.post("/preferences", async (req, res) => {
    try {
        const { email, key, value } = req.body;
        if (!email || !key || typeof value === "undefined") {
            return res.status(400).json({ error: "Missing email, key or value" });
        } // Find user id by email
        const userRes = await (0, db_1.query) `
      SELECT UserID FROM Users WHERE Email = ${email}
    `;
        const user = userRes.recordset[0];
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        } // Upsert preference
        const existing = await (0, db_1.query) `
      SELECT COUNT(1) AS Cnt FROM UserPreferences WHERE UserID = ${user.UserID} AND PreferenceKey = ${key}
    `;
        if ((existing.recordset[0]?.Cnt ?? 0) > 0) {
            await (0, db_1.query) `
        UPDATE UserPreferences SET PreferenceValue = ${String(value)}
        WHERE UserID = ${user.UserID} AND PreferenceKey = ${key}
      `;
        }
        else {
            await (0, db_1.query) `
        INSERT INTO UserPreferences (UserID, PreferenceKey, PreferenceValue)
        VALUES (${user.UserID}, ${key}, ${String(value)})
      `;
        }
        return res.json({ ok: true });
    }
    catch (e) {
        // Graceful fallback: persist in memory if DB fails
        console.error("POST /preferences error:", e);
        const { email, key, value } = req.body;
        if (email && key && typeof value !== "undefined") {
            const existing = inMemoryPreferences.get(email) || {};
            existing[String(key)] = String(value);
            inMemoryPreferences.set(email, existing);
        }
        return res.json({ ok: true, persisted: false, storage: "memory" });
    }
});
// ===== MOVIE COMMENTS API =====
// Lấy danh sách bình luận của phim
router.get("/movies/:id/comments", async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        if (!movieId)
            return res.status(400).json({ error: "Invalid movie ID" });
        const comments = await (0, db_1.query) `
      SELECT 
        mc.CommentID,
        mc.Content,
        mc.CreatedAt,
        mc.ParentCommentID,
        mc.IsDeleted,
        u.Username,
        u.Avatar,
        u.Email,
        r.RoleName,
        ISNULL(likeCount.LikeCount, 0) as LikeCount,
        ISNULL(dislikeCount.DislikeCount, 0) as DislikeCount,
        userReaction.ReactionType as UserReaction,
        CAST(
          CASE 
            WHEN ue.TotalExp IS NULL THEN 1
            ELSE FLOOR(ue.TotalExp / 100) + 1
          END AS INT
        ) as Level
      FROM MovieComments mc
      INNER JOIN Users u ON mc.UserID = u.UserID
      INNER JOIN Roles r ON u.RoleID = r.RoleID
      LEFT JOIN UserExp ue ON u.UserID = ue.UserID
      LEFT JOIN (
        SELECT CommentID, COUNT(*) as LikeCount 
        FROM MovieCommentReactions 
        WHERE ReactionType = 'Like' 
        GROUP BY CommentID
      ) likeCount ON mc.CommentID = likeCount.CommentID
      LEFT JOIN (
        SELECT CommentID, COUNT(*) as DislikeCount 
        FROM MovieCommentReactions 
        WHERE ReactionType = 'Dislike' 
        GROUP BY CommentID
      ) dislikeCount ON mc.CommentID = dislikeCount.CommentID
      LEFT JOIN (
        SELECT CommentID, ReactionType 
        FROM MovieCommentReactions 
        WHERE UserID = ${req.user?.id || 0}
      ) userReaction ON mc.CommentID = userReaction.CommentID
      WHERE mc.MovieID = ${movieId} AND mc.IsDeleted = 0
      ORDER BY mc.CreatedAt DESC
    `;
        res.json(comments.recordset);
    }
    catch (e) {
        console.error("GET /movies/:id/comments error:", e);
        res.status(500).json({ error: "Failed to fetch comments" });
    }
});
// Thêm bình luận mới
router.post("/movies/:id/comments", authenticate, async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const { content, parentCommentId } = req.body;
        if (!movieId || !content) {
            return res.status(400).json({ error: "Missing movie ID or content" });
        }
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        await (0, db_1.query) `
      INSERT INTO MovieComments (UserID, MovieID, ParentCommentID, Content, CreatedAt)
      VALUES (${Number(req.user.id)}, ${movieId}, ${parentCommentId || null}, ${content}, GETDATE())
    `;
        // Tạo thông báo nếu đây là reply
        if (parentCommentId) {
            try {
                console.log("📝 Creating reply notification for parentCommentId:", parentCommentId, "from user:", req.user.id);
                // Lấy thông tin người comment gốc
                const parentComment = await (0, db_1.query) `
            SELECT u.UserID, u.Email, m.Title, m.Slug
            FROM MovieComments mc
            INNER JOIN Users u ON mc.UserID = u.UserID
            INNER JOIN Movies m ON mc.MovieID = m.MovieID
            WHERE mc.CommentID = ${parentCommentId}
          `;
                console.log("📝 Parent comment found:", parentComment.recordset[0] ? "Yes" : "No");
                if (parentComment.recordset[0] &&
                    parentComment.recordset[0].UserID !== Number(req.user.id)) {
                    const parentUser = parentComment.recordset[0];
                    console.log("📝 Parent user ID:", parentUser.UserID, "Current user ID:", req.user.id);
                    const currentUser = await (0, db_1.query) `
              SELECT Username FROM Users WHERE UserID = ${Number(req.user.id)}
            `;
                    const username = currentUser.recordset[0]?.Username || "Người dùng";
                    const movieTitle = parentUser.Title || "phim";
                    const movieSlug = parentUser.Slug || "";
                    console.log("📝 Movie slug from DB:", movieSlug, "Title:", movieTitle);
                    // Validate slug - nếu slug rỗng hoặc có ký tự @ (placeholder), lấy lại từ database bằng MovieID
                    let validSlug = movieSlug;
                    if (!validSlug || validSlug.includes("@")) {
                        console.log("⚠️ Invalid slug detected, fetching MovieID...");
                        const movieInfo = await (0, db_1.query) `
                SELECT MovieID, Slug FROM Movies WHERE MovieID = (
                  SELECT MovieID FROM MovieComments WHERE CommentID = ${parentCommentId}
                )
              `;
                        if (movieInfo.recordset[0]) {
                            validSlug = movieInfo.recordset[0].Slug || "";
                            console.log("📝 Fetched valid slug:", validSlug);
                        }
                    }
                    if (!validSlug || validSlug.includes("@")) {
                        console.error("❌ Cannot create notification: Invalid slug:", validSlug);
                        // Skip notification if slug is still invalid
                    }
                    else {
                        const notificationTitle = "Có phản hồi bình luận";
                        const notificationContent = `${username} đã trả lời bình luận của bạn trong "${movieTitle}"`;
                        const notificationURL = `/watch/${validSlug}#comments`;
                        console.log("📝 Creating notification for user:", parentUser.UserID, "from:", username, "movie:", movieTitle, "URL:", notificationURL);
                        await (0, db_1.query) `
                INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead)
                VALUES (
                  ${parentUser.UserID},
                  'CommentReplied',
                  ${notificationTitle},
                  ${notificationContent},
                  ${notificationURL},
                  0
                )
              `;
                        console.log("✅ Reply notification created successfully");
                    }
                }
                else {
                    console.log("⚠️ Skipping notification: Same user or no parent comment");
                }
            }
            catch (notifError) {
                console.error("❌ Failed to create reply notification:", notifError);
            }
        }
        else {
            console.log("📝 Not a reply comment (no parentCommentId)");
        }
        res.json({ message: "Comment added successfully" });
    }
    catch (e) {
        console.error("POST /movies/:id/comments error:", e);
        res.status(500).json({ error: "Failed to add comment" });
    }
});
// Cập nhật bình luận
router.put("/movies/:id/comments/:commentId", authenticate, async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const commentId = Number(req.params.commentId);
        const { content } = req.body;
        if (!movieId || !commentId || !content) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        // Check if user owns the comment
        const comment = await (0, db_1.query) `
      SELECT UserID FROM MovieComments 
      WHERE CommentID = ${commentId} AND MovieID = ${movieId}
    `;
        if (comment.recordset.length === 0) {
            return res.status(404).json({ error: "Comment not found" });
        }
        if (comment.recordset[0].UserID !== Number(req.user.id)) {
            return res
                .status(403)
                .json({ error: "Not authorized to edit this comment" });
        }
        await (0, db_1.query) `
      UPDATE MovieComments 
      SET Content = ${content}, UpdatedAt = GETDATE()
      WHERE CommentID = ${commentId}
    `;
        res.json({ message: "Comment updated successfully" });
    }
    catch (e) {
        console.error("PUT /movies/:id/comments/:commentId error:", e);
        res.status(500).json({ error: "Failed to update comment" });
    }
});
// Xóa bình luận
router.delete("/movies/:id/comments/:commentId", authenticate, async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const commentId = Number(req.params.commentId);
        if (!movieId || !commentId) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        // Check if user owns the comment
        const comment = await (0, db_1.query) `
      SELECT UserID FROM MovieComments 
      WHERE CommentID = ${commentId} AND MovieID = ${movieId}
    `;
        if (comment.recordset.length === 0) {
            return res.status(404).json({ error: "Comment not found" });
        }
        if (comment.recordset[0].UserID !== Number(req.user.id) &&
            req.user.role !== "Admin") {
            return res
                .status(403)
                .json({ error: "Not authorized to delete this comment" });
        }
        // Delete reactions for this comment and direct replies
        await (0, db_1.query) `DELETE FROM MovieCommentReactions WHERE CommentID IN (
        SELECT CommentID FROM MovieComments WHERE CommentID = ${commentId}
        UNION ALL
        SELECT CommentID FROM MovieComments WHERE ParentCommentID = ${commentId}
      )`;
        // Delete direct replies first, then the comment itself
        await (0, db_1.query) `DELETE FROM MovieComments WHERE ParentCommentID = ${commentId}`;
        await (0, db_1.query) `DELETE FROM MovieComments WHERE CommentID = ${commentId}`;
        res.json({ message: "Comment deleted successfully" });
    }
    catch (e) {
        console.error("DELETE /movies/:id/comments/:commentId error:", e);
        res.status(500).json({ error: "Failed to delete comment" });
    }
});
// Like/Dislike movie comment
router.post("/movies/:id/comments/:commentId/reaction", authenticate, async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const commentId = Number(req.params.commentId);
        const { reactionType } = req.body;
        if (!movieId || !commentId || !reactionType) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        if (!["Like", "Dislike"].includes(reactionType)) {
            return res.status(400).json({ error: "Invalid reaction type" });
        }
        // Check if comment exists
        const comment = await (0, db_1.query) `
      SELECT CommentID FROM MovieComments 
      WHERE CommentID = ${commentId} AND MovieID = ${movieId} AND IsDeleted = 0
    `;
        if (comment.recordset.length === 0) {
            return res.status(404).json({ error: "Comment not found" });
        }
        // Remove existing reaction if any
        await (0, db_1.query) `
      DELETE FROM MovieCommentReactions 
      WHERE CommentID = ${commentId} AND UserID = ${Number(req.user.id)}
    `;
        // Add new reaction
        await (0, db_1.query) `
      INSERT INTO MovieCommentReactions (CommentID, UserID, ReactionType, CreatedAt)
      VALUES (${commentId}, ${Number(req.user.id)}, ${reactionType}, GETDATE())
    `;
        res.json({ message: "Reaction updated successfully" });
    }
    catch (e) {
        console.error("POST /movies/:id/comments/:commentId/reaction error:", e);
        res.status(500).json({ error: "Failed to update reaction" });
    }
});
// ===== SERIES COMMENTS API =====
// Lấy danh sách bình luận của truyện
router.get("/stories/:id/comments", async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        if (!seriesId)
            return res.status(400).json({ error: "Invalid series ID" });
        const comments = await (0, db_1.query) `
      SELECT 
        sc.CommentID,
        sc.Content,
        sc.CreatedAt,
        sc.ParentCommentID,
        sc.IsDeleted,
        u.Username,
        u.Avatar,
        u.Email,
        r.RoleName,
        ISNULL(likeCount.LikeCount, 0) as LikeCount,
        ISNULL(dislikeCount.DislikeCount, 0) as DislikeCount,
        userReaction.ReactionType as UserReaction,
        CAST(
          CASE 
            WHEN ue.TotalExp IS NULL THEN 1
            ELSE FLOOR(ue.TotalExp / 100) + 1
          END AS INT
        ) as Level
      FROM SeriesComments sc
      INNER JOIN Users u ON sc.UserID = u.UserID
      INNER JOIN Roles r ON u.RoleID = r.RoleID
      LEFT JOIN UserExp ue ON u.UserID = ue.UserID
      LEFT JOIN (
        SELECT CommentID, COUNT(*) as LikeCount 
        FROM SeriesCommentReactions 
        WHERE ReactionType = 'Like' 
        GROUP BY CommentID
      ) likeCount ON sc.CommentID = likeCount.CommentID
      LEFT JOIN (
        SELECT CommentID, COUNT(*) as DislikeCount 
        FROM SeriesCommentReactions 
        WHERE ReactionType = 'Dislike' 
        GROUP BY CommentID
      ) dislikeCount ON sc.CommentID = dislikeCount.CommentID
      LEFT JOIN (
        SELECT CommentID, ReactionType 
        FROM SeriesCommentReactions 
        WHERE UserID = ${req.user?.id || 0}
      ) userReaction ON sc.CommentID = userReaction.CommentID
      WHERE sc.SeriesID = ${seriesId} AND sc.IsDeleted = 0
      ORDER BY sc.CreatedAt DESC
    `;
        res.json(comments.recordset);
    }
    catch (e) {
        console.error("GET /stories/:id/comments error:", e);
        res.status(500).json({ error: "Failed to fetch comments" });
    }
});
// Thêm bình luận mới cho truyện
router.post("/stories/:id/comments", authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        const { content, parentCommentId } = req.body;
        if (!seriesId || !content) {
            return res.status(400).json({ error: "Missing series ID or content" });
        }
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        await (0, db_1.query) `
      INSERT INTO SeriesComments (UserID, SeriesID, ParentCommentID, Content, CreatedAt)
      VALUES (${Number(req.user.id)}, ${seriesId}, ${parentCommentId || null}, ${content}, GETDATE())
    `;
        // Tạo thông báo nếu đây là reply
        if (parentCommentId) {
            try {
                console.log("📝 [Story] Creating reply notification for parentCommentId:", parentCommentId, "from user:", req.user.id);
                // Lấy thông tin người comment gốc
                const parentComment = await (0, db_1.query) `
            SELECT u.UserID, u.Email, s.Title, s.Slug
            FROM SeriesComments sc
            INNER JOIN Users u ON sc.UserID = u.UserID
            INNER JOIN Series s ON sc.SeriesID = s.SeriesID
            WHERE sc.CommentID = ${parentCommentId}
          `;
                console.log("📝 [Story] Parent comment found:", parentComment.recordset[0] ? "Yes" : "No");
                if (parentComment.recordset[0] &&
                    parentComment.recordset[0].UserID !== Number(req.user.id)) {
                    const parentUser = parentComment.recordset[0];
                    console.log("📝 [Story] Parent user ID:", parentUser.UserID, "Current user ID:", req.user.id);
                    const currentUser = await (0, db_1.query) `
              SELECT Username FROM Users WHERE UserID = ${Number(req.user.id)}
            `;
                    const username = currentUser.recordset[0]?.Username || "Người dùng";
                    const seriesTitle = parentUser.Title || "truyện";
                    const seriesSlug = parentUser.Slug || "";
                    console.log("📝 [Story] Series slug from DB:", seriesSlug, "Title:", seriesTitle);
                    // Validate slug - nếu slug rỗng hoặc có ký tự @ (placeholder), lấy lại từ database bằng SeriesID
                    let validSlug = seriesSlug;
                    if (!validSlug || validSlug.includes("@")) {
                        console.log("⚠️ [Story] Invalid slug detected, fetching SeriesID...");
                        const seriesInfo = await (0, db_1.query) `
                SELECT SeriesID, Slug FROM Series WHERE SeriesID = (
                  SELECT SeriesID FROM SeriesComments WHERE CommentID = ${parentCommentId}
                )
              `;
                        if (seriesInfo.recordset[0]) {
                            validSlug = seriesInfo.recordset[0].Slug || "";
                            console.log("📝 [Story] Fetched valid slug:", validSlug);
                        }
                    }
                    if (!validSlug || validSlug.includes("@")) {
                        console.error("❌ [Story] Cannot create notification: Invalid slug:", validSlug);
                        // Skip notification if slug is still invalid
                    }
                    else {
                        const notificationTitle = "Có phản hồi bình luận";
                        const notificationContent = `${username} đã trả lời bình luận của bạn trong "${seriesTitle}"`;
                        const notificationURL = `/stories/${validSlug}#comments`;
                        console.log("📝 [Story] Creating notification for user:", parentUser.UserID, "from:", username, "series:", seriesTitle, "URL:", notificationURL);
                        await (0, db_1.query) `
                INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead)
                VALUES (
                  ${parentUser.UserID},
                  'CommentReplied',
                  ${notificationTitle},
                  ${notificationContent},
                  ${notificationURL},
                  0
                )
              `;
                        console.log("✅ [Story] Reply notification created successfully");
                    }
                }
                else {
                    console.log("⚠️ [Story] Skipping notification: Same user or no parent comment");
                }
            }
            catch (notifError) {
                console.error("❌ [Story] Failed to create reply notification:", notifError);
            }
        }
        else {
            console.log("📝 [Story] Not a reply comment (no parentCommentId)");
        }
        res.json({ message: "Comment added successfully" });
    }
    catch (e) {
        console.error("POST /stories/:id/comments error:", e);
        res.status(500).json({ error: "Failed to add comment" });
    }
});
// Like/Dislike series comment
router.post("/stories/:id/comments/:commentId/reaction", authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        const commentId = Number(req.params.commentId);
        const { reactionType } = req.body;
        if (!seriesId || !commentId || !reactionType) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        if (!["Like", "Dislike"].includes(reactionType)) {
            return res.status(400).json({ error: "Invalid reaction type" });
        }
        // Check if comment exists
        const comment = await (0, db_1.query) `
      SELECT CommentID FROM SeriesComments 
      WHERE CommentID = ${commentId} AND SeriesID = ${seriesId} AND IsDeleted = 0
    `;
        if (comment.recordset.length === 0) {
            return res.status(404).json({ error: "Comment not found" });
        }
        // Remove existing reaction if any
        await (0, db_1.query) `
      DELETE FROM SeriesCommentReactions 
      WHERE CommentID = ${commentId} AND UserID = ${Number(req.user.id)}
    `;
        // Add new reaction
        await (0, db_1.query) `
      INSERT INTO SeriesCommentReactions (CommentID, UserID, ReactionType, CreatedAt)
      VALUES (${commentId}, ${Number(req.user.id)}, ${reactionType}, GETDATE())
    `;
        res.json({ message: "Reaction updated successfully" });
    }
    catch (e) {
        console.error("POST /stories/:id/comments/:commentId/reaction error:", e);
        res.status(500).json({ error: "Failed to update reaction" });
    }
});
// Cập nhật bình luận (Series)
router.put("/stories/:seriesId/comments/:commentId", authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const commentId = Number(req.params.commentId);
        const { content } = req.body;
        if (!seriesId || !commentId || !content)
            return res.status(400).json({ error: "Invalid params" });
        if (!req.user)
            return res.status(401).json({ error: "Authentication required" });
        const owner = await (0, db_1.query) `
      SELECT UserID FROM SeriesComments WHERE CommentID = ${commentId} AND SeriesID = ${seriesId}
    `;
        if (owner.recordset.length === 0)
            return res.status(404).json({ error: "Comment not found" });
        if (owner.recordset[0].UserID !== req.user.UserID) {
            return res.status(403).json({ error: "No permission" });
        }
        await (0, db_1.query) `
      UPDATE SeriesComments SET Content = ${content}, UpdatedAt = GETDATE() WHERE CommentID = ${commentId}
    `;
        res.json({ ok: true });
    }
    catch (e) {
        console.error("PUT /stories/:seriesId/comments/:commentId error:", e);
        res.status(500).json({ error: "Failed to update comment" });
    }
});
// Xóa bình luận (mềm) Series
router.delete("/stories/:seriesId/comments/:commentId", authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const commentId = Number(req.params.commentId);
        if (!seriesId || !commentId)
            return res.status(400).json({ error: "Invalid params" });
        if (!req.user)
            return res.status(401).json({ error: "Authentication required" });
        const owner = await (0, db_1.query) `
      SELECT UserID FROM SeriesComments WHERE CommentID = ${commentId} AND SeriesID = ${seriesId}
    `;
        if (owner.recordset.length === 0)
            return res.status(404).json({ error: "Comment not found" });
        if (req.user.RoleName !== "Admin" &&
            owner.recordset[0].UserID !== req.user.UserID) {
            return res.status(403).json({ error: "No permission" });
        }
        // Delete reactions for this comment and direct replies (series)
        await (0, db_1.query) `DELETE FROM SeriesCommentReactions WHERE CommentID IN (
        SELECT CommentID FROM SeriesComments WHERE CommentID = ${commentId}
        UNION ALL
        SELECT CommentID FROM SeriesComments WHERE ParentCommentID = ${commentId}
      )`;
        await (0, db_1.query) `DELETE FROM SeriesComments WHERE ParentCommentID = ${commentId}`;
        await (0, db_1.query) `DELETE FROM SeriesComments WHERE CommentID = ${commentId}`;
        res.json({ ok: true });
    }
    catch (e) {
        console.error("DELETE /stories/:seriesId/comments/:commentId error:", e);
        res.status(500).json({ error: "Failed to delete comment" });
    }
});
// ===== MOVIE RATINGS API =====
// Lấy đánh giá của phim
router.get("/movies/:id/ratings", async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        if (!movieId)
            return res.status(400).json({ error: "Invalid movie ID" });
        const ratings = await (0, db_1.query) `
      SELECT 
        mr.Rating,
        mr.CreatedAt,
        u.Username
      FROM MovieRatings mr
      INNER JOIN Users u ON mr.UserID = u.UserID
      WHERE mr.MovieID = ${movieId}
      ORDER BY mr.CreatedAt DESC
    `;
        // Tính rating trung bình
        const avgRating = await (0, db_1.query) `
      SELECT AVG(CAST(Rating AS FLOAT)) as AverageRating, COUNT(*) as TotalRatings
      FROM MovieRatings 
      WHERE MovieID = ${movieId}
    `;
        res.json({
            ratings: ratings.recordset,
            averageRating: avgRating.recordset[0]?.AverageRating || 0,
            totalRatings: avgRating.recordset[0]?.TotalRatings || 0,
        });
    }
    catch (e) {
        console.error("GET /movies/:id/ratings error:", e);
        res.status(500).json({ error: "Failed to fetch ratings" });
    }
});
// Thêm đánh giá mới
router.post("/movies/:id/ratings", authenticate, async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const { rating } = req.body;
        if (!movieId || !rating || rating < 1 || rating > 5) {
            return res
                .status(400)
                .json({ error: "Invalid movie ID or rating (1-5)" });
        }
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        // Kiểm tra xem user đã đánh giá chưa
        const existingRating = await (0, db_1.query) `
      SELECT RatingID FROM MovieRatings 
      WHERE UserID = ${Number(req.user.id)} AND MovieID = ${movieId}
    `;
        if (existingRating.recordset.length > 0) {
            // Cập nhật đánh giá cũ
            await (0, db_1.query) `
        UPDATE MovieRatings 
        SET Rating = ${rating}, CreatedAt = GETDATE()
        WHERE UserID = ${Number(req.user.id)} AND MovieID = ${movieId}
      `;
        }
        else {
            // Thêm đánh giá mới
            await (0, db_1.query) `
        INSERT INTO MovieRatings (UserID, MovieID, Rating, CreatedAt)
        VALUES (${Number(req.user.id)}, ${movieId}, ${rating}, GETDATE())
      `;
        }
        // Cập nhật rating trung bình trong bảng Movies
        const avgResult = await (0, db_1.query) `
      SELECT AVG(CAST(Rating AS FLOAT)) as AverageRating, COUNT(*) as TotalRatings
      FROM MovieRatings 
      WHERE MovieID = ${movieId}
    `;
        await (0, db_1.query) `
      UPDATE Movies 
      SET Rating = ${avgResult.recordset[0]?.AverageRating || 0}, 
          TotalRatings = ${avgResult.recordset[0]?.TotalRatings || 0}
      WHERE MovieID = ${movieId}
    `;
        res.json({ message: "Rating saved successfully" });
    }
    catch (e) {
        console.error("POST /movies/:id/ratings error:", e);
        res.status(500).json({ error: "Failed to save rating" });
    }
});
// ===== NOTIFICATIONS API =====
// Lấy thông báo của user
router.get("/notifications", authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        const notifications = await (0, db_1.query) `
      SELECT 
        NotificationID,
        Type,
        Title,
        Content,
        RelatedURL,
        IsRead,
        CreatedAt
      FROM Notifications 
      WHERE UserID = ${Number(req.user.UserID)}
      ORDER BY CreatedAt DESC
    `;
        res.json(notifications.recordset);
    }
    catch (e) {
        console.error("GET /notifications error:", e);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});
// Đánh dấu thông báo đã đọc
router.post("/notifications/:id/read", authenticate, async (req, res) => {
    try {
        const notificationId = Number(req.params.id);
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        await (0, db_1.query) `
      UPDATE Notifications 
      SET IsRead = 1 
      WHERE NotificationID = ${notificationId} AND UserID = ${Number(req.user.UserID)}
    `;
        res.json({ message: "Notification marked as read" });
    }
    catch (e) {
        console.error("POST /notifications/:id/read error:", e);
        res.status(500).json({ error: "Failed to mark notification as read" });
    }
});
// User xóa thông báo của mình
router.delete("/notifications/:id", authenticate, async (req, res) => {
    try {
        const notificationId = Number(req.params.id);
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        // Kiểm tra thông báo thuộc về user này
        const notification = await (0, db_1.query) `
        SELECT UserID FROM Notifications WHERE NotificationID = ${notificationId}
      `;
        if (notification.recordset.length === 0) {
            return res.status(404).json({ error: "Notification not found" });
        }
        if (notification.recordset[0].UserID !== Number(req.user.UserID)) {
            return res
                .status(403)
                .json({ error: "You can only delete your own notifications" });
        }
        // Xóa thông báo trong CSDL
        await (0, db_1.query) `
        DELETE FROM Notifications 
        WHERE NotificationID = ${notificationId} AND UserID = ${Number(req.user.UserID)}
      `;
        res.json({ message: "Notification deleted successfully" });
    }
    catch (e) {
        console.error("DELETE /notifications/:id error:", e);
        res.status(500).json({ error: "Failed to delete notification" });
    }
});
// User xóa tất cả thông báo của mình
router.delete("/notifications", authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        // Xóa tất cả thông báo của user trong CSDL
        const result = await (0, db_1.query) `
        DELETE FROM Notifications 
        WHERE UserID = ${Number(req.user.UserID)}
      `;
        res.json({
            message: "All notifications deleted successfully",
            deletedCount: result.rowsAffected[0] || 0,
        });
    }
    catch (e) {
        console.error("DELETE /notifications error:", e);
        res.status(500).json({ error: "Failed to delete notifications" });
    }
});
// Admin xóa tất cả thông báo (của tất cả users)
router.delete("/admin/notifications", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["delete:any_content"]), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        // Xóa tất cả thông báo trong CSDL
        const result = await (0, db_1.query) `
        DELETE FROM Notifications
      `;
        res.json({
            message: "All notifications deleted successfully by Admin",
            deletedCount: result.rowsAffected[0] || 0,
        });
        console.log(`✅ Admin ${req.user.email} đã xóa tất cả thông báo`);
    }
    catch (e) {
        console.error("DELETE /admin/notifications error:", e);
        res.status(500).json({ error: "Failed to delete all notifications" });
    }
});
// ===== SEARCH & FILTER API =====
// Tìm kiếm phim
router.get("/movies/search", async (req, res) => {
    try {
        const { q, category, year, rating, limit = 20 } = req.query;
        let whereClause = "WHERE 1=1";
        const params = [];
        let paramIndex = 0;
        if (q) {
            whereClause += ` AND Title LIKE '%${q}%'`;
        }
        if (category) {
            whereClause += ` AND MovieID IN (SELECT MovieID FROM MovieCategories WHERE CategoryID = ${category})`;
        }
        if (year) {
            whereClause += ` AND ReleaseYear = ${year}`;
        }
        if (rating) {
            whereClause += ` AND Rating >= ${rating}`;
        }
        const movies = await (0, db_1.query) `
      SELECT TOP ${Number(limit)} 
        MovieID, Title, Slug, PosterURL, Rating, ViewCount, ReleaseYear, Duration
      FROM Movies 
      ${whereClause}
      ORDER BY CreatedAt DESC
    `;
        res.json(movies.recordset);
    }
    catch (e) {
        console.error("GET /movies/search error:", e);
        res.status(500).json({ error: "Failed to search movies" });
    }
});
// ===== USER PREFERENCES API =====
// Lấy preferences của user
router.get("/user/preferences", authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        const preferences = await (0, db_1.query) `
      SELECT PreferenceKey, PreferenceValue
      FROM UserPreferences 
      WHERE UserID = ${Number(req.user.id)}
    `;
        const prefsMap = {};
        preferences.recordset.forEach((row) => {
            prefsMap[row.PreferenceKey] = row.PreferenceValue;
        });
        res.json(prefsMap);
    }
    catch (e) {
        console.error("GET /user/preferences error:", e);
        res.status(500).json({ error: "Failed to fetch preferences" });
    }
});
// Cập nhật preferences của user
router.post("/user/preferences", authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        const { key, value } = req.body;
        if (!key || value === undefined) {
            return res.status(400).json({ error: "Missing key or value" });
        }
        // Kiểm tra xem preference đã tồn tại chưa
        const existing = await (0, db_1.query) `
      SELECT PreferenceID FROM UserPreferences 
      WHERE UserID = ${Number(req.user.id)} AND PreferenceKey = ${key}
    `;
        if (existing.recordset.length > 0) {
            // Cập nhật
            await (0, db_1.query) `
        UPDATE UserPreferences 
        SET PreferenceValue = ${value}, UpdatedAt = GETDATE()
        WHERE UserID = ${Number(req.user.id)} AND PreferenceKey = ${key}
      `;
        }
        else {
            // Thêm mới
            await (0, db_1.query) `
        INSERT INTO UserPreferences (UserID, PreferenceKey, PreferenceValue, UpdatedAt)
        VALUES (${Number(req.user.id)}, ${key}, ${value}, GETDATE())
      `;
        }
        res.json({ message: "Preference saved successfully" });
    }
    catch (e) {
        console.error("POST /user/preferences error:", e);
        res.status(500).json({ error: "Failed to save preference" });
    }
});
// ===== ADMIN COMMENTS MANAGEMENT API =====
// Get all movie comments for admin
router.get("/admin/comments/movies", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const comments = await (0, db_1.query) `
        SELECT 
          mc.CommentID,
          mc.Content,
          mc.CreatedAt,
          mc.UpdatedAt,
          mc.ParentCommentID,
          mc.IsDeleted,
          u.Username,
          u.Email,
          u.Avatar,
          m.Title as MovieTitle,
          m.MovieID,
          ISNULL(likeCount.LikeCount, 0) as LikeCount,
          ISNULL(dislikeCount.DislikeCount, 0) as DislikeCount
        FROM MovieComments mc
        INNER JOIN Users u ON mc.UserID = u.UserID
        LEFT JOIN Movies m ON mc.MovieID = m.MovieID
        LEFT JOIN (
          SELECT CommentID, COUNT(*) as LikeCount 
          FROM MovieCommentReactions 
          WHERE ReactionType = 'Like' 
          GROUP BY CommentID
        ) likeCount ON mc.CommentID = likeCount.CommentID
        LEFT JOIN (
          SELECT CommentID, COUNT(*) as DislikeCount 
          FROM MovieCommentReactions 
          WHERE ReactionType = 'Dislike' 
          GROUP BY CommentID
        ) dislikeCount ON mc.CommentID = dislikeCount.CommentID
        ORDER BY mc.CreatedAt DESC
      `;
        res.json(comments.recordset);
    }
    catch (e) {
        console.error("GET /admin/comments/movies error:", e);
        res.status(500).json({ error: "Failed to fetch movie comments" });
    }
});
// Get all series comments for admin
router.get("/admin/comments/series", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const comments = await (0, db_1.query) `
        SELECT 
          sc.CommentID,
          sc.Content,
          sc.CreatedAt,
          sc.UpdatedAt,
          sc.ParentCommentID,
          sc.IsDeleted,
          u.Username,
          u.Email,
          u.Avatar,
          s.Title as SeriesTitle,
          s.SeriesID,
          ISNULL(likeCount.LikeCount, 0) as LikeCount,
          ISNULL(dislikeCount.DislikeCount, 0) as DislikeCount
        FROM SeriesComments sc
        INNER JOIN Users u ON sc.UserID = u.UserID
        LEFT JOIN Series s ON sc.SeriesID = s.SeriesID
        LEFT JOIN (
          SELECT CommentID, COUNT(*) as LikeCount 
          FROM SeriesCommentReactions 
          WHERE ReactionType = 'Like' 
          GROUP BY CommentID
        ) likeCount ON sc.CommentID = likeCount.CommentID
        LEFT JOIN (
          SELECT CommentID, COUNT(*) as DislikeCount 
          FROM SeriesCommentReactions 
          WHERE ReactionType = 'Dislike' 
          GROUP BY CommentID
        ) dislikeCount ON sc.CommentID = dislikeCount.CommentID
        ORDER BY sc.CreatedAt DESC
      `;
        res.json(comments.recordset);
    }
    catch (e) {
        console.error("GET /admin/comments/series error:", e);
        res.status(500).json({ error: "Failed to fetch series comments" });
    }
});
// Delete movie comment (soft delete)
router.delete("/admin/comments/movies/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const commentId = Number(req.params.id);
        if (!commentId)
            return res.status(400).json({ error: "Invalid comment ID" });
        await (0, db_1.query) `
        UPDATE MovieComments 
        SET IsDeleted = 1, UpdatedAt = GETDATE()
        WHERE CommentID = ${commentId}
      `;
        res.json({ message: "Comment deleted successfully" });
    }
    catch (e) {
        console.error("DELETE /admin/comments/movies/:id error:", e);
        res.status(500).json({ error: "Failed to delete comment" });
    }
});
// Delete series comment (soft delete)
router.delete("/admin/comments/series/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const commentId = Number(req.params.id);
        if (!commentId)
            return res.status(400).json({ error: "Invalid comment ID" });
        await (0, db_1.query) `
        UPDATE SeriesComments 
        SET IsDeleted = 1, UpdatedAt = GETDATE()
        WHERE CommentID = ${commentId}
      `;
        res.json({ message: "Comment deleted successfully" });
    }
    catch (e) {
        console.error("DELETE /admin/comments/series/:id error:", e);
        res.status(500).json({ error: "Failed to delete comment" });
    }
});
// Restore movie comment
router.put("/admin/comments/movies/:id/restore", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const commentId = Number(req.params.id);
        if (!commentId)
            return res.status(400).json({ error: "Invalid comment ID" });
        await (0, db_1.query) `
        UPDATE MovieComments 
        SET IsDeleted = 0, UpdatedAt = GETDATE()
        WHERE CommentID = ${commentId}
      `;
        res.json({ message: "Comment restored successfully" });
    }
    catch (e) {
        console.error("PUT /admin/comments/movies/:id/restore error:", e);
        res.status(500).json({ error: "Failed to restore comment" });
    }
});
// Restore series comment
router.put("/admin/comments/series/:id/restore", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const commentId = Number(req.params.id);
        if (!commentId)
            return res.status(400).json({ error: "Invalid comment ID" });
        await (0, db_1.query) `
        UPDATE SeriesComments 
        SET IsDeleted = 0, UpdatedAt = GETDATE()
        WHERE CommentID = ${commentId}
      `;
        res.json({ message: "Comment restored successfully" });
    }
    catch (e) {
        console.error("PUT /admin/comments/series/:id/restore error:", e);
        res.status(500).json({ error: "Failed to restore comment" });
    }
});
// Edit movie comment (Admin only)
router.put("/admin/comments/movies/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const commentId = Number(req.params.id);
        const { content } = req.body;
        if (!commentId || !content) {
            return res.status(400).json({ error: "Invalid comment ID or content" });
        }
        await (0, db_1.query) `
        UPDATE MovieComments 
        SET Content = ${content}, UpdatedAt = GETDATE()
        WHERE CommentID = ${commentId}
      `;
        res.json({ message: "Comment updated successfully" });
    }
    catch (e) {
        console.error("PUT /admin/comments/movies/:id error:", e);
        res.status(500).json({ error: "Failed to update comment" });
    }
});
// Edit series comment (Admin only)
router.put("/admin/comments/series/:id", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const commentId = Number(req.params.id);
        const { content } = req.body;
        if (!commentId || !content) {
            return res.status(400).json({ error: "Invalid comment ID or content" });
        }
        await (0, db_1.query) `
        UPDATE SeriesComments 
        SET Content = ${content}, UpdatedAt = GETDATE()
        WHERE CommentID = ${commentId}
      `;
        res.json({ message: "Comment updated successfully" });
    }
    catch (e) {
        console.error("PUT /admin/comments/series/:id error:", e);
        res.status(500).json({ error: "Failed to update comment" });
    }
});
// ===== SERIES RATING & FAVORITE API =====
// Get series ratings
router.get("/stories/:id/ratings", async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        if (!seriesId)
            return res.status(400).json({ error: "Invalid series ID" });
        const ratings = await (0, db_1.query) `
      SELECT 
        AVG(CAST(Rating AS FLOAT)) as averageRating,
        COUNT(*) as totalRatings
      FROM SeriesRatings 
      WHERE SeriesID = ${seriesId}
    `;
        const result = ratings.recordset[0];
        res.json({
            averageRating: result.averageRating || 0,
            totalRatings: result.totalRatings || 0,
        });
    }
    catch (e) {
        console.error("GET /stories/:id/ratings error:", e);
        res.status(500).json({ error: "Failed to fetch ratings" });
    }
});
// Submit series rating
router.post("/stories/:id/rating", authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        const { rating } = req.body;
        console.log("=== RATING API CALLED ===");
        console.log("SeriesID:", seriesId);
        console.log("Rating:", rating);
        console.log("User:", req.user);
        if (!seriesId || !rating || rating < 1 || rating > 5) {
            console.log("Validation failed");
            return res.status(400).json({ error: "Invalid series ID or rating" });
        }
        if (!req.user) {
            console.log("No user found");
            return res.status(401).json({ error: "Authentication required" });
        }
        const userId = req.user.UserID;
        console.log("UserID:", userId);
        // Check if user already rated
        const existingRating = await (0, db_1.query) `
      SELECT RatingID FROM SeriesRatings 
      WHERE SeriesID = ${seriesId} AND UserID = ${userId}
    `;
        console.log("Existing ratings:", existingRating.recordset.length);
        if (existingRating.recordset.length > 0) {
            // Update existing rating
            console.log("Updating existing rating");
            await (0, db_1.query) `
        UPDATE SeriesRatings 
        SET Rating = ${rating}, CreatedAt = GETDATE()
        WHERE SeriesID = ${seriesId} AND UserID = ${userId}
      `;
        }
        else {
            // Insert new rating
            console.log("Inserting new rating");
            await (0, db_1.query) `
        INSERT INTO SeriesRatings (UserID, SeriesID, Rating, CreatedAt)
        VALUES (${userId}, ${seriesId}, ${rating}, GETDATE())
      `;
        }
        console.log("Rating operation completed successfully");
        res.json({ message: "Rating submitted successfully" });
    }
    catch (e) {
        console.error("POST /stories/:id/rating error:", e);
        res.status(500).json({ error: "Failed to submit rating" });
    }
});
// Add series to favorites
router.post("/stories/:id/favorite", authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        if (!seriesId) {
            return res.status(400).json({ error: "Invalid series ID" });
        }
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        // Check if already in favorites
        const existing = await (0, db_1.query) `
      SELECT FavoriteID FROM SeriesFavorites 
      WHERE SeriesID = ${seriesId} AND UserID = ${Number(req.user.UserID)}
    `;
        if (existing.recordset.length === 0) {
            await (0, db_1.query) `
        INSERT INTO SeriesFavorites (UserID, SeriesID, CreatedAt)
        VALUES (${Number(req.user.UserID)}, ${seriesId}, GETDATE())
      `;
        }
        res.json({ message: "Added to favorites" });
    }
    catch (e) {
        console.error("POST /stories/:id/favorite error:", e);
        res.status(500).json({ error: "Failed to add to favorites" });
    }
});
// Remove series from favorites
router.delete("/stories/:id/favorite", authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        if (!seriesId) {
            return res.status(400).json({ error: "Invalid series ID" });
        }
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        await (0, db_1.query) `
      DELETE FROM SeriesFavorites 
      WHERE SeriesID = ${seriesId} AND UserID = ${Number(req.user.UserID)}
    `;
        res.json({ message: "Removed from favorites" });
    }
    catch (e) {
        console.error("DELETE /stories/:id/favorite error:", e);
        res.status(500).json({ error: "Failed to remove from favorites" });
    }
});
// Get user's rating for a series
router.get("/stories/:id/user-rating", authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        if (!seriesId) {
            return res.status(400).json({ error: "Invalid series ID" });
        }
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        const rating = await (0, db_1.query) `
      SELECT Rating FROM SeriesRatings 
      WHERE SeriesID = ${seriesId} AND UserID = ${Number(req.user.UserID)}
    `;
        res.json({ rating: rating.recordset[0]?.Rating || 0 });
    }
    catch (e) {
        console.error("GET /stories/:id/user-rating error:", e);
        res.status(500).json({ error: "Failed to fetch user rating" });
    }
});
// Check if series is in user's favorites
router.get("/stories/:id/favorite-status", authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        if (!seriesId) {
            return res.status(400).json({ error: "Invalid series ID" });
        }
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        const favorite = await (0, db_1.query) `
      SELECT FavoriteID FROM SeriesFavorites 
      WHERE SeriesID = ${seriesId} AND UserID = ${Number(req.user.UserID)}
    `;
        res.json({ isFavorite: favorite.recordset.length > 0 });
    }
    catch (e) {
        console.error("GET /stories/:id/favorite-status error:", e);
        res.status(500).json({ error: "Failed to check favorite status" });
    }
});
// Test API để kiểm tra series favorites
router.get("/test-series-favorites", authenticate, async (req, res) => {
    try {
        const userId = req.user.UserID;
        console.log("Testing series favorites for UserID:", userId);
        // Check if user has any series favorites
        const favorites = await (0, db_1.query) `
      SELECT sf.FavoriteID, sf.SeriesID, sf.CreatedAt, s.Title
      FROM SeriesFavorites sf
      LEFT JOIN Series s ON sf.SeriesID = s.SeriesID
      WHERE sf.UserID = ${userId}
      ORDER BY sf.CreatedAt DESC
    `;
        console.log("Series favorites found:", favorites.recordset);
        res.json(favorites.recordset);
    }
    catch (e) {
        console.error("Test series favorites error:", e);
        res
            .status(500)
            .json({ error: "Failed to test series favorites", details: e.message });
    }
});
// Get user's favorite series
router.get("/user/series-favorites", authenticate, async (req, res) => {
    try {
        const userId = req.user.UserID;
        const favorites = await (0, db_1.query) `
      SELECT s.SeriesID, s.Title, s.Slug, s.CoverURL, s.Rating, s.ViewCount, s.CreatedAt
      FROM SeriesFavorites sf
      INNER JOIN Series s ON sf.SeriesID = s.SeriesID
      WHERE sf.UserID = ${userId}
      ORDER BY sf.CreatedAt DESC
    `;
        res.json(favorites.recordset);
    }
    catch (e) {
        console.error("GET /user/series-favorites error:", e);
        res.status(500).json({ error: "Failed to fetch favorite series" });
    }
});
// ===== STATISTICS API =====
// Thống kê tổng quan
router.get("/admin/statistics", authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        const [totalUsers, totalMovies, totalSeries, totalComments, totalRatings,] = await Promise.all([
            (0, db_1.query) `SELECT COUNT(*) as count FROM Users`,
            (0, db_1.query) `SELECT COUNT(*) as count FROM Movies`,
            (0, db_1.query) `SELECT COUNT(*) as count FROM Series`,
            (0, db_1.query) `SELECT COUNT(*) as count FROM MovieComments WHERE IsDeleted = 0`,
            (0, db_1.query) `SELECT COUNT(*) as count FROM MovieRatings`,
        ]);
        const topMovies = await (0, db_1.query) `
      SELECT TOP 10 MovieID, Title, ViewCount, Rating
      FROM Movies 
      ORDER BY ViewCount DESC
    `;
        const recentActivity = await (0, db_1.query) `
      SELECT TOP 20 
        'Movie' as Type, MovieID as ID, Title as Name, CreatedAt
      FROM Movies
      UNION ALL
      SELECT TOP 20 
        'Series' as Type, SeriesID as ID, Title as Name, CreatedAt
      FROM Series
      ORDER BY CreatedAt DESC
    `;
        res.json({
            totals: {
                users: totalUsers.recordset[0].count,
                movies: totalMovies.recordset[0].count,
                series: totalSeries.recordset[0].count,
                comments: totalComments.recordset[0].count,
                ratings: totalRatings.recordset[0].count,
            },
            topMovies: topMovies.recordset,
            recentActivity: recentActivity.recordset,
        });
    }
    catch (e) {
        console.error("GET /admin/statistics error:", e);
        res.status(500).json({ error: "Failed to fetch statistics" });
    }
});
// =============================================
// FORGOT PASSWORD & OTP ENDPOINTS
// =============================================
// Generate OTP code
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
// Send email function using Nodemailer with Gmail
async function sendEmail(to, subject, content) {
    try {
        // Lấy thông tin email từ environment variables
        const emailUser = process.env.EMAIL_USER || "YOUR_EMAIL@gmail.com";
        const emailPassword = process.env.EMAIL_PASSWORD || "YOUR_APP_PASSWORD";
        // Nếu chưa cấu hình email, chỉ log ra console (fallback)
        if (!emailUser || emailUser === "YOUR_EMAIL@gmail.com" || !emailPassword || emailPassword === "YOUR_APP_PASSWORD") {
            console.log(`📧 [DEV MODE] Email would be sent to: ${to}`);
            console.log(`📧 [DEV MODE] Subject: ${subject}`);
            console.log(`📧 [DEV MODE] Content: ${content}`);
            console.log(`⚠️  Vui lòng cấu hình EMAIL_USER và EMAIL_PASSWORD trong file .env để gửi email thật`);
            return true; // Trả về true để không block flow trong development
        }
        // Tạo transporter với Gmail - cấu hình chi tiết hơn
        const transporter = nodemailer_1.default.createTransport({
            service: "gmail",
            host: "smtp.gmail.com",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: emailUser,
                pass: emailPassword, // Mật khẩu ứng dụng Gmail (App Password) - KHÔNG phải mật khẩu thông thường
            },
            tls: {
                rejectUnauthorized: false, // Cho phép self-signed certificates
            },
        });
        // Verify connection configuration
        await transporter.verify();
        // Gửi email
        await transporter.sendMail({
            from: `"Fimory" <${emailUser}>`, // Tên hiển thị + email
            to: to,
            subject: subject,
            html: content, // Sử dụng HTML content
        });
        console.log(`✅ Email sent successfully to: ${to}`);
        return true;
    }
    catch (error) {
        console.error("❌ Email sending error:", error.message);
        // Xử lý các lỗi cụ thể và đưa ra hướng dẫn
        if (error.code === "EAUTH") {
            console.error("");
            console.error("═══════════════════════════════════════════════════════");
            console.error("❌ LỖI XÁC THỰC GMAIL!");
            console.error("═══════════════════════════════════════════════════════");
            console.error("Nguyên nhân: Email hoặc mật khẩu không đúng");
            console.error("");
            console.error("🔧 CÁCH SỬA:");
            console.error("1. Bạn PHẢI sử dụng App Password (Mật khẩu ứng dụng), KHÔNG phải mật khẩu Gmail thông thường");
            console.error("2. Cách tạo App Password:");
            console.error("   - Vào: https://myaccount.google.com/");
            console.error("   - Chọn: Bảo mật (Security)");
            console.error("   - Bật: Xác minh 2 bước (2-Step Verification) nếu chưa bật");
            console.error("   - Tìm: Mật khẩu ứng dụng (App passwords)");
            console.error("   - Tạo mật khẩu ứng dụng mới cho 'Mail'");
            console.error("   - Copy mật khẩu 16 ký tự (không có khoảng trắng)");
            console.error("   - Dán vào file BE/.env: EMAIL_PASSWORD=xxxx xxxx xxxx xxxx");
            console.error("   - Lưu ý: Xóa khoảng trắng trong App Password");
            console.error("");
            console.error("3. Kiểm tra file BE/.env:");
            console.error(`   EMAIL_USER=${process.env.EMAIL_USER || "CHƯA CẤU HÌNH"}`);
            console.error(`   EMAIL_PASSWORD=... (16 ký tự, không có khoảng trắng)`);
            console.error("═══════════════════════════════════════════════════════");
        }
        else if (error.code === "ECONNECTION" || error.code === "ETIMEDOUT") {
            console.error("❌ Lỗi kết nối đến Gmail. Kiểm tra kết nối internet.");
        }
        else {
            console.error("❌ Lỗi không xác định:", error);
        }
        return false;
    }
}
// Forgot password - Send OTP
router.post("/auth/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Vui lòng nhập email" });
        }
        // Check if user exists
        const userResult = await (0, db_1.query) `
        SELECT UserID, Email, Username FROM Users WHERE Email = ${email} AND IsActive = 1
      `;
        if (userResult.recordset.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy tài khoản với email này. Vui lòng kiểm tra lại email đã đăng ký." });
        }
        const user = userResult.recordset[0];
        // Generate OTP
        const otpCode = generateOTP();
        // Tính toán thời gian hết hạn: hiện tại + 10 phút (600,000 ms)
        // Sử dụng SQL Server GETDATE() để đảm bảo timezone nhất quán
        const now = new Date();
        const expiryTime = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now
        // Debug logging
        console.log(`📝 Creating OTP for user ${email} (UserID: ${user.UserID})`);
        console.log(`📝 OTP Code: ${otpCode}`);
        console.log(`📝 Current time (JS): ${now.toISOString()}`);
        console.log(`📝 Expiry time (JS): ${expiryTime.toISOString()}`);
        console.log(`📝 Expiry in: ${Math.round((expiryTime.getTime() - now.getTime()) / 1000 / 60)} minutes`);
        // Invalidate previous OTPs for this user
        await (0, db_1.query) `
        UPDATE EmailOTP SET IsUsed = 1 WHERE UserID = ${user.UserID} AND IsUsed = 0
      `;
        // Insert new OTP - Đảm bảo lưu vào DB TRƯỚC khi gửi email
        // Sử dụng DATEADD để tính toán trực tiếp trong SQL Server (tránh timezone issues)
        await (0, db_1.query) `
        INSERT INTO EmailOTP (UserID, OTPCode, ExpiryTime, IsUsed)
        VALUES (${user.UserID}, ${otpCode}, DATEADD(MINUTE, 10, GETDATE()), 0)
      `;
        // Verify OTP was saved - Kiểm tra OTP vừa lưu với GETDATE() để so sánh chính xác
        const verifyInsert = await (0, db_1.query) `
        SELECT OTPID, OTPCode, ExpiryTime, IsUsed, CreatedAt,
               DATEDIFF(SECOND, GETDATE(), ExpiryTime) as SecondsRemaining
        FROM EmailOTP 
        WHERE UserID = ${user.UserID} 
          AND OTPCode = ${otpCode}
          AND IsUsed = 0
          AND ExpiryTime > GETDATE()
        ORDER BY CreatedAt DESC
      `;
        if (verifyInsert.recordset.length === 0) {
            console.error(`❌ CRITICAL: OTP was not saved to database or already expired!`);
            // Thử lấy OTP không kiểm tra expiry để debug
            const debugOtp = await (0, db_1.query) `
          SELECT TOP 1 OTPID, OTPCode, ExpiryTime, IsUsed, CreatedAt,
                 DATEDIFF(SECOND, GETDATE(), ExpiryTime) as SecondsRemaining
          FROM EmailOTP 
          WHERE UserID = ${user.UserID} 
            AND OTPCode = ${otpCode}
            AND IsUsed = 0
          ORDER BY CreatedAt DESC
        `;
            if (debugOtp.recordset.length > 0) {
                const debug = debugOtp.recordset[0];
                console.error(`❌ OTP found but expired! ExpiryTime: ${debug.ExpiryTime}, SecondsRemaining: ${debug.SecondsRemaining}`);
            }
            return res.status(500).json({ error: "Lỗi khi lưu mã OTP. Vui lòng thử lại." });
        }
        const savedOtp = verifyInsert.recordset[0];
        console.log(`✅ OTP saved to database: OTPID=${savedOtp.OTPID}`);
        console.log(`✅ ExpiryTime: ${savedOtp.ExpiryTime}, SecondsRemaining: ${savedOtp.SecondsRemaining}`);
        // Send email với template tiếng Việt
        const emailSubject = "Fimory - Mã xác nhận đặt lại mật khẩu";
        const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 28px;">Fimory</h1>
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h2 style="color: #ffffff; margin: 0 0 15px 0; font-size: 24px;">Yêu cầu đặt lại mật khẩu</h2>
          <p style="color: #ffffff; margin: 0; font-size: 16px;">Xin chào ${user.Username},</p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
          <p style="color: #374151; font-size: 16px; margin: 0 0 15px 0;">
            Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản Fimory của mình.
          </p>
          <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
            Mã xác nhận của bạn là:
          </p>
          <div style="background-color: #ffffff; padding: 25px; text-align: center; border-radius: 8px; border: 2px dashed #2563eb; margin: 20px 0;">
            <h1 style="color: #2563eb; font-size: 36px; letter-spacing: 8px; margin: 0; font-weight: bold;">${otpCode}</h1>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin: 15px 0 0 0; text-align: center;">
            ⏰ Mã này sẽ hết hạn sau <strong>10 phút</strong>
          </p>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
          <p style="color: #92400e; font-size: 14px; margin: 0;">
            <strong>⚠️ Lưu ý bảo mật:</strong> Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. 
            Mã xác nhận này chỉ có hiệu lực trong 10 phút và chỉ có thể sử dụng một lần.
          </p>
        </div>
        
        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
            Trân trọng,<br>
            <strong>Đội ngũ Fimory</strong>
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            Email này được gửi tự động, vui lòng không trả lời email này.
          </p>
        </div>
      </div>
    `;
        const emailSent = await sendEmail(email, emailSubject, emailContent);
        if (!emailSent) {
            return res.status(500).json({ error: "Không thể gửi email. Vui lòng thử lại sau." });
        }
        console.log(`✅ OTP sent to ${email}: ${otpCode}`);
        res.json({
            message: "Đã gửi mã OTP thành công! Vui lòng kiểm tra email.",
            success: true
        });
    }
    catch (e) {
        console.error("POST /auth/forgot-password error:", e);
        return res.status(500).json({ error: "Lỗi khi gửi mã OTP. Vui lòng thử lại sau." });
    }
});
// Reset password - Verify OTP and update password
router.post("/auth/reset-password", async (req, res) => {
    try {
        const { email, otp, password } = req.body;
        if (!email || !otp || !password) {
            return res
                .status(400)
                .json({ error: "Vui lòng điền đầy đủ email, mã OTP và mật khẩu mới" });
        }
        if (password.length < 6) {
            return res
                .status(400)
                .json({ error: "Mật khẩu phải có ít nhất 6 ký tự" });
        }
        // Check if user exists
        const userResult = await (0, db_1.query) `
        SELECT UserID, Email FROM Users WHERE Email = ${email} AND IsActive = 1
      `;
        if (userResult.recordset.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy tài khoản với email này" });
        }
        const user = userResult.recordset[0];
        // Normalize OTP: trim whitespace and convert to string
        const normalizedOtp = String(otp).trim();
        // Debug logging
        console.log(`🔍 Verifying OTP for user ${email} (UserID: ${user.UserID})`);
        console.log(`🔍 OTP received: "${normalizedOtp}" (length: ${normalizedOtp.length})`);
        // Verify OTP - Lấy tất cả OTP chưa dùng và còn hạn của user này
        // Sử dụng GETDATE() của SQL Server để so sánh chính xác (tránh timezone issues)
        const currentTime = new Date();
        console.log(`🔍 Current server time (JS): ${currentTime.toISOString()}`);
        // Query với DATEDIFF để debug thời gian còn lại
        const otpResult = await (0, db_1.query) `
        SELECT OTPID, OTPCode, ExpiryTime, IsUsed, CreatedAt,
               DATEDIFF(SECOND, GETDATE(), ExpiryTime) as SecondsRemaining,
               DATEDIFF(MINUTE, GETDATE(), ExpiryTime) as MinutesRemaining
        FROM EmailOTP 
        WHERE UserID = ${user.UserID} 
          AND IsUsed = 0 
          AND ExpiryTime > GETDATE()
        ORDER BY CreatedAt DESC
      `;
        console.log(`🔍 Found ${otpResult.recordset.length} valid OTP(s) for this user`);
        // Log tất cả OTP hợp lệ để debug
        if (otpResult.recordset.length > 0) {
            otpResult.recordset.forEach((record, index) => {
                const expiryDate = new Date(record.ExpiryTime);
                console.log(`🔍 OTP ${index + 1}: "${record.OTPCode}" (type: ${typeof record.OTPCode}, length: ${String(record.OTPCode).length})`);
                console.log(`🔍   ExpiryTime (DB): ${record.ExpiryTime}`);
                console.log(`🔍   ExpiryTime (JS): ${expiryDate.toISOString()}`);
                console.log(`🔍   SecondsRemaining (SQL): ${record.SecondsRemaining}`);
                console.log(`🔍   MinutesRemaining (SQL): ${record.MinutesRemaining}`);
                console.log(`🔍   IsUsed: ${record.IsUsed}, CreatedAt: ${record.CreatedAt}`);
            });
        }
        else {
            // Nếu không tìm thấy OTP hợp lệ, thử query tất cả OTP (kể cả hết hạn) để debug
            console.log(`⚠️  No valid OTP found. Checking all OTPs for this user...`);
            const allOtps = await (0, db_1.query) `
          SELECT OTPID, OTPCode, ExpiryTime, IsUsed, CreatedAt,
                 DATEDIFF(SECOND, GETDATE(), ExpiryTime) as SecondsRemaining
          FROM EmailOTP 
          WHERE UserID = ${user.UserID}
          ORDER BY CreatedAt DESC
        `;
            console.log(`🔍 Found ${allOtps.recordset.length} total OTP(s) for this user:`);
            allOtps.recordset.forEach((record, index) => {
                const expiryDate = new Date(record.ExpiryTime);
                const isExpired = record.SecondsRemaining <= 0;
                const isUsed = record.IsUsed === 1 || record.IsUsed === true;
                console.log(`🔍   OTP ${index + 1}: "${record.OTPCode}"`);
                console.log(`🔍     IsUsed: ${isUsed}, Expired: ${isExpired}`);
                console.log(`🔍     SecondsRemaining: ${record.SecondsRemaining}`);
                console.log(`🔍     ExpiryTime: ${expiryDate.toISOString()}`);
            });
        }
        // Tìm OTP khớp (so sánh string, không phân biệt hoa thường)
        const matchedOtp = otpResult.recordset.find((record) => {
            const dbOtp = String(record.OTPCode).trim();
            const isMatch = dbOtp === normalizedOtp;
            console.log(`🔍 Comparing: "${dbOtp}" === "${normalizedOtp}" => ${isMatch}`);
            return isMatch;
        });
        if (!matchedOtp) {
            console.log(`❌ OTP mismatch or expired for user ${email}`);
            return res.status(400).json({
                error: "Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng thử lại."
            });
        }
        const otpRecord = matchedOtp;
        // Hash new password
        const saltRounds = 10;
        const hashedPassword = await bcryptjs_1.default.hash(password, saltRounds);
        // Update password
        await (0, db_1.query) `
        UPDATE Users 
        SET PasswordHash = ${hashedPassword}, UpdatedAt = GETDATE()
        WHERE UserID = ${user.UserID}
      `;
        // Mark OTP as used
        await (0, db_1.query) `
        UPDATE EmailOTP 
        SET IsUsed = 1 
        WHERE OTPID = ${otpRecord.OTPID}
      `;
        console.log(`✅ Password reset successful for user ${email}`);
        res.json({
            message: "Đặt lại mật khẩu thành công!",
            success: true
        });
    }
    catch (e) {
        console.error("POST /auth/reset-password error:", e);
        return res.status(500).json({ error: "Lỗi khi đặt lại mật khẩu. Vui lòng thử lại sau." });
    }
});
// =============================================
// SIMPLE OTP API (Không cần user phải tồn tại)
// =============================================
// Memory store để lưu OTP (Map: email -> { otp, expiry })
const otpStore = new Map();
// Cleanup expired OTPs mỗi 5 phút
setInterval(() => {
    const now = new Date();
    for (const [email, data] of otpStore.entries()) {
        if (data.expiry < now) {
            otpStore.delete(email);
        }
    }
}, 5 * 60 * 1000); // 5 phút
// API gửi OTP đơn giản (không cần user phải tồn tại)
router.post("/send-otp", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "Thiếu email!" });
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: "Email không hợp lệ!" });
        }
        // Generate OTP 6 số
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 phút
        // Lưu OTP vào memory store (ghi đè OTP cũ nếu có)
        otpStore.set(email, { otp, expiry: expiryTime });
        // Gửi email OTP
        const emailSubject = "Mã OTP xác nhận";
        const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Mã OTP xác nhận</h2>
        <p>Xin chào,</p>
        <p>Mã OTP của bạn là:</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
          <h1 style="color: #2563eb; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Mã này sẽ hết hạn sau 10 phút.</p>
        <p style="color: #6b7280; font-size: 14px;">Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">
          Trân trọng,<br>
          Hệ thống Fimory
        </p>
      </div>
    `;
        const emailSent = await sendEmail(email, emailSubject, emailContent);
        if (!emailSent) {
            return res.status(500).json({ success: false, message: "Không gửi được OTP!" });
        }
        console.log(`✅ OTP sent to ${email}: ${otp}`);
        // Trả về OTP trong response (như code mẫu - để test dễ dàng)
        // Trong production, nên bỏ otp khỏi response để bảo mật hơn
        return res.json({
            success: true,
            otp: otp, // ⚠️ Trong production nên bỏ dòng này
            message: "Gửi OTP thành công!",
        });
    }
    catch (error) {
        console.error("POST /send-otp error:", error);
        return res.status(500).json({ success: false, message: "Không gửi được OTP!" });
    }
});
// API xác minh OTP
router.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email và OTP là bắt buộc!",
            });
        }
        // Lấy OTP từ memory store
        const otpData = otpStore.get(email);
        if (!otpData) {
            return res.status(400).json({
                success: false,
                message: "OTP không tồn tại hoặc đã hết hạn!",
            });
        }
        // Kiểm tra OTP đã hết hạn chưa
        if (otpData.expiry < new Date()) {
            otpStore.delete(email);
            return res.status(400).json({
                success: false,
                message: "OTP đã hết hạn!",
            });
        }
        // Kiểm tra OTP có đúng không
        if (otpData.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: "OTP không đúng!",
            });
        }
        // Xóa OTP sau khi verify thành công (chỉ dùng 1 lần)
        otpStore.delete(email);
        console.log(`✅ OTP verified successfully for ${email}`);
        return res.json({
            success: true,
            message: "Xác minh OTP thành công!",
        });
    }
    catch (error) {
        console.error("POST /verify-otp error:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi xác minh OTP!",
        });
    }
});
// Chatbot API endpoint - Gọi Google Gemini AI
router.post("/chatbot", async (req, res) => {
    try {
        const { contents } = req.body;
        if (!contents || !Array.isArray(contents)) {
            return res.status(400).json({ error: "Invalid request format" });
        }
        // Lấy API key từ environment variable
        let apiKey = process.env.GEMINI_API_KEY;
        // Debug logging
        console.log("🔍 Checking GEMINI_API_KEY...");
        console.log("API key exists:", !!apiKey);
        console.log("API key length:", apiKey?.length || 0);
        console.log("API key preview:", apiKey ? apiKey.substring(0, 10) + "..." : "undefined");
        // Nếu không có, thử load lại từ file với encoding detection
        if (!apiKey ||
            apiKey === "your_gemini_api_key_here" ||
            apiKey.trim() === "") {
            console.warn("⚠️ GEMINI_API_KEY not in process.env, attempting emergency load...");
            try {
                const envPath = path_1.default.resolve(__dirname, "..", ".env");
                if (fs_1.default.existsSync(envPath)) {
                    const buffer = fs_1.default.readFileSync(envPath);
                    let envContent;
                    // Detect encoding
                    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
                        envContent = buffer.toString("utf16le");
                        if (envContent.charCodeAt(0) === 0xfeff) {
                            envContent = envContent.substring(1);
                        }
                    }
                    else {
                        envContent = buffer.toString("utf8");
                        if (envContent.includes("\x00")) {
                            envContent = buffer.toString("utf16le");
                        }
                    }
                    // Remove null bytes
                    envContent = envContent.replace(/\x00/g, "");
                    const lines = envContent.split(/\r?\n/);
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith("GEMINI_API_KEY=")) {
                            const keyValue = trimmed
                                .substring("GEMINI_API_KEY=".length)
                                .trim()
                                .replace(/\x00/g, "");
                            if (keyValue && keyValue !== "your_gemini_api_key_here") {
                                apiKey = keyValue;
                                process.env.GEMINI_API_KEY = keyValue;
                                console.log("✅ Emergency load successful:", keyValue.substring(0, 10) +
                                    "..." +
                                    keyValue.substring(keyValue.length - 4));
                                break;
                            }
                        }
                    }
                }
            }
            catch (err) {
                console.error("❌ Emergency load failed:", err);
            }
        }
        if (!apiKey ||
            apiKey === "your_gemini_api_key_here" ||
            apiKey.trim() === "") {
            console.error("❌ GEMINI_API_KEY not found or not configured");
            console.error("Current GEMINI_API_KEY value:", apiKey ? `exists but invalid (length: ${apiKey.length})` : "undefined");
            console.error("All environment variables:", Object.keys(process.env).filter((k) => k.includes("GEMINI") || k.includes("API")));
            return res.status(500).json({
                error: {
                    message: `Chatbot service chưa được cấu hình. 

Vui lòng làm theo các bước sau:
1. Mở file BE/.env trong editor (Ctrl+P, gõ: BE/.env)
2. Kiểm tra có dòng: GEMINI_API_KEY=AIzaSy...
3. Nếu chưa có, thêm dòng: GEMINI_API_KEY=your_api_key_here
4. Thay your_api_key_here bằng API key từ Google AI Studio
5. Lưu file (Ctrl+S) và KHỞI ĐỘNG LẠI server (Ctrl+C rồi npm run dev)

Lấy API key tại: https://makersuite.google.com/app/apikey

⚠️ Lưu ý: Bạn PHẢI khởi động lại server sau khi thêm API key!`,
                },
            });
        }
        console.log("✅ GEMINI_API_KEY found, proceeding with API call...");
        // System instruction cho chatbot
        const systemInstruction = `Bạn là trợ lý AI của website Fimory - một nền tảng xem phim và đọc truyện trực tuyến. 

Thông tin về Fimory:
- Fimory là website xem phim và đọc truyện online
- Người dùng có thể xem phim, đọc truyện, thêm vào danh sách yêu thích
- Có các thể loại phim và truyện đa dạng
- Hỗ trợ tìm kiếm, lọc theo danh mục
- Người dùng có thể đăng ký, đăng nhập, quản lý profile
- Có hệ thống phân quyền: Admin, Uploader, Author, Translator, Reup
- Người dùng có thể upload nội dung phim/truyện (với quyền phù hợp)
- Có tính năng bình luận, đánh giá
- Hỗ trợ dark mode và light mode

Hãy trả lời các câu hỏi về website Fimory một cách thân thiện, hữu ích và chính xác. Nếu người dùng hỏi về thông tin không liên quan đến Fimory, hãy nhẹ nhàng hướng họ về các tính năng của website.`;
        // Format history for Gemini API
        const formattedContents = contents.map((item) => ({
            role: item.role === "user" ? "user" : "model",
            parts: [{ text: item.parts?.[0]?.text || item.text || "" }],
        }));
        // Lấy danh sách model khả dụng từ API
        console.log("🔍 Fetching available models from Gemini API...");
        let availableModels = [];
        // Thử lấy models từ v1beta và v1
        for (const version of ["v1beta", "v1"]) {
            try {
                const modelsUrl = `https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`;
                const modelsResponse = await fetch(modelsUrl);
                if (modelsResponse.ok) {
                    const modelsData = await modelsResponse.json();
                    if (modelsData.models && Array.isArray(modelsData.models)) {
                        for (const model of modelsData.models) {
                            let modelName = model.name || "";
                            // Remove "models/" prefix if present
                            if (modelName.startsWith("models/")) {
                                modelName = modelName.substring(7);
                            }
                            const supportsGenerateContent = model.supportedGenerationMethods?.includes("generateContent") ||
                                false;
                            if (modelName && supportsGenerateContent) {
                                availableModels.push({
                                    name: modelName,
                                    version: version,
                                    supportsGenerateContent: true,
                                });
                                console.log(`  - Found model: ${modelName} (${version})`);
                            }
                        }
                        console.log(`✅ Found ${modelsData.models.length} models in ${version}`);
                    }
                }
            }
            catch (err) {
                console.warn(`⚠️ Failed to fetch models from ${version}:`, err.message);
            }
        }
        // Nếu không lấy được từ API, dùng danh sách fallback
        if (availableModels.length === 0) {
            console.warn("⚠️ Could not fetch models from API, using fallback list");
            availableModels = [
                {
                    name: "gemini-1.5-flash",
                    version: "v1beta",
                    supportsGenerateContent: true,
                },
                {
                    name: "gemini-1.5-pro",
                    version: "v1beta",
                    supportsGenerateContent: true,
                },
                {
                    name: "gemini-pro",
                    version: "v1beta",
                    supportsGenerateContent: true,
                },
                {
                    name: "gemini-1.5-flash",
                    version: "v1",
                    supportsGenerateContent: true,
                },
                {
                    name: "gemini-1.5-pro",
                    version: "v1",
                    supportsGenerateContent: true,
                },
                { name: "gemini-pro", version: "v1", supportsGenerateContent: true },
            ];
        }
        else {
            console.log(`📋 Available models: ${availableModels.map((m) => m.name).join(", ")}`);
        }
        // Tạo danh sách models để thử (ưu tiên gemini-1.5-flash và gemini-1.5-pro)
        const modelsToTry = [];
        // Ưu tiên các model 1.5 với systemInstruction
        for (const version of ["v1beta", "v1"]) {
            for (const modelName of ["gemini-1.5-flash", "gemini-1.5-pro"]) {
                const available = availableModels.find((m) => m.name === modelName && m.version === version);
                if (available) {
                    if (version === "v1beta") {
                        modelsToTry.push({
                            model: modelName,
                            version,
                            useSystemInstruction: true,
                        });
                    }
                    modelsToTry.push({
                        model: modelName,
                        version,
                        useSystemInstruction: false,
                    });
                }
            }
        }
        // Thêm các model khác
        for (const version of ["v1beta", "v1"]) {
            for (const available of availableModels) {
                if (available.version === version &&
                    !available.name.includes("1.5-flash") &&
                    !available.name.includes("1.5-pro") &&
                    !modelsToTry.find((m) => m.model === available.name && m.version === version)) {
                    modelsToTry.push({
                        model: available.name,
                        version,
                        useSystemInstruction: false,
                    });
                }
            }
        }
        let lastError = null;
        for (const { model, version, useSystemInstruction } of modelsToTry) {
            try {
                const geminiUrl = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
                let requestBody;
                if (version === "v1beta" &&
                    useSystemInstruction &&
                    model.includes("1.5")) {
                    // v1beta với gemini-1.5-* có thể dùng systemInstruction
                    requestBody = {
                        contents: formattedContents,
                        systemInstruction: {
                            parts: [{ text: systemInstruction }],
                        },
                    };
                }
                else if (version === "v1") {
                    // v1 không hỗ trợ systemInstruction, thêm vào contents như message đầu tiên
                    const contentsWithSystem = [
                        {
                            role: "user",
                            parts: [{ text: systemInstruction }],
                        },
                        {
                            role: "model",
                            parts: [
                                {
                                    text: "Tôi hiểu rồi. Tôi sẽ giúp bạn với các câu hỏi về Fimory.",
                                },
                            ],
                        },
                        ...formattedContents,
                    ];
                    requestBody = {
                        contents: contentsWithSystem,
                    };
                }
                else {
                    // Không dùng systemInstruction
                    requestBody = {
                        contents: formattedContents,
                    };
                }
                console.log(`🔄 Trying model: ${model} (${version}), systemInstruction: ${useSystemInstruction}`);
                const response = await fetch(geminiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(requestBody),
                });
                if (response.ok) {
                    const data = await response.json();
                    // Kiểm tra nhiều format response có thể có
                    let responseText = null;
                    if (data.candidates &&
                        data.candidates[0]?.content?.parts?.[0]?.text) {
                        responseText = data.candidates[0].content.parts[0].text;
                    }
                    else if (data.text) {
                        responseText = data.text;
                    }
                    else if (data.response && data.response.text) {
                        responseText = data.response.text;
                    }
                    else if (data.message) {
                        responseText = data.message;
                    }
                    if (responseText) {
                        console.log(`✅ Success with model: ${model} (${version})`);
                        // Đảm bảo format response đúng với frontend
                        return res.json({
                            candidates: [
                                {
                                    content: {
                                        parts: [
                                            {
                                                text: responseText,
                                            },
                                        ],
                                    },
                                },
                            ],
                        });
                    }
                    else {
                        console.warn(`⚠️ Model ${model} returned invalid response format:`, JSON.stringify(data).substring(0, 200));
                        lastError = { message: "AI returned an invalid response format" };
                        continue;
                    }
                }
                else {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMessage = errorData.error?.message ||
                        errorData.message ||
                        response.statusText;
                    console.warn(`❌ Model ${model} (${version}) failed: ${errorMessage}`);
                    lastError = { message: errorMessage };
                    continue;
                }
            }
            catch (err) {
                console.warn(`❌ Model ${model} (${version}) error:`, err.message);
                lastError = err;
                continue;
            }
        }
        // Nếu tất cả models đều fail
        return res.status(500).json({
            error: {
                message: lastError?.message ||
                    "Tất cả các model đều không khả dụng. Vui lòng thử lại sau hoặc kiểm tra API key của bạn.",
            },
        });
    }
    catch (error) {
        console.error("Chatbot API error:", error);
        res.status(500).json({
            error: {
                message: error.message || "Failed to process chatbot request",
            },
        });
    }
});
// =============================================
// CRAWL ROUTES - Crawl metadata từ TMDB và truyện VN
// =============================================
// GET /api/crawl/movie/:tmdbId - Crawl metadata phim từ TMDB ID (path param)
// GET /api/crawl/movie?url=... - Crawl metadata phim từ URL (query param)
// ✅ FIX: Hỗ trợ cả TMDB ID (path param) và URL (query param)
// Route 1: Với path param (TMDB ID)
router.get("/crawl/movie/:tmdbId", async (req, res) => {
    try {
        const { tmdbId } = req.params;
        const downloadPoster = req.query.download === "true";
        if (!tmdbId) {
            return res.status(400).json({ error: "Thiếu TMDB ID" });
        }
        console.log(`[CRAWL] GET /api/crawl/movie với TMDB ID: ${tmdbId}`);
        const movie = await (0, crawlService_1.crawlMovieFromTMDB)(tmdbId, downloadPoster);
        res.json({
            ok: true,
            movie,
        });
    }
    catch (error) {
        console.error("Crawl movie error:", error);
        res.status(500).json({
            error: error.message || "Lỗi khi crawl metadata phim",
        });
    }
});
// Route 2: Chỉ với query param (URL) - phải đặt sau route có path param
router.get("/crawl/movie", async (req, res) => {
    try {
        const urlParam = req.query.url;
        const downloadPoster = req.query.download === "true";
        if (!urlParam) {
            return res.status(400).json({ error: "Thiếu URL. Dùng ?url=... cho URL hoặc /:tmdbId cho TMDB ID" });
        }
        const decodedUrl = decodeURIComponent(urlParam);
        console.log(`[CRAWL] GET /api/crawl/movie với URL từ query: ${decodedUrl}`);
        // Kiểm tra xem URL có phải TMDB không
        const isTMDB = decodedUrl.includes('themoviedb.org') || decodedUrl.includes('tmdb.org');
        let movie;
        if (isTMDB) {
            // Extract TMDB ID từ URL: https://www.themoviedb.org/movie/1084242-...
            const tmdbIdMatch = decodedUrl.match(/\/movie\/(\d+)/);
            if (tmdbIdMatch && tmdbIdMatch[1]) {
                const extractedTmdbId = tmdbIdMatch[1];
                console.log(`[CRAWL] ✅ Detect TMDB URL, extract ID: ${extractedTmdbId}`);
                movie = await (0, crawlService_1.crawlMovieFromTMDB)(extractedTmdbId, downloadPoster);
            }
            else {
                throw new Error("Không thể extract TMDB ID từ URL. URL phải có dạng: https://www.themoviedb.org/movie/1084242-...");
            }
        }
        else {
            // URL là trang VN, dùng crawlMovieFromVN
            console.log(`[CRAWL] ✅ Detect trang VN, dùng crawlMovieFromVN`);
            movie = await (0, crawlService_1.crawlMovieFromVN)(decodedUrl, downloadPoster);
        }
        return res.json({
            ok: true,
            movie,
        });
    }
    catch (error) {
        console.error("Crawl movie error:", error);
        res.status(500).json({
            error: error.message || "Lỗi khi crawl metadata phim",
        });
    }
});
// POST /api/crawl/story - Crawl metadata truyện từ URL
// ✅ FIX: Route này chỉ trả về metadata, không tự động lưu vào database
// Frontend cần kiểm tra truyện đã tồn tại (theo title hoặc URL) và:
// - Nếu đã tồn tại: Gọi API PUT /admin/stories/:id để cập nhật metadata và thêm chapter mới
// - Nếu chưa tồn tại: Gọi API POST /admin/stories để tạo mới
// Logic này đảm bảo "Crawl một lần và có thể cập nhật liên tục" như các web truyện lớn
router.post("/crawl/story", async (req, res) => {
    try {
        // Debug: Log request body để kiểm tra
        console.log("[CRAWL] POST /api/crawl/story");
        console.log("[CRAWL] Request body:", JSON.stringify(req.body));
        console.log("[CRAWL] Content-Type:", req.headers["content-type"]);
        const { url, download } = req.body;
        if (!url) {
            console.log("[CRAWL] ❌ Thiếu URL trong body");
            return res.status(400).json({ error: "Thiếu URL truyện" });
        }
        console.log(`[CRAWL] ✅ URL nhận được: ${url}`);
        // ✅ FIX: Kiểm tra download đúng cách (có thể là boolean hoặc string "true")
        const downloadCover = download === true || download === "true" || download === 1;
        console.log(`[CRAWL] 📥 downloadCover = ${downloadCover} (from download=${JSON.stringify(download)})`);
        const series = await (0, crawlService_1.crawlStoryFromVN)(url, downloadCover);
        res.json({
            ok: true,
            series,
        });
    }
    catch (error) {
        console.error("Crawl story error:", error);
        res.status(500).json({
            error: error.message || "Lỗi khi crawl metadata truyện",
        });
    }
});
// POST /api/crawl/movie - Crawl metadata phim từ URL (TMDB hoặc trang VN)
// ✅ Route này chỉ trả về metadata, không tự động lưu vào database
// Frontend cần kiểm tra phim đã tồn tại (theo title hoặc URL) và:
// - Nếu đã tồn tại: Gọi API PUT /admin/movies/:id để cập nhật metadata và thêm episode mới
// - Nếu chưa tồn tại: Gọi API POST /admin/movies để tạo mới
// Logic này đảm bảo "Crawl một lần và có thể cập nhật liên tục" như các web phim lớn
router.post("/crawl/movie", async (req, res) => {
    try {
        console.log("[CRAWL] POST /api/crawl/movie");
        console.log("[CRAWL] Request body:", JSON.stringify(req.body));
        const { url, download, tmdbId } = req.body;
        // ✅ FIX: Hỗ trợ cả TMDB ID và URL TMDB/trang VN
        let movie;
        const downloadPoster = download === true || download === "true" || download === 1;
        // Nếu có tmdbId trực tiếp, dùng luôn
        if (tmdbId) {
            console.log(`[CRAWL] ✅ Crawl từ TMDB ID: ${tmdbId}`);
            movie = await (0, crawlService_1.crawlMovieFromTMDB)(String(tmdbId), downloadPoster);
        }
        // Nếu có URL, kiểm tra xem là TMDB hay trang VN
        else if (url) {
            console.log(`[CRAWL] ✅ URL nhận được: ${url}`);
            // Kiểm tra xem URL có phải TMDB không
            const isTMDB = url.includes('themoviedb.org') || url.includes('tmdb.org');
            if (isTMDB) {
                // Extract TMDB ID từ URL: https://www.themoviedb.org/movie/1084242-zootopia-2
                const tmdbIdMatch = url.match(/\/movie\/(\d+)/);
                if (tmdbIdMatch && tmdbIdMatch[1]) {
                    const extractedTmdbId = tmdbIdMatch[1];
                    console.log(`[CRAWL] ✅ Detect TMDB URL, extract ID: ${extractedTmdbId}`);
                    movie = await (0, crawlService_1.crawlMovieFromTMDB)(extractedTmdbId, downloadPoster);
                }
                else {
                    throw new Error("Không thể extract TMDB ID từ URL. URL phải có dạng: https://www.themoviedb.org/movie/1084242-...");
                }
            }
            else {
                // URL là trang VN, dùng crawlMovieFromVN
                console.log(`[CRAWL] ✅ Detect trang VN, dùng crawlMovieFromVN`);
                movie = await (0, crawlService_1.crawlMovieFromVN)(url, downloadPoster);
            }
        }
        else {
            return res.status(400).json({ error: "Thiếu URL phim hoặc TMDB ID" });
        }
        res.json({
            ok: true,
            movie,
        });
    }
    catch (error) {
        console.error("Crawl movie error:", error);
        res.status(500).json({
            error: error.message || "Lỗi khi crawl metadata phim",
        });
    }
});
// ✅ FIX: POST /api/admin/stories/:seriesId/chapters/crawl - Crawl chapter mới cho story (Admin only)
router.post("/admin/stories/:seriesId/chapters/crawl", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["create:content"]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const { chapterUrl, chapterNumber, title, isFree } = req.body;
        if (!chapterUrl) {
            return res.status(400).json({ error: "Thiếu chapterUrl" });
        }
        // Get story type
        const storyRes = await (0, db_1.query) `
        SELECT StoryType FROM Series WHERE SeriesID = ${seriesId}
      `;
        if (storyRes.recordset.length === 0) {
            return res.status(404).json({ error: "Story not found" });
        }
        const storyType = storyRes.recordset[0]?.StoryType || "Comic";
        if (storyType !== "Comic") {
            return res.status(400).json({ error: "Chỉ có thể crawl chapter cho truyện tranh (Comic)" });
        }
        // Get next chapter number if not provided
        let nextChapterNumber = chapterNumber ? Number(chapterNumber) : null;
        if (!nextChapterNumber) {
            const maxChapter = await (0, db_1.query) `
          SELECT MAX(ChapterNumber) as MaxChapter 
          FROM Chapters 
          WHERE SeriesID = ${seriesId}
        `;
            nextChapterNumber = (maxChapter.recordset[0].MaxChapter || 0) + 1;
        }
        // Validate ChapterNumber không trùng
        const duplicateCheck = await (0, db_1.query) `
        SELECT TOP 1 ChapterID
        FROM Chapters
        WHERE SeriesID = ${seriesId} AND ChapterNumber = ${nextChapterNumber}
      `;
        if (duplicateCheck.recordset.length > 0) {
            return res.status(400).json({
                error: `Chapter ${nextChapterNumber} already exists. Please choose a different chapter number.`,
            });
        }
        // Crawl chapter
        const result = await (0, crawlService_1.crawlChapterWithFallback)({
            url: chapterUrl,
            chapterUrl: chapterUrl,
            saveToDisk: true,
        });
        if (!result.savedImages || result.savedImages.length === 0) {
            return res.status(400).json({ error: "Không thể crawl được ảnh chapter" });
        }
        // Insert chapter vào DB
        const checkColumn = await (0, db_1.query) `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Chapters' AND COLUMN_NAME = 'ChapterCode'
      `;
        const hasChapterCode = checkColumn.recordset.length > 0;
        const chapterCode = hasChapterCode
            ? `CH${seriesId}-${String(nextChapterNumber).padStart(3, "0")}`
            : null;
        const chapterTitle = title || `Chapter ${nextChapterNumber}`;
        const chapterIsFree = isFree === "true" || isFree === true;
        const chapterInsert = hasChapterCode
            ? await (0, db_1.query) `
            INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, ChapterCode, CreatedAt)
            OUTPUT INSERTED.ChapterID
            VALUES (${seriesId}, ${nextChapterNumber}, ${chapterTitle}, '', ${chapterIsFree ? 1 : 0}, ${result.savedImages.length}, ${chapterCode}, GETDATE())
          `
            : await (0, db_1.query) `
            INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
            OUTPUT INSERTED.ChapterID
            VALUES (${seriesId}, ${nextChapterNumber}, ${chapterTitle}, '', ${chapterIsFree ? 1 : 0}, ${result.savedImages.length}, GETDATE())
          `;
        const persistedChapterId = chapterInsert.recordset[0]?.ChapterID || null;
        if (persistedChapterId) {
            // Insert images
            for (let i = 0; i < result.savedImages.length; i++) {
                const imageUrl = result.savedImages[i];
                if (!imageUrl)
                    continue;
                await (0, db_1.query) `
            INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
            VALUES (${persistedChapterId}, ${imageUrl}, ${i + 1}, NULL, GETDATE())
          `;
            }
        }
        res.json({
            success: true,
            message: "Chapter crawled and added successfully",
            chapterId: persistedChapterId,
            chapterNumber: nextChapterNumber,
            imageCount: result.savedImages.length,
        });
    }
    catch (e) {
        console.error("POST /admin/stories/:seriesId/chapters/crawl error:", e);
        res.status(500).json({ error: "Failed to crawl chapter" });
    }
});
// POST /api/admin/movies/:movieId/episodes/crawl - Crawl episode mới cho phim (Admin only)
// Tương tự route crawl chapter, nhưng cho phim (30% logic riêng: video URL, server, subtitle)
router.post("/admin/movies/:movieId/episodes/crawl", authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["create:content"]), async (req, res) => {
    try {
        const movieId = Number(req.params.movieId);
        const { episodeUrl, episodeNumber, seasonNumber, title, isFree, videoUrl, videoBackupUrl, subtitleUrl, serverName, duration, quality } = req.body;
        if (!episodeUrl) {
            return res.status(400).json({ error: "Thiếu episodeUrl" });
        }
        // Kiểm tra phim có tồn tại không
        const movieRes = await (0, db_1.query) `
        SELECT MovieID FROM Movies WHERE MovieID = ${movieId}
      `;
        if (movieRes.recordset.length === 0) {
            return res.status(404).json({ error: "Movie not found" });
        }
        // Get next episode number nếu không có
        let nextEpisodeNumber = episodeNumber ? Number(episodeNumber) : null;
        const nextSeasonNumber = seasonNumber ? Number(seasonNumber) : 1;
        if (!nextEpisodeNumber) {
            const maxEpisode = await (0, db_1.query) `
          SELECT MAX(EpisodeNumber) as MaxEpisode 
          FROM MovieEpisodes 
          WHERE MovieID = ${movieId} AND SeasonNumber = ${nextSeasonNumber}
        `;
            nextEpisodeNumber = (maxEpisode.recordset[0]?.MaxEpisode || 0) + 1;
        }
        // Validate EpisodeNumber không trùng
        const duplicateCheck = await (0, db_1.query) `
        SELECT TOP 1 EpisodeID
        FROM MovieEpisodes
        WHERE MovieID = ${movieId} 
          AND SeasonNumber = ${nextSeasonNumber}
          AND EpisodeNumber = ${nextEpisodeNumber}
      `;
        if (duplicateCheck.recordset.length > 0) {
            return res.status(400).json({
                error: `Episode ${nextEpisodeNumber} (Season ${nextSeasonNumber}) already exists. Please choose a different episode number.`,
            });
        }
        // Crawl episode từ URL (nếu có videoUrl thì dùng luôn, không cần crawl)
        let finalVideoUrl = videoUrl || null;
        let finalVideoBackupUrl = videoBackupUrl || null;
        let finalSubtitleUrl = subtitleUrl || null;
        let finalServerName = serverName || "Default";
        let finalDuration = duration ? Number(duration) : null;
        let finalQuality = quality || null;
        // Nếu không có videoUrl, thử crawl từ episodeUrl
        if (!finalVideoUrl) {
            try {
                // TODO: Implement crawl episode video từ URL (tương tự crawl chapter images)
                // Hiện tại chỉ lưu episodeUrl để sau này crawl
                console.log(`⚠️ Chưa có videoUrl, lưu episodeUrl để crawl sau: ${episodeUrl}`);
            }
            catch (e) {
                console.warn(`⚠️ Không thể crawl video từ ${episodeUrl}:`, e.message);
            }
        }
        const episodeTitle = title || `Tập ${nextEpisodeNumber}`;
        const episodeIsFree = isFree === "true" || isFree === true;
        // Insert episode vào DB
        const episodeInsert = await (0, db_1.query) `
        INSERT INTO MovieEpisodes (
          MovieID, 
          EpisodeNumber, 
          SeasonNumber,
          Title, 
          VideoURL, 
          VideoBackupURL,
          SubtitleURL,
          ServerName,
          Duration,
          IsFree,
          CrawlSource,
          CrawlEpisodeURL,
          CreatedAt
        )
        OUTPUT INSERTED.EpisodeID
        VALUES (
          ${movieId}, 
          ${nextEpisodeNumber}, 
          ${nextSeasonNumber},
          ${episodeTitle}, 
          ${finalVideoUrl || ''}, 
          ${finalVideoBackupUrl},
          ${finalSubtitleUrl},
          ${finalServerName},
          ${finalDuration},
          ${episodeIsFree ? 1 : 0},
          'crawl',
          ${episodeUrl},
          GETDATE()
        )
      `;
        const persistedEpisodeId = episodeInsert.recordset[0]?.EpisodeID || null;
        if (!persistedEpisodeId) {
            return res.status(500).json({ error: "Không thể tạo episode" });
        }
        res.json({
            success: true,
            message: "Episode crawled and added successfully",
            episodeId: persistedEpisodeId,
            episodeNumber: nextEpisodeNumber,
            seasonNumber: nextSeasonNumber,
            videoUrl: finalVideoUrl,
            serverName: finalServerName,
        });
    }
    catch (e) {
        console.error("POST /admin/movies/:movieId/episodes/crawl error:", e);
        res.status(500).json({
            error: "Failed to crawl episode",
            message: e.message || "Unknown error"
        });
    }
});
// POST /api/crawl/chapter - Crawl full images cho chapter cụ thể
router.post("/crawl/chapter", async (req, res) => {
    try {
        const { url, chapterUrl, chapterId, chapterSlug, chapterTitle, storySlug, storyTitle, saveToDisk, seriesId, chapterNumber, isFree, updateExisting = false, // ✅ FIX: Flag để update chapter hiện có
         } = req.body || {};
        if (!chapterUrl && !url) {
            return res.status(400).json({ error: "Thiếu chapterUrl hoặc url" });
        }
        const result = await (0, crawlService_1.crawlChapterWithFallback)({
            url,
            chapterUrl: chapterUrl || url,
            chapterId,
            chapterSlug,
            chapterTitle,
            storySlug,
            storyTitle,
            saveToDisk: saveToDisk !== false,
        });
        const numericSeriesId = typeof seriesId !== "undefined" ? Number(seriesId) : null;
        const numericChapterId = typeof chapterId !== "undefined" ? Number(chapterId) : null;
        const numericChapterNumber = typeof chapterNumber !== "undefined" ? Number(chapterNumber) : null;
        const chapterIsFree = isFree === false || isFree === "false" ? 0 : 1;
        let persistedChapterId = null;
        // ✅ FIX: Nếu có chapterId và updateExisting = true → Update chapter hiện có
        if (numericChapterId && updateExisting && result.savedImages && result.savedImages.length > 0) {
            try {
                // Xóa ảnh cũ trong DB
                await (0, db_1.query) `DELETE FROM ChapterImages WHERE ChapterID = ${numericChapterId}`;
                // Xóa file ảnh cũ
                const oldImages = await (0, db_1.query) `
            SELECT ImageURL FROM ChapterImages WHERE ChapterID = ${numericChapterId}
          `;
                const uploadsRoot = path_1.default.resolve(__dirname, "..", "..", "..", "uploads");
                for (const img of oldImages.recordset) {
                    try {
                        if (img.ImageURL && img.ImageURL.startsWith("/storage/")) {
                            const relativePath = img.ImageURL.replace("/storage/", "");
                            const filePath = path_1.default.join(uploadsRoot, relativePath);
                            if (fs_1.default.existsSync(filePath)) {
                                fs_1.default.unlinkSync(filePath);
                            }
                        }
                    }
                    catch (e) {
                        // Ignore file errors
                    }
                }
                // Insert ảnh mới
                for (let i = 0; i < result.savedImages.length; i++) {
                    const imageUrl = result.savedImages[i];
                    if (!imageUrl)
                        continue;
                    await (0, db_1.query) `
              INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
              VALUES (${numericChapterId}, ${imageUrl}, ${i + 1}, NULL, GETDATE())
            `;
                }
                // Update ImageCount và Title nếu có
                if (chapterTitle) {
                    await (0, db_1.query) `
              UPDATE Chapters 
              SET ImageCount = ${result.savedImages.length}, Title = ${chapterTitle}
              WHERE ChapterID = ${numericChapterId}
            `;
                }
                else {
                    await (0, db_1.query) `
              UPDATE Chapters 
              SET ImageCount = ${result.savedImages.length}
              WHERE ChapterID = ${numericChapterId}
            `;
                }
                persistedChapterId = numericChapterId;
                console.log(`✅ Đã update chapter ${numericChapterId} với ${result.savedImages.length} ảnh mới`);
            }
            catch (updateError) {
                console.error("Failed to update chapter:", updateError);
                return res.status(500).json({ error: "Failed to update chapter" });
            }
        }
        else if (numericSeriesId &&
            Number.isFinite(numericSeriesId) &&
            numericSeriesId > 0 &&
            result.savedImages &&
            result.savedImages.length > 0) {
            // ✅ FIX: Tạo chapter mới (logic cũ nhưng có validate)
            try {
                let nextChapterNumber = numericChapterNumber && Number.isFinite(numericChapterNumber)
                    ? numericChapterNumber
                    : null;
                if (!nextChapterNumber) {
                    const maxChapter = await (0, db_1.query) `
              SELECT MAX(ChapterNumber) as MaxChapter 
              FROM Chapters 
              WHERE SeriesID = ${numericSeriesId}
            `;
                    nextChapterNumber = (maxChapter.recordset[0]?.MaxChapter || 0) + 1;
                }
                const resolvedChapterNumber = nextChapterNumber || 1;
                const resolvedTitle = chapterTitle || `Chapter ${resolvedChapterNumber}`;
                // ✅ FIX: Validate không trùng ChapterNumber
                const duplicateChapter = await (0, db_1.query) `
            SELECT TOP 1 ChapterID
            FROM Chapters
            WHERE SeriesID = ${numericSeriesId} AND ChapterNumber = ${resolvedChapterNumber}
          `;
                if (duplicateChapter.recordset.length > 0) {
                    return res.status(400).json({
                        error: `Chapter ${resolvedChapterNumber} already exists. Use updateExisting=true and chapterId to update existing chapter.`,
                    });
                }
                else {
                    const checkColumn = await (0, db_1.query) `
              SELECT COLUMN_NAME
              FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_NAME = 'Chapters' AND COLUMN_NAME = 'ChapterCode'
            `;
                    const hasChapterCode = checkColumn.recordset.length > 0;
                    const chapterCode = hasChapterCode
                        ? `CH${numericSeriesId}-${String(resolvedChapterNumber).padStart(3, "0")}`
                        : null;
                    const chapterInsert = hasChapterCode
                        ? await (0, db_1.query) `
                INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, ChapterCode, CreatedAt)
                OUTPUT INSERTED.ChapterID
                VALUES (${numericSeriesId}, ${resolvedChapterNumber}, ${resolvedTitle}, '', ${chapterIsFree}, ${result.savedImages.length}, ${chapterCode}, GETDATE())
              `
                        : await (0, db_1.query) `
                INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
                OUTPUT INSERTED.ChapterID
                VALUES (${numericSeriesId}, ${resolvedChapterNumber}, ${resolvedTitle}, '', ${chapterIsFree}, ${result.savedImages.length}, GETDATE())
              `;
                    persistedChapterId = chapterInsert.recordset[0]?.ChapterID || null;
                    if (persistedChapterId) {
                        for (let i = 0; i < result.savedImages.length; i++) {
                            const imageUrl = result.savedImages[i];
                            if (!imageUrl)
                                continue;
                            await (0, db_1.query) `
                  INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
                  VALUES (${persistedChapterId}, ${imageUrl}, ${i + 1}, NULL, GETDATE())
                `;
                        }
                    }
                }
            }
            catch (dbError) {
                console.error("Failed to persist crawled chapter:", dbError);
            }
        }
        res.json({
            ok: true,
            site: result.site,
            chapterUrl: result.chapterUrl,
            imageCount: result.imageCount,
            images: result.images,
            savedImages: result.savedImages,
            storageFolder: result.storageFolder,
            chapterId: persistedChapterId,
        });
    }
    catch (error) {
        console.error("Crawl chapter error:", error);
        res.status(500).json({
            error: error.message || "Lỗi khi crawl chapter",
        });
    }
});
exports.default = router;
