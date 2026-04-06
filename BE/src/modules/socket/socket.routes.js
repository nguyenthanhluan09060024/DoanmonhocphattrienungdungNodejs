"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const socketService_1 = require("../../services/socketService");
const router = (0, express_1.Router)();
router.get("/socket/health", (_req, res) => {
    return res.json({ ok: true, realtime: Boolean((0, socketService_1.getIO)()) });
});
exports.default = router;
