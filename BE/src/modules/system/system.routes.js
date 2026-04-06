"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get("/system/modules", (_req, res) => {
    return res.json({
        backendStyle: "Node.js layered modules",
        modules: [
            "content",
            "transactions",
            "socket",
            "database",
            "middlewares",
            "services",
            "utils",
            "constants",
        ],
    });
});
exports.default = router;
