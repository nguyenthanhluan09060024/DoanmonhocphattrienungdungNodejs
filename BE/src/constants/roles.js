"use strict";
// BE/src/constants/roles.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.rolePermissions = exports.ROLE_ID_MAP = void 0;
// Ánh xạ RoleID (từ DB) sang RoleName (chuỗi Type)
exports.ROLE_ID_MAP = {
    1: "Viewer",
    2: "Uploader",
    3: "Author",
    4: "Translator",
    5: "Reup",
    6: "Admin",
};
// Ánh xạ Vai trò tới các Quyền hạn
exports.rolePermissions = {
    // RoleID 1: Viewer (Người xem thông thường)
    Viewer: ["read:content"], // RoleID 2, 3, 5: Uploader, Author, Reup (Người tạo/đăng nội dung)
    Uploader: ["read:content", "create:content", "edit:own_content"],
    Author: ["read:content", "create:content", "edit:own_content"],
    Reup: ["read:content", "create:content", "edit:own_content"],
    // RoleID 4: Translator (Có quyền tạo và sửa nội dung)
    Translator: ["read:content", "create:content", "edit:own_content"], // RoleID 6: Admin (Quản trị viên) - Có tất cả các quyền
    Admin: [
        "read:content",
        "create:content",
        "edit:own_content",
        "edit:any_content",
        "manage:users",
        "delete:any_content",
        "view:any_user",
        "edit:any_user",
    ],
};
