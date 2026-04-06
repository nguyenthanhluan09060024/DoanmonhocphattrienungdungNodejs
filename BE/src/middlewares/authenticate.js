"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const db_1 = require("../database/db");
const roles_1 = require("../constants/roles");
const authenticate = async (req, res, next) => {
    const userEmail = String(req.header("x-user-email") || "").trim();
    if (!userEmail) {
        return res.status(401).json({ message: "Chưa xác thực." });
    }
    try {
        const userRes = await (0, db_1.query) `
            SELECT TOP 1 UserID, Email, RoleID
            FROM dbo.Users
            WHERE Email = ${userEmail}
        `;
        const userRow = userRes.recordset[0];
        if (!userRow) {
            return res.status(401).json({ error: "Người dùng không tồn tại." });
        }
        const roleString = roles_1.ROLE_ID_MAP[userRow.RoleID] || "Viewer";
        req.user = {
            id: String(userRow.UserID),
            UserID: userRow.UserID,
            email: userRow.Email,
            role: roleString,
            RoleName: roleString,
            RoleID: userRow.RoleID,
        };
        next();
    }
    catch (error) {
        console.error("Authentication DB error:", error);
        return res.status(500).json({ error: "Lỗi hệ thống trong quá trình xác thực." });
    }
};
exports.authenticate = authenticate;
