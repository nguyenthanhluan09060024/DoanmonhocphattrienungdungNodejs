"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../database/db");
const socketService_1 = require("../../services/socketService");
const router = (0, express_1.Router)();
const inMemoryNotifications = new Map();
function decodeEmail(value) {
    try {
        return decodeURIComponent(String(value || ""));
    }
    catch {
        return String(value || "");
    }
}
router.get("/notifications", async (req, res) => {
    try {
        const email = decodeEmail(req.query.email);
        if (!email) {
            return res.status(400).json({ error: "Missing email" });
        }
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user) {
            return res.json(inMemoryNotifications.get(email) || []);
        }
        const rows = await (0, db_1.query) `
            SELECT NotificationID, Type, Title, Content, RelatedURL, IsRead, CreatedAt
            FROM Notifications
            WHERE UserID = ${user.UserID}
            ORDER BY CreatedAt DESC
        `;
        return res.json(rows.recordset);
    }
    catch (e) {
        console.error("GET /notifications error:", e);
        const email = decodeEmail(req.query.email);
        return res.json(inMemoryNotifications.get(email) || []);
    }
});
router.post("/notifications", async (req, res) => {
    try {
        const { email, type, title, content, relatedURL } = req.body || {};
        if (!email || !type || !title) {
            return res.status(400).json({ error: "Missing email/type/title" });
        }
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        const payload = {
            Type: String(type),
            Title: String(title),
            Content: String(content ?? ""),
            RelatedURL: String(relatedURL ?? ""),
            IsRead: false,
            CreatedAt: new Date().toISOString(),
        };
        if (!user) {
            const list = inMemoryNotifications.get(email) || [];
            list.unshift(payload);
            inMemoryNotifications.set(email, list);
            (0, socketService_1.emitNotificationCreated)(String(email), payload);
            return res.json({ ok: true, persisted: false, storage: "memory" });
        }
        await (0, db_1.query) `
            INSERT INTO Notifications (UserID, Type, Title, Content, RelatedURL, IsRead)
            VALUES (${user.UserID}, ${type}, ${title}, ${content ?? ""}, ${relatedURL ?? ""}, 0)
        `;
        (0, socketService_1.emitNotificationCreated)(String(email), payload);
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("POST /notifications error:", e);
        const { email, type, title, content, relatedURL } = req.body || {};
        if (email && type && title) {
            const payload = {
                Type: String(type),
                Title: String(title),
                Content: String(content ?? ""),
                RelatedURL: String(relatedURL ?? ""),
                IsRead: false,
                CreatedAt: new Date().toISOString(),
            };
            const list = inMemoryNotifications.get(email) || [];
            list.unshift(payload);
            inMemoryNotifications.set(email, list);
            (0, socketService_1.emitNotificationCreated)(String(email), payload);
            return res.json({ ok: true, persisted: false, storage: "memory" });
        }
        return res.status(400).json({ error: "Invalid request" });
    }
});
router.get("/notifications/count", async (req, res) => {
    try {
        const email = decodeEmail(req.query.email);
        if (!email) {
            return res.status(400).json({ error: "Missing email" });
        }
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user) {
            const list = inMemoryNotifications.get(email) || [];
            return res.json({ count: list.filter((item) => !item.IsRead).length });
        }
        const allNotifications = await (0, db_1.query) `SELECT IsRead FROM Notifications WHERE UserID = ${user.UserID}`;
        const unreadCount = allNotifications.recordset.filter((row) => row.IsRead === 0 || row.IsRead === false || row.IsRead == null).length;
        return res.json({ count: unreadCount });
    }
    catch (e) {
        console.error("GET /notifications/count error:", e);
        const email = decodeEmail(req.query.email);
        const list = inMemoryNotifications.get(email) || [];
        return res.json({ count: list.filter((item) => !item.IsRead).length });
    }
});
router.post("/notifications/read", async (req, res) => {
    try {
        const { email, notificationId } = req.body || {};
        if (!email) {
            return res.status(400).json({ error: "Missing email" });
        }
        const userRes = await (0, db_1.query) `SELECT TOP 1 UserID FROM Users WHERE Email = ${email}`;
        const user = userRes.recordset[0];
        if (!user) {
            const list = inMemoryNotifications.get(email) || [];
            if (!notificationId) {
                list.forEach((item) => {
                    item.IsRead = true;
                });
            }
            else {
                const target = list.find((_, idx) => idx + 1 === Number(notificationId));
                if (target) {
                    target.IsRead = true;
                }
            }
            inMemoryNotifications.set(email, list);
            return res.json({ ok: true, persisted: false, storage: "memory" });
        }
        if (!notificationId) {
            await (0, db_1.query) `UPDATE Notifications SET IsRead = 1 WHERE UserID = ${user.UserID}`;
        }
        else {
            await (0, db_1.query) `UPDATE Notifications SET IsRead = 1 WHERE NotificationID = ${Number(notificationId)} AND UserID = ${user.UserID}`;
        }
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("POST /notifications/read error:", e);
        const { email, notificationId } = req.body || {};
        const list = inMemoryNotifications.get(email) || [];
        if (!notificationId) {
            list.forEach((item) => {
                item.IsRead = true;
            });
        }
        inMemoryNotifications.set(email, list);
        return res.json({ ok: true, persisted: false, storage: "memory" });
    }
});
exports.default = router;
