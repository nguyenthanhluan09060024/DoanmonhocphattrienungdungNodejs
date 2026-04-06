"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const socketService_1 = require("./services/socketService");
// Load .env file from server directory
const envPath = path_1.default.resolve(__dirname, "..", ".env");
const envPathExists = fs_1.default.existsSync(envPath);
// Function to manually parse .env file with encoding detection
function parseEnvFile(filePath) {
    const env = {};
    try {
        // Try to read with different encodings
        let content;
        const buffer = fs_1.default.readFileSync(filePath);
        // Check for UTF-16 BOM (Byte Order Mark)
        if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
            // UTF-16 LE
            content = buffer.toString("utf16le");
            // Remove BOM if present
            if (content.charCodeAt(0) === 0xfeff) {
                content = content.substring(1);
            }
        }
        else if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
            // UTF-16 BE - convert to LE first
            const swapped = Buffer.alloc(buffer.length);
            for (let i = 0; i < buffer.length - 1; i += 2) {
                swapped[i] = buffer[i + 1];
                swapped[i + 1] = buffer[i];
            }
            content = swapped.toString("utf16le");
        }
        else {
            // Try UTF-8 first
            content = buffer.toString("utf8");
            // If we see null bytes, it might be UTF-16 without BOM
            if (content.includes("\x00")) {
                // Try UTF-16 LE without BOM
                content = buffer.toString("utf16le");
            }
        }
        // Remove null bytes that might be present
        content = content.replace(/\x00/g, "");
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            // Skip comments and empty lines
            if (!trimmed || trimmed.startsWith("#"))
                continue;
            // Match KEY=VALUE pattern
            const match = trimmed.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                // Remove quotes if present (both single and double)
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                // Remove any trailing whitespace and null bytes
                value = value.trim().replace(/\x00/g, "");
                env[key] = value;
                // Debug for GEMINI_API_KEY
                if (key === "GEMINI_API_KEY") {
                    console.log(`📝 Found GEMINI_API_KEY in .env file: length=${value.length}, preview=${value.substring(0, 10)}...`);
                }
            }
        }
    }
    catch (err) {
        console.error("Error parsing .env file:", err);
    }
    return env;
}
if (envPathExists) {
    // First try dotenv
    const result = dotenv_1.default.config({ path: envPath, override: false });
    if (result.error) {
        console.error("❌ Error loading .env file with dotenv:", result.error);
    }
    else {
        console.log("✅ Loaded .env file with dotenv from:", envPath);
    }
    // Also manually parse to ensure we get all values
    const manualEnv = parseEnvFile(envPath);
    console.log("📋 Manually parsed .env keys:", Object.keys(manualEnv).join(", "));
    // FORCE set ALL environment variables from manual parse (override dotenv)
    for (const [key, value] of Object.entries(manualEnv)) {
        if (!process.env[key]) {
            process.env[key] = value;
        }
        if (key === "GEMINI_API_KEY") {
            console.log("✅ FORCE set GEMINI_API_KEY from manual parse:", value.substring(0, 10) + "..." + value.substring(value.length - 4));
        }
    }
    // Double check GEMINI_API_KEY
    if (process.env.GEMINI_API_KEY) {
        console.log("✅ GEMINI_API_KEY confirmed:", process.env.GEMINI_API_KEY.substring(0, 10) +
            "..." +
            process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 4));
        console.log("✅ GEMINI_API_KEY length:", process.env.GEMINI_API_KEY.length);
    }
    else {
        console.error("❌ GEMINI_API_KEY not found in manual parse!");
        console.error("   Available keys:", Object.keys(manualEnv));
    }
}
else {
    console.warn("⚠️ .env file not found at:", envPath);
    // Try loading from root directory as fallback
    const rootEnvPath = path_1.default.resolve(__dirname, "..", "..", ".env");
    if (fs_1.default.existsSync(rootEnvPath)) {
        const rootResult = dotenv_1.default.config({ path: rootEnvPath, override: false });
        const rootManualEnv = parseEnvFile(rootEnvPath);
        if (rootManualEnv.GEMINI_API_KEY) {
            process.env.GEMINI_API_KEY = rootManualEnv.GEMINI_API_KEY;
            console.log("✅ Loaded GEMINI_API_KEY from root .env file");
        }
    }
}
// Final check: Ensure GEMINI_API_KEY is set
if (!process.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY === "your_gemini_api_key_here") {
    console.error("❌ CRITICAL: GEMINI_API_KEY still not set after all attempts!");
    console.error("   Attempting emergency load from:", envPath);
    try {
        if (fs_1.default.existsSync(envPath)) {
            const emergencyEnv = parseEnvFile(envPath);
            if (emergencyEnv.GEMINI_API_KEY) {
                process.env.GEMINI_API_KEY = emergencyEnv.GEMINI_API_KEY;
                console.log("✅ Emergency load successful!");
            }
        }
    }
    catch (err) {
        console.error("❌ Emergency load failed:", err);
    }
}
// Sử dụng biến môi trường từ file .env
// Tự động tạo/cập nhật file .env với các giá trị mặc định nếu cần
const defaultEnvValues = {
    SQL_SERVER: "CHAUTHANH\\SQLEXPRESS",
    SQL_DATABASE: "Fimory",
    SQL_USER: "fimory",
    SQL_PASSWORD: "Fimory@123",
    SQL_TRUSTED: "0", // Mặc định dùng Windows Authentication (an toàn hơn)
    PORT: "4000",
    NODE_ENV: "development",
};
// Kiểm tra và cập nhật file .env nếu cần
if (!envPathExists ||
    !process.env.SQL_SERVER ||
    process.env.SQL_SERVER === "localhost") {
    try {
        let envContent = "";
        if (envPathExists) {
            envContent = fs_1.default.readFileSync(envPath, "utf8");
        }
        // Đọc các giá trị hiện có từ file
        const existingEnv = parseEnvFile(envPath);
        // Cập nhật các giá trị mặc định nếu chưa có
        let needsUpdate = false;
        const lines = envContent ? envContent.split(/\r?\n/) : [];
        const existingKeys = new Set();
        // Đọc các key hiện có
        lines.forEach((line) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#")) {
                const match = trimmed.match(/^([^=]+)=/);
                if (match) {
                    existingKeys.add(match[1].trim());
                }
            }
        });
        // Thêm các giá trị mặc định nếu chưa có
        for (const [key, defaultValue] of Object.entries(defaultEnvValues)) {
            if (!existingKeys.has(key) && !existingEnv[key]) {
                lines.push(`${key}=${defaultValue}`);
                needsUpdate = true;
                process.env[key] = defaultValue;
            }
            else if (existingEnv[key]) {
                process.env[key] = existingEnv[key];
            }
            else {
                process.env[key] = defaultValue;
            }
        }
        // Ghi lại file .env nếu có thay đổi
        if (needsUpdate || !envPathExists) {
            const newContent = lines.join("\n") +
                (lines.length > 0 && !lines[lines.length - 1].endsWith("\n")
                    ? "\n"
                    : "");
            fs_1.default.writeFileSync(envPath, newContent, "utf8");
            console.log("✅ Đã tạo/cập nhật file .env với các giá trị mặc định");
        }
    }
    catch (err) {
        console.error("❌ Lỗi khi tạo/cập nhật file .env:", err);
        // Fallback: set vào process.env
        for (const [key, value] of Object.entries(defaultEnvValues)) {
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    }
}
else {
    // Nếu file .env đã có, đảm bảo các giá trị mặc định được set nếu thiếu
    for (const [key, value] of Object.entries(defaultEnvValues)) {
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}
// Kiểm tra SQL Authentication config
if (!process.env.SQL_USER || !process.env.SQL_PASSWORD) {
    console.warn("⚠️ CẢNH BÁO: SQL_USER hoặc SQL_PASSWORD chưa được cấu hình!");
    console.warn("   Vui lòng kiểm tra file BE/.env");
    console.warn("   Ví dụ: SQL_USER=sa, SQL_PASSWORD=Admin@123");
}
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Ensure uploads directory exists and serve it statically
const uploadsRoot = path_1.default.resolve(__dirname, "..", "uploads");
const storageFallbackDirectories = ["posters", "covers", "videos"];
const applyStorageHeaders = (res, filePath) => {
    if (filePath.toLowerCase().endsWith(".pdf")) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");
    }
    if (filePath.endsWith(".mp4") ||
        filePath.endsWith(".avi") ||
        filePath.endsWith(".mov") ||
        filePath.endsWith(".mkv") ||
        filePath.endsWith(".webm")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Accept-Ranges", "bytes");
    }
};
try {
    if (!fs_1.default.existsSync(uploadsRoot)) {
        fs_1.default.mkdirSync(uploadsRoot, { recursive: true });
    }
}
catch (e) {
    console.error("Failed to ensure uploads directory:", e);
}
// Expose uploaded files at /storage/<filename>
app.use("/storage", express_1.default.static(uploadsRoot, {
    setHeaders: applyStorageHeaders,
}));
app.get("/storage/:filename", (req, res, next) => {
    const filename = path_1.default.basename(String(req.params.filename || ""));
    if (!filename) {
        return next();
    }
    for (const directory of storageFallbackDirectories) {
        const candidatePath = path_1.default.join(uploadsRoot, directory, filename);
        if (fs_1.default.existsSync(candidatePath)) {
            applyStorageHeaders(res, candidatePath);
            return res.sendFile(candidatePath);
        }
    }
    return next();
});
const devFrontendUrl = process.env.FRONTEND_DEV_SERVER || "http://localhost:5173";
// In development, redirect root to Vite dev server for convenience
if (process.env.NODE_ENV !== "production") {
    app.get("/", (_req, res) => {
        res.redirect(devFrontendUrl);
    });
}
app.use("/uploads", express_1.default.static(uploadsRoot));
// Simple request logger to debug routes
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Server Error:", err);
    res
        .status(500)
        .json({ error: "Internal Server Error", message: err.message });
});
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", routes_1.default);
// Serve frontend build in production
if (process.env.NODE_ENV === "production") {
    const distPath = path_1.default.resolve(__dirname, "..", "..", "dist");
    if (fs_1.default.existsSync(distPath)) {
        app.use(express_1.default.static(distPath));
        // Catch-all handler: send back React's index.html file for client-side routing
        app.get("*", (req, res) => {
            // Don't serve index.html for API routes
            if (req.path.startsWith("/api") || req.path.startsWith("/storage") || req.path.startsWith("/uploads")) {
                return res.status(404).send("Not Found");
            }
            res.sendFile(path_1.default.join(distPath, "index.html"));
        });
        console.log("✅ Serving frontend build from:", distPath);
    }
    else {
        console.warn("⚠️ Frontend build not found at:", distPath);
        console.warn("   Run 'npm run build' to build the frontend");
    }
}
const port = Number(process.env.PORT ?? 4000);
// Add process error handlers
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});
const io = (0, socketService_1.initSocketServer)(server);
app.locals.io = io;
server.listen(port, async () => {
    console.log(`API running on :${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`Database: ${process.env.SQL_SERVER || "localhost"}/${process.env.SQL_DATABASE || "Fimory"}`);
    // Debug environment variables
    console.log("🔍 Environment variables:");
    console.log("SQL_SERVER:", process.env.SQL_SERVER);
    console.log("SQL_DATABASE:", process.env.SQL_DATABASE);
    console.log("SQL_USER:", process.env.SQL_USER);
    console.log("SQL_TRUSTED:", process.env.SQL_TRUSTED);
    // Kiểm tra GEMINI_API_KEY từ process.env
    const geminiKey = process.env.GEMINI_API_KEY;
    console.log("🔍 Checking GEMINI_API_KEY in process.env:");
    console.log("  - Type:", typeof geminiKey);
    console.log("  - Exists:", !!geminiKey);
    console.log("  - Length:", geminiKey?.length || 0);
    if (geminiKey &&
        geminiKey.trim() &&
        geminiKey !== "your_gemini_api_key_here") {
        console.log("GEMINI_API_KEY: ✅ Đã cấu hình");
        console.log("GEMINI_API_KEY preview:", geminiKey.substring(0, 10) +
            "..." +
            geminiKey.substring(geminiKey.length - 4));
    }
    else {
        console.log("GEMINI_API_KEY: ❌ Chưa cấu hình");
        console.log("⚠️ Vui lòng kiểm tra file BE/.env");
        console.log("⚠️ Đảm bảo dòng GEMINI_API_KEY=... không có khoảng trắng thừa");
        // Thử load lại .env file bằng cách parse thủ công
        try {
            if (fs_1.default.existsSync(envPath)) {
                const envContent = fs_1.default.readFileSync(envPath, "utf8");
                const lines = envContent.split(/\r?\n/);
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith("GEMINI_API_KEY=")) {
                        const keyValue = trimmed.substring("GEMINI_API_KEY=".length).trim();
                        if (keyValue && keyValue !== "your_gemini_api_key_here") {
                            process.env.GEMINI_API_KEY = keyValue;
                            console.log("✅ Đã load lại GEMINI_API_KEY từ file:", keyValue.substring(0, 10) +
                                "..." +
                                keyValue.substring(keyValue.length - 4));
                            console.log("✅ GEMINI_API_KEY: Đã cấu hình (từ fallback)");
                            break;
                        }
                    }
                }
            }
        }
        catch (err) {
            console.error("❌ Error reading .env file:", err);
        }
    }
    // Test database connection
    try {
        const { getPool } = await Promise.resolve().then(() => __importStar(require("./database/db")));
        const pool = await getPool();
        console.log("✅ Database connection successful");
    }
    catch (error) {
        console.error("❌ Database connection failed:", error);
        console.log("Server will continue running but database operations may fail");
    }
    console.log("Server started successfully!");
});
// 404 catcher to help debug missing routes
app.use((req, res) => {
    console.warn(`404 ${req.method} ${req.url}`);
    res.status(404).send("Not Found");
});
