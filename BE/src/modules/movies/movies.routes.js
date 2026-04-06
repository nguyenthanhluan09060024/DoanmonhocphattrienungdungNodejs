"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../database/db");
const authenticate_1 = require("../../middlewares/authenticate");
const authMiddleware_1 = require("../../middlewares/authMiddleware");
const router = (0, express_1.Router)();
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
        console.error("GET /movies error:", e);
        res.status(500).json({ error: "Failed to fetch movies" });
    }
});
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
        console.error("GET /movies/debug error:", e);
        res.status(500).json({ error: "Failed to fetch movies" });
    }
});
router.get("/movies/search", async (req, res) => {
    try {
        const { q, category, year, rating, limit = 20 } = req.query;
        const parsedLimit = Number(limit);
        const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
            ? Math.min(Math.floor(parsedLimit), 100)
            : 20;
        let whereClause = "WHERE 1=1";
        if (q)
            whereClause += ` AND Title LIKE '%${q}%'`;
        if (category)
            whereClause += ` AND MovieID IN (SELECT MovieID FROM MovieCategories WHERE CategoryID = ${category})`;
        if (year)
            whereClause += ` AND ReleaseYear = ${year}`;
        if (rating)
            whereClause += ` AND Rating >= ${rating}`;
        const pool = await (0, db_1.getPool)();
        const movies = await pool.request().query(`
            SELECT TOP (${safeLimit})
              MovieID, Title, Slug, PosterURL, Rating, ViewCount, ReleaseYear, Duration
            FROM Movies
            ${whereClause}
            ORDER BY CreatedAt DESC
        `);
        res.json(movies.recordset);
    }
    catch (e) {
        console.error("GET /movies/search error:", e);
        res.status(500).json({ error: "Failed to search movies" });
    }
});
router.get("/admin/stats/movies/engagement", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), async (req, res) => {
    try {
        const parsedLimit = Number(req.query.limit ?? 100);
        const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
            ? Math.min(Math.floor(parsedLimit), 500)
            : 100;
        const pool = await (0, db_1.getPool)();
        const sql = `
            SELECT TOP (${limit})
              m.MovieID,
              m.Title,
              m.Slug,
              m.PosterURL,
              ISNULL(v.totalViews, 0) AS totalViews,
              ISNULL(f.totalLikes, 0) AS totalLikes,
              ISNULL(c.totalComments, 0) AS totalComments,
              ISNULL(r.totalRatings, 0) AS totalRatings
            FROM Movies m
            LEFT JOIN (
              SELECT MovieID, COUNT(*) AS totalViews
              FROM MovieHistory
              GROUP BY MovieID
            ) v ON v.MovieID = m.MovieID
            LEFT JOIN (
              SELECT MovieID, COUNT(*) AS totalLikes
              FROM MovieFavorites
              GROUP BY MovieID
            ) f ON f.MovieID = m.MovieID
            LEFT JOIN (
              SELECT MovieID, COUNT(*) AS totalComments
              FROM MovieComments
              GROUP BY MovieID
            ) c ON c.MovieID = m.MovieID
            LEFT JOIN (
              SELECT MovieID, COUNT(*) AS totalRatings
              FROM MovieRatings
              GROUP BY MovieID
            ) r ON r.MovieID = m.MovieID
            WHERE m.Status = 'Approved'
            ORDER BY
              (ISNULL(v.totalViews, 0) + ISNULL(c.totalComments, 0) * 3 + ISNULL(f.totalLikes, 0) * 2 + ISNULL(r.totalRatings, 0) * 2) DESC,
              ISNULL(v.totalViews, 0) DESC,
              m.MovieID DESC
        `;
        const rows = await pool.request().query(sql);
        res.json(rows.recordset);
    }
    catch (e) {
        console.error("GET /admin/stats/movies/engagement error:", e);
        res.status(500).json({ error: "Failed to load movie engagement stats" });
    }
});
router.get("/admin/stats/movies/:movieId/details", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), async (req, res) => {
    try {
        const movieId = Number(req.params.movieId);
        const metric = String(req.query.metric || "views");
        const parsedLimit = Number(req.query.limit ?? 30);
        const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
            ? Math.min(Math.floor(parsedLimit), 100)
            : 30;
        if (!movieId) {
            return res.status(400).json({ error: "Invalid movie ID" });
        }
        const pool = await (0, db_1.getPool)();
        const movieResult = await (0, db_1.query) `SELECT TOP 1 Title FROM Movies WHERE MovieID = ${movieId}`;
        const movieTitle = movieResult.recordset[0]?.Title || `Movie #${movieId}`;
        let items = [];
        if (metric === "likes") {
            const likes = await pool.request().query(`
                SELECT TOP (${limit})
                  u.UserID,
                  u.Username,
                  u.Email
                FROM MovieFavorites mf
                JOIN Users u ON u.UserID = mf.UserID
                WHERE mf.MovieID = ${movieId}
                ORDER BY u.Username ASC
            `);
            items = likes.recordset;
        }
        else if (metric === "comments") {
            const comments = await pool.request().query(`
                SELECT TOP (${limit})
                  mc.CommentID,
                  u.Username,
                  mc.Content,
                  mc.CreatedAt
                FROM MovieComments mc
                JOIN Users u ON u.UserID = mc.UserID
                WHERE mc.MovieID = ${movieId}
                ORDER BY mc.CreatedAt DESC
            `);
            items = comments.recordset;
        }
        else if (metric === "ratings") {
            const ratings = await pool.request().query(`
                SELECT TOP (${limit})
                  mr.RatingID,
                  u.Username,
                  mr.Rating,
                  mr.CreatedAt
                FROM MovieRatings mr
                JOIN Users u ON u.UserID = mr.UserID
                WHERE mr.MovieID = ${movieId}
                ORDER BY mr.CreatedAt DESC
            `);
            items = ratings.recordset;
        }
        else {
            const views = await pool.request().query(`
                SELECT TOP (${limit})
                  mh.HistoryID,
                  u.Username,
                  me.EpisodeNumber,
                  me.Title AS EpisodeTitle,
                  mh.WatchedAt
                FROM MovieHistory mh
                JOIN Users u ON u.UserID = mh.UserID
                LEFT JOIN MovieEpisodes me ON me.EpisodeID = mh.EpisodeID
                WHERE mh.MovieID = ${movieId}
                ORDER BY mh.WatchedAt DESC
            `);
            items = views.recordset;
        }
        res.json({
            movieId,
            title: movieTitle,
            metric,
            items,
        });
    }
    catch (e) {
        console.error("GET /admin/stats/movies/:movieId/details error:", e);
        res.status(500).json({ error: "Failed to load movie metric details" });
    }
});
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
        console.error("GET /movies/:slug error:", e);
        return res.status(500).json({ error: "Failed to fetch movie" });
    }
});
router.get("/movies/:slug/episodes", async (req, res) => {
    try {
        const slug = req.params.slug;
        const movieRes = await (0, db_1.query) `SELECT TOP 1 MovieID FROM dbo.Movies WHERE Slug = ${slug}`;
        const movie = movieRes.recordset[0];
        if (!movie)
            return res.status(404).json({ error: "Movie not found" });
        const checkColumn = await (0, db_1.query) `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'MovieEpisodes' AND COLUMN_NAME = 'EpisodeCode'
        `;
        const hasEpisodeCode = checkColumn.recordset.length > 0;
        const rows = hasEpisodeCode
            ? await (0, db_1.query) `
                SELECT EpisodeID, EpisodeNumber, Title, VideoURL, Duration, EpisodeCode, IsFree, ViewCount, CreatedAt
                FROM dbo.MovieEpisodes
                WHERE MovieID = ${movie.MovieID}
                ORDER BY EpisodeNumber ASC
            `
            : await (0, db_1.query) `
                SELECT EpisodeID, EpisodeNumber, Title, VideoURL, Duration, IsFree, ViewCount, CreatedAt
                FROM dbo.MovieEpisodes
                WHERE MovieID = ${movie.MovieID}
                ORDER BY EpisodeNumber ASC
            `;
        return res.json(rows.recordset);
    }
    catch (e) {
        console.error("GET /movies/:slug/episodes error:", e);
        return res.status(500).json({ error: "Failed to fetch episodes" });
    }
});
router.get("/admin/movies", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (_req, res) => {
    try {
        const rows = await (0, db_1.query) `
            SELECT TOP 200
              m.MovieID, m.Title, m.Slug, m.PosterURL, m.Status, m.IsFree, m.ViewCount, m.Rating, m.CreatedAt,
              u.FullName as UploaderName, u.Username as UploaderUsername, u.Email as UploaderEmail,
              r.RoleName as UploaderRole
            FROM Movies m
            LEFT JOIN Users u ON m.UploaderID = u.UserID
            LEFT JOIN Roles r ON u.RoleID = r.RoleID
            ORDER BY m.CreatedAt DESC
        `;
        res.json(rows.recordset);
    }
    catch (e) {
        console.error("GET /admin/movies error:", e);
        res.status(500).json({ error: "Failed to load movies" });
    }
});
router.get("/user/movies", authenticate_1.authenticate, (0, authMiddleware_1.authorize)(["read:content"]), async (req, res) => {
    try {
        const rows = await (0, db_1.query) `
            SELECT TOP 200
              m.MovieID, m.Title, m.Slug, m.PosterURL, m.Status, m.IsFree, m.ViewCount, m.Rating, m.CreatedAt
            FROM Movies m
            WHERE m.UploaderID = ${req.user.UserID}
            ORDER BY m.CreatedAt DESC
        `;
        res.json(rows.recordset);
    }
    catch (e) {
        console.error("GET /user/movies error:", e);
        res.status(500).json({ error: "Failed to load movies" });
    }
});
router.get("/admin/movies/:movieId/episodes", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin", "Uploader", "Author", "Translator", "Reup"]), (0, authMiddleware_1.authorize)(["read:content"]), async (req, res) => {
    try {
        const movieId = Number(req.params.movieId);
        const checkColumn = await (0, db_1.query) `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'MovieEpisodes' AND COLUMN_NAME = 'EpisodeCode'
        `;
        const hasEpisodeCode = checkColumn.recordset.length > 0;
        const rows = hasEpisodeCode
            ? await (0, db_1.query) `
                SELECT EpisodeID, EpisodeNumber, Title, VideoURL, Duration, EpisodeCode, IsFree, ViewCount, CreatedAt
                FROM dbo.MovieEpisodes
                WHERE MovieID = ${movieId}
                ORDER BY EpisodeNumber ASC
            `
            : await (0, db_1.query) `
                SELECT EpisodeID, EpisodeNumber, Title, VideoURL, Duration, IsFree, ViewCount, CreatedAt
                FROM dbo.MovieEpisodes
                WHERE MovieID = ${movieId}
                ORDER BY EpisodeNumber ASC
            `;
        res.json(rows.recordset);
    }
    catch (e) {
        console.error("GET /admin/movies/:movieId/episodes error:", e);
        res.status(500).json({ error: "Failed to fetch episodes" });
    }
});
exports.default = router;
