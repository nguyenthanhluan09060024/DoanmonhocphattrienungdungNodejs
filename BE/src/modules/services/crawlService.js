"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlMovieFromTMDB = crawlMovieFromTMDB;
exports.crawlStoryFromVN = crawlStoryFromVN;
exports.crawlChapterWithFallback = crawlChapterWithFallback;
exports.crawlMovieFromVN = crawlMovieFromVN;
const cheerio_1 = require("cheerio");
const axios_1 = __importDefault(require("axios"));
const zlib_1 = __importDefault(require("zlib"));
const brotli_1 = require("brotli");
const downloadImage_1 = require("../utils/downloadImage");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const slugify_1 = __importDefault(require("slugify"));
const STORY_SITE_PRIORITY = [
    "nettruyen",
    "truyenqqno",
    "truyenvn",
    "blogtruyen",
    "goctruyentranhvui",
    "other",
];
function resolveToAbsoluteUrl(rawUrl, baseUrl) {
    if (!rawUrl)
        return "";
    try {
        const absolute = new URL(rawUrl, baseUrl).href;
        return absolute;
    }
    catch {
        return rawUrl;
    }
}
function toChapterSlug(title, fallback) {
    const slug = (0, slugify_1.default)(title || "", { lower: true, strict: true }) ||
        (0, slugify_1.default)(fallback, { lower: true, strict: true }) ||
        fallback;
    return slug;
}
function buildChapterList(rawChapters, options = { baseUrl: "" }) {
    if (!rawChapters || rawChapters.length === 0) {
        return [];
    }
    const normalized = rawChapters
        .map((item) => {
        const resolvedUrl = resolveToAbsoluteUrl(item.url, options.baseUrl);
        return {
            title: item.title?.trim() || "Chapter",
            url: resolvedUrl,
        };
    })
        .filter((item) => !!item.url);
    const ordered = options.ascending === false ? normalized.slice().reverse() : normalized;
    return ordered.map((item, index) => ({
        ordinal: index + 1,
        title: item.title,
        url: item.url,
        slug: toChapterSlug(item.title, `chapter-${index + 1}`),
    }));
}
function dedupeStrings(values) {
    return Array.from(new Set(values.filter((value) => !!value)));
}
function getImageExtension(imageUrl) {
    try {
        const urlObj = new URL(imageUrl);
        const ext = path_1.default.extname(urlObj.pathname).toLowerCase();
        if (ext && ext.length <= 5) {
            return ext;
        }
    }
    catch {
        // ignore parse errors
    }
    return ".jpg";
}
/**
 * Crawl metadata phim từ TMDB
 * @param tmdbId ID phim trên TMDB
 * @param downloadPoster Có tải poster về local không
 * @returns Metadata phim
 */
async function crawlMovieFromTMDB(tmdbId, downloadPoster = false) {
    const tmdbKey = process.env.TMDB_API_KEY;
    if (!tmdbKey) {
        throw new Error("TMDB_API_KEY chưa được cấu hình trong .env");
    }
    // Lấy thông tin phim với ngôn ngữ tiếng Việt
    const movieUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}&language=vi-VN&append_to_response=videos,credits`;
    const response = await fetch(movieUrl);
    if (!response.ok) {
        throw new Error(`Không lấy được dữ liệu từ TMDB: ${response.statusText}`);
    }
    const data = await response.json();
    // Lấy poster URL
    const posterPath = data.poster_path
        ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
        : null;
    // Lấy trailer (YouTube)
    const trailer = data.videos &&
        data.videos.results &&
        data.videos.results.length > 0
        ? `https://www.youtube.com/watch?v=${data.videos.results[0].key}`
        : null;
    // Lấy đạo diễn
    const director = data.credits?.crew?.find((person) => person.job === "Director")
        ?.name || null;
    // Lấy diễn viên chính (top 5)
    const cast = data.credits?.cast
        ?.slice(0, 5)
        .map((actor) => actor.name)
        .join(", ") || null;
    // Lấy quốc gia sản xuất
    const country = data.production_countries && data.production_countries.length > 0
        ? data.production_countries[0].name
        : null;
    const movie = {
        title: data.title || data.original_title || "",
        overview: data.overview || "",
        poster_url: posterPath,
        poster_local: null,
        trailer_url: trailer,
        release_year: data.release_date
            ? Number(data.release_date.split("-")[0])
            : null,
        duration: data.runtime || null,
        genres: (data.genres || []).map((g) => g.name).join(", ") || "",
        language: data.original_language || "vi",
        rating: data.vote_average || 0,
        country: country,
        director: director,
        cast: cast,
    };
    // Tùy chọn: tải poster về local
    if (downloadPoster && posterPath) {
        const uploadsRoot = path_1.default.resolve(__dirname, "..", "..", "uploads");
        const postersDir = path_1.default.join(uploadsRoot, "posters");
        if (!fs_1.default.existsSync(postersDir)) {
            fs_1.default.mkdirSync(postersDir, { recursive: true });
        }
        const extension = path_1.default.extname(posterPath).split("?")[0] || ".jpg";
        const filename = `poster_tmdb_${tmdbId}_${Date.now()}${extension}`;
        const destPath = path_1.default.join(postersDir, filename);
        const saved = await (0, downloadImage_1.downloadImage)(posterPath, destPath);
        if (saved) {
            movie.poster_local = `/storage/posters/${filename}`;
        }
    }
    return movie;
}
/**
 * Detect loại trang web từ URL - hỗ trợ nhiều mirror/clone
 */
function detectStorySite(url) {
    const hostname = new URL(url).hostname.toLowerCase();
    // ✅ FIX: Nettruyen và các mirror/clone
    if (hostname.includes('nettruyen') ||
        hostname.includes('nettruyenmax') ||
        hostname.includes('nagalandcricket') || // Mirror của Nettruyen
        hostname.includes('truyentranh') ||
        (hostname.includes('truyen') && hostname.includes('tranh'))) {
        // Kiểm tra path để xác nhận là Nettruyen-style
        const pathname = new URL(url).pathname.toLowerCase();
        if (pathname.includes('/truyen-tranh/') || pathname.includes('/truyen/')) {
            return 'nettruyen';
        }
    }
    // TruyenVN và các mirror
    if (hostname.includes('truyenvn') ||
        hostname.includes('truyenfull') ||
        hostname.includes('truyensub')) {
        return 'truyenvn';
    }
    // BlogTruyen
    if (hostname.includes('blogtruyen')) {
        return 'blogtruyen';
    }
    // Goctruyentranhvui
    if (hostname.includes('goctruyentranhvui')) {
        return 'goctruyentranhvui';
    }
    // TruyenQQNo và các mirror
    if (hostname.includes('truyenqqno') ||
        hostname.includes('truyenqq') ||
        hostname.includes('qqno')) {
        return 'truyenqqno';
    }
    return 'other';
}
/**
 * Normalize URL chapter về URL truyện chính (theo từng trang)
 * ✅ FIX: Hỗ trợ nhiều trang mirror/clone
 */
function normalizeStoryUrl(url, siteType) {
    try {
        const urlObj = new URL(url);
        let pathname = urlObj.pathname;
        // ✅ FIX: NetTruyen và các mirror/clone (nagalandcricket.com, v.v.)
        if (siteType === 'nettruyen') {
            // Pattern: /truyen-tranh/ten-truyen/chap-1 → /truyen-tranh/ten-truyen
            pathname = pathname
                .replace(/\/chap-\d+.*$/i, '')
                .replace(/\/chapter-\d+.*$/i, '')
                .replace(/\/chuong-\d+.*$/i, '');
        }
        // TruyenQQNo: ...-chap-1.html → ...-8419
        else if (siteType === 'truyenqqno') {
            pathname = pathname
                .replace(/-chap-\d+\.html/i, '')
                .replace(/-chapter-\d+\.html/i, '')
                .replace(/\/chap-\d+\.html/i, '');
        }
        // ✅ FIX: Các trang khác (mirror/clone) - xóa pattern chapter chung
        else {
            pathname = pathname
                .replace(/-chap-\d+\.html/i, '')
                .replace(/-chapter-\d+\.html/i, '')
                .replace(/\/chap-\d+.*$/i, '')
                .replace(/\/chapter-\d+.*$/i, '')
                .replace(/\/chuong-\d+.*$/i, '')
                .replace(/\/ch-\d+.*$/i, '');
        }
        // Xóa .html ở cuối nếu có
        if (pathname.endsWith('.html') || pathname.endsWith('.htm')) {
            pathname = pathname.replace(/\.html?$/, '');
        }
        urlObj.pathname = pathname;
        return urlObj.href;
    }
    catch (e) {
        console.warn(`⚠️ Không thể normalize URL: ${url}`, e);
        return url;
    }
}
/**
 * Fetch HTML với axios + zlib/brotli để xử lý GZIP/DEFLATE/Brotli đúng cách
 * Trả về cheerio loaded object ($) trực tiếp
 */
async function fetchHtml(url, timeoutMs = 12000) {
    try {
        const urlObj = new URL(url);
        const origin = `${urlObj.protocol}//${urlObj.host}`;
        const res = await Promise.race([
            axios_1.default.get(url, {
                responseType: "arraybuffer",
                timeout: timeoutMs,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "vi,en-US;q=0.9,en;q=0.8",
                    "Referer": origin,
                    "Origin": origin,
                    "Sec-Fetch-Site": "same-origin",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-User": "?1",
                    "Sec-Fetch-Dest": "document",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Connection": "keep-alive",
                    "Upgrade-Insecure-Requests": "1",
                    "Cache-Control": "max-age=0",
                },
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Request timeout sau ${timeoutMs}ms`)), timeoutMs)),
        ]);
        let buffer = Buffer.from(res.data);
        const contentEncoding = res.headers['content-encoding']?.toLowerCase() || '';
        // Decompress dựa trên Content-Encoding header
        if (contentEncoding.includes('br') || contentEncoding.includes('brotli')) {
            // Brotli decompression
            const decompressed = (0, brotli_1.decompress)(buffer);
            if (decompressed) {
                buffer = Buffer.from(decompressed);
            }
        }
        else if (contentEncoding.includes('gzip')) {
            // GZIP decompression
            buffer = zlib_1.default.gunzipSync(buffer);
        }
        else if (contentEncoding.includes('deflate')) {
            // DEFLATE decompression
            buffer = zlib_1.default.inflateSync(buffer);
        }
        const html = buffer.toString("utf8");
        if (!html || html.length < 100) {
            throw new Error("HTML quá ngắn hoặc rỗng");
        }
        return (0, cheerio_1.load)(html);
    }
    catch (error) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            throw new Error(`Request timeout sau ${timeoutMs}ms`);
        }
        throw error;
    }
}
/**
 * Crawl metadata từ NetTruyen và các mirror/clone (trang dễ crawl nhất)
 * ✅ FIX: Cải thiện selector để hỗ trợ nhiều trang mirror
 */
async function crawlFromNetTruyen($, baseUrl) {
    const title = $('.title-detail').first().text().trim() ||
        $('h1.title-detail').first().text().trim() ||
        $('.story-detail-info h1').first().text().trim() ||
        $('h1').first().text().trim() ||
        $('h1.title').first().text().trim() ||
        $('meta[property="og:title"]').attr("content")?.trim() ||
        "";
    const author = $('.author a').first().text().trim() ||
        $('.story-detail-info .author').first().text().trim() ||
        $('span:contains("Tác giả")').parent().find('a').first().text().trim() ||
        $('.book-author').first().text().trim() ||
        "";
    const description = $('.detail-content').text().trim() ||
        $('.story-detail-info .detail-content').text().trim() ||
        $('.comic-description').text().trim() ||
        $('.summary').text().trim() ||
        $('.book-description').text().trim() ||
        $('meta[name="description"]').attr("content")?.trim() ||
        "";
    // ✅ FIX: Thêm nhiều selector cho cover image (hỗ trợ mirror/clone)
    let cover = $('.detail-info img').first().attr('src') ||
        $('.story-detail-info img').first().attr('src') ||
        $('.book img').first().attr('src') ||
        $('.book-cover img').first().attr('src') ||
        $('.detail-cover img').first().attr('src') ||
        $('.story-cover img').first().attr('src') ||
        $('meta[property="og:image"]').attr("content") ||
        "";
    // ✅ FIX: Kiểm tra data-src (lazy load) nếu không tìm thấy src
    if (!cover || cover.startsWith("data:") || cover.length < 10) {
        cover =
            $('.detail-info img').first().attr('data-src') ||
                $('.story-detail-info img').first().attr('data-src') ||
                $('.book img').first().attr('data-src') ||
                $('.book-cover img').first().attr('data-src') ||
                $('.detail-cover img').first().attr('data-src') ||
                $('.story-cover img').first().attr('data-src') ||
                $('img[data-src]').first().attr('data-src') ||
                cover || "";
    }
    // ✅ FIX: Kiểm tra data-original (một số trang dùng attribute này)
    if (!cover || cover.startsWith("data:") || cover.length < 10) {
        cover =
            $('.detail-info img').first().attr('data-original') ||
                $('.story-detail-info img').first().attr('data-original') ||
                $('.book img').first().attr('data-original') ||
                $('img[data-original]').first().attr('data-original') ||
                cover || "";
    }
    // Convert relative URL to absolute
    if (cover && !cover.startsWith('http') && !cover.startsWith('data:')) {
        try {
            cover = new URL(cover, baseUrl).href;
        }
        catch (e) {
            console.warn("Không thể parse cover URL:", cover);
        }
    }
    return { title, author, description, cover };
}
/**
 * Crawl metadata từ TruyenVN/TruyenFull
 */
async function crawlFromTruyenVN($, baseUrl) {
    const title = $('.book-title').first().text().trim() ||
        $('h1').first().text().trim() ||
        "";
    const author = $('.book-author').first().text().trim() ||
        $('.author').first().text().trim() ||
        "";
    const description = $('.book-description').text().trim() ||
        $('.summary').text().trim() ||
        "";
    let cover = $('.book-cover img').first().attr('src') ||
        $('.book img').first().attr('src') ||
        "";
    if (cover && !cover.startsWith('http')) {
        try {
            cover = new URL(cover, baseUrl).href;
        }
        catch (e) { }
    }
    return { title, author, description, cover };
}
/**
 * Crawl metadata từ Goctruyentranhvui
 */
async function crawlFromGoctruyentranhvui($, baseUrl) {
    const title = $('h1').first().text().trim() ||
        $('.title').first().text().trim() ||
        "";
    const author = $('.author').first().text().trim() ||
        $('span:contains("Tác giả")').next().text().trim() ||
        "";
    const description = $('.description').text().trim() ||
        $('.summary').text().trim() ||
        "";
    let cover = $('.cover img').first().attr('src') ||
        $('.book-cover img').first().attr('src') ||
        "";
    if (cover && !cover.startsWith('http')) {
        try {
            cover = new URL(cover, baseUrl).href;
        }
        catch (e) { }
    }
    return { title, author, description, cover };
}
/**
 * Crawl metadata từ TruyenQQNo (cấu trúc HTML đặc biệt)
 */
async function crawlFromTruyenQQNo($, baseUrl) {
    const title = $('h1').first().text().trim() ||
        $('.book-title').first().text().trim() ||
        $('.title-detail').first().text().trim() ||
        $('meta[property="og:title"]').attr("content")?.trim() ||
        "";
    const author = $('.author').first().text().trim() ||
        $('.book-author').first().text().trim() ||
        $('span:contains("Tác giả")').parent().find('a').first().text().trim() ||
        "";
    const description = $('.summary').text().trim() ||
        $('.book-description').text().trim() ||
        $('.detail-content').text().trim() ||
        $('.comic-description').text().trim() ||
        $('meta[name="description"]').attr("content")?.trim() ||
        "";
    // ✅ FIX: Thêm nhiều selector cho cover image của TruyenQQNo
    let cover = $('.book img').first().attr('src') ||
        $('.book-cover img').first().attr('src') ||
        $('.detail-info img').first().attr('src') ||
        $('.story-detail-info img').first().attr('src') ||
        $('.detail-cover img').first().attr('src') ||
        $('.book-detail img').first().attr('src') ||
        $('.story-cover img').first().attr('src') ||
        $('meta[property="og:image"]').attr("content") ||
        "";
    // ✅ FIX: Kiểm tra data-src (lazy load) nếu không tìm thấy src
    if (!cover || cover.startsWith("data:") || cover.length < 10) {
        cover =
            $('.book img').first().attr('data-src') ||
                $('.book-cover img').first().attr('data-src') ||
                $('.detail-info img').first().attr('data-src') ||
                $('.story-detail-info img').first().attr('data-src') ||
                $('.detail-cover img').first().attr('data-src') ||
                $('.book-detail img').first().attr('data-src') ||
                $('.story-cover img').first().attr('data-src') ||
                $('img[data-src]').first().attr('data-src') ||
                cover || "";
    }
    // ✅ FIX: Kiểm tra data-original (một số trang dùng attribute này)
    if (!cover || cover.startsWith("data:") || cover.length < 10) {
        cover =
            $('.book img').first().attr('data-original') ||
                $('.book-cover img').first().attr('data-original') ||
                $('.detail-info img').first().attr('data-original') ||
                $('img[data-original]').first().attr('data-original') ||
                cover || "";
    }
    // Convert relative URL to absolute
    if (cover && !cover.startsWith('http') && !cover.startsWith('data:')) {
        try {
            cover = new URL(cover, baseUrl).href;
        }
        catch (e) {
            console.warn("Không thể parse cover URL:", cover);
        }
    }
    return { title, author, description, cover };
}
function parseNettruyenChapters($, baseUrl) {
    const chapters = [];
    $(".list-chapter li a").each((_, el) => {
        chapters.push({
            title: $(el).text().trim(),
            url: $(el).attr("href") || "",
        });
    });
    if (chapters.length === 0) {
        $(".row .chapter a").each((_, el) => {
            chapters.push({
                title: $(el).text().trim(),
                url: $(el).attr("href") || "",
            });
        });
    }
    return buildChapterList(chapters, { baseUrl, ascending: false });
}
function parseTruyenQQChapters($, baseUrl) {
    const chapters = [];
    $("ul.list-chapter li a, .works-chapter-list a").each((_, el) => {
        let url = $(el).attr("href") || "";
        if (url && !url.startsWith("http")) {
            url = new URL(url, baseUrl).href;
        }
        chapters.push({
            title: $(el).text().trim(),
            url,
        });
    });
    return buildChapterList(chapters, { baseUrl, ascending: true });
}
function parseTruyenVNChapters($, baseUrl) {
    const chapters = [];
    $(".list-chapter li a, .chapter-list a, ul#list-chapter li a").each((_, el) => {
        chapters.push({
            title: $(el).text().trim(),
            url: $(el).attr("href") || "",
        });
    });
    return buildChapterList(chapters, { baseUrl, ascending: true });
}
function parseGenericChapters($, baseUrl) {
    const chapters = [];
    $(".list-chapter li a, .chapter-list a, #list-chapter a, a.chapter-name, a[data-chapter]").each((_, el) => {
        chapters.push({
            title: $(el).text().trim(),
            url: $(el).attr("href") || "",
        });
    });
    return buildChapterList(chapters, { baseUrl, ascending: true });
}
/**
 * Crawl metadata truyện từ các trang VN (NetTruyen, TruyenVN, Goctruyentranhvui...)
 * @param url URL trang truyện (có thể là URL chapter, sẽ tự động chuyển về URL truyện)
 * @param downloadCover Có tải cover về local không
 * @returns Metadata truyện
 */
async function crawlStoryWithSite(url, siteType, downloadCover = false) {
    console.log(`🌐 Trying site type: ${siteType}`);
    let storyUrl = url;
    let $;
    try {
        // Bước 1: Normalize URL chapter về URL truyện chính (theo từng trang)
        const normalizedUrl = normalizeStoryUrl(url, siteType);
        console.log(`📖 Normalized URL: ${url} → ${normalizedUrl}`);
        // Bước 2: Fetch HTML (ưu tiên normalized URL, fallback URL gốc)
        let fetchSuccess = false;
        // Thử fetch từ normalized URL trước
        try {
            $ = await fetchHtml(normalizedUrl, 10000); // Timeout ngắn hơn cho trang dễ crawl
            storyUrl = normalizedUrl;
            fetchSuccess = true;
            console.log(`✅ Fetch thành công từ normalized URL`);
        }
        catch (e) {
            console.log(`⚠️ Normalized URL không work: ${e.message}`);
        }
        // Nếu normalized URL fail, thử URL gốc
        if (!fetchSuccess) {
            try {
                $ = await fetchHtml(url, 10000);
                // Tìm link truyện chính từ breadcrumb (chỉ cho trang khó crawl như truyenqqno)
                if (siteType === 'truyenqqno' || siteType === 'other') {
                    let breadcrumbLink = "";
                    // Tìm link có /truyen-tranh/ và không có -chap-
                    const allStoryLinks = $('a[href*="/truyen-tranh/"]').filter((i, el) => {
                        const href = $(el).attr('href') || '';
                        return href.includes('/truyen-tranh/') &&
                            !href.includes('-chap-') &&
                            !href.includes('-chapter-') &&
                            !href.includes('/chap-');
                    });
                    if (allStoryLinks.length > 0) {
                        breadcrumbLink = allStoryLinks.eq(1).attr('href') || allStoryLinks.first().attr('href') || "";
                    }
                    if (!breadcrumbLink) {
                        breadcrumbLink =
                            $('.breadcrumb a').eq(1).attr('href') ||
                                $('nav a').eq(1).attr('href') ||
                                "";
                    }
                    if (breadcrumbLink) {
                        try {
                            const baseUrl = new URL(url);
                            storyUrl = new URL(breadcrumbLink, baseUrl.origin).href;
                            console.log(`✅ Tìm thấy link truyện chính từ breadcrumb: ${storyUrl}`);
                            $ = await fetchHtml(storyUrl, 10000);
                        }
                        catch (e) {
                            console.warn("Không thể fetch từ link breadcrumb:", e.message);
                        }
                    }
                }
            }
            catch (fetchError) {
                throw new Error(`Không thể fetch HTML: ${fetchError.message}`);
            }
        }
        // Crawl metadata theo từng loại trang
        let title = "";
        let author = "";
        let description = "";
        let cover = "";
        let chapterList = [];
        if (siteType === 'nettruyen') {
            const data = await crawlFromNetTruyen($, storyUrl);
            title = data.title;
            author = data.author;
            description = data.description;
            cover = data.cover;
            chapterList = parseNettruyenChapters($, storyUrl);
        }
        else if (siteType === 'truyenvn') {
            const data = await crawlFromTruyenVN($, storyUrl);
            title = data.title;
            author = data.author;
            description = data.description;
            cover = data.cover;
            chapterList = parseTruyenVNChapters($, storyUrl);
        }
        else if (siteType === 'goctruyentranhvui') {
            const data = await crawlFromGoctruyentranhvui($, storyUrl);
            title = data.title;
            author = data.author;
            description = data.description;
            cover = data.cover;
            chapterList = parseGenericChapters($, storyUrl);
        }
        else if (siteType === 'truyenqqno') {
            // ✅ FIX: Dùng hàm crawl riêng cho TruyenQQNo với selector phù hợp
            const data = await crawlFromTruyenQQNo($, storyUrl);
            title = data.title;
            author = data.author;
            description = data.description;
            cover = data.cover;
            chapterList = parseTruyenQQChapters($, storyUrl);
        }
        else if (siteType === 'blogtruyen') {
            const data = await crawlFromNetTruyen($, storyUrl);
            title = data.title;
            author = data.author;
            description = data.description;
            cover = data.cover;
            chapterList = parseGenericChapters($, storyUrl);
        }
        else {
            // ✅ FIX: Fallback selectors chung - hỗ trợ nhiều trang mirror/clone
            // Thử dùng selector của Nettruyen trước (nhiều trang mirror dùng cấu trúc tương tự)
            try {
                const nettruyenData = await crawlFromNetTruyen($, storyUrl);
                if (nettruyenData.title && nettruyenData.cover) {
                    title = nettruyenData.title;
                    author = nettruyenData.author;
                    description = nettruyenData.description;
                    cover = nettruyenData.cover;
                    console.log(`✅ Dùng selector Nettruyen cho trang mirror/clone`);
                }
                else {
                    throw new Error("Nettruyen selector không tìm thấy đủ dữ liệu");
                }
            }
            catch (e) {
                // Nếu selector Nettruyen không work, dùng fallback chung
                console.log(`⚠️ Selector Nettruyen không work, dùng fallback chung`);
                title =
                    $("h1.title").first().text().trim() ||
                        $(".book-title").first().text().trim() ||
                        $("h1").first().text().trim() ||
                        $(".detail-name").first().text().trim() ||
                        $('meta[property="og:title"]').attr("content")?.trim() ||
                        "";
                author =
                    $(".author a").first().text().trim() ||
                        $(".book-author").first().text().trim() ||
                        $(".detail-author a").first().text().trim() ||
                        "";
                description =
                    $(".summary").text().trim() ||
                        $(".book-description").text().trim() ||
                        $(".detail-content").text().trim() ||
                        $('meta[name="description"]').attr("content")?.trim() ||
                        "";
                cover =
                    $(".book img").first().attr("src") ||
                        $(".book-cover img").first().attr("src") ||
                        $(".detail-cover img").first().attr("src") ||
                        $(".book-detail img").first().attr("src") ||
                        $(".story-cover img").first().attr("src") ||
                        $('meta[property="og:image"]').attr("content") ||
                        "";
                // ✅ FIX: Kiểm tra data-src (lazy load) từ nhiều selector
                if (!cover || cover.startsWith("data:") || cover.length < 10) {
                    cover =
                        $(".book img").first().attr("data-src") ||
                            $(".book-cover img").first().attr("data-src") ||
                            $(".detail-cover img").first().attr("data-src") ||
                            $(".book-detail img").first().attr("data-src") ||
                            $(".story-cover img").first().attr("data-src") ||
                            $("img[data-src]").first().attr("data-src") ||
                            cover || "";
                }
                // ✅ FIX: Kiểm tra data-original
                if (!cover || cover.startsWith("data:") || cover.length < 10) {
                    cover =
                        $(".book img").first().attr("data-original") ||
                            $(".book-cover img").first().attr("data-original") ||
                            $("img[data-original]").first().attr("data-original") ||
                            cover || "";
                }
            }
        }
        // Nếu cover là relative URL, chuyển thành absolute
        if (cover && !cover.startsWith("http")) {
            try {
                const baseUrl = new URL(storyUrl);
                cover = new URL(cover, baseUrl.origin).href;
            }
            catch (e) {
                console.warn("Không thể parse cover URL:", cover);
            }
        }
        // ✅ DEBUG: Log cover được tìm thấy
        if (cover) {
            console.log(`🖼️ Cover tìm thấy: ${cover}`);
        }
        else {
            console.warn(`⚠️ Không tìm thấy cover image từ siteType: ${siteType}`);
        }
        if (!chapterList || chapterList.length === 0) {
            chapterList = parseGenericChapters($, storyUrl);
        }
        // ✅ FIX: Đảm bảo cover_url luôn được set nếu có cover
        const series = {
            title: title,
            author: author,
            description: description,
            cover_url: cover || null, // ✅ Luôn set cover_url nếu có
            cover_local: null,
            chapters: chapterList,
            source_site: siteType,
            story_url: storyUrl,
        };
        // ✅ FIX: Tải cover về local khi có cover URL và downloadCover = true
        console.log(`🔍 [COVER] Check download: downloadCover=${downloadCover}, cover=${!!cover}, cover_url=${cover || 'null'}`);
        if (downloadCover && cover) {
            console.log(`📥 [COVER] Đang tải cover từ: ${cover}`);
            console.log(`📥 [COVER] Story URL (referer): ${storyUrl}`);
            const uploadsRoot = path_1.default.resolve(__dirname, "..", "..", "uploads");
            const coversDir = path_1.default.join(uploadsRoot, "covers");
            if (!fs_1.default.existsSync(coversDir)) {
                fs_1.default.mkdirSync(coversDir, { recursive: true });
            }
            try {
                const urlObj = new URL(cover);
                const extension = path_1.default.extname(urlObj.pathname).split("?")[0] || ".jpg";
                const filename = `cover_${Date.now()}${extension}`;
                const destPath = path_1.default.join(coversDir, filename);
                console.log(`💾 [COVER] Đang lưu cover vào: ${destPath}`);
                // ✅ FIX: Truyền storyUrl làm referer để tránh 403 Forbidden
                const saved = await (0, downloadImage_1.downloadImage)(cover, destPath, storyUrl);
                if (saved) {
                    series.cover_local = `/storage/covers/${filename}`;
                    console.log(`✅ [COVER] Đã tải cover thành công: ${series.cover_local}`);
                }
                else {
                    console.warn(`⚠️ [COVER] Không thể tải cover từ: ${cover} (có thể bị chặn 403 hoặc timeout)`);
                    // ✅ FIX: Nếu không tải được, vẫn giữ cover_url để FE có thể dùng
                    series.cover_url = cover;
                }
            }
            catch (e) {
                console.error(`❌ [COVER] Lỗi khi tải cover từ ${cover}:`, e.message || e);
                // ✅ FIX: Nếu lỗi, vẫn giữ cover_url
                series.cover_url = cover;
            }
        }
        else if (cover) {
            console.log(`ℹ️ [COVER] Cover URL tìm thấy nhưng không tải về local (downloadCover=${downloadCover}): ${cover}`);
            // ✅ FIX: Nếu không download, vẫn set cover_url để FE có thể dùng
            series.cover_url = cover;
        }
        else {
            console.warn(`⚠️ [COVER] Không tìm thấy cover image cho truyện (siteType: ${siteType})`);
        }
        return series;
    }
    catch (error) {
        // Xử lý các loại lỗi
        if (error.message?.includes('timeout') || error.message?.includes('Request timeout')) {
            throw new Error("Request timeout - Trang web phản hồi quá chậm (>12 giây). Vui lòng thử lại hoặc kiểm tra URL.");
        }
        if (error.message) {
            throw new Error(`Lỗi khi crawl truyện: ${error.message}`);
        }
        throw new Error(error.message || "Unknown error khi crawl truyện");
    }
}
async function crawlStoryFromVN(url, downloadCover = false) {
    const detected = detectStorySite(url);
    const candidates = [
        detected,
        ...STORY_SITE_PRIORITY.filter((site) => site !== detected),
    ];
    const errors = [];
    // ✅ FIX: Thử crawl từ nhiều nguồn, nếu một trang bị chặn thì thử trang khác
    for (const site of candidates) {
        try {
            console.log(`🔄 Đang thử crawl từ site type: ${site}`);
            const result = await crawlStoryWithSite(url, site, downloadCover);
            // ✅ Kiểm tra xem có đủ dữ liệu không
            if (result.title && result.cover_url) {
                console.log(`✅ Crawl thành công từ ${site}: ${result.title}`);
                return result;
            }
            else {
                throw new Error(`Không tìm thấy đủ dữ liệu (title: ${!!result.title}, cover: ${!!result.cover_url})`);
            }
        }
        catch (error) {
            const errorMsg = error.message || "Unknown error";
            errors.push(`[${site}] ${errorMsg}`);
            console.warn(`⚠️ Crawl từ ${site} thất bại: ${errorMsg}`);
            // ✅ Nếu là lỗi timeout hoặc connection, tiếp tục thử site khác
            if (errorMsg.includes('timeout') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND') || errorMsg.includes('chặn')) {
                console.log(`🔄 Trang ${site} có thể bị chặn, thử trang khác...`);
                continue;
            }
        }
    }
    throw new Error(errors.length > 0
        ? `Không crawl được truyện từ các nguồn dự phòng: ${errors.join(" | ")}`
        : "Không thể crawl truyện");
}
function extractChapterImageSources($, chapterUrl, selectors) {
    const images = [];
    selectors.forEach((selector) => {
        $(selector).each((_, el) => {
            const src = $(el).attr("data-original") ||
                $(el).attr("data-src") ||
                $(el).attr("data-aload") ||
                $(el).attr("data-lazy-src") ||
                $(el).attr("src");
            if (src) {
                const absolute = resolveToAbsoluteUrl(src, chapterUrl);
                images.push(absolute);
            }
        });
    });
    return images;
}
function parseChapterImagesBySite(site, $, chapterUrl) {
    if (site === "nettruyen") {
        return extractChapterImageSources($, chapterUrl, [
            "img.chapter-img",
            ".reading-detail img",
            ".page-chapter img",
            ".reading img",
        ]);
    }
    if (site === "truyenqqno") {
        return extractChapterImageSources($, chapterUrl, [
            ".page-chapter img",
            ".story-see-content img",
            ".reading-detail img",
        ]);
    }
    if (site === "truyenvn" || site === "blogtruyen") {
        return extractChapterImageSources($, chapterUrl, [
            "#chapter-content img",
            ".reading img",
            ".content img",
        ]);
    }
    return extractChapterImageSources($, chapterUrl, [
        ".chapter-content img",
        ".reading-detail img",
        ".page-chapter img",
        "img[data-original]",
    ]);
}
async function crawlChapterImagesForSite(chapterUrl, site) {
    const timeout = site === "truyenqqno" ? 15000 : 11000;
    const $ = await fetchHtml(chapterUrl, timeout);
    let images = parseChapterImagesBySite(site, $, chapterUrl);
    if (images.length === 0 && site !== "other") {
        images = parseChapterImagesBySite("other", $, chapterUrl);
    }
    return dedupeStrings(images);
}
function normalizeChapterFolderName(options) {
    const slugParts = [];
    if (options.storySlug) {
        slugParts.push((0, slugify_1.default)(options.storySlug, { lower: true, strict: true }) ||
            options.storySlug);
    }
    else if (options.storyTitle) {
        slugParts.push((0, slugify_1.default)(options.storyTitle, { lower: true, strict: true }) || "story");
    }
    if (options.chapterId) {
        slugParts.push(options.chapterId);
    }
    else if (options.chapterSlug) {
        slugParts.push(options.chapterSlug);
    }
    else if (options.chapterTitle) {
        slugParts.push((0, slugify_1.default)(options.chapterTitle, { lower: true, strict: true }) ||
            "chapter");
    }
    const key = slugParts.filter(Boolean).join("-") ||
        `chapter-${Math.floor(Date.now() / 1000)}`;
    return key;
}
function ensureUniqueChapterFolder(rootDir, key) {
    let finalKey = key;
    let attempt = 1;
    while (fs_1.default.existsSync(path_1.default.join(rootDir, finalKey))) {
        finalKey = `${key}-${Date.now()}-${attempt}`;
        attempt += 1;
        if (attempt > 3) {
            break;
        }
    }
    return finalKey;
}
function toStoragePath(filePath) {
    if (!filePath)
        return filePath;
    const normalized = filePath.replace(/\\/g, "/");
    if (normalized.startsWith("/storage/")) {
        return normalized;
    }
    const uploadsMarker = "/uploads/";
    const idx = normalized.indexOf(uploadsMarker);
    if (idx !== -1) {
        const relative = normalized.substring(idx + uploadsMarker.length);
        return `/storage/${relative}`.replace(/\/+/g, "/");
    }
    return normalized.replace(/^uploads/i, "/storage");
}
async function saveChapterImagesToStorage(images, options) {
    if (!images || images.length === 0) {
        return { saved: [], folder: null };
    }
    const uploadsRoot = path_1.default.resolve(__dirname, "..", "..", "uploads");
    const chaptersRoot = path_1.default.join(uploadsRoot, "chapters");
    if (!fs_1.default.existsSync(chaptersRoot)) {
        fs_1.default.mkdirSync(chaptersRoot, { recursive: true });
    }
    const rawFolderKey = normalizeChapterFolderName(options);
    const folderKey = ensureUniqueChapterFolder(chaptersRoot, rawFolderKey);
    const destFolder = path_1.default.join(chaptersRoot, folderKey);
    if (!fs_1.default.existsSync(destFolder)) {
        fs_1.default.mkdirSync(destFolder, { recursive: true });
    }
    const saved = [];
    // ✅ FIX: Dùng chapterUrl làm referer để tránh 403 Forbidden
    const refererUrl = options.chapterUrl || undefined;
    for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i];
        const ext = getImageExtension(imageUrl);
        const filename = `${String(i + 1).padStart(3, "0")}${ext}`;
        const destPath = path_1.default.join(destFolder, filename);
        try {
            const success = await (0, downloadImage_1.downloadImage)(imageUrl, destPath, refererUrl);
            if (success) {
                saved.push(toStoragePath(destPath));
            }
        }
        catch (error) {
            console.warn("⚠️ Miss image:", imageUrl, error);
        }
    }
    return { saved, folder: saved.length > 0 ? `/storage/chapters/${folderKey}` : null };
}
async function crawlChapterWithFallback(options) {
    const targetUrl = options.chapterUrl || options.url;
    if (!targetUrl) {
        throw new Error("Thiếu chapterUrl để crawl");
    }
    const detected = detectStorySite(targetUrl);
    const order = [detected, ...STORY_SITE_PRIORITY.filter((site) => site !== detected)];
    const errors = [];
    for (const site of order) {
        try {
            const images = await crawlChapterImagesForSite(targetUrl, site);
            if (!images || images.length === 0) {
                errors.push(`[${site}] Không tìm thấy ảnh`);
                continue;
            }
            let savedImages = [];
            let folder = null;
            if (options.saveToDisk !== false) {
                // ✅ FIX: Truyền chapterUrl làm referer để tránh 403 Forbidden
                const savedResult = await saveChapterImagesToStorage(images, {
                    chapterId: options.chapterId,
                    chapterSlug: options.chapterSlug,
                    chapterTitle: options.chapterTitle,
                    storySlug: options.storySlug,
                    storyTitle: options.storyTitle,
                    site,
                    chapterUrl: targetUrl, // ✅ FIX: Dùng chapterUrl làm referer
                });
                savedImages = savedResult.saved;
                folder = savedResult.folder;
            }
            return {
                site,
                chapterUrl: targetUrl,
                imageCount: images.length,
                images,
                savedImages,
                storageFolder: folder,
            };
        }
        catch (error) {
            errors.push(`[${site}] ${error.message || error}`);
            continue;
        }
    }
    throw new Error(`Không crawl được từ bất kỳ nguồn nào: ${errors.join(" | ")}`);
}
// =============================================
// MOVIE CRAWL FUNCTIONS (70% dùng chung + 30% riêng)
// =============================================
const MOVIE_SITE_PRIORITY = [
    "animehay",
    "animevietsub",
    "phimmoi",
    "hdonline",
    "phim1080",
    "phimbathu",
    "other",
];
/**
 * Detect loại trang web phim từ URL
 */
function detectMovieSite(url) {
    const hostname = new URL(url).hostname.toLowerCase();
    // AnimeHay và các mirror
    if (hostname.includes('animehay') ||
        hostname.includes('animehay.life') ||
        hostname.includes('animehay.tv') ||
        hostname.includes('ahay.in')) {
        return 'animehay';
    }
    // AnimeVietsub và các mirror
    if (hostname.includes('animevietsub') ||
        hostname.includes('animevietsub.show') ||
        hostname.includes('animevietsub.tv')) {
        return 'animevietsub';
    }
    if (hostname.includes('phimmoi') || hostname.includes('phimmoi.net')) {
        return 'phimmoi';
    }
    if (hostname.includes('hdonline') || hostname.includes('hdonline.vn')) {
        return 'hdonline';
    }
    if (hostname.includes('phim1080') || hostname.includes('1080phim')) {
        return 'phim1080';
    }
    if (hostname.includes('phimbathu') || hostname.includes('bathu')) {
        return 'phimbathu';
    }
    return 'other';
}
/**
 * Normalize URL episode về URL phim chính (tương tự normalizeStoryUrl)
 * ✅ FIX: AnimeHay BẮT BUỘC phải có .html, không được xóa
 */
function normalizeMovieUrl(url, siteType) {
    try {
        // ✅ FIX: AnimeHay - KHÔNG normalize, giữ nguyên URL 100% vì bắt buộc có .html
        if (siteType === 'animehay') {
            // AnimeHay: URL phim luôn là .../something.html
            // Nếu URL đã là URL phim (không có /tap-xxx hoặc -tap-xxx-), giữ nguyên
            // Pattern: /tap-xxx hoặc -tap-xxx- (trong pathname)
            const hasTapPattern = url.match(/\/tap-\d+/i) || url.match(/-tap-\d+-/i) || url.match(/\/episode-\d+/i) || url.match(/\/ep-\d+/i);
            if (!hasTapPattern) {
                return url; // URL đã là URL phim chính, không cần normalize
            }
            // Nếu URL có /tap-xxx.html hoặc -tap-xxx-, chỉ xóa phần tap-xxx nhưng GIỮ .html
            const urlObj = new URL(url);
            let pathname = urlObj.pathname;
            // Xử lý pattern -tap-xxx- trong pathname (ví dụ: ...-tap-1-72170.html)
            // Chỉ xóa phần -tap-xxx- nhưng giữ .html
            pathname = pathname
                .replace(/-tap-\d+-\d+\.html$/i, '.html') // ...-tap-24-76101.html → ...html
                .replace(/-tap-\d+-\d+-/i, '-') // ...-tap-24-76101-... → ...-...
                .replace(/-tap-\d+\.html$/i, '.html') // ...-tap-1.html → ...html
                .replace(/-tap-\d+-/i, '-') // ...-tap-1-... → ...-...
                .replace(/\/tap-\d+-\d+\.html$/i, '.html') // /tap-24-76101.html → .html
                .replace(/\/tap-\d+\.html$/i, '.html') // /tap-1.html → .html
                .replace(/\/tap-\d+$/i, ''); // /tap-1 → ''
            // QUAN TRỌNG: Đảm bảo có .html ở cuối (AnimeHay bắt buộc)
            if (url.endsWith('.html') && !pathname.endsWith('.html')) {
                pathname = pathname + '.html';
            }
            urlObj.pathname = pathname;
            return urlObj.href;
        }
        // ✅ AnimeVietsub - có thể normalize vì hỗ trợ URL không có .html
        if (siteType === 'animevietsub') {
            const urlObj = new URL(url);
            let pathname = urlObj.pathname;
            // Xóa phần /tap-xxx.html hoặc /tap-xxx
            pathname = pathname
                .replace(/\/tap-\d+-\d+\.html$/i, '') // /tap-24-76101.html → ''
                .replace(/\/tap-\d+\.html$/i, '') // /tap-1.html → ''
                .replace(/\/tap-\d+$/i, ''); // /tap-1 → ''
            urlObj.pathname = pathname;
            return urlObj.href;
        }
        // Các trang khác: xóa pattern episode/tập phim
        const urlObj = new URL(url);
        let pathname = urlObj.pathname;
        pathname = pathname
            .replace(/\/tap-\d+.*$/i, '')
            .replace(/\/episode-\d+.*$/i, '')
            .replace(/\/ep-\d+.*$/i, '')
            .replace(/\/season-\d+.*$/i, '');
        // Xóa .html ở cuối nếu có (cho các trang khác)
        if (pathname.endsWith('.html') || pathname.endsWith('.htm')) {
            pathname = pathname.replace(/\.html?$/, '');
        }
        urlObj.pathname = pathname;
        return urlObj.href;
    }
    catch (e) {
        console.warn(`⚠️ Không thể normalize URL phim: ${url}`, e);
        return url;
    }
}
/**
 * Build episode list từ raw episodes (tương tự buildChapterList)
 */
function buildEpisodeList(rawEpisodes, options = { baseUrl: "" }) {
    if (!rawEpisodes || rawEpisodes.length === 0) {
        return [];
    }
    const normalized = rawEpisodes
        .map((item, index) => {
        const resolvedUrl = resolveToAbsoluteUrl(item.url, options.baseUrl);
        const seasonNum = item.seasonNumber || 1;
        const episodeNum = item.episodeNumber || (index + 1);
        return {
            title: item.title?.trim() || `Tập ${episodeNum}`,
            url: resolvedUrl,
            seasonNumber: seasonNum,
            episodeNumber: episodeNum,
            videoUrl: item.videoUrl || null,
            videoBackupUrl: null,
            subtitleUrl: null,
            serverName: item.serverName || null,
            duration: null,
            quality: null,
        };
    })
        .filter((item) => !!item.url);
    const ordered = options.ascending === false ? normalized.slice().reverse() : normalized;
    return ordered.map((item, index) => ({
        ordinal: index + 1,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        title: item.title,
        url: item.url,
        videoUrl: item.videoUrl,
        videoBackupUrl: item.videoBackupUrl,
        subtitleUrl: item.subtitleUrl,
        serverName: item.serverName,
        duration: item.duration,
        quality: item.quality,
    }));
}
/**
 * Crawl metadata phim từ PhimMoi (ví dụ - cần customize theo từng trang)
 */
async function crawlFromPhimMoi($, baseUrl) {
    const title = $('h1.movie-title').first().text().trim() ||
        $('.movie-info h1').first().text().trim() ||
        $('h1').first().text().trim() ||
        $('meta[property="og:title"]').attr("content")?.trim() ||
        "";
    const description = $('.movie-description').text().trim() ||
        $('.movie-info .description').text().trim() ||
        $('meta[name="description"]').attr("content")?.trim() ||
        "";
    let poster = $('.movie-poster img').first().attr('src') ||
        $('.movie-info img').first().attr('src') ||
        $('meta[property="og:image"]').attr("content") ||
        "";
    // Kiểm tra data-src (lazy load)
    if (!poster || poster.startsWith("data:") || poster.length < 10) {
        poster =
            $('.movie-poster img').first().attr('data-src') ||
                $('.movie-info img').first().attr('data-src') ||
                poster || "";
    }
    // Convert relative URL to absolute
    if (poster && !poster.startsWith('http') && !poster.startsWith('data:')) {
        try {
            poster = new URL(poster, baseUrl).href;
        }
        catch (e) {
            console.warn("Không thể parse poster URL:", poster);
        }
    }
    const trailer = $('.trailer iframe').first().attr('src') ||
        $('iframe[src*="youtube"]').first().attr('src') ||
        null;
    // Parse metadata từ info box
    const infoText = $('.movie-info').text() || "";
    const releaseYearMatch = infoText.match(/(\d{4})/);
    const releaseYear = releaseYearMatch ? Number(releaseYearMatch[1]) : null;
    const durationMatch = infoText.match(/(\d+)\s*phút/i);
    const duration = durationMatch ? Number(durationMatch[1]) : null;
    // Kiểm tra type (movie hay series)
    const type = $('.movie-type').text().toLowerCase().includes('bộ') ||
        $('.episode-list').length > 0
        ? "series"
        : "movie";
    return {
        title,
        description,
        poster,
        trailer,
        releaseYear,
        duration,
        country: null, // Cần parse từ info box
        director: null, // Cần parse từ info box
        cast: null, // Cần parse từ info box
        genres: "", // Cần parse từ categories
        rating: 0,
        type,
    };
}
/**
 * Parse episodes từ PhimMoi (ví dụ - cần customize theo từng trang)
 */
function parsePhimMoiEpisodes($, baseUrl) {
    const episodes = [];
    $(".episode-list a, .list-episode a").each((_, el) => {
        episodes.push({
            title: $(el).text().trim(),
            url: $(el).attr("href") || "",
        });
    });
    return buildEpisodeList(episodes, { baseUrl, ascending: true });
}
/**
 * Crawl metadata phim từ các trang VN (tương tự crawlStoryWithSite)
 * Tái sử dụng 70% logic: fetchHtml, normalize URL, error handling
 */
async function crawlMovieWithSite(url, siteType, downloadPoster = false) {
    console.log(`🌐 Trying movie site type: ${siteType}`);
    let movieUrl = url;
    let $;
    try {
        // Bước 1: Normalize URL episode về URL phim chính
        const normalizedUrl = normalizeMovieUrl(url, siteType);
        console.log(`📖 Normalized URL: ${url} → ${normalizedUrl}`);
        // Bước 2: Fetch HTML (tái sử dụng 70% logic)
        let fetchSuccess = false;
        try {
            $ = await fetchHtml(normalizedUrl, 10000);
            movieUrl = normalizedUrl;
            fetchSuccess = true;
            console.log(`✅ Fetch thành công từ normalized URL`);
        }
        catch (e) {
            console.log(`⚠️ Normalized URL không work: ${e.message}`);
        }
        if (!fetchSuccess) {
            try {
                $ = await fetchHtml(url, 10000);
            }
            catch (fetchError) {
                throw new Error(`Không thể fetch HTML: ${fetchError.message}`);
            }
        }
        // Crawl metadata theo từng loại trang (30% riêng cho phim)
        let title = "";
        let description = "";
        let poster = "";
        let trailer = null;
        let releaseYear = null;
        let duration = null;
        let country = null;
        let director = null;
        let cast = null;
        let genres = "";
        let rating = 0;
        let type = "movie";
        let episodeList = [];
        if (siteType === 'phimmoi') {
            const data = await crawlFromPhimMoi($, movieUrl);
            title = data.title;
            description = data.description;
            poster = data.poster;
            trailer = data.trailer;
            releaseYear = data.releaseYear;
            duration = data.duration;
            country = data.country;
            director = data.director;
            cast = data.cast;
            genres = data.genres;
            rating = data.rating;
            type = data.type;
            episodeList = parsePhimMoiEpisodes($, movieUrl);
        }
        else if (siteType === 'animehay' || siteType === 'animevietsub') {
            // ✅ FIX: Crawl từ AnimeHay hoặc AnimeVietsub với selector đúng 100%
            console.log(`[CRAWL] Crawling từ ${siteType}...`);
            // ✅ FIX: Title - AnimeHay dùng h1.name-vi hoặc h1.title-vi (selector đúng 100%)
            title =
                $('h1.name-vi').first().text().trim() ||
                    $('h1.title-vi').first().text().trim() ||
                    $('h1.name').first().text().trim() ||
                    $('h1.title').first().text().trim() ||
                    $('.movie-info h1').first().text().trim() ||
                    $('.anime-info h1').first().text().trim() ||
                    $('.movie-detail h1').first().text().trim() ||
                    $('h1').first().text().trim() ||
                    $('meta[property="og:title"]').attr("content")?.trim() ||
                    "";
            // Loại bỏ các ký tự không cần thiết
            if (title) {
                title = title.replace(/\s+/g, ' ').trim();
                // Loại bỏ phần "Xem phim", "Anime", "Phim", "AnimeHay" ở đầu
                title = title.replace(/^(Xem phim|Anime|Phim|AnimeHay|404|Trang không tồn tại)\s*/i, '').trim();
                // Loại bỏ phần "| AnimeHay" ở cuối
                title = title.replace(/\s*\|\s*AnimeHay.*$/i, '').trim();
            }
            console.log(`[CRAWL] Title tìm thấy: "${title}" (length: ${title.length})`);
            // ✅ FIX: Kiểm tra nếu title là 404/Not Found/Trang không tồn tại → có thể đang fetch trang 404
            if (!title || title.length < 2 ||
                title.includes('404') ||
                title.includes('không tồn tại') ||
                title.includes('Not Found') ||
                title.includes('Trang không tồn tại') ||
                title.toLowerCase() === 'animehay') {
                console.warn(`[CRAWL] ⚠️ Detect trang 404 hoặc title không hợp lệ: "${title}"`);
                console.warn(`[CRAWL] ⚠️ URL hiện tại: ${movieUrl}`);
                console.warn(`[CRAWL] ⚠️ URL gốc: ${url}`);
                // Nếu URL đã bị normalize và mất .html, thử lại với URL gốc
                if (movieUrl !== url && url.endsWith('.html') && !movieUrl.endsWith('.html')) {
                    try {
                        console.log(`[CRAWL] 🔄 URL đã mất .html, thử lại với URL gốc: ${url}`);
                        $ = await fetchHtml(url, 10000);
                        movieUrl = url;
                        // Parse lại title với selector đúng
                        title =
                            $('h1.name-vi').first().text().trim() ||
                                $('h1.title-vi').first().text().trim() ||
                                $('h1.name').first().text().trim() ||
                                $('.movie-info h1').first().text().trim() ||
                                $('meta[property="og:title"]').attr("content")?.trim() ||
                                "";
                        if (title) {
                            title = title.replace(/\s+/g, ' ').trim();
                            title = title.replace(/^(Xem phim|Anime|Phim|AnimeHay|404|Trang không tồn tại)\s*/i, '').trim();
                            title = title.replace(/\s*\|\s*AnimeHay.*$/i, '').trim();
                        }
                        console.log(`[CRAWL] ✅ Title sau khi thử URL gốc: "${title}"`);
                    }
                    catch (e) {
                        console.warn(`[CRAWL] ⚠️ Không thể fetch từ URL gốc: ${e.message}`);
                    }
                }
                else if (movieUrl.endsWith('.html')) {
                    // URL đã có .html nhưng vẫn 404 → có thể URL sai hoặc phim không tồn tại
                    console.error(`[CRAWL] ❌ URL có .html nhưng vẫn trả về 404: ${movieUrl}`);
                }
            }
            // ✅ FIX: Description - AnimeHay có description trong .movie-info hoặc .content
            description =
                $('.movie-info .content').text().trim() ||
                    $('.movie-info .description').text().trim() ||
                    $('.anime-info .content').text().trim() ||
                    $('.anime-info .description').text().trim() ||
                    $('.content').text().trim() ||
                    $('.description').text().trim() ||
                    $('.summary').text().trim() ||
                    $('meta[name="description"]').attr("content")?.trim() ||
                    "";
            // Loại bỏ các phần không cần thiết từ description
            if (description) {
                description = description
                    .replace(/PHIM ĐƯỢC CẬP NHẬT.*?$/i, '')
                    .replace(/Main:.*?$/i, '')
                    .replace(/Vợ:.*?$/i, '')
                    .replace(/Các cấp độ:.*?$/i, '')
                    .replace(/Thể loại:.*?$/i, '')
                    .replace(/Năm sản xuất:.*?$/i, '')
                    .trim();
            }
            console.log(`[CRAWL] Description length: ${description.length}`);
            // ✅ FIX: Poster - AnimeHay dùng .movie-thumbnail img (selector đúng 100%)
            let posterImg = $('.movie-thumbnail img').first().attr('src') ||
                $('.movie-info .movie-thumbnail img').first().attr('src') ||
                $('.anime-info .movie-thumbnail img').first().attr('src') ||
                $('.movie-detail .movie-thumbnail img').first().attr('src') ||
                $('.movie-info img').first().attr('src') ||
                $('.anime-info img').first().attr('src') ||
                $('img[src*="poster"]').first().attr('src') ||
                $('img[src*="cover"]').first().attr('src') ||
                $('.poster img').first().attr('src') ||
                $('meta[property="og:image"]').attr("content") ||
                "";
            // Kiểm tra data-src (lazy load) - AnimeHay thường dùng data-src
            if (!posterImg || posterImg.startsWith("data:") || posterImg.length < 10) {
                posterImg =
                    $('.movie-thumbnail img').first().attr('data-src') ||
                        $('.movie-info .movie-thumbnail img').first().attr('data-src') ||
                        $('.anime-info .movie-thumbnail img').first().attr('data-src') ||
                        $('.movie-detail .movie-thumbnail img').first().attr('data-src') ||
                        $('.movie-info img').first().attr('data-src') ||
                        $('.anime-info img').first().attr('data-src') ||
                        $('img[data-src]').first().attr('data-src') ||
                        posterImg || "";
            }
            // Kiểm tra data-original (một số trang dùng attribute này)
            if (!posterImg || posterImg.startsWith("data:") || posterImg.length < 10) {
                posterImg =
                    $('.movie-thumbnail img').first().attr('data-original') ||
                        $('.movie-info .movie-thumbnail img').first().attr('data-original') ||
                        $('.anime-info .movie-thumbnail img').first().attr('data-original') ||
                        $('img[data-original]').first().attr('data-original') ||
                        posterImg || "";
            }
            // Kiểm tra data-lazy-src (một số trang dùng attribute này)
            if (!posterImg || posterImg.startsWith("data:") || posterImg.length < 10) {
                posterImg =
                    $('.movie-thumbnail img').first().attr('data-lazy-src') ||
                        $('.movie-info .movie-thumbnail img').first().attr('data-lazy-src') ||
                        $('img[data-lazy-src]').first().attr('data-lazy-src') ||
                        posterImg || "";
            }
            // Convert relative URL to absolute
            if (posterImg && !posterImg.startsWith('http') && !posterImg.startsWith('data:')) {
                try {
                    posterImg = new URL(posterImg, movieUrl).href;
                }
                catch (e) {
                    console.warn("Không thể parse poster URL:", posterImg);
                }
            }
            poster = posterImg;
            console.log(`[CRAWL] Poster tìm thấy: ${poster ? 'Có' : 'Không'}`);
            // ✅ FIX: Parse episodes từ AnimeHay/AnimeVietsub - dùng .list-episode a
            const episodes = [];
            // AnimeHay dùng .list-episode > a hoặc .episode-list > a
            $('.list-episode a, .episode-list a, .list-ep a').each((_, el) => {
                const href = $(el).attr("href") || "";
                const text = $(el).text().trim();
                if (href) {
                    episodes.push({
                        title: text || `Tập ${episodes.length + 1}`,
                        url: href,
                    });
                }
            });
            // Nếu không tìm thấy, thử selector chung hơn
            if (episodes.length === 0) {
                $("a[href*='tap'], a[href*='episode'], a[href*='ep']").each((_, el) => {
                    const href = $(el).attr("href") || "";
                    const text = $(el).text().trim();
                    if (href && (href.includes('tap') || href.includes('episode') || href.includes('ep'))) {
                        episodes.push({
                            title: text || `Tập ${episodes.length + 1}`,
                            url: href,
                        });
                    }
                });
            }
            episodeList = buildEpisodeList(episodes, { baseUrl: movieUrl, ascending: true });
            console.log(`[CRAWL] Episodes tìm thấy: ${episodeList.length}`);
            // Kiểm tra type (thường là series cho anime)
            type = episodeList.length > 0 ? "series" : "movie";
        }
        else {
            // Fallback cho các trang khác
            title = $("h1").first().text().trim() || $('meta[property="og:title"]').attr("content")?.trim() || "";
            description = $('meta[name="description"]').attr("content")?.trim() || "";
            poster = $('meta[property="og:image"]').attr("content") || "";
            type = $('.episode-list').length > 0 ? "series" : "movie";
        }
        // Nếu poster là relative URL, chuyển thành absolute
        if (poster && !poster.startsWith("http")) {
            try {
                const baseUrl = new URL(movieUrl);
                poster = new URL(poster, baseUrl.origin).href;
            }
            catch (e) {
                console.warn("Không thể parse poster URL:", poster);
            }
        }
        // ✅ FIX: Tải poster về local TRƯỚC KHI validate title (để có poster ngay cả khi title fail)
        let posterLocal = null;
        if (downloadPoster && poster) {
            try {
                const uploadsRoot = path_1.default.resolve(__dirname, "..", "..", "uploads");
                const postersDir = path_1.default.join(uploadsRoot, "posters");
                if (!fs_1.default.existsSync(postersDir)) {
                    fs_1.default.mkdirSync(postersDir, { recursive: true });
                }
                const extension = path_1.default.extname(poster).split("?")[0] || ".jpg";
                const filename = `poster_${Date.now()}${extension}`;
                const destPath = path_1.default.join(postersDir, filename);
                console.log(`[CRAWL] 📥 Đang tải poster từ: ${poster}`);
                const saved = await (0, downloadImage_1.downloadImage)(poster, destPath, movieUrl);
                if (saved) {
                    posterLocal = `/storage/posters/${filename}`;
                    console.log(`[CRAWL] ✅ Đã tải poster thành công: ${posterLocal}`);
                }
                else {
                    console.warn(`[CRAWL] ⚠️ Không thể tải poster, nhưng vẫn giữ poster_url`);
                }
            }
            catch (e) {
                console.warn(`[CRAWL] ⚠️ Lỗi khi tải poster: ${e.message}`);
                // Không throw error, vẫn tiếp tục với poster_url
            }
        }
        // ✅ FIX: Validate title - nhưng nếu có poster thì vẫn trả về partial data
        if (!title || title.length < 2) {
            // Log HTML để debug
            const htmlPreview = $.html().substring(0, 500);
            console.error(`[CRAWL] ❌ Không tìm thấy title từ ${siteType}`);
            console.error(`[CRAWL] HTML preview (500 chars):`, htmlPreview);
            // ✅ FIX: Nếu có poster, vẫn trả về partial data thay vì throw error
            if (poster || posterLocal) {
                console.warn(`[CRAWL] ⚠️ Không có title nhưng có poster, trả về partial data`);
                return {
                    title: "", // Title rỗng, user có thể nhập thủ công
                    description: description || "",
                    poster_url: poster || null,
                    poster_local: posterLocal,
                    trailer_url: trailer,
                    release_year: releaseYear,
                    duration,
                    country,
                    director,
                    cast,
                    imdb_score: null,
                    genres,
                    language: "vi",
                    rating,
                    episodes: episodeList,
                    source_site: siteType,
                    movie_url: movieUrl,
                    type: episodeList.length > 0 ? "series" : "movie",
                };
            }
            // Chỉ throw error nếu không có cả title và poster
            throw new Error(`Không tìm thấy title từ ${siteType}. Có thể selector không đúng hoặc trang web đã thay đổi cấu trúc. URL: ${movieUrl}`);
        }
        console.log(`[CRAWL] ✅ Crawl thành công từ ${siteType}:`);
        console.log(`  - Title: ${title}`);
        console.log(`  - Description: ${description.length} ký tự`);
        console.log(`  - Poster: ${poster ? 'Có' : 'Không'}`);
        console.log(`  - Episodes: ${episodeList.length}`);
        const movie = {
            title,
            description,
            poster_url: poster || null,
            poster_local: posterLocal,
            trailer_url: trailer,
            release_year: releaseYear,
            duration,
            country,
            director,
            cast,
            imdb_score: null,
            genres,
            language: "vi",
            rating,
            episodes: episodeList,
            source_site: siteType,
            movie_url: movieUrl,
            type,
        };
        return movie;
    }
    catch (error) {
        console.error(`[CRAWL] ❌ Lỗi khi crawl phim từ ${siteType}:`, error);
        if (error.message?.includes('timeout') || error.message?.includes('Request timeout')) {
            throw new Error("Request timeout - Trang web phản hồi quá chậm (>12 giây). Vui lòng thử lại hoặc kiểm tra URL.");
        }
        // Log chi tiết lỗi để debug
        if (error.stack) {
            console.error(`[CRAWL] Stack trace:`, error.stack);
        }
        throw new Error(error.message || `Unknown error khi crawl phim từ ${siteType}`);
    }
}
/**
 * Crawl metadata phim từ các trang VN (tương tự crawlStoryFromVN)
 * Tái sử dụng 70% logic: fallback sites, error handling
 */
async function crawlMovieFromVN(url, downloadPoster = false) {
    const detected = detectMovieSite(url);
    const candidates = [
        detected,
        ...MOVIE_SITE_PRIORITY.filter((site) => site !== detected),
    ];
    const errors = [];
    // Thử crawl từ nhiều nguồn
    for (const site of candidates) {
        try {
            console.log(`🔄 Đang thử crawl phim từ site type: ${site}`);
            const result = await crawlMovieWithSite(url, site, downloadPoster);
            // Kiểm tra xem có đủ dữ liệu không (chỉ cần title, poster là optional)
            if (result.title && result.title.length >= 2) {
                console.log(`✅ Crawl phim thành công từ ${site}: ${result.title}`);
                return result;
            }
            else {
                throw new Error(`Không tìm thấy title hợp lệ (title: ${result.title || 'null'})`);
            }
        }
        catch (error) {
            const errorMsg = error.message || "Unknown error";
            errors.push(`[${site}] ${errorMsg}`);
            console.warn(`⚠️ Crawl phim từ ${site} thất bại: ${errorMsg}`);
            // Nếu là lỗi timeout hoặc connection, tiếp tục thử site khác
            if (errorMsg.includes('timeout') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND')) {
                console.log(`🔄 Trang ${site} có thể bị chặn, thử trang khác...`);
                continue;
            }
        }
    }
    throw new Error(errors.length > 0
        ? `Không crawl được phim từ các nguồn dự phòng: ${errors.join(" | ")}`
        : "Không thể crawl phim");
}
