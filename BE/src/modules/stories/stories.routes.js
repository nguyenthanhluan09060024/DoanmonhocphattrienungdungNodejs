"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../database/db");
const authenticate_1 = require("../../middlewares/authenticate");
const authMiddleware_1 = require("../../middlewares/authMiddleware");

const router = (0, express_1.Router)();

// ==================== ADMIN ROUTES ====================

/**
 * GET /admin/stories - Get all stories (Admin only)
 * Pagination support with limit and offset
 */
router.get("/admin/stories", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        const offset = Math.max(Number(req.query.offset) || 0, 0);

        const rows = await (0, db_1.query)`
            SELECT 
              s.SeriesID, s.Title, s.Slug, s.CoverURL, s.Description, s.Author, s.Status, 
              s.IsFree, s.ViewCount, s.Rating, s.CreatedAt, s.UpdatedAt, s.StoryType,
              u.FullName as UploaderName, u.Username as UploaderUsername, u.Email as UploaderEmail,
              r.RoleName as UploaderRole
            FROM Series s
            LEFT JOIN Users u ON s.UploaderID = u.UserID
            LEFT JOIN Roles r ON u.RoleID = r.RoleID
            ORDER BY s.CreatedAt DESC
            OFFSET ${offset} ROWS
            FETCH NEXT ${limit} ROWS ONLY
        `;

        const countResult = await (0, db_1.query)`SELECT COUNT(*) as total FROM Series`;
        const total = countResult.recordset[0]?.total || 0;

        return res.json({
            success: true,
            data: rows.recordset,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total
            }
        });
    }
    catch (e) {
        console.error("GET /admin/stories error:", e);
        return res.status(500).json({ success: false, error: "Không thể lấy danh sách truyện" });
    }
});

// ==================== PUBLIC ROUTES ====================

/**
 * GET /stories - Get approved stories (Public)
 */
router.get("/stories", async (req, res) => {
    try {
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        const offset = Math.max(Number(req.query.offset) || 0, 0);

        const result = await (0, db_1.query)`
            SELECT 
              s.SeriesID, s.Title, s.Slug, s.Description, s.CoverURL, s.Author, s.Rating, 
              s.ViewCount, s.CreatedAt, s.Status, s.IsFree, s.StoryType,
              u.Username as UploaderName, r.RoleName as UploaderRole
            FROM Series s
            JOIN Users u ON s.UploaderID = u.UserID
            JOIN Roles r ON u.RoleID = r.RoleID
            WHERE s.Status = 'Approved' AND s.IsApproved = 1
            ORDER BY s.CreatedAt DESC
            OFFSET ${offset} ROWS
            FETCH NEXT ${limit} ROWS ONLY
        `;

        const countResult = await (0, db_1.query)`
            SELECT COUNT(*) as total FROM Series 
            WHERE Status = 'Approved' AND IsApproved = 1
        `;
        const total = countResult.recordset[0]?.total || 0;

        res.json({
            success: true,
            data: result.recordset,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total
            }
        });
    }
    catch (e) {
        console.error("GET /stories error:", e);
        res.status(500).json({ success: false, error: "Không thể tải dữ liệu truyện" });
    }
});

/**
 * GET /user/stories - Get stories by authenticated user
 */
router.get("/user/stories", authenticate_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.UserID;
        if (!userId) {
            return res.status(401).json({ success: false, error: "Unauthorized" });
        }

        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        const offset = Math.max(Number(req.query.offset) || 0, 0);

        const rows = await (0, db_1.query)`
            SELECT 
              s.SeriesID, s.Title, s.Slug, s.Description, s.CoverURL, s.Author, s.Status, 
              s.IsFree, s.ViewCount, s.Rating, s.CreatedAt, s.UpdatedAt, s.StoryType
            FROM Series s
            WHERE s.UploaderID = ${userId}
            ORDER BY s.CreatedAt DESC
            OFFSET ${offset} ROWS
            FETCH NEXT ${limit} ROWS ONLY
        `;

        const countResult = await (0, db_1.query)`
            SELECT COUNT(*) as total FROM Series WHERE UploaderID = ${userId}
        `;
        const total = countResult.recordset[0]?.total || 0;

        res.json({
            success: true,
            data: rows.recordset,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total
            }
        });
    }
    catch (e) {
        console.error("GET /user/stories error:", e);
        res.status(500).json({ success: false, error: "Không thể tải truyện của bạn" });
    }
});

/**
 * GET /stories/:slug - Get story by slug
 */
router.get("/stories/:slug", async (req, res) => {
    try {
        const slug = req.params.slug?.trim();
        if (!slug) {
            return res.status(400).json({ success: false, error: "Slug là bắt buộc" });
        }

        const result = await (0, db_1.query)`
            SELECT TOP 1 
              SeriesID, Title, Slug, Description, CoverURL, Author, Status, IsFree, 
              ViewCount, Rating, StoryType, CreatedAt, UpdatedAt
            FROM Series 
            WHERE Slug = ${slug}
        `;

        const story = result.recordset[0];
        if (!story) {
            return res.status(404).json({ success: false, error: "Không tìm thấy truyện" });
        }

        res.json({
            success: true,
            data: story
        });
    }
    catch (e) {
        console.error("GET /stories/:slug error:", e);
        res.status(500).json({ success: false, error: "Không thể lấy thông tin truyện" });
    }
});

// ==================== CHAPTER ROUTES ====================

/**
 * GET /stories/:seriesId/chapters - Get all chapters of a series
 */
router.get("/stories/:seriesId/chapters", async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        if (!seriesId || isNaN(seriesId)) {
            return res.status(400).json({ success: false, error: "Series ID không hợp lệ" });
        }

        // Get story type
        const storyInfo = await (0, db_1.query)`SELECT StoryType FROM Series WHERE SeriesID = ${seriesId}`;
        if (!storyInfo.recordset[0]) {
            return res.status(404).json({ success: false, error: "Không tìm thấy truyện" });
        }

        const storyType = storyInfo.recordset[0].StoryType || "Text";

        // Check if ChapterCode column exists
        const checkColumn = await (0, db_1.query)`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Chapters' AND COLUMN_NAME = 'ChapterCode'
        `;
        const hasChapterCode = checkColumn.recordset.length > 0;

        // Fetch chapters
        const chapters = hasChapterCode
            ? await (0, db_1.query)`
                SELECT 
                  ChapterID, ChapterNumber, Title, Content, IsFree, ImageCount, 
                  ViewCount, CreatedAt, ChapterCode
                FROM Chapters
                WHERE SeriesID = ${seriesId}
                ORDER BY ChapterNumber ASC
            `
            : await (0, db_1.query)`
                SELECT 
                  ChapterID, ChapterNumber, Title, Content, IsFree, ImageCount, 
                  ViewCount, CreatedAt
                FROM Chapters
                WHERE SeriesID = ${seriesId}
                ORDER BY ChapterNumber ASC
            `;

        // If Comic type, fetch images for each chapter
        if (storyType === "Comic") {
            const chaptersWithImages = await Promise.all(
                chapters.recordset.map(async (chapter) => {
                    const images = await (0, db_1.query)`
                        SELECT ImageID, ImageURL, ImageOrder, FileSize, Width, Height
                        FROM ChapterImages
                        WHERE ChapterID = ${chapter.ChapterID}
                        ORDER BY ImageOrder ASC
                    `;
                    return {
                        ...chapter,
                        Images: images.recordset,
                        StoryType: "Comic",
                        ChapterCode: hasChapterCode ? chapter.ChapterCode : undefined
                    };
                })
            );
            return res.json({
                success: true,
                data: chaptersWithImages
            });
        }

        res.json({
            success: true,
            data: chapters.recordset.map((chapter) => ({
                ...chapter,
                StoryType: "Text",
                ChapterCode: hasChapterCode ? chapter.ChapterCode : undefined
            }))
        });
    }
    catch (e) {
        console.error("GET /stories/:seriesId/chapters error:", e);
        res.status(500).json({ success: false, error: "Không thể lấy danh sách chương" });
    }
});

/**
 * POST /stories/:seriesId/chapters - Create a new chapter
 */
router.post("/stories/:seriesId/chapters", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["create:content"]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const { title, content, chapterNumber, isFree } = req.body || {};

        // Validation
        if (!seriesId || isNaN(seriesId)) {
            return res.status(400).json({ success: false, error: "Series ID không hợp lệ" });
        }
        if (!title || !content) {
            return res.status(400).json({ success: false, error: "Tiêu đề và nội dung là bắt buộc" });
        }
        if (typeof title !== 'string' || typeof content !== 'string') {
            return res.status(400).json({ success: false, error: "Tiêu đề và nội dung phải là chuỗi" });
        }

        // Check series exists and belongs to user
        const seriesCheck = await (0, db_1.query)`SELECT UploaderID FROM Series WHERE SeriesID = ${seriesId}`;
        if (seriesCheck.recordset.length === 0) {
            return res.status(404).json({ success: false, error: "Không tìm thấy truyện" });
        }

        // Authorization check
        const isAdmin = req.user.RoleName === "Admin";
        const isOwner = seriesCheck.recordset[0].UploaderID === req.user.UserID;
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ success: false, error: "Bạn chỉ có thể thêm chương vào truyện của mình" });
        }

        // Get or generate chapter number
        let finalChapterNumber = chapterNumber;
        if (!finalChapterNumber) {
            const lastChapter = await (0, db_1.query)`
                SELECT MAX(ChapterNumber) as MaxChapter FROM Chapters WHERE SeriesID = ${seriesId}
            `;
            finalChapterNumber = (lastChapter.recordset[0]?.MaxChapter || 0) + 1;
        }

        // Insert chapter
        const chapterResult = await (0, db_1.query)`
            INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, CreatedAt)
            OUTPUT INSERTED.ChapterID
            VALUES (${seriesId}, ${finalChapterNumber}, ${title.trim()}, ${content}, ${isFree ? 1 : 0}, GETDATE())
        `;

        res.status(201).json({
            success: true,
            message: "Chương được thêm thành công",
            data: {
                chapterId: chapterResult.recordset[0].ChapterID,
                chapterNumber: finalChapterNumber
            }
        });
    }
    catch (e) {
        console.error("POST /stories/:seriesId/chapters error:", e);
        res.status(500).json({ success: false, error: "Không thể thêm chương" });
    }
});

/**
 * PUT /stories/:seriesId/chapters/:chapterId - Update a chapter
 */
router.put("/stories/:seriesId/chapters/:chapterId", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["edit:own_content"]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const chapterId = Number(req.params.chapterId);
        const { title, content, chapterNumber, isFree } = req.body || {};

        // Validation
        if (!seriesId || !chapterId || isNaN(seriesId) || isNaN(chapterId)) {
            return res.status(400).json({ success: false, error: "Series ID hoặc Chapter ID không hợp lệ" });
        }

        // Check series exists and belongs to user
        const seriesCheck = await (0, db_1.query)`SELECT UploaderID FROM Series WHERE SeriesID = ${seriesId}`;
        if (seriesCheck.recordset.length === 0) {
            return res.status(404).json({ success: false, error: "Không tìm thấy truyện" });
        }

        // Authorization check
        const isAdmin = req.user.RoleName === "Admin";
        const isOwner = seriesCheck.recordset[0].UploaderID === req.user.UserID;
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ success: false, error: "Bạn chỉ có thể chỉnh sửa chương của truyện mình" });
        }

        // Update fields
        if (title && typeof title === 'string') {
            await (0, db_1.query)`UPDATE Chapters SET Title = ${title.trim()} WHERE ChapterID = ${chapterId}`;
        }
        if (content && typeof content === 'string') {
            await (0, db_1.query)`UPDATE Chapters SET Content = ${content} WHERE ChapterID = ${chapterId}`;
        }
        if (typeof chapterNumber === 'number' && chapterNumber > 0) {
            await (0, db_1.query)`UPDATE Chapters SET ChapterNumber = ${chapterNumber} WHERE ChapterID = ${chapterId}`;
        }
        if (typeof isFree === 'boolean') {
            await (0, db_1.query)`UPDATE Chapters SET IsFree = ${isFree ? 1 : 0} WHERE ChapterID = ${chapterId}`;
        }

        res.json({
            success: true,
            message: "Chương được cập nhật thành công"
        });
    }
    catch (e) {
        console.error("PUT /stories/:seriesId/chapters/:chapterId error:", e);
        res.status(500).json({ success: false, error: "Không thể cập nhật chương" });
    }
});

/**
 * DELETE /stories/:seriesId/chapters/:chapterId - Delete a chapter
 */
router.delete("/stories/:seriesId/chapters/:chapterId", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["delete:any_content"]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const chapterId = Number(req.params.chapterId);

        // Validation
        if (!seriesId || !chapterId || isNaN(seriesId) || isNaN(chapterId)) {
            return res.status(400).json({ success: false, error: "Series ID hoặc Chapter ID không hợp lệ" });
        }

        // Check series exists and belongs to user
        const seriesCheck = await (0, db_1.query)`SELECT UploaderID FROM Series WHERE SeriesID = ${seriesId}`;
        if (seriesCheck.recordset.length === 0) {
            return res.status(404).json({ success: false, error: "Không tìm thấy truyện" });
        }

        // Authorization check
        const isAdmin = req.user.RoleName === "Admin";
        const isOwner = seriesCheck.recordset[0].UploaderID === req.user.UserID;
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ success: false, error: "Bạn chỉ có thể xóa chương của truyện mình" });
        }

        // Delete associated images first
        await (0, db_1.query)`DELETE FROM ChapterImages WHERE ChapterID = ${chapterId}`;
        
        // Delete chapter
        await (0, db_1.query)`DELETE FROM Chapters WHERE ChapterID = ${chapterId}`;

        res.json({
            success: true,
            message: "Chương được xóa thành công"
        });
    }
    catch (e) {
        console.error("DELETE /stories/:seriesId/chapters/:chapterId error:", e);
        res.status(500).json({ success: false, error: "Không thể xóa chương" });
    }
});

exports.default = router;
