"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../database/db");
const router = (0, express_1.Router)();
const inMemoryMovieHistory = new Map();
router.post("/history/movie", async (req, res) => {
    try {
        const { email, movieId, episodeId } = req.body || {};
        if (!movieId)
            return res.status(400).json({ error: "Missing movieId" });
        try {
            await (0, db_1.query) `UPDATE Movies SET ViewCount = ViewCount + 1 WHERE MovieID = ${Number(movieId)}`;
            if (episodeId) {
                await (0, db_1.query) `UPDATE MovieEpisodes SET ViewCount = ViewCount + 1 WHERE EpisodeID = ${Number(episodeId)}`;
            }
        }
        catch (viewCountError) {
            console.error("Error updating movie view count:", viewCountError);
        }
        if (!email) {
            return res.json({ ok: true, persisted: false, reason: "no_email" });
        }
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user) {
            const list = inMemoryMovieHistory.get(email) || [];
            list.unshift({ MovieID: Number(movieId), EpisodeID: episodeId ? Number(episodeId) : undefined, WatchedAt: new Date().toISOString() });
            inMemoryMovieHistory.set(email, list);
            return res.json({ ok: true, persisted: false, storage: "memory" });
        }
        const existingHistory = episodeId
            ? await (0, db_1.query) `SELECT TOP 1 HistoryID FROM MovieHistory WHERE UserID = ${user.UserID} AND MovieID = ${Number(movieId)} AND EpisodeID = ${Number(episodeId)}`
            : await (0, db_1.query) `SELECT TOP 1 HistoryID FROM MovieHistory WHERE UserID = ${user.UserID} AND MovieID = ${Number(movieId)} AND EpisodeID IS NULL`;
        if (existingHistory.recordset.length > 0) {
            await (0, db_1.query) `UPDATE MovieHistory SET WatchedAt = GETDATE() WHERE HistoryID = ${existingHistory.recordset[0].HistoryID}`;
            return res.json({ ok: true, updated: true });
        }
        await (0, db_1.query) `INSERT INTO MovieHistory (UserID, MovieID, EpisodeID, WatchedAt) VALUES (${user.UserID}, ${Number(movieId)}, ${episodeId ? Number(episodeId) : null}, GETDATE())`;
        return res.json({ ok: true, inserted: true });
    }
    catch (e) {
        console.error("POST /history/movie error:", e);
        return res.status(500).json({ error: "Failed to save history" });
    }
});
router.get("/history/movie", async (req, res) => {
    try {
        const email = req.query.email || "";
        const targetEmail = req.query.userEmail || email;
        if (!targetEmail)
            return res.status(400).json({ error: "Missing email" });
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
            SELECT TOP 200 h.HistoryID, h.MovieID, h.EpisodeID, h.WatchedAt, m.Title, m.Slug, me.EpisodeNumber
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
router.post("/history/series", async (req, res) => {
    try {
        const { email, seriesId, chapterId } = req.body || {};
        if (!seriesId)
            return res.status(400).json({ error: "Missing seriesId" });
        try {
            await (0, db_1.query) `UPDATE Series SET ViewCount = ViewCount + 1 WHERE SeriesID = ${Number(seriesId)}`;
            if (chapterId) {
                await (0, db_1.query) `UPDATE Chapters SET ViewCount = ViewCount + 1 WHERE ChapterID = ${Number(chapterId)}`;
            }
        }
        catch (viewCountError) {
            console.error("Error updating series view count:", viewCountError);
        }
        if (!email) {
            return res.json({ ok: true, persisted: false, reason: "no_email" });
        }
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user) {
            return res.json({ ok: true, persisted: false, reason: "user_not_found" });
        }
        const existingHistory = chapterId
            ? await (0, db_1.query) `SELECT TOP 1 HistoryID FROM SeriesHistory WHERE UserID = ${user.UserID} AND SeriesID = ${Number(seriesId)} AND ChapterID = ${Number(chapterId)}`
            : await (0, db_1.query) `SELECT TOP 1 HistoryID FROM SeriesHistory WHERE UserID = ${user.UserID} AND SeriesID = ${Number(seriesId)} AND ChapterID IS NULL`;
        if (existingHistory.recordset.length > 0) {
            await (0, db_1.query) `UPDATE SeriesHistory SET ReadAt = GETDATE() WHERE HistoryID = ${existingHistory.recordset[0].HistoryID}`;
            return res.json({ ok: true, updated: true });
        }
        await (0, db_1.query) `INSERT INTO SeriesHistory (UserID, SeriesID, ChapterID, ReadAt) VALUES (${user.UserID}, ${Number(seriesId)}, ${chapterId ? Number(chapterId) : null}, GETDATE())`;
        return res.json({ ok: true, inserted: true });
    }
    catch (e) {
        console.error("POST /history/series error:", e);
        return res.status(500).json({ error: "Failed to save history" });
    }
});
router.get("/history/series", async (req, res) => {
    try {
        const email = req.query.email || "";
        const targetEmail = req.query.userEmail || email;
        if (!targetEmail)
            return res.status(400).json({ error: "Missing email" });
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
            SELECT TOP 200 h.HistoryID, h.SeriesID, h.ChapterID, h.ReadAt, s.Title, s.Slug, c.ChapterNumber
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
exports.default = router;
