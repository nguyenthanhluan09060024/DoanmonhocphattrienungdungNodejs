"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitNotificationCreated = emitNotificationCreated;
exports.getIO = getIO;
exports.initSocketServer = initSocketServer;
let ioInstance = null;
function initSocketServer(server) {
    const { Server } = require("socket.io");
    ioInstance = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });
    ioInstance.on("connection", (socket) => {
        socket.on("notifications:join", (email) => {
            if (email) {
                socket.join(`notifications:${email}`);
            }
        });
        socket.on("notifications:leave", (email) => {
            if (email) {
                socket.leave(`notifications:${email}`);
            }
        });
    });
    return ioInstance;
}
function getIO() {
    return ioInstance;
}
function emitNotificationCreated(email, payload) {
    if (!ioInstance || !email) {
        return;
    }
    ioInstance.to(`notifications:${email}`).emit("notifications:created", payload);
}
