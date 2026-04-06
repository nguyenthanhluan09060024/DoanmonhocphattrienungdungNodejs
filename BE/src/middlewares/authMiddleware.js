"use strict";
// BE/src/middlewares/authMiddleware.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = exports.authorize = void 0;
const roles_1 = require("../constants/roles");
/**
 * Middleware kiểm tra quyền hạn (Authorization)
 * @param requiredPermissions Mảng các quyền (Permission) cần thiết cho route này
 */
const authorize = (requiredPermissions) => {
    return (req, res, next) => {
        // 1. Kiểm tra xác thực (Giả định Auth đã chạy trước đó)
        if (!req.user || !req.user.role) {
            return res
                .status(401)
                .json({ message: "Lỗi xác thực (Authentication Failed)." });
        }
        const userRole = req.user.role;
        // 2. Lấy danh sách quyền của người dùng hiện tại
        const userPermissions = roles_1.rolePermissions[userRole];
        if (!userPermissions) {
            return res
                .status(403)
                .json({ message: "Vai trò người dùng không hợp lệ." });
        }
        // 3. Kiểm tra: người dùng có TẤT CẢ các quyền cần thiết không?
        const hasAllRequiredPermissions = requiredPermissions.every((requiredPerm) => userPermissions.includes(requiredPerm));
        if (hasAllRequiredPermissions) {
            next(); // Đã được cấp quyền, cho phép đi tiếp
        }
        else {
            // Lỗi 403: Forbidden (Không có quyền)
            return res.status(403).json({
                message: "Không có quyền truy cập (Forbidden).",
                required: requiredPermissions,
            });
        }
    };
};
exports.authorize = authorize;
/**
 * Middleware kiểm tra vai trò cụ thể (ví dụ chỉ Admin)
 * @param roles Danh sách role hợp lệ
 */
const requireRoles = (roles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: "Lỗi xác thực (Authentication Failed)." });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Chỉ dành cho Admin." });
        }
        next();
    };
};
exports.requireRoles = requireRoles;
