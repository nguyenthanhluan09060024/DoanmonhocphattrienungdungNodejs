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
Object.defineProperty(exports, "__esModule", { value: true });
exports.sql = void 0;
exports.getPool = getPool;
exports.query = query;
const sql = __importStar(require("mssql"));
exports.sql = sql;
exports.executeTransaction = executeTransaction;
// Biến lưu trữ Promise của Connection Pool (Singleton)
let poolPromise = null;
/**
 * Lấy hoặc tạo Connection Pool. Đảm bảo chỉ tạo một lần (Singleton).
 * @returns Promise<sql.ConnectionPool>
 */
async function getPool() {
    if (!poolPromise) {
        const sqlServer = process.env.SQL_SERVER;
        const sqlDatabase = process.env.SQL_DATABASE;
        const sqlUser = process.env.SQL_USER || "sa";
        const sqlPassword = process.env.SQL_PASSWORD || "";
        // Kiểm tra password có rỗng không
        if (!sqlPassword || sqlPassword.trim() === "") {
            console.error("❌ LỖI: SQL_PASSWORD chưa được cấu hình hoặc rỗng!");
            console.error(`   Vui lòng sửa file BE/.env và thêm mật khẩu đúng cho user '${sqlUser}'`);
            console.error("   Ví dụ: SQL_PASSWORD=Admin@123");
            throw new Error("SQL_PASSWORD is required");
        }
        // SQL Authentication config
        const cfg = {
            user: sqlUser,
            password: sqlPassword,
            server: sqlServer,
            database: sqlDatabase,
            options: {
                trustServerCertificate: true,
                encrypt: false,
            },
        };
        console.log(`🔌 Kết nối database với SQL Authentication`);
        console.log(`   Server: ${cfg.server}`);
        console.log(`   Database: ${cfg.database}`);
        console.log(`   User: ${cfg.user}`);
        console.log(`   Password: ${sqlPassword ? '***' + sqlPassword.substring(sqlPassword.length - 2) : 'CHƯA CÓ'}`);
        // Tạo và kết nối Connection Pool
        poolPromise = new sql.ConnectionPool(cfg)
            .connect()
            .then((pool) => {
            console.log("✅ Connected to SQL Server");
            return pool;
        })
            .catch((err) => {
            poolPromise = null; // Thiết lập lại để có thể thử lại
            console.error("❌ SQL connection error:", err.message);
            if (err.code === 'ELOGIN') {
                console.error("");
                console.error("═══════════════════════════════════════════════════════");
                console.error("❌ LỖI ĐĂNG NHẬP DATABASE!");
                console.error("═══════════════════════════════════════════════════════");
                console.error(`Nguyên nhân: Mật khẩu của user '${sqlUser}' không đúng`);
                console.error("   → User này có thể KHÔNG TỒN TẠI trong SQL Server");
                console.error("");
                console.error("🔧 CÁCH SỬA:");
                console.error("1. Mở file: BE/.env");
                console.error("2. Tìm dòng: SQL_PASSWORD=...");
                console.error(`3. Sửa thành mật khẩu ĐÚNG của user '${sqlUser}'`);
                console.error("");
                console.error("💡 Nếu không biết mật khẩu:");
                console.error("   - Mở SQL Server Management Studio (SSMS)");
                console.error("   - Kết nối với server: " + sqlServer);
                console.error(`   - Thử đăng nhập với user '${sqlUser}' và mật khẩu hiện tại`);
                console.error("   - Nếu kết nối được → đó là mật khẩu đúng");
                console.error(`   - Hoặc reset mật khẩu: ALTER LOGIN ${sqlUser} WITH PASSWORD = 'NewPassword';`);
                console.error("═══════════════════════════════════════════════════════");
            }
            throw err;
        });
    }
    return poolPromise;
}
/**
 * Hàm tiện ích để thực hiện truy vấn với Template Strings và tự động hóa input parameters.
 * @param strings Chuỗi truy vấn SQL.
 * @param values Các giá trị tham số.
 * @returns Kết quả truy vấn.
 */
async function query(strings, ...values) {
    const pool = await getPool();
    const request = pool.request();
    // Thiết lập Input Parameters: @p0, @p1, ...
    strings.forEach((_, i) => {
        if (i < values.length) {
            request.input(`p${i}`, values[i]);
        }
    });
    // Xây dựng chuỗi truy vấn cuối cùng với các tham số đã định danh
    const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `@p${i}` : ""), "");
    return request.query(text);
}
async function executeTransaction(work) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const result = await work(transaction);
        await transaction.commit();
        return result;
    }
    catch (error) {
        try {
            await transaction.rollback();
        }
        catch (_rollbackError) {
        }
        throw error;
    }
}
