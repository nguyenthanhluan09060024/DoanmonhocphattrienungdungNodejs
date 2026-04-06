"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../database/db");
const authenticate_1 = require("../../middlewares/authenticate");
const authMiddleware_1 = require("../../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.get("/admin/stories", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (_req, res) => {
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
        console.error("GET /stories error:", e);
        res.status(500).json({ error: "Failed to fetch stories" });
    }
});
router.get("/user/stories", authenticate_1.authenticate, async (req, res) => {
    try {
        const rows = await (0, db_1.query) `
            SELECT TOP 200
              s.SeriesID, s.Title, s.Slug, s.CoverURL, s.Author, s.Status, s.IsFree, s.ViewCount, s.Rating, s.CreatedAt, s.StoryType
            FROM Series s
            WHERE s.UploaderID = ${req.user?.UserID}
            ORDER BY s.CreatedAt DESC
        `;
        res.json(rows.recordset);
    }
    catch (e) {
        console.error("GET /user/stories error:", e);
        res.status(500).json({ error: "Failed to load user stories" });
    }
});
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
        console.error("GET /stories/:slug error:", e);
        return res.status(500).json({ error: "Failed to fetch story" });
    }
});
router.get("/stories/:seriesId/chapters", async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        if (!seriesId)
            return res.status(400).json({ error: "Invalid series ID" });
        const storyInfo = await (0, db_1.query) `SELECT StoryType FROM Series WHERE SeriesID = ${seriesId}`;
        const storyType = storyInfo.recordset[0]?.StoryType || "Text";
        const checkColumn = await (0, db_1.query) `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Chapters' AND COLUMN_NAME = 'ChapterCode'
        `;
        const hasChapterCode = checkColumn.recordset.length > 0;
        const chapters = hasChapterCode
            ? await (0, db_1.query) `
                SELECT ChapterID, ChapterNumber, Title, Content, IsFree, ImageCount, ViewCount, CreatedAt, ChapterCode
                FROM Chapters
                WHERE SeriesID = ${seriesId}
                ORDER BY ChapterNumber ASC
            `
            : await (0, db_1.query) `
                SELECT ChapterID, ChapterNumber, Title, Content, IsFree, ImageCount, ViewCount, CreatedAt
                FROM Chapters
                WHERE SeriesID = ${seriesId}
                ORDER BY ChapterNumber ASC
            `;
        if (storyType === "Comic") {
            const chaptersWithImages = await Promise.all(chapters.recordset.map(async (chapter) => {
                const images = await (0, db_1.query) `
                    SELECT ImageID, ImageURL, ImageOrder, FileSize, Width, Height
                    FROM ChapterImages
                    WHERE ChapterID = ${chapter.ChapterID}
                    ORDER BY ImageOrder ASC
                `;
                return { ...chapter, Images: images.recordset, StoryType: "Comic", ChapterCode: hasChapterCode ? chapter.ChapterCode : undefined };
            }));
            return res.json(chaptersWithImages);
        }
        res.json(chapters.recordset.map((chapter) => ({ ...chapter, StoryType: "Text", ChapterCode: hasChapterCode ? chapter.ChapterCode : undefined })));
    }
    catch (e) {
        console.error("GET /stories/:seriesId/chapters error:", e);
        res.status(500).json({ error: "Failed to fetch chapters" });
    }
});
router.post("/stories/:seriesId/chapters", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["create:content"]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const { title, content, chapterNumber, isFree } = req.body || {};
        if (!seriesId || !title || !content) {
            return res.status(400).json({ error: "Missing seriesId, title, or content" });
        }
        const seriesCheck = await (0, db_1.query) `SELECT UploaderID FROM Series WHERE SeriesID = ${seriesId}`;
        if (seriesCheck.recordset.length === 0) {
            return res.status(404).json({ error: "Series not found" });
        }
        if (req.user.RoleName !== "Admin" && seriesCheck.recordset[0].UploaderID !== req.user.UserID) {
            return res.status(403).json({ error: "You can only add chapters to your own series" });
        }
        let finalChapterNumber = chapterNumber;
        if (!finalChapterNumber) {
            const lastChapter = await (0, db_1.query) `SELECT MAX(ChapterNumber) as MaxChapter FROM Chapters WHERE SeriesID = ${seriesId}`;
            finalChapterNumber = (lastChapter.recordset[0]?.MaxChapter || 0) + 1;
        }
        const chapterResult = await (0, db_1.query) `
            INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, CreatedAt)
            OUTPUT INSERTED.ChapterID
            VALUES (${seriesId}, ${finalChapterNumber}, ${title}, ${content}, ${isFree ? 1 : 0}, GETDATE())
        `;
        res.status(201).json({ message: "Chapter added successfully", chapterId: chapterResult.recordset[0].ChapterID, chapterNumber: finalChapterNumber });
    }
    catch (e) {
        console.error("POST /stories/:seriesId/chapters error:", e);
        res.status(500).json({ error: "Failed to add chapter" });
    }
});
router.put("/stories/:seriesId/chapters/:chapterId", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["edit:own_content"]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const chapterId = Number(req.params.chapterId);
        const { title, content, chapterNumber, isFree } = req.body || {};
        if (!seriesId || !chapterId) {
            return res.status(400).json({ error: "Invalid series or chapter ID" });
        }
        const seriesCheck = await (0, db_1.query) `SELECT UploaderID FROM Series WHERE SeriesID = ${seriesId}`;
        if (seriesCheck.recordset.length === 0) {
            return res.status(404).json({ error: "Series not found" });
        }
        if (req.user.RoleName !== "Admin" && seriesCheck.recordset[0].UploaderID !== req.user.UserID) {
            return res.status(403).json({ error: "You can only edit chapters of your own series" });
        }
        if (title)
            await (0, db_1.query) `UPDATE Chapters SET Title = ${title} WHERE ChapterID = ${chapterId}`;
        if (content)
            await (0, db_1.query) `UPDATE Chapters SET Content = ${content} WHERE ChapterID = ${chapterId}`;
        if (chapterNumber)
            await (0, db_1.query) `UPDATE Chapters SET ChapterNumber = ${chapterNumber} WHERE ChapterID = ${chapterId}`;
        if (typeof isFree !== "undefined")
            await (0, db_1.query) `UPDATE Chapters SET IsFree = ${isFree ? 1 : 0} WHERE ChapterID = ${chapterId}`;
        res.json({ message: "Chapter updated successfully" });
    }
    catch (e) {
        console.error("PUT /stories/:seriesId/chapters/:chapterId error:", e);
        res.status(500).json({ error: "Failed to update chapter" });
    }
});
router.delete("/stories/:seriesId/chapters/:chapterId", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["delete:any_content"]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const chapterId = Number(req.params.chapterId);
        if (!seriesId || !chapterId) {
            return res.status(400).json({ error: "Invalid series or chapter ID" });
        }
        const seriesCheck = await (0, db_1.query) `SELECT UploaderID FROM Series WHERE SeriesID = ${seriesId}`;
        if (seriesCheck.recordset.length === 0) {
            return res.status(404).json({ error: "Series not found" });
        }
        if (req.user.RoleName !== "Admin" && seriesCheck.recordset[0].UploaderID !== req.user.UserID) {
            return res.status(403).json({ error: "You can only delete chapters of your own series" });
        }
        await (0, db_1.query) `DELETE FROM ChapterImages WHERE ChapterID = ${chapterId}`;
        await (0, db_1.query) `DELETE FROM Chapters WHERE ChapterID = ${chapterId}`;
        res.json({ message: "Chapter deleted successfully" });
    }
    catch (e) {
        console.error("DELETE /stories/:seriesId/chapters/:chapterId error:", e);
        res.status(500).json({ error: "Failed to delete chapter" });
    }
});
exports.default = router;
