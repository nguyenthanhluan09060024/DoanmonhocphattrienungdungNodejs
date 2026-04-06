"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../database/db");
const authenticate_1 = require("../../middlewares/authenticate");
const router = (0, express_1.Router)();
router.get("/movies/:id/ratings", async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        if (!movieId)
            return res.status(400).json({ error: "Invalid movie ID" });
        const ratings = await (0, db_1.query) `
            SELECT mr.Rating, mr.CreatedAt, u.Username
            FROM MovieRatings mr
            INNER JOIN Users u ON mr.UserID = u.UserID
            WHERE mr.MovieID = ${movieId}
            ORDER BY mr.CreatedAt DESC
        `;
        const avgRating = await (0, db_1.query) `SELECT AVG(CAST(Rating AS FLOAT)) as AverageRating, COUNT(*) as TotalRatings FROM MovieRatings WHERE MovieID = ${movieId}`;
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
router.post("/movies/:id/ratings", authenticate_1.authenticate, async (req, res) => {
    try {
        const movieId = Number(req.params.id);
        const { rating } = req.body || {};
        if (!movieId || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Invalid movie ID or rating (1-5)" });
        }
        const existingRating = await (0, db_1.query) `SELECT RatingID FROM MovieRatings WHERE UserID = ${Number(req.user.id)} AND MovieID = ${movieId}`;
        if (existingRating.recordset.length > 0) {
            await (0, db_1.query) `UPDATE MovieRatings SET Rating = ${rating}, CreatedAt = GETDATE() WHERE UserID = ${Number(req.user.id)} AND MovieID = ${movieId}`;
        }
        else {
            await (0, db_1.query) `INSERT INTO MovieRatings (UserID, MovieID, Rating, CreatedAt) VALUES (${Number(req.user.id)}, ${movieId}, ${rating}, GETDATE())`;
        }
        const avgResult = await (0, db_1.query) `SELECT AVG(CAST(Rating AS FLOAT)) as AverageRating, COUNT(*) as TotalRatings FROM MovieRatings WHERE MovieID = ${movieId}`;
        await (0, db_1.query) `UPDATE Movies SET Rating = ${avgResult.recordset[0]?.AverageRating || 0}, TotalRatings = ${avgResult.recordset[0]?.TotalRatings || 0} WHERE MovieID = ${movieId}`;
        res.json({ message: "Rating saved successfully" });
    }
    catch (e) {
        console.error("POST /movies/:id/ratings error:", e);
        res.status(500).json({ error: "Failed to save rating" });
    }
});
router.get("/stories/:id/ratings", async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        if (!seriesId)
            return res.status(400).json({ error: "Invalid series ID" });
        const ratings = await (0, db_1.query) `SELECT AVG(CAST(Rating AS FLOAT)) as averageRating, COUNT(*) as totalRatings FROM SeriesRatings WHERE SeriesID = ${seriesId}`;
        const result = ratings.recordset[0];
        res.json({ averageRating: result.averageRating || 0, totalRatings: result.totalRatings || 0 });
    }
    catch (e) {
        console.error("GET /stories/:id/ratings error:", e);
        res.status(500).json({ error: "Failed to fetch ratings" });
    }
});
router.post("/stories/:id/rating", authenticate_1.authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        const { rating } = req.body || {};
        if (!seriesId || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Invalid series ID or rating" });
        }
        const userId = req.user.UserID;
        const existingRating = await (0, db_1.query) `SELECT RatingID FROM SeriesRatings WHERE SeriesID = ${seriesId} AND UserID = ${userId}`;
        if (existingRating.recordset.length > 0) {
            await (0, db_1.query) `UPDATE SeriesRatings SET Rating = ${rating}, CreatedAt = GETDATE() WHERE SeriesID = ${seriesId} AND UserID = ${userId}`;
        }
        else {
            await (0, db_1.query) `INSERT INTO SeriesRatings (UserID, SeriesID, Rating, CreatedAt) VALUES (${userId}, ${seriesId}, ${rating}, GETDATE())`;
        }
        res.json({ message: "Rating submitted successfully" });
    }
    catch (e) {
        console.error("POST /stories/:id/rating error:", e);
        res.status(500).json({ error: "Failed to submit rating" });
    }
});
router.get("/stories/:id/user-rating", authenticate_1.authenticate, async (req, res) => {
    try {
        const seriesId = Number(req.params.id);
        if (!seriesId)
            return res.status(400).json({ error: "Invalid series ID" });
        const rating = await (0, db_1.query) `SELECT Rating FROM SeriesRatings WHERE SeriesID = ${seriesId} AND UserID = ${Number(req.user.UserID)}`;
        res.json({ rating: rating.recordset[0]?.Rating || 0 });
    }
    catch (e) {
        console.error("GET /stories/:id/user-rating error:", e);
        res.status(500).json({ error: "Failed to fetch user rating" });
    }
});
exports.default = router;
