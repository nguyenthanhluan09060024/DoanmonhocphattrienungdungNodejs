"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../database/db");
const authenticate_1 = require("../../middlewares/authenticate");
const authMiddleware_1 = require("../../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.get("/movies/:id/comments", async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        if (!movieId)
            return res.status(400).json({ error: "Invalid movie ID" });
        const comments = await (0, db_1.query) `
            SELECT mc.CommentID, mc.Content, mc.CreatedAt, mc.ParentCommentID, mc.IsDeleted,
                   u.Username, u.Avatar, u.Email, r.RoleName,
                   ISNULL(likeCount.LikeCount, 0) as LikeCount,
                   ISNULL(dislikeCount.DislikeCount, 0) as DislikeCount,
                   userReaction.ReactionType as UserReaction,
                   CAST(CASE WHEN ue.TotalExp IS NULL THEN 1 ELSE FLOOR(ue.TotalExp / 100) + 1 END AS INT) as Level
            FROM MovieComments mc
            INNER JOIN Users u ON mc.UserID = u.UserID
            INNER JOIN Roles r ON u.RoleID = r.RoleID
            LEFT JOIN UserExp ue ON u.UserID = ue.UserID
            LEFT JOIN (SELECT CommentID, COUNT(*) as LikeCount FROM MovieCommentReactions WHERE ReactionType = 'Like' GROUP BY CommentID) likeCount ON mc.CommentID = likeCount.CommentID
            LEFT JOIN (SELECT CommentID, COUNT(*) as DislikeCount FROM MovieCommentReactions WHERE ReactionType = 'Dislike' GROUP BY CommentID) dislikeCount ON mc.CommentID = dislikeCount.CommentID
            LEFT JOIN (SELECT CommentID, ReactionType FROM MovieCommentReactions WHERE UserID = ${req.user?.id || 0}) userReaction ON mc.CommentID = userReaction.CommentID
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
router.post("/movies/:id/comments", authenticate_1.authenticate, async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const { content, parentCommentId } = req.body || {};
        if (!movieId || !content)
            return res.status(400).json({ error: "Missing movie ID or content" });
        await (0, db_1.query) `INSERT INTO MovieComments (UserID, MovieID, ParentCommentID, Content, CreatedAt) VALUES (${Number(req.user.id)}, ${movieId}, ${parentCommentId || null}, ${content}, GETDATE())`;
        res.json({ message: "Comment added successfully" });
    }
    catch (e) {
        console.error("POST /movies/:id/comments error:", e);
        res.status(500).json({ error: "Failed to add comment" });
    }
});
router.put("/movies/:id/comments/:commentId", authenticate_1.authenticate, async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const commentId = Number(req.params.commentId);
        const { content } = req.body || {};
        if (!movieId || !commentId || !content)
            return res.status(400).json({ error: "Missing required fields" });
        const comment = await (0, db_1.query) `SELECT UserID FROM MovieComments WHERE CommentID = ${commentId} AND MovieID = ${movieId}`;
        if (comment.recordset.length === 0)
            return res.status(404).json({ error: "Comment not found" });
        if (comment.recordset[0].UserID !== Number(req.user.id))
            return res.status(403).json({ error: "Not authorized to edit this comment" });
        await (0, db_1.query) `UPDATE MovieComments SET Content = ${content}, UpdatedAt = GETDATE() WHERE CommentID = ${commentId}`;
        res.json({ message: "Comment updated successfully" });
    }
    catch (e) {
        console.error("PUT /movies/:id/comments/:commentId error:", e);
        res.status(500).json({ error: "Failed to update comment" });
    }
});
router.delete("/movies/:id/comments/:commentId", authenticate_1.authenticate, async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const commentId = Number(req.params.commentId);
        if (!movieId || !commentId)
            return res.status(400).json({ error: "Missing required fields" });
        const comment = await (0, db_1.query) `SELECT UserID FROM MovieComments WHERE CommentID = ${commentId} AND MovieID = ${movieId}`;
        if (comment.recordset.length === 0)
            return res.status(404).json({ error: "Comment not found" });
        if (comment.recordset[0].UserID !== Number(req.user.id) && req.user.role !== "Admin")
            return res.status(403).json({ error: "Not authorized to delete this comment" });
        await (0, db_1.query) `DELETE FROM MovieCommentReactions WHERE CommentID IN (SELECT CommentID FROM MovieComments WHERE CommentID = ${commentId} UNION ALL SELECT CommentID FROM MovieComments WHERE ParentCommentID = ${commentId})`;
        await (0, db_1.query) `DELETE FROM MovieComments WHERE ParentCommentID = ${commentId}`;
        await (0, db_1.query) `DELETE FROM MovieComments WHERE CommentID = ${commentId}`;
        res.json({ message: "Comment deleted successfully" });
    }
    catch (e) {
        console.error("DELETE /movies/:id/comments/:commentId error:", e);
        res.status(500).json({ error: "Failed to delete comment" });
    }
});
router.post("/movies/:id/comments/:commentId/reaction", authenticate_1.authenticate, async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const commentId = Number(req.params.commentId);
        const { reactionType } = req.body || {};
        if (!movieId || !commentId || !reactionType)
            return res.status(400).json({ error: "Missing required fields" });
        if (!["Like", "Dislike"].includes(reactionType))
            return res.status(400).json({ error: "Invalid reaction type" });
        const comment = await (0, db_1.query) `SELECT CommentID FROM MovieComments WHERE CommentID = ${commentId} AND MovieID = ${movieId} AND IsDeleted = 0`;
        if (comment.recordset.length === 0)
            return res.status(404).json({ error: "Comment not found" });
        await (0, db_1.query) `DELETE FROM MovieCommentReactions WHERE CommentID = ${commentId} AND UserID = ${Number(req.user.id)}`;
        await (0, db_1.query) `INSERT INTO MovieCommentReactions (CommentID, UserID, ReactionType, CreatedAt) VALUES (${commentId}, ${Number(req.user.id)}, ${reactionType}, GETDATE())`;
        res.json({ message: "Reaction updated successfully" });
    }
    catch (e) {
        console.error("POST /movies/:id/comments/:commentId/reaction error:", e);
        res.status(500).json({ error: "Failed to update reaction" });
    }
});
router.get("/stories/:id/comments", async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        if (!seriesId)
            return res.status(400).json({ error: "Invalid series ID" });
        const comments = await (0, db_1.query) `
            SELECT sc.CommentID, sc.Content, sc.CreatedAt, sc.ParentCommentID, sc.IsDeleted,
                   u.Username, u.Avatar, u.Email, r.RoleName,
                   ISNULL(likeCount.LikeCount, 0) as LikeCount,
                   ISNULL(dislikeCount.DislikeCount, 0) as DislikeCount,
                   userReaction.ReactionType as UserReaction,
                   CAST(CASE WHEN ue.TotalExp IS NULL THEN 1 ELSE FLOOR(ue.TotalExp / 100) + 1 END AS INT) as Level
            FROM SeriesComments sc
            INNER JOIN Users u ON sc.UserID = u.UserID
            INNER JOIN Roles r ON u.RoleID = r.RoleID
            LEFT JOIN UserExp ue ON u.UserID = ue.UserID
            LEFT JOIN (SELECT CommentID, COUNT(*) as LikeCount FROM SeriesCommentReactions WHERE ReactionType = 'Like' GROUP BY CommentID) likeCount ON sc.CommentID = likeCount.CommentID
            LEFT JOIN (SELECT CommentID, COUNT(*) as DislikeCount FROM SeriesCommentReactions WHERE ReactionType = 'Dislike' GROUP BY CommentID) dislikeCount ON sc.CommentID = dislikeCount.CommentID
            LEFT JOIN (SELECT CommentID, ReactionType FROM SeriesCommentReactions WHERE UserID = ${req.user?.id || 0}) userReaction ON sc.CommentID = userReaction.CommentID
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
router.post("/stories/:id/comments", authenticate_1.authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        const { content, parentCommentId } = req.body || {};
        if (!seriesId || !content)
            return res.status(400).json({ error: "Missing series ID or content" });
        await (0, db_1.query) `INSERT INTO SeriesComments (UserID, SeriesID, ParentCommentID, Content, CreatedAt) VALUES (${Number(req.user.id)}, ${seriesId}, ${parentCommentId || null}, ${content}, GETDATE())`;
        res.json({ message: "Comment added successfully" });
    }
    catch (e) {
        console.error("POST /stories/:id/comments error:", e);
        res.status(500).json({ error: "Failed to add comment" });
    }
});
router.post("/stories/:id/comments/:commentId/reaction", authenticate_1.authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        const commentId = Number(req.params.commentId);
        const { reactionType } = req.body || {};
        if (!seriesId || !commentId || !reactionType)
            return res.status(400).json({ error: "Missing required fields" });
        if (!["Like", "Dislike"].includes(reactionType))
            return res.status(400).json({ error: "Invalid reaction type" });
        const comment = await (0, db_1.query) `SELECT CommentID FROM SeriesComments WHERE CommentID = ${commentId} AND SeriesID = ${seriesId} AND IsDeleted = 0`;
        if (comment.recordset.length === 0)
            return res.status(404).json({ error: "Comment not found" });
        await (0, db_1.query) `DELETE FROM SeriesCommentReactions WHERE CommentID = ${commentId} AND UserID = ${Number(req.user.id)}`;
        await (0, db_1.query) `INSERT INTO SeriesCommentReactions (CommentID, UserID, ReactionType, CreatedAt) VALUES (${commentId}, ${Number(req.user.id)}, ${reactionType}, GETDATE())`;
        res.json({ message: "Reaction updated successfully" });
    }
    catch (e) {
        console.error("POST /stories/:id/comments/:commentId/reaction error:", e);
        res.status(500).json({ error: "Failed to update reaction" });
    }
});
router.put("/stories/:seriesId/comments/:commentId", authenticate_1.authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const commentId = Number(req.params.commentId);
        const { content } = req.body || {};
        if (!seriesId || !commentId || !content)
            return res.status(400).json({ error: "Invalid params" });
        const owner = await (0, db_1.query) `SELECT UserID FROM SeriesComments WHERE CommentID = ${commentId} AND SeriesID = ${seriesId}`;
        if (owner.recordset.length === 0)
            return res.status(404).json({ error: "Comment not found" });
        if (owner.recordset[0].UserID !== req.user.UserID)
            return res.status(403).json({ error: "No permission" });
        await (0, db_1.query) `UPDATE SeriesComments SET Content = ${content}, UpdatedAt = GETDATE() WHERE CommentID = ${commentId}`;
        res.json({ ok: true });
    }
    catch (e) {
        console.error("PUT /stories/:seriesId/comments/:commentId error:", e);
        res.status(500).json({ error: "Failed to update comment" });
    }
});
router.delete("/stories/:seriesId/comments/:commentId", authenticate_1.authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.seriesId);
        const commentId = Number(req.params.commentId);
        if (!seriesId || !commentId)
            return res.status(400).json({ error: "Invalid params" });
        const owner = await (0, db_1.query) `SELECT UserID FROM SeriesComments WHERE CommentID = ${commentId} AND SeriesID = ${seriesId}`;
        if (owner.recordset.length === 0)
            return res.status(404).json({ error: "Comment not found" });
        if (req.user.RoleName !== "Admin" && owner.recordset[0].UserID !== req.user.UserID)
            return res.status(403).json({ error: "No permission" });
        await (0, db_1.query) `DELETE FROM SeriesCommentReactions WHERE CommentID IN (SELECT CommentID FROM SeriesComments WHERE CommentID = ${commentId} UNION ALL SELECT CommentID FROM SeriesComments WHERE ParentCommentID = ${commentId})`;
        await (0, db_1.query) `DELETE FROM SeriesComments WHERE ParentCommentID = ${commentId}`;
        await (0, db_1.query) `DELETE FROM SeriesComments WHERE CommentID = ${commentId}`;
        res.json({ ok: true });
    }
    catch (e) {
        console.error("DELETE /stories/:seriesId/comments/:commentId error:", e);
        res.status(500).json({ error: "Failed to delete comment" });
    }
});
router.get("/admin/comments/movies", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (_req, res) => {
    try {
        const comments = await (0, db_1.query) `
            SELECT mc.CommentID, mc.Content, mc.CreatedAt, mc.UpdatedAt, mc.ParentCommentID, mc.IsDeleted,
                   u.Username, u.Email, u.Avatar, m.Title as MovieTitle, m.MovieID,
                   ISNULL(likeCount.LikeCount, 0) as LikeCount,
                   ISNULL(dislikeCount.DislikeCount, 0) as DislikeCount
            FROM MovieComments mc
            INNER JOIN Users u ON mc.UserID = u.UserID
            LEFT JOIN Movies m ON mc.MovieID = m.MovieID
            LEFT JOIN (SELECT CommentID, COUNT(*) as LikeCount FROM MovieCommentReactions WHERE ReactionType = 'Like' GROUP BY CommentID) likeCount ON mc.CommentID = likeCount.CommentID
            LEFT JOIN (SELECT CommentID, COUNT(*) as DislikeCount FROM MovieCommentReactions WHERE ReactionType = 'Dislike' GROUP BY CommentID) dislikeCount ON mc.CommentID = dislikeCount.CommentID
            ORDER BY mc.CreatedAt DESC
        `;
        res.json(comments.recordset);
    }
    catch (e) {
        console.error("GET /admin/comments/movies error:", e);
        res.status(500).json({ error: "Failed to fetch movie comments" });
    }
});
router.get("/admin/comments/series", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (_req, res) => {
    try {
        const comments = await (0, db_1.query) `
            SELECT sc.CommentID, sc.Content, sc.CreatedAt, sc.UpdatedAt, sc.ParentCommentID, sc.IsDeleted,
                   u.Username, u.Email, u.Avatar, s.Title as SeriesTitle, s.SeriesID,
                   ISNULL(likeCount.LikeCount, 0) as LikeCount,
                   ISNULL(dislikeCount.DislikeCount, 0) as DislikeCount
            FROM SeriesComments sc
            INNER JOIN Users u ON sc.UserID = u.UserID
            LEFT JOIN Series s ON sc.SeriesID = s.SeriesID
            LEFT JOIN (SELECT CommentID, COUNT(*) as LikeCount FROM SeriesCommentReactions WHERE ReactionType = 'Like' GROUP BY CommentID) likeCount ON sc.CommentID = likeCount.CommentID
            LEFT JOIN (SELECT CommentID, COUNT(*) as DislikeCount FROM SeriesCommentReactions WHERE ReactionType = 'Dislike' GROUP BY CommentID) dislikeCount ON sc.CommentID = dislikeCount.CommentID
            ORDER BY sc.CreatedAt DESC
        `;
        res.json(comments.recordset);
    }
    catch (e) {
        console.error("GET /admin/comments/series error:", e);
        res.status(500).json({ error: "Failed to fetch series comments" });
    }
});
router.delete("/admin/comments/movies/:id", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const commentId = Number(req.params.id);
        if (!commentId)
            return res.status(400).json({ error: "Invalid comment ID" });
        await (0, db_1.query) `UPDATE MovieComments SET IsDeleted = 1, UpdatedAt = GETDATE() WHERE CommentID = ${commentId}`;
        res.json({ message: "Comment deleted successfully" });
    }
    catch (e) {
        console.error("DELETE /admin/comments/movies/:id error:", e);
        res.status(500).json({ error: "Failed to delete comment" });
    }
});
router.delete("/admin/comments/series/:id", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const commentId = Number(req.params.id);
        if (!commentId)
            return res.status(400).json({ error: "Invalid comment ID" });
        await (0, db_1.query) `UPDATE SeriesComments SET IsDeleted = 1, UpdatedAt = GETDATE() WHERE CommentID = ${commentId}`;
        res.json({ message: "Comment deleted successfully" });
    }
    catch (e) {
        console.error("DELETE /admin/comments/series/:id error:", e);
        res.status(500).json({ error: "Failed to delete comment" });
    }
});
router.put("/admin/comments/movies/:id/restore", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const commentId = Number(req.params.id);
        if (!commentId)
            return res.status(400).json({ error: "Invalid comment ID" });
        await (0, db_1.query) `UPDATE MovieComments SET IsDeleted = 0, UpdatedAt = GETDATE() WHERE CommentID = ${commentId}`;
        res.json({ message: "Comment restored successfully" });
    }
    catch (e) {
        console.error("PUT /admin/comments/movies/:id/restore error:", e);
        res.status(500).json({ error: "Failed to restore comment" });
    }
});
router.put("/admin/comments/series/:id/restore", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const commentId = Number(req.params.id);
        if (!commentId)
            return res.status(400).json({ error: "Invalid comment ID" });
        await (0, db_1.query) `UPDATE SeriesComments SET IsDeleted = 0, UpdatedAt = GETDATE() WHERE CommentID = ${commentId}`;
        res.json({ message: "Comment restored successfully" });
    }
    catch (e) {
        console.error("PUT /admin/comments/series/:id/restore error:", e);
        res.status(500).json({ error: "Failed to restore comment" });
    }
});
router.put("/admin/comments/movies/:id", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const commentId = Number(req.params.id);
        const { content } = req.body || {};
        if (!commentId || !content)
            return res.status(400).json({ error: "Invalid comment ID or content" });
        await (0, db_1.query) `UPDATE MovieComments SET Content = ${content}, UpdatedAt = GETDATE() WHERE CommentID = ${commentId}`;
        res.json({ message: "Comment updated successfully" });
    }
    catch (e) {
        console.error("PUT /admin/comments/movies/:id error:", e);
        res.status(500).json({ error: "Failed to update comment" });
    }
});
router.put("/admin/comments/series/:id", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_content"]), async (req, res) => {
    try {
        const commentId = Number(req.params.id);
        const { content } = req.body || {};
        if (!commentId || !content)
            return res.status(400).json({ error: "Invalid comment ID or content" });
        await (0, db_1.query) `UPDATE SeriesComments SET Content = ${content}, UpdatedAt = GETDATE() WHERE CommentID = ${commentId}`;
        res.json({ message: "Comment updated successfully" });
    }
    catch (e) {
        console.error("PUT /admin/comments/series/:id error:", e);
        res.status(500).json({ error: "Failed to update comment" });
    }
});
exports.default = router;
