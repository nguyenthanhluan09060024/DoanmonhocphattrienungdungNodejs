"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../database/db");
const authenticate_1 = require("../../middlewares/authenticate");
const authMiddleware_1 = require("../../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.get("/admin/users", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["view:any_user"]), async (_req, res) => {
    try {
        const users = await (0, db_1.query) `
            SELECT u.UserID, u.Username, u.Email, u.FullName, u.IsActive, u.IsEmailVerified,
                   u.CreatedAt, u.LastLoginAt, r.RoleName,
                   CAST(CASE WHEN ue.TotalExp IS NULL THEN 1 ELSE FLOOR(ue.TotalExp / 100) + 1 END AS INT) as Level
            FROM Users u
            JOIN Roles r ON u.RoleID = r.RoleID
            LEFT JOIN UserExp ue ON u.UserID = ue.UserID
            ORDER BY u.CreatedAt DESC
        `;
        res.json(users.recordset);
    }
    catch (e) {
        console.error("GET /admin/users error:", e);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});
router.put("/admin/users/:id/role", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_user"]), async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const { role } = req.body || {};
        if (!userId || !role) {
            return res.status(400).json({ error: "Invalid user ID or role" });
        }
        const roleResult = await (0, db_1.query) `SELECT RoleID FROM Roles WHERE RoleName = ${role}`;
        if (roleResult.recordset.length === 0) {
            return res.status(400).json({ error: "Invalid role" });
        }
        await (0, db_1.query) `UPDATE Users SET RoleID = ${roleResult.recordset[0].RoleID}, UpdatedAt = GETDATE() WHERE UserID = ${userId}`;
        res.json({ ok: true });
    }
    catch (e) {
        console.error("PUT /admin/users/:id/role error:", e);
        res.status(500).json({ error: "Failed to update user role" });
    }
});
router.put("/admin/users/:id/status", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["edit:any_user"]), async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const { isActive } = req.body || {};
        if (!userId || typeof isActive !== "boolean") {
            return res.status(400).json({ error: "Invalid user ID or status" });
        }
        await (0, db_1.query) `UPDATE Users SET IsActive = ${isActive ? 1 : 0}, UpdatedAt = GETDATE() WHERE UserID = ${userId}`;
        res.json({ ok: true });
    }
    catch (e) {
        console.error("PUT /admin/users/:id/status error:", e);
        res.status(500).json({ error: "Failed to update user status" });
    }
});
router.get("/admin/role-upgrade-requests", authenticate_1.authenticate, (0, authMiddleware_1.requireRoles)(["Admin"]), (0, authMiddleware_1.authorize)(["view:any_user"]), async (_req, res) => {
    try {
        const requests = await (0, db_1.query) `
            SELECT rur.RequestID, rur.Reason, rur.Status, rur.ReviewNote, rur.RequestedAt, rur.ReviewedAt,
                   u.Username, u.Email, cr.RoleName as CurrentRole, rr.RoleName as RequestedRole
            FROM RoleUpgradeRequests rur
            LEFT JOIN Users u ON rur.UserID = u.UserID
            LEFT JOIN Roles cr ON u.RoleID = cr.RoleID
            LEFT JOIN Roles rr ON rur.RequestedRoleID = rr.RoleID
            ORDER BY rur.RequestedAt DESC
        `;
        res.json(requests.recordset);
    }
    catch (e) {
        console.error("GET /admin/role-upgrade-requests error:", e);
        res.status(500).json({ error: "Failed to fetch upgrade requests" });
    }
});
router.get("/roles", async (_req, res) => {
    try {
        const roles = await (0, db_1.query) `SELECT RoleID, RoleName, Description FROM Roles ORDER BY RoleID`;
        res.json(roles.recordset);
    }
    catch (e) {
        console.error("GET /roles error:", e);
        res.status(500).json({ error: "Failed to fetch roles" });
    }
});
router.post("/user/role-upgrade-request", authenticate_1.authenticate, async (req, res) => {
    try {
        const { requestedRole, reason } = req.body || {};
        if (!requestedRole || !reason) {
            return res.status(400).json({ error: "Requested role and reason are required" });
        }
        const existingRequest = await (0, db_1.query) `SELECT RequestID FROM RoleUpgradeRequests WHERE UserID = ${req.user?.UserID} AND Status = 'Pending'`;
        if (existingRequest.recordset.length > 0) {
            return res.status(400).json({ error: "You already have a pending upgrade request" });
        }
        const roleResult = await (0, db_1.query) `SELECT RoleID FROM Roles WHERE RoleName = ${requestedRole}`;
        if (roleResult.recordset.length === 0) {
            return res.status(400).json({ error: "Invalid role" });
        }
        const requestedRoleId = roleResult.recordset[0].RoleID;
        if (requestedRoleId <= (req.user?.RoleID || 0)) {
            return res.status(400).json({ error: "Cannot upgrade to same or lower role" });
        }
        await (0, db_1.query) `INSERT INTO RoleUpgradeRequests (UserID, RequestedRoleID, Reason, Status) VALUES (${req.user?.UserID}, ${requestedRoleId}, ${reason}, 'Pending')`;
        res.json({ ok: true });
    }
    catch (e) {
        console.error("POST /user/role-upgrade-request error:", e);
        res.status(500).json({ error: "Failed to submit upgrade request" });
    }
});
router.get("/user/role-upgrade-requests", authenticate_1.authenticate, async (req, res) => {
    try {
        const requests = await (0, db_1.query) `
            SELECT rur.RequestID, rur.Reason, rur.Status, rur.ReviewNote, rur.RequestedAt, rur.ReviewedAt,
                   r.RoleName as RequestedRoleName
            FROM RoleUpgradeRequests rur
            JOIN Roles r ON rur.RequestedRoleID = r.RoleID
            WHERE rur.UserID = ${req.user?.UserID}
            ORDER BY rur.RequestedAt DESC
        `;
        res.json(requests.recordset);
    }
    catch (e) {
        console.error("GET /user/role-upgrade-requests error:", e);
        res.status(500).json({ error: "Failed to fetch upgrade requests" });
    }
});
exports.default = router;
