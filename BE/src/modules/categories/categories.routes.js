"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const slugify_1 = require("slugify");
const db_1 = require("../../database/db");
const authenticate_1 = require("../../middlewares/authenticate");
const authMiddleware_1 = require("../../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.get("/categories", async (_req, res) => {
    try {
        const result = await (0, db_1.query) `SELECT CategoryID, CategoryName, Slug, Description, Type, CreatedAt FROM Categories ORDER BY CategoryName`;
        res.json(result.recordset);
    }
    catch (e) {
        console.error("GET /categories error:", e);
        res.status(500).json({ error: "Failed to fetch categories" });
    }
});
router.get("/admin/categories", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), async (_req, res) => {
    try {
        const result = await (0, db_1.query) `SELECT CategoryID, CategoryName, Slug, Description, Type, CreatedAt FROM Categories ORDER BY CategoryName`;
        res.json(result.recordset);
    }
    catch (e) {
        console.error("GET /admin/categories error:", e);
        res.status(500).json({ error: "Failed to fetch categories" });
    }
});
router.post("/admin/categories", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), async (req, res) => {
    try {
        const { name, type } = req.body || {};
        const trimmedName = String(name || "").trim();
        const normalizedType = String(type || "Both").trim();
        if (!trimmedName) {
            return res.status(400).json({ error: "Category name is required" });
        }
        if (!["Movie", "Series", "Both"].includes(normalizedType)) {
            return res.status(400).json({ error: "Invalid category type" });
        }
        const baseSlug = (0, slugify_1.default)(trimmedName, { lower: true, strict: true });
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
        res.status(201).json({ message: "Category created", CategoryName: trimmedName, Slug: finalSlug, Type: normalizedType });
    }
    catch (e) {
        console.error("POST /admin/categories error:", e);
        res.status(500).json({ error: "Failed to create category" });
    }
});
router.put("/admin/categories/:id", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), async (req, res) => {
    try {
        const categoryId = Number(req.params.id);
        if (!Number.isFinite(categoryId)) {
            return res.status(400).json({ error: "Invalid category id" });
        }
        const { name, type } = req.body || {};
        const current = await (0, db_1.query) `SELECT TOP 1 CategoryID, CategoryName, Slug, Description, Type FROM Categories WHERE CategoryID = ${categoryId}`;
        const row = current.recordset[0];
        if (!row)
            return res.status(404).json({ error: "Category not found" });
        let newName = typeof name === "string" && name.trim() ? name.trim() : row.CategoryName;
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
            SET CategoryName = ${newName}, Slug = ${newSlug}, Description = ${null}, Type = ${newType}
            WHERE CategoryID = ${categoryId}
        `;
        res.json({ message: "Category updated" });
    }
    catch (e) {
        console.error("PUT /admin/categories/:id error:", e);
        res.status(500).json({ error: "Failed to update category" });
    }
});
router.delete("/admin/categories/:id", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), async (req, res) => {
    try {
        const categoryId = Number(req.params.id);
        if (!Number.isFinite(categoryId)) {
            return res.status(400).json({ error: "Invalid category id" });
        }
        await (0, db_1.query) `DELETE FROM MovieCategories WHERE CategoryID = ${categoryId}`;
        await (0, db_1.query) `DELETE FROM SeriesCategories WHERE CategoryID = ${categoryId}`;
        const result = await (0, db_1.query) `DELETE FROM Categories WHERE CategoryID = ${categoryId}`;
        if ((result.rowsAffected?.[0] ?? 0) === 0) {
            return res.status(404).json({ error: "Category not found" });
        }
        res.json({ message: "Category deleted" });
    }
    catch (e) {
        console.error("DELETE /admin/categories/:id error:", e);
        res.status(500).json({ error: "Failed to delete category" });
    }
});
exports.default = router;
