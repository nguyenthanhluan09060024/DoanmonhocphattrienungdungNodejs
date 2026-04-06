"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../database/db");
const authenticate_1 = require("../../middlewares/authenticate");
const authMiddleware_1 = require("../../middlewares/authMiddleware");
const crawlService_1 = require("../../services/crawlService");
const uploadFiles_1 = require("../../utils/uploadFiles");
const router = (0, express_1.Router)();
const creatorRoles = ["Admin", "Uploader", "Author", "Translator", "Reup"];
function toBoolean(value) {
    return value === true || value === "true" || value === 1 || value === "1";
}
function toNumberArray(value) {
    if (Array.isArray(value)) {
        return value.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
    }
    if (typeof value === "string") {
        return value.split(",").map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0);
    }
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? [numberValue] : [];
}
function parseStorageList(value) {
    const rawValues = Array.isArray(value) ? value : [value];
    const parsed = [];
    for (const rawValue of rawValues) {
        if (!rawValue) {
            continue;
        }
        if (Array.isArray(rawValue)) {
            parsed.push(...rawValue);
            continue;
        }
        if (typeof rawValue === "string") {
            const trimmed = rawValue.trim();
            if (!trimmed) {
                continue;
            }
            if (trimmed.startsWith("[")) {
                try {
                    const jsonValue = JSON.parse(trimmed);
                    if (Array.isArray(jsonValue)) {
                        parsed.push(...jsonValue);
                        continue;
                    }
                }
                catch (_error) {
                }
            }
            parsed.push(trimmed);
            continue;
        }
        parsed.push(rawValue);
    }
    return parsed
        .map((item) => (0, uploadFiles_1.normalizeStoragePath)(String(item || "")))
        .filter((item) => !!item);
}
async function hasColumn(tableName, columnName) {
    const result = await (0, db_1.query) `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ${tableName} AND COLUMN_NAME = ${columnName}
    `;
    return result.recordset.length > 0;
}
function simpleSlugify(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
async function buildStorySlug(title, seriesId) {
    const baseSlug = simpleSlugify(title) || `story-${Date.now()}`;
    let candidate = baseSlug;
    let attempt = 1;
    while (attempt <= 100) {
        const result = seriesId
            ? await (0, db_1.query) `SELECT COUNT(*) AS Total FROM Series WHERE Slug = ${candidate} AND SeriesID <> ${seriesId}`
            : await (0, db_1.query) `SELECT COUNT(*) AS Total FROM Series WHERE Slug = ${candidate}`;
        if (Number(result.recordset[0]?.Total || 0) === 0) {
            return candidate;
        }
        candidate = `${baseSlug}-${attempt}`;
        attempt += 1;
    }
    return `${baseSlug}-${Date.now()}`;
}
async function ensureStoryOwnership(seriesId, req) {
    const storyResult = await (0, db_1.query) `SELECT SeriesID, UploaderID, StoryType FROM Series WHERE SeriesID = ${seriesId}`;
    const story = storyResult.recordset[0];
    if (!story) {
        return { error: { status: 404, body: { error: "Story not found" } } };
    }
    if (req.user?.RoleName !== "Admin" && story.UploaderID !== req.user?.UserID) {
        return { error: { status: 403, body: { error: "You can only manage your own stories" } } };
    }
    return { story };
}
router.post("/admin/stories", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["create:content"]), uploadFiles_1.upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "contentFiles", maxCount: 50 },
    { name: "chapterImages", maxCount: 5000 },
]), async (req, res) => {
    try {
        const categoryIds = toNumberArray(req.body.categoryIds || req.body.categoryId);
        if (!req.body.title || !req.body.author || categoryIds.length === 0) {
            return res.status(400).json({ error: "Missing title, author, or category" });
        }
        const coverImage = req.files?.coverImage?.[0];
        const contentFiles = req.files?.contentFiles || [];
        const chapterImages = req.files?.chapterImages || [];
        const crawledImages = parseStorageList(req.body.crawledImages);
        const storyType = req.body.storyType === "Comic" ? "Comic" : "Text";
        const coverUrl = (0, uploadFiles_1.normalizeStoragePath)(req.body.coverLocal) || (coverImage ? `/storage/${coverImage.filename}` : null);
        if (!coverUrl) {
            return res.status(400).json({ error: "Cover image is required" });
        }
        if (storyType === "Text" && contentFiles.length === 0) {
            return res.status(400).json({ error: "Text stories require content files" });
        }
        if (storyType === "Comic" && chapterImages.length === 0 && crawledImages.length === 0) {
            return res.status(400).json({ error: "Comic stories require chapter images" });
        }
        const slug = await buildStorySlug(req.body.title);
        const storyInsert = await (0, db_1.query) `
            INSERT INTO Series (
              Title, Slug, Description, CoverURL, Author, IsFree, Status, StoryType,
              UploaderID, IsApproved, ApprovedBy, ApprovedAt, CreatedAt, UpdatedAt
            )
            OUTPUT INSERTED.SeriesID
            VALUES (
              ${req.body.title},
              ${slug},
              ${req.body.description || ""},
              ${coverUrl},
              ${req.body.author},
              ${toBoolean(req.body.isFree) ? 1 : 0},
              ${"Approved"},
              ${storyType},
              ${req.user?.UserID},
              1,
              ${req.user?.UserID},
              GETDATE(),
              GETDATE(),
              GETDATE()
            )
        `;
        const seriesId = storyInsert.recordset[0]?.SeriesID;
        for (const categoryId of categoryIds) {
            await (0, db_1.query) `INSERT INTO SeriesCategories (SeriesID, CategoryID) VALUES (${seriesId}, ${categoryId})`;
        }
        const hasChapterCode = await hasColumn("Chapters", "ChapterCode");
        let createdChapterId = null;
        if (storyType === "Text") {
            for (let index = 0; index < contentFiles.length; index += 1) {
                const file = contentFiles[index];
                const chapterNumber = index + 1;
                const chapterCode = `CH${seriesId}-${String(chapterNumber).padStart(3, "0")}`;
                if (hasChapterCode) {
                    await (0, db_1.query) `
                        INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, ChapterCode, CreatedAt)
                        VALUES (${seriesId}, ${chapterNumber}, ${`Chapter ${chapterNumber}`}, ${`/storage/${file.filename}`}, ${toBoolean(req.body.isFree) ? 1 : 0}, 0, ${chapterCode}, GETDATE())
                    `;
                }
                else {
                    await (0, db_1.query) `
                        INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
                        VALUES (${seriesId}, ${chapterNumber}, ${`Chapter ${chapterNumber}`}, ${`/storage/${file.filename}`}, ${toBoolean(req.body.isFree) ? 1 : 0}, 0, GETDATE())
                    `;
                }
            }
        }
        else {
            const normalizedChapterImages = crawledImages.length > 0
                ? crawledImages.map((imageUrl, index) => ({
                    ImageURL: imageUrl,
                    ImageOrder: index + 1,
                    FileSize: null,
                }))
                : chapterImages
                    .sort((a, b) => a.originalname.localeCompare(b.originalname))
                    .map((image, index) => ({
                    ImageURL: `/storage/${image.filename}`,
                    ImageOrder: index + 1,
                    FileSize: image.size,
                }));
            const chapterInsert = hasChapterCode
                ? await (0, db_1.query) `
                    INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, ChapterCode, CreatedAt)
                    OUTPUT INSERTED.ChapterID
                    VALUES (${seriesId}, 1, ${"Chapter 1"}, ${""}, ${toBoolean(req.body.isFree) ? 1 : 0}, ${normalizedChapterImages.length}, ${`CH${seriesId}-001`}, GETDATE())
                `
                : await (0, db_1.query) `
                    INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
                    OUTPUT INSERTED.ChapterID
                    VALUES (${seriesId}, 1, ${"Chapter 1"}, ${""}, ${toBoolean(req.body.isFree) ? 1 : 0}, ${normalizedChapterImages.length}, GETDATE())
                `;
            const chapterId = chapterInsert.recordset[0]?.ChapterID;
            createdChapterId = chapterId;
            for (let index = 0; index < normalizedChapterImages.length; index += 1) {
                const image = normalizedChapterImages[index];
                await (0, db_1.query) `
                    INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
                    VALUES (${chapterId}, ${image.ImageURL}, ${image.ImageOrder}, ${image.FileSize}, GETDATE())
                `;
            }
        }
        return res.status(201).json({
            success: true,
            seriesId,
            slug,
            chapterId: createdChapterId,
            chapterCount: storyType === "Text" ? contentFiles.length : (createdChapterId ? 1 : 0),
        });
    }
    catch (error) {
        console.error("POST /admin/stories error:", error);
        return res.status(500).json({ error: "Failed to create story" });
    }
});
router.put("/admin/stories/:id", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), uploadFiles_1.upload.fields([{ name: "coverImage", maxCount: 1 }]), async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        const currentStory = await (0, db_1.query) `SELECT CoverURL FROM Series WHERE SeriesID = ${seriesId}`;
        if (currentStory.recordset.length === 0) {
            return res.status(404).json({ error: "Story not found" });
        }
        if (req.body.title) {
            const slug = await buildStorySlug(req.body.title, seriesId);
            await (0, db_1.query) `UPDATE Series SET Title = ${req.body.title}, Slug = ${slug} WHERE SeriesID = ${seriesId}`;
        }
        if (typeof req.body.description !== "undefined") {
            await (0, db_1.query) `UPDATE Series SET Description = ${req.body.description} WHERE SeriesID = ${seriesId}`;
        }
        if (typeof req.body.author !== "undefined") {
            await (0, db_1.query) `UPDATE Series SET Author = ${req.body.author} WHERE SeriesID = ${seriesId}`;
        }
        if (typeof req.body.status !== "undefined") {
            await (0, db_1.query) `UPDATE Series SET Status = ${req.body.status} WHERE SeriesID = ${seriesId}`;
        }
        if (typeof req.body.isFree !== "undefined") {
            await (0, db_1.query) `UPDATE Series SET IsFree = ${toBoolean(req.body.isFree) ? 1 : 0} WHERE SeriesID = ${seriesId}`;
        }
        const coverFromCrawl = (0, uploadFiles_1.normalizeStoragePath)(req.body.coverLocal);
        const coverImage = req.files?.coverImage?.[0];
        if (coverFromCrawl) {
            await (0, db_1.query) `UPDATE Series SET CoverURL = ${coverFromCrawl} WHERE SeriesID = ${seriesId}`;
        }
        else if (coverImage) {
            await (0, db_1.query) `UPDATE Series SET CoverURL = ${`/storage/${coverImage.filename}`} WHERE SeriesID = ${seriesId}`;
            (0, uploadFiles_1.safeDeleteStoragePath)(currentStory.recordset[0]?.CoverURL);
        }
        if (typeof req.body.categoryIds !== "undefined") {
            const categoryIds = toNumberArray(req.body.categoryIds);
            await (0, db_1.query) `DELETE FROM SeriesCategories WHERE SeriesID = ${seriesId}`;
            for (const categoryId of categoryIds) {
                await (0, db_1.query) `INSERT INTO SeriesCategories (SeriesID, CategoryID) VALUES (${seriesId}, ${categoryId})`;
            }
        }
        await (0, db_1.query) `UPDATE Series SET UpdatedAt = GETDATE() WHERE SeriesID = ${seriesId}`;
        return res.json({ success: true });
    }
    catch (error) {
        console.error("PUT /admin/stories/:id error:", error);
        return res.status(500).json({ error: "Failed to update story" });
    }
});
router.put("/admin/stories/:seriesId/status", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const status = req.body?.status;
        if (!seriesId || !["Approved", "Pending", "Rejected"].includes(status)) {
            return res.status(400).json({ error: "Invalid story status" });
        }
        await (0, db_1.query) `UPDATE Series SET Status = ${status}, UpdatedAt = GETDATE() WHERE SeriesID = ${seriesId}`;
        if (status === "Approved") {
            await (0, db_1.query) `UPDATE Series SET IsApproved = 1, ApprovedBy = ${req.user?.UserID}, ApprovedAt = GETDATE() WHERE SeriesID = ${seriesId}`;
        }
        return res.json({ success: true });
    }
    catch (error) {
        console.error("PUT /admin/stories/:seriesId/status error:", error);
        return res.status(500).json({ error: "Failed to update story status" });
    }
});
router.delete("/admin/stories/:id", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["delete:any_content"]), async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        const storyResult = await (0, db_1.query) `SELECT CoverURL FROM Series WHERE SeriesID = ${seriesId}`;
        if (storyResult.recordset.length === 0) {
            return res.status(404).json({ error: "Story not found" });
        }
        const chapterImages = await (0, db_1.query) `
            SELECT ci.ImageURL
            FROM ChapterImages ci
            JOIN Chapters ch ON ci.ChapterID = ch.ChapterID
            WHERE ch.SeriesID = ${seriesId}
        `;
        await (0, db_1.query) `DELETE FROM SeriesHistory WHERE SeriesID = ${seriesId}`;
        await (0, db_1.query) `DELETE FROM SeriesComments WHERE SeriesID = ${seriesId}`;
        await (0, db_1.query) `DELETE FROM SeriesRatings WHERE SeriesID = ${seriesId}`;
        await (0, db_1.query) `DELETE FROM SeriesFavorites WHERE SeriesID = ${seriesId}`;
        await (0, db_1.query) `DELETE FROM ChapterImages WHERE ChapterID IN (SELECT ChapterID FROM Chapters WHERE SeriesID = ${seriesId})`;
        await (0, db_1.query) `DELETE FROM Chapters WHERE SeriesID = ${seriesId}`;
        await (0, db_1.query) `DELETE FROM SeriesCategories WHERE SeriesID = ${seriesId}`;
        await (0, db_1.query) `DELETE FROM Series WHERE SeriesID = ${seriesId}`;
        (0, uploadFiles_1.safeDeleteStoragePath)(storyResult.recordset[0]?.CoverURL);
        for (const row of chapterImages.recordset) {
            (0, uploadFiles_1.safeDeleteStoragePath)(row.ImageURL);
            (0, uploadFiles_1.deleteChapterFolderByImageUrl)(row.ImageURL);
        }
        return res.json({ success: true });
    }
    catch (error) {
        console.error("DELETE /admin/stories/:id error:", error);
        return res.status(500).json({ error: "Failed to delete story" });
    }
});
router.post("/admin/stories/:seriesId/chapters", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(creatorRoles), (0, authMiddleware_1.authorize)(["create:content"]), uploadFiles_1.upload.fields([
    { name: "contentFile", maxCount: 1 },
    { name: "chapterImages", maxCount: 500 },
]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const ownership = await ensureStoryOwnership(seriesId, req);
        if (ownership.error) {
            return res.status(ownership.error.status).json(ownership.error.body);
        }
        const contentFile = req.files?.contentFile?.[0];
        const chapterImages = req.files?.chapterImages || [];
        const storyType = ownership.story?.StoryType || req.body.storyType || "Text";
        if (storyType === "Text" && !contentFile) {
            return res.status(400).json({ error: "Content file is required" });
        }
        if (storyType === "Comic" && chapterImages.length === 0) {
            return res.status(400).json({ error: "Chapter images are required" });
        }
        let chapterNumber = Number(req.body.chapterNumber);
        if (!chapterNumber) {
            const maxChapter = await (0, db_1.query) `SELECT MAX(ChapterNumber) as MaxChapter FROM Chapters WHERE SeriesID = ${seriesId}`;
            chapterNumber = Number(maxChapter.recordset[0]?.MaxChapter || 0) + 1;
        }
        const hasChapterCode = await hasColumn("Chapters", "ChapterCode");
        const chapterCode = `CH${seriesId}-${String(chapterNumber).padStart(3, "0")}`;
        if (storyType === "Text") {
            if (hasChapterCode) {
                await (0, db_1.query) `
                    INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, ChapterCode, CreatedAt)
                    VALUES (${seriesId}, ${chapterNumber}, ${req.body.title || `Chapter ${chapterNumber}`}, ${`/storage/${contentFile.filename}`}, ${toBoolean(req.body.isFree) ? 1 : 0}, 0, ${chapterCode}, GETDATE())
                `;
            }
            else {
                await (0, db_1.query) `
                    INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
                    VALUES (${seriesId}, ${chapterNumber}, ${req.body.title || `Chapter ${chapterNumber}`}, ${`/storage/${contentFile.filename}`}, ${toBoolean(req.body.isFree) ? 1 : 0}, 0, GETDATE())
                `;
            }
        }
        else {
            const chapterInsert = hasChapterCode
                ? await (0, db_1.query) `
                    INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, ChapterCode, CreatedAt)
                    OUTPUT INSERTED.ChapterID
                    VALUES (${seriesId}, ${chapterNumber}, ${req.body.title || `Chapter ${chapterNumber}`}, ${""}, ${toBoolean(req.body.isFree) ? 1 : 0}, ${chapterImages.length}, ${chapterCode}, GETDATE())
                `
                : await (0, db_1.query) `
                    INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
                    OUTPUT INSERTED.ChapterID
                    VALUES (${seriesId}, ${chapterNumber}, ${req.body.title || `Chapter ${chapterNumber}`}, ${""}, ${toBoolean(req.body.isFree) ? 1 : 0}, ${chapterImages.length}, GETDATE())
                `;
            const chapterId = chapterInsert.recordset[0]?.ChapterID;
            const sortedImages = chapterImages.sort((a, b) => a.originalname.localeCompare(b.originalname));
            for (let index = 0; index < sortedImages.length; index += 1) {
                const image = sortedImages[index];
                await (0, db_1.query) `
                    INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
                    VALUES (${chapterId}, ${`/storage/${image.filename}`}, ${index + 1}, ${image.size}, GETDATE())
                `;
            }
        }
        return res.json({ success: true, chapterNumber });
    }
    catch (error) {
        console.error("POST /admin/stories/:seriesId/chapters error:", error);
        return res.status(500).json({ error: "Failed to add chapter" });
    }
});
router.put("/admin/chapters/:chapterId", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(creatorRoles), (0, authMiddleware_1.authorize)(["edit:any_content"]), uploadFiles_1.upload.fields([
    { name: "contentFile", maxCount: 1 },
    { name: "chapterImages", maxCount: 500 },
]), async (req, res) => {
    try {
        const chapterId = Number(req.params.chapterId);
        const currentChapter = await (0, db_1.query) `
            SELECT ch.ChapterID, ch.SeriesID, s.StoryType
            FROM Chapters ch
            JOIN Series s ON ch.SeriesID = s.SeriesID
            WHERE ch.ChapterID = ${chapterId}
        `;
        if (currentChapter.recordset.length === 0) {
            return res.status(404).json({ error: "Chapter not found" });
        }
        const chapter = currentChapter.recordset[0];
        const ownership = await ensureStoryOwnership(Number(chapter.SeriesID), req);
        if (ownership.error) {
            return res.status(ownership.error.status).json(ownership.error.body);
        }
        if (req.body.title) {
            await (0, db_1.query) `UPDATE Chapters SET Title = ${req.body.title} WHERE ChapterID = ${chapterId}`;
        }
        if (req.body.chapterNumber) {
            await (0, db_1.query) `UPDATE Chapters SET ChapterNumber = ${Number(req.body.chapterNumber)} WHERE ChapterID = ${chapterId}`;
        }
        if (typeof req.body.isFree !== "undefined") {
            await (0, db_1.query) `UPDATE Chapters SET IsFree = ${toBoolean(req.body.isFree) ? 1 : 0} WHERE ChapterID = ${chapterId}`;
        }
        if ((req.body.chapterCode || req.body.ChapterCode) && await hasColumn("Chapters", "ChapterCode")) {
            await (0, db_1.query) `UPDATE Chapters SET ChapterCode = ${req.body.chapterCode || req.body.ChapterCode} WHERE ChapterID = ${chapterId}`;
        }
        const contentFile = req.files?.contentFile?.[0];
        if (chapter.StoryType === "Text" && contentFile) {
            await (0, db_1.query) `UPDATE Chapters SET Content = ${`/storage/${contentFile.filename}`} WHERE ChapterID = ${chapterId}`;
        }
        const chapterImages = req.files?.chapterImages || [];
        if (chapter.StoryType === "Comic" && chapterImages.length > 0) {
            const oldImages = await (0, db_1.query) `SELECT ImageURL FROM ChapterImages WHERE ChapterID = ${chapterId}`;
            for (const row of oldImages.recordset) {
                (0, uploadFiles_1.safeDeleteStoragePath)(row.ImageURL);
                (0, uploadFiles_1.deleteChapterFolderByImageUrl)(row.ImageURL);
            }
            await (0, db_1.query) `DELETE FROM ChapterImages WHERE ChapterID = ${chapterId}`;
            const sortedImages = chapterImages.sort((a, b) => a.originalname.localeCompare(b.originalname));
            for (let index = 0; index < sortedImages.length; index += 1) {
                const image = sortedImages[index];
                await (0, db_1.query) `
                    INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
                    VALUES (${chapterId}, ${`/storage/${image.filename}`}, ${index + 1}, ${image.size}, GETDATE())
                `;
            }
            await (0, db_1.query) `UPDATE Chapters SET ImageCount = ${sortedImages.length} WHERE ChapterID = ${chapterId}`;
        }
        return res.json({ success: true });
    }
    catch (error) {
        console.error("PUT /admin/chapters/:chapterId error:", error);
        return res.status(500).json({ error: "Failed to update chapter" });
    }
});
router.delete("/admin/chapters/:chapterId", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(creatorRoles), (0, authMiddleware_1.authorize)(["delete:any_content"]), async (req, res) => {
    try {
        const chapterId = Number(req.params.chapterId);
        const currentChapter = await (0, db_1.query) `SELECT ChapterID, SeriesID FROM Chapters WHERE ChapterID = ${chapterId}`;
        if (currentChapter.recordset.length === 0) {
            return res.status(404).json({ error: "Chapter not found" });
        }
        const ownership = await ensureStoryOwnership(Number(currentChapter.recordset[0]?.SeriesID), req);
        if (ownership.error) {
            return res.status(ownership.error.status).json(ownership.error.body);
        }
        const images = await (0, db_1.query) `SELECT ImageURL FROM ChapterImages WHERE ChapterID = ${chapterId}`;
        await (0, db_1.query) `DELETE FROM SeriesHistory WHERE ChapterID = ${chapterId}`;
        await (0, db_1.query) `DELETE FROM ChapterImages WHERE ChapterID = ${chapterId}`;
        await (0, db_1.query) `DELETE FROM Chapters WHERE ChapterID = ${chapterId}`;
        for (const row of images.recordset) {
            (0, uploadFiles_1.safeDeleteStoragePath)(row.ImageURL);
            (0, uploadFiles_1.deleteChapterFolderByImageUrl)(row.ImageURL);
        }
        return res.json({ success: true });
    }
    catch (error) {
        console.error("DELETE /admin/chapters/:chapterId error:", error);
        return res.status(500).json({ error: "Failed to delete chapter" });
    }
});
router.post("/admin/stories/:seriesId/chapters/crawl", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(creatorRoles), (0, authMiddleware_1.authorize)(["create:content"]), async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const ownership = await ensureStoryOwnership(seriesId, req);
        if (ownership.error) {
            return res.status(ownership.error.status).json(ownership.error.body);
        }
        if (!req.body.chapterUrl) {
            return res.status(400).json({ error: "Missing chapterUrl" });
        }
        const result = await (0, crawlService_1.crawlChapterWithFallback)({
            url: req.body.chapterUrl,
            chapterUrl: req.body.chapterUrl,
            saveToDisk: true,
        });
        if (!result.savedImages || result.savedImages.length === 0) {
            return res.status(400).json({ error: "No chapter images crawled" });
        }
        let chapterNumber = Number(req.body.chapterNumber);
        if (!chapterNumber) {
            const maxChapter = await (0, db_1.query) `SELECT MAX(ChapterNumber) as MaxChapter FROM Chapters WHERE SeriesID = ${seriesId}`;
            chapterNumber = Number(maxChapter.recordset[0]?.MaxChapter || 0) + 1;
        }
        const hasChapterCode = await hasColumn("Chapters", "ChapterCode");
        const chapterCode = `CH${seriesId}-${String(chapterNumber).padStart(3, "0")}`;
        const chapterInsert = hasChapterCode
            ? await (0, db_1.query) `
                INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, ChapterCode, CreatedAt)
                OUTPUT INSERTED.ChapterID
                VALUES (${seriesId}, ${chapterNumber}, ${req.body.title || `Chapter ${chapterNumber}`}, ${""}, ${toBoolean(req.body.isFree) ? 1 : 0}, ${result.savedImages.length}, ${chapterCode}, GETDATE())
            `
            : await (0, db_1.query) `
                INSERT INTO Chapters (SeriesID, ChapterNumber, Title, Content, IsFree, ImageCount, CreatedAt)
                OUTPUT INSERTED.ChapterID
                VALUES (${seriesId}, ${chapterNumber}, ${req.body.title || `Chapter ${chapterNumber}`}, ${""}, ${toBoolean(req.body.isFree) ? 1 : 0}, ${result.savedImages.length}, GETDATE())
            `;
        const chapterId = chapterInsert.recordset[0]?.ChapterID;
        for (let index = 0; index < result.savedImages.length; index += 1) {
            await (0, db_1.query) `
                INSERT INTO ChapterImages (ChapterID, ImageURL, ImageOrder, FileSize, CreatedAt)
                VALUES (${chapterId}, ${result.savedImages[index]}, ${index + 1}, NULL, GETDATE())
            `;
        }
        return res.json({ success: true, chapterId, chapterNumber, imageCount: result.savedImages.length });
    }
    catch (error) {
        console.error("POST /admin/stories/:seriesId/chapters/crawl error:", error);
        return res.status(500).json({ error: "Failed to crawl chapter" });
    }
});
exports.default = router;
