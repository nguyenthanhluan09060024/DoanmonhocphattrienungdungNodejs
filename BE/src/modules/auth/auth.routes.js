"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = require("bcryptjs");
const db_1 = require("../../database/db");
const authenticate_1 = require("../../middlewares/authenticate");
const router = (0, express_1.Router)();
const inMemoryUsers = new Map();
const inMemoryPreferences = new Map();
router.post("/auth/register", async (req, res) => {
    try {
        const { email, username, fullName, password } = req.body || {};
        if (!email || !username || !password) {
            return res.status(400).json({ error: "Missing fields" });
        }
        const dup = await (0, db_1.query) `
            SELECT COUNT(1) AS cnt FROM Users WHERE Email = ${email} OR Username = ${username}
        `;
        if ((dup.recordset[0]?.cnt ?? 0) > 0) {
            return res.status(409).json({ error: "Email or username already exists" });
        }
        const passwordHash = (0, bcryptjs_1.hashSync)(password, 10);
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
        const { email, password } = req.body || {};
        const result = await (0, db_1.query) `SELECT UserID, PasswordHash FROM Users WHERE Email = ${email}`;
        const user = result.recordset[0];
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const ok = (0, bcryptjs_1.compareSync)(password, user.PasswordHash);
        if (!ok) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        return res.json({ ok: true, userId: user.UserID });
    }
    catch (e) {
        console.error("Login error:", e);
        return res.status(500).json({ error: "Login failed" });
    }
});
router.get("/auth/role", authenticate_1.authenticate, (req, res) => {
    return res.json({ role: req.user.role });
});
router.get("/me", async (req, res) => {
    try {
        const email = req.query.email ?? "";
        if (!email) {
            return res.status(400).json({ error: "Missing email" });
        }
        const result = await (0, db_1.query) `
            SELECT TOP 1 Username, FullName, Avatar, CreatedAt, UserID
            FROM Users
            WHERE Email = ${email}
        `;
        const row = result.recordset[0];
        if (row) {
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
            }
            return res.json({
                Username: row.Username,
                FullName: row.FullName || "",
                Avatar: row.Avatar || "",
                Gender: gender || "Khong xac dinh",
                CreatedAt: row.CreatedAt ? row.CreatedAt.toISOString() : undefined,
            });
        }
        const mem = inMemoryUsers.get(email);
        if (mem) {
            return res.json({
                ...mem,
                Gender: "Khong xac dinh",
                CreatedAt: undefined,
            });
        }
        return res.json({
            Username: String(email).split("@")[0] || "",
            FullName: "",
            Avatar: "",
            Gender: "Khong xac dinh",
            CreatedAt: undefined,
        });
    }
    catch (e) {
        console.error("GET /me error:", e);
        const email = req.query.email ?? "";
        const fallback = inMemoryUsers.get(email);
        if (fallback) {
            return res.json({
                ...fallback,
                Gender: "Khong xac dinh",
                CreatedAt: undefined,
            });
        }
        return res.status(404).json({ error: "User not found" });
    }
});
router.post("/me", async (req, res) => {
    try {
        const { email, username, fullName, avatar, gender, password } = req.body || {};
        if (!email) {
            return res.status(400).json({ error: "Missing email" });
        }
        const exists = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = exists.recordset[0];
        if (!user) {
            const current = inMemoryUsers.get(email) || { Username: "", FullName: "", Avatar: "" };
            if (typeof username !== "undefined")
                current.Username = username;
            if (typeof fullName !== "undefined")
                current.FullName = fullName;
            if (typeof avatar !== "undefined")
                current.Avatar = avatar;
            inMemoryUsers.set(email, current);
            if (typeof gender !== "undefined") {
                const prefs = inMemoryPreferences.get(email) || {};
                prefs.gender = gender;
                inMemoryPreferences.set(email, prefs);
            }
            return res.json({ ok: true, persisted: false, storage: "memory" });
        }
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
            const passwordHash = (0, bcryptjs_1.hashSync)(password, 10);
            await (0, db_1.query) `UPDATE Users SET PasswordHash = ${passwordHash} WHERE UserID = ${user.UserID}`;
        }
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
        const { email, username, fullName, avatar, gender } = req.body || {};
        if (email) {
            const current = inMemoryUsers.get(email) || { Username: "", FullName: "", Avatar: "" };
            if (typeof username !== "undefined")
                current.Username = username;
            if (typeof fullName !== "undefined")
                current.FullName = fullName;
            if (typeof avatar !== "undefined")
                current.Avatar = avatar;
            inMemoryUsers.set(email, current);
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
exports.default = router;
