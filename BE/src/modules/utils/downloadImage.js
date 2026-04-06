"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadImage = downloadImage;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Tải ảnh từ URL về local storage
 * @param url URL của ảnh cần tải
 * @param destPath Đường dẫn đầy đủ đến file đích
 * @returns true nếu thành công, false nếu thất bại
 */
async function downloadImage(url, destPath, refererUrl // ✅ FIX: Cho phép truyền referer từ bên ngoài
) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 giây timeout cho ảnh
    try {
        // Đảm bảo thư mục đích tồn tại
        const destDir = path_1.default.dirname(destPath);
        if (!fs_1.default.existsSync(destDir)) {
            fs_1.default.mkdirSync(destDir, { recursive: true });
        }
        // ✅ FIX: Ưu tiên dùng referer được truyền vào (từ storyUrl), nếu không thì tự detect
        let referer = refererUrl;
        if (!referer) {
            // Parse URL để lấy domain cho Referer
            try {
                const urlObj = new URL(url);
                // ✅ FIX: Nếu image từ CDN (image4.kcgsbok.com, v.v.), cần referer từ trang gốc
                // Thử detect domain gốc từ URL pattern
                if (urlObj.hostname.includes("kcgsbok") || urlObj.hostname.includes("image") || urlObj.hostname.includes("cdn")) {
                    // URL có pattern /nettruyen/ → referer nên là nettruyen domain
                    if (urlObj.pathname.includes("/nettruyen/") || urlObj.pathname.includes("nettruyen")) {
                        referer = "https://nettruyen.com/";
                    }
                    else if (urlObj.pathname.includes("/truyenqq") || urlObj.pathname.includes("truyenqq")) {
                        referer = "https://truyenqqno.com/";
                    }
                    else {
                        // ✅ FIX: Thử nhiều domain phổ biến
                        referer = "https://nettruyen.com/"; // Default cho CDN
                    }
                }
                else if (urlObj.hostname.includes("truyenqq") || urlObj.hostname.includes("nettruyen") ||
                    urlObj.hostname.includes("truyenvn") || urlObj.hostname.includes("hinhanh") ||
                    urlObj.hostname.includes("hinhhinhn")) {
                    referer = `${urlObj.protocol}//${urlObj.hostname}/`;
                }
                else {
                    // Fallback: dùng domain của image URL
                    referer = `${urlObj.protocol}//${urlObj.hostname}/`;
                }
            }
            catch (e) {
                // Nếu không parse được, dùng refererUrl nếu có, không thì để null
                referer = refererUrl || null;
            }
        }
        // ✅ DEBUG: Log referer để debug
        console.log(`🔗 [DOWNLOAD] URL: ${url.substring(0, 80)}... | Referer: ${referer || 'null'}`);
        // Fetch ảnh từ URL với headers browser đầy đủ để tránh bị Cloudflare chặn
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "Accept-Language": "vi,en-US;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Sec-Fetch-Dest": "image",
            "Sec-Fetch-Mode": "no-cors",
            "Sec-Fetch-Site": "cross-site",
            "Sec-Ch-Ua": '"Chromium";v="123", "Not:A-Brand";v="8"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        };
        // ✅ FIX: Chỉ thêm Referer nếu có (một số server không cần Referer)
        if (referer) {
            headers["Referer"] = referer;
        }
        const response = await fetch(url, {
            signal: controller.signal,
            headers,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            console.error(`Failed to download image [${response.status}]: ${response.statusText}`);
            console.error(`URL: ${url}`);
            console.error(`Referer: ${referer || 'null'}`);
            // ✅ FIX: Nếu 403 và có refererUrl, thử lại với referer khác
            if (response.status === 403 && refererUrl) {
                try {
                    const storyUrlObj = new URL(refererUrl);
                    const alternativeReferer = `${storyUrlObj.protocol}//${storyUrlObj.hostname}/`;
                    if (alternativeReferer !== referer) {
                        console.log(`🔄 Retry với referer khác: ${alternativeReferer}`);
                        const retryHeaders = { ...headers };
                        retryHeaders["Referer"] = alternativeReferer;
                        const retryResponse = await fetch(url, {
                            signal: controller.signal,
                            headers: retryHeaders,
                        });
                        if (retryResponse.ok) {
                            const arrayBuffer = await retryResponse.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);
                            fs_1.default.writeFileSync(destPath, buffer);
                            console.log(`✅ Retry thành công với referer: ${alternativeReferer}`);
                            return true;
                        }
                    }
                }
                catch (e) {
                    // Ignore retry errors
                }
            }
            return false;
        }
        // Chuyển response thành buffer
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // Ghi file
        fs_1.default.writeFileSync(destPath, buffer);
        return true;
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error("Download image timeout (>30s)");
            return false;
        }
        console.error("downloadImage error:", error.message || error);
        console.error(`URL: ${url}`);
        return false;
    }
}
