"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../database/db");
const authenticate_1 = require("../../middlewares/authenticate");
const authMiddleware_1 = require("../../middlewares/authMiddleware");
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
async function buildMovieSlug(title, movieId) {
    const baseSlug = simpleSlugify(title) || `movie-${Date.now()}`;
    let candidate = baseSlug;
    let attempt = 1;
    while (attempt <= 100) {
        const result = movieId
            ? await (0, db_1.query) `SELECT COUNT(*) AS Total FROM Movies WHERE Slug = ${candidate} AND MovieID <> ${movieId}`
            : await (0, db_1.query) `SELECT COUNT(*) AS Total FROM Movies WHERE Slug = ${candidate}`;
        if (Number(result.recordset[0]?.Total || 0) === 0) {
            return candidate;
        }
        candidate = `${baseSlug}-${attempt}`;
        attempt += 1;
    }
    return `${baseSlug}-${Date.now()}`;
}
async function ensureMovieOwnership(movieId, req) {
    const movieResult = await (0, db_1.query) `SELECT MovieID, UploaderID FROM Movies WHERE MovieID = ${movieId}`;
    const movie = movieResult.recordset[0];
    if (!movie) {
        return { status: 404, body: { error: "Movie not found" } };
    }
    if (req.user?.RoleName !== "Admin" && movie.UploaderID !== req.user?.UserID) {
        return { status: 403, body: { error: "You can only manage your own movies" } };
    }
    return null;
}
router.post("/admin/movies", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["create:content"]), uploadFiles_1.upload.fields([
    { name: "episodeFiles", maxCount: 50 },
    { name: "coverImage", maxCount: 1 },
]), async (req, res) => {
    try {
        const episodeFiles = req.files?.episodeFiles || [];
        const coverImage = req.files?.coverImage?.[0];
        const categoryIds = toNumberArray(req.body.categoryIds || req.body.categoryId);
        const posterUrl = (0, uploadFiles_1.normalizeStoragePath)(req.body.posterLocal) || (coverImage ? `/storage/${coverImage.filename}` : null);
        if (!req.body.title || categoryIds.length === 0 || !posterUrl || episodeFiles.length === 0) {
            return res.status(400).json({ error: "Missing title, category, cover, or episode files" });
        }
        const slug = await buildMovieSlug(req.body.title);
        const movieInsert = await (0, db_1.query) `
            INSERT INTO Movies (
              Title, Slug, Description, PosterURL, ReleaseYear, Duration, Country, Director, Cast,
              Status, IsFree, ViewCount, Rating, UploaderID, IsApproved, ApprovedBy, ApprovedAt, CreatedAt, UpdatedAt
            )
            OUTPUT INSERTED.MovieID
            VALUES (
              ${req.body.title},
              ${slug},
              ${req.body.description || ""},
              ${posterUrl},
              ${Number(req.body.releaseYear) || null},
              ${Number(req.body.duration) || null},
              ${req.body.country || ""},
              ${req.body.director || ""},
              ${req.body.cast || ""},
              ${"Approved"},
              ${toBoolean(req.body.isFree) ? 1 : 0},
              0,
              0,
              ${req.user?.UserID},
              1,
              ${req.user?.UserID},
              GETDATE(),
              GETDATE(),
              GETDATE()
            )
        `;
        const movieId = movieInsert.recordset[0]?.MovieID;
        for (const categoryId of categoryIds) {
            await (0, db_1.query) `INSERT INTO MovieCategories (MovieID, CategoryID) VALUES (${movieId}, ${categoryId})`;
        }
        const episodesMeta = req.body.episodes ? JSON.parse(req.body.episodes) : [];
        const hasEpisodeCode = await hasColumn("MovieEpisodes", "EpisodeCode");
        for (let index = 0; index < episodeFiles.length; index += 1) {
            const file = episodeFiles[index];
            const episodeNumber = index + 1;
            const meta = Array.isArray(episodesMeta) ? episodesMeta.find((item) => Number(item?.episodeNumber) === episodeNumber || Number(item?.index) === index) : null;
            const episodeTitle = meta?.title || `Tap ${episodeNumber}`;
            const duration = Number(meta?.duration || req.body.duration || 120);
            const episodeCode = `EP${movieId}-${String(episodeNumber).padStart(3, "0")}`;
            if (hasEpisodeCode) {
                await (0, db_1.query) `
                    INSERT INTO MovieEpisodes (MovieID, EpisodeNumber, Title, VideoURL, Duration, EpisodeCode, IsFree, ViewCount, CreatedAt)
                    VALUES (${movieId}, ${episodeNumber}, ${episodeTitle}, ${`/uploads/${file.filename}`}, ${duration}, ${episodeCode}, ${toBoolean(req.body.isFree) ? 1 : 0}, 0, GETDATE())
                `;
            }
            else {
                await (0, db_1.query) `
                    INSERT INTO MovieEpisodes (MovieID, EpisodeNumber, Title, VideoURL, Duration, IsFree, ViewCount, CreatedAt)
                    VALUES (${movieId}, ${episodeNumber}, ${episodeTitle}, ${`/uploads/${file.filename}`}, ${duration}, ${toBoolean(req.body.isFree) ? 1 : 0}, 0, GETDATE())
                `;
            }
        }
        return res.status(201).json({ success: true, movieId, slug });
    }
    catch (error) {
        console.error("POST /admin/movies error:", error);
        return res.status(500).json({ error: "Failed to create movie" });
    }
});
router.put("/admin/movies/:id", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), uploadFiles_1.upload.fields([
    { name: "videoFile", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
]), async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const currentMovie = await (0, db_1.query) `SELECT PosterURL, TrailerURL FROM Movies WHERE MovieID = ${movieId}`;
        if (currentMovie.recordset.length === 0) {
            return res.status(404).json({ error: "Movie not found" });
        }
        if (req.body.title) {
            const slug = await buildMovieSlug(req.body.title, movieId);
            await (0, db_1.query) `UPDATE Movies SET Title = ${req.body.title}, Slug = ${slug}, UpdatedAt = GETDATE() WHERE MovieID = ${movieId}`;
        }
        if (typeof req.body.description !== "undefined") {
            await (0, db_1.query) `UPDATE Movies SET Description = ${req.body.description} WHERE MovieID = ${movieId}`;
        }
        if (typeof req.body.status !== "undefined") {
            await (0, db_1.query) `UPDATE Movies SET Status = ${req.body.status}, UpdatedAt = GETDATE() WHERE MovieID = ${movieId}`;
        }
        if (typeof req.body.isFree !== "undefined") {
            await (0, db_1.query) `UPDATE Movies SET IsFree = ${toBoolean(req.body.isFree) ? 1 : 0} WHERE MovieID = ${movieId}`;
        }
        const coverImage = req.files?.coverImage?.[0];
        if (coverImage) {
            await (0, db_1.query) `UPDATE Movies SET PosterURL = ${`/storage/${coverImage.filename}`} WHERE MovieID = ${movieId}`;
            (0, uploadFiles_1.safeDeleteStoragePath)(currentMovie.recordset[0]?.PosterURL);
        }
        const videoFile = req.files?.videoFile?.[0];
        if (videoFile) {
            await (0, db_1.query) `UPDATE Movies SET TrailerURL = ${`/storage/${videoFile.filename}`} WHERE MovieID = ${movieId}`;
            (0, uploadFiles_1.safeDeleteStoragePath)(currentMovie.recordset[0]?.TrailerURL);
        }
        if (typeof req.body.categoryIds !== "undefined") {
            const categoryIds = toNumberArray(req.body.categoryIds);
            await (0, db_1.query) `DELETE FROM MovieCategories WHERE MovieID = ${movieId}`;
            for (const categoryId of categoryIds) {
                await (0, db_1.query) `INSERT INTO MovieCategories (MovieID, CategoryID) VALUES (${movieId}, ${categoryId})`;
            }
        }
        return res.json({ ok: true });
    }
    catch (error) {
        console.error("PUT /admin/movies/:id error:", error);
        return res.status(500).json({ error: "Failed to update movie" });
    }
});
router.put("/admin/movies/:id/status", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const status = req.body?.status;
        if (!movieId || !["Approved", "Rejected", "Pending"].includes(status)) {
            return res.status(400).json({ error: "Invalid movie status" });
        }
        await (0, db_1.query) `UPDATE Movies SET Status = ${status}, UpdatedAt = GETDATE() WHERE MovieID = ${movieId}`;
        return res.json({ ok: true });
    }
    catch (error) {
        console.error("PUT /admin/movies/:id/status error:", error);
        return res.status(500).json({ error: "Failed to update movie status" });
    }
});
router.delete("/admin/movies/:id", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["delete:any_content"]), async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const movieResult = await (0, db_1.query) `SELECT PosterURL, TrailerURL FROM Movies WHERE MovieID = ${movieId}`;
        if (movieResult.recordset.length === 0) {
            return res.status(404).json({ error: "Movie not found" });
        }
        const episodes = await (0, db_1.query) `SELECT VideoURL FROM MovieEpisodes WHERE MovieID = ${movieId}`;
        await (0, db_1.query) `DELETE FROM MovieComments WHERE MovieID = ${movieId}`;
        await (0, db_1.query) `DELETE FROM MovieRatings WHERE MovieID = ${movieId}`;
        await (0, db_1.query) `DELETE FROM MovieFavorites WHERE MovieID = ${movieId}`;
        await (0, db_1.query) `DELETE FROM MovieHistory WHERE MovieID = ${movieId}`;
        await (0, db_1.query) `DELETE FROM MovieCategories WHERE MovieID = ${movieId}`;
        await (0, db_1.query) `DELETE FROM MovieEpisodes WHERE MovieID = ${movieId}`;
        await (0, db_1.query) `DELETE FROM Movies WHERE MovieID = ${movieId}`;
        (0, uploadFiles_1.safeDeleteStoragePath)(movieResult.recordset[0]?.PosterURL);
        (0, uploadFiles_1.safeDeleteStoragePath)(movieResult.recordset[0]?.TrailerURL);
        for (const episode of episodes.recordset) {
            (0, uploadFiles_1.safeDeleteStoragePath)(episode.VideoURL);
        }
        return res.json({ ok: true });
    }
    catch (error) {
        console.error("DELETE /admin/movies/:id error:", error);
        return res.status(500).json({ error: "Failed to delete movie" });
    }
});
router.post("/admin/movies/:movieId/episodes", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(creatorRoles), (0, authMiddleware_1.authorize)(["create:content"]), uploadFiles_1.upload.fields([{ name: "videoFile", maxCount: 1 }]), async (req, res) => {
    try {
        const movieId = Number(req.params.movieId);
        const ownershipError = await ensureMovieOwnership(movieId, req);
        if (ownershipError) {
            return res.status(ownershipError.status).json(ownershipError.body);
        }
        const videoFile = req.files?.videoFile?.[0];
        if (!videoFile) {
            return res.status(400).json({ error: "Video file is required" });
        }
        let episodeNumber = Number(req.body.episodeNumber);
        if (!episodeNumber) {
            const maxEpisode = await (0, db_1.query) `SELECT MAX(EpisodeNumber) as MaxEpisode FROM MovieEpisodes WHERE MovieID = ${movieId}`;
            episodeNumber = Number(maxEpisode.recordset[0]?.MaxEpisode || 0) + 1;
        }
        const episodeTitle = req.body.title || `Tap ${episodeNumber}`;
        const duration = Number(req.body.duration || 120);
        const hasEpisodeCode = await hasColumn("MovieEpisodes", "EpisodeCode");
        const episodeCode = `EP${movieId}-${String(episodeNumber).padStart(3, "0")}`;
        if (hasEpisodeCode) {
            await (0, db_1.query) `
                INSERT INTO MovieEpisodes (MovieID, EpisodeNumber, Title, VideoURL, Duration, EpisodeCode, IsFree, ViewCount, CreatedAt)
                VALUES (${movieId}, ${episodeNumber}, ${episodeTitle}, ${`/uploads/${videoFile.filename}`}, ${duration}, ${episodeCode}, ${toBoolean(req.body.isFree) ? 1 : 0}, 0, GETDATE())
            `;
        }
        else {
            await (0, db_1.query) `
                INSERT INTO MovieEpisodes (MovieID, EpisodeNumber, Title, VideoURL, Duration, IsFree, ViewCount, CreatedAt)
                VALUES (${movieId}, ${episodeNumber}, ${episodeTitle}, ${`/uploads/${videoFile.filename}`}, ${duration}, ${toBoolean(req.body.isFree) ? 1 : 0}, 0, GETDATE())
            `;
        }
        return res.json({ success: true, episodeCode });
    }
    catch (error) {
        console.error("POST /admin/movies/:movieId/episodes error:", error);
        return res.status(500).json({ error: "Failed to add episode" });
    }
});
router.put("/admin/episodes/:episodeId", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(creatorRoles), (0, authMiddleware_1.authorize)(["edit:any_content"]), uploadFiles_1.upload.fields([{ name: "videoFile", maxCount: 1 }]), async (req, res) => {
    try {
        const episodeId = Number(req.params.episodeId);
        const currentEpisode = await (0, db_1.query) `SELECT * FROM MovieEpisodes WHERE EpisodeID = ${episodeId}`;
        if (currentEpisode.recordset.length === 0) {
            return res.status(404).json({ error: "Episode not found" });
        }
        const episode = currentEpisode.recordset[0];
        const ownershipError = await ensureMovieOwnership(Number(episode.MovieID), req);
        if (ownershipError) {
            return res.status(ownershipError.status).json(ownershipError.body);
        }
        if (req.body.title) {
            await (0, db_1.query) `UPDATE MovieEpisodes SET Title = ${req.body.title} WHERE EpisodeID = ${episodeId}`;
        }
        if (req.body.duration) {
            await (0, db_1.query) `UPDATE MovieEpisodes SET Duration = ${Number(req.body.duration)} WHERE EpisodeID = ${episodeId}`;
        }
        if (typeof req.body.isFree !== "undefined") {
            await (0, db_1.query) `UPDATE MovieEpisodes SET IsFree = ${toBoolean(req.body.isFree) ? 1 : 0} WHERE EpisodeID = ${episodeId}`;
        }
        if (req.body.episodeNumber) {
            await (0, db_1.query) `UPDATE MovieEpisodes SET EpisodeNumber = ${Number(req.body.episodeNumber)} WHERE EpisodeID = ${episodeId}`;
        }
        if ((req.body.episodeCode || req.body.EpisodeCode) && await hasColumn("MovieEpisodes", "EpisodeCode")) {
            await (0, db_1.query) `UPDATE MovieEpisodes SET EpisodeCode = ${req.body.episodeCode || req.body.EpisodeCode} WHERE EpisodeID = ${episodeId}`;
        }
        const videoFile = req.files?.videoFile?.[0];
        if (videoFile) {
            await (0, db_1.query) `UPDATE MovieEpisodes SET VideoURL = ${`/uploads/${videoFile.filename}`} WHERE EpisodeID = ${episodeId}`;
            (0, uploadFiles_1.safeDeleteStoragePath)(episode.VideoURL);
        }
        return res.json({ success: true });
    }
    catch (error) {
        console.error("PUT /admin/episodes/:episodeId error:", error);
        return res.status(500).json({ error: "Failed to update episode" });
    }
});
router.delete("/admin/episodes/:episodeId", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(creatorRoles), (0, authMiddleware_1.authorize)(["delete:any_content"]), async (req, res) => {
    try {
        const episodeId = Number(req.params.episodeId);
        const currentEpisode = await (0, db_1.query) `SELECT * FROM MovieEpisodes WHERE EpisodeID = ${episodeId}`;
        if (currentEpisode.recordset.length === 0) {
            return res.status(404).json({ error: "Episode not found" });
        }
        const episode = currentEpisode.recordset[0];
        const ownershipError = await ensureMovieOwnership(Number(episode.MovieID), req);
        if (ownershipError) {
            return res.status(ownershipError.status).json(ownershipError.body);
        }
        await (0, db_1.query) `DELETE FROM MovieEpisodes WHERE EpisodeID = ${episodeId}`;
        (0, uploadFiles_1.safeDeleteStoragePath)(episode.VideoURL);
        return res.json({ success: true });
    }
    catch (error) {
        console.error("DELETE /admin/episodes/:episodeId error:", error);
        return res.status(500).json({ error: "Failed to delete episode" });
    }
});
exports.default = router;
