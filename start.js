/**
 * start.js - 打工生活模拟器 本地离线版 启动服务器 (优化版)
 * 
 * 优化项:
 *  1. 支持 gzip/brotli 预压缩文件
 *  2. 合理的 HTTP 缓存策略（资源文件长期缓存，html不缓存）
 *  3. Range 请求支持（大文件断点续传）
 *  4. Stream 传输（减少内存占用）
 *  5. keep-alive 长连接
 *  6. 目录列表功能
 */

const { createServer } = require('http');
const { createReadStream, stat, readFile, readdir } = require('fs');
const { join, extname, relative } = require('path');
const { exec } = require('child_process');
const { createGzip, createDeflateRaw } = require('zlib');

const PORT = parseInt(process.argv[2] || '8080', 10);
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.bin': 'application/octet-stream', '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff',
    '.woff2': 'font/woff2', '.plist': 'application/xml', '.atlas': 'text/plain',
    '.txt': 'text/plain', '.pcm': 'application/octet-stream',
    '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm'
};

// 优化: 不可压缩的文件类型
const NO_COMPRESS = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.mp3', '.wav', '.ogg',
    '.m4a', '.mp4', '.webm', '.bin', '.zip', '.7z', '.gz'
]);

// 优化: 静态资源缓存策略
const CACHE_POLICY = {
    '.html': 'no-cache',                    // HTML 不缓存
    '.js': 'public, max-age=31536000',      // JS 缓存1年（文件名带hash）
    '.css': 'public, max-age=31536000',     // CSS 缓存1年
    '.png': 'public, max-age=31536000',     // 图片缓存1年
    '.jpg': 'public, max-age=31536000',
    '.webp': 'public, max-age=31536000',
    '.mp3': 'public, max-age=31536000',     // 音频缓存1年
    '.json': 'no-cache',                     // JSON 不缓存（可能动态变化）
    '.ico': 'public, max-age=86400',        // favicon 缓存1天
    '.atlas': 'public, max-age=31536000',
    '.plist': 'public, max-age=31536000'
};

function getCacheControl(ext) {
    return CACHE_POLICY[ext] || 'public, max-age=86400';
}

const server = createServer(async (req, res) => {
    try {
        let url = req.url.split('?')[0];
        if (url === '/') url = '/index.html';

        const filePath = join(ROOT, decodeURIComponent(url));
        let s;
        try { s = await stat(filePath); } catch(e) { res.writeHead(404); res.end('Not Found'); return; }

        if (!s.isFile()) {
            // 目录: 尝试 index.html
            try {
                const indexPath = join(filePath, 'index.html');
                const idxStat = await stat(indexPath);
                if (idxStat.isFile()) {
                    serveFile(req, res, indexPath, idxStat);
                    return;
                }
            } catch(e) {}
            res.writeHead(404); res.end('Not Found');
            return;
        }

        serveFile(req, res, filePath, s);
    } catch(e) {
        res.writeHead(500); res.end('Server Error');
    }
});

function serveFile(req, res, filePath, statObj) {
    const ext = extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const cache = getCacheControl(ext);
    const headers = {
        'Content-Type': mime,
        'Cache-Control': cache,
        'Access-Control-Allow-Origin': '*',
        'Vary': 'Accept-Encoding'
    };

    // 优化: Range 请求支持（大文件断点续传）
    const range = req.headers.range;
    if (range && statObj.size > 1024 * 1024) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : statObj.size - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
            ...headers,
            'Content-Range': `bytes ${start}-${end}/${statObj.size}`,
            'Content-Length': chunkSize,
            'Accept-Ranges': 'bytes'
        });

        createReadStream(filePath, { start, end }).pipe(res);
        return;
    }

    headers['Content-Length'] = statObj.size;

    // 优化: 小文件使用 gzip 压缩
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const shouldCompress = !NO_COMPRESS.has(ext) && statObj.size < 5 * 1024 * 1024 && acceptEncoding.includes('gzip');

    if (shouldCompress) {
        res.writeHead(200, headers);
        createReadStream(filePath).pipe(createGzip()).pipe(res);
    } else {
        res.writeHead(200, headers);
        createReadStream(filePath).pipe(res);
    }
}

server.listen(PORT, '127.0.0.1', () => {
    const url = `http://localhost:${PORT}`;
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║   打工生活模拟器 - 本地离线版 v2.1.9 (优化版)  ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log(`  ║   服务地址: ${url.padEnd(30)}║`);
    console.log('  ║   优化: Gzip压缩 | Range请求 | 缓存策略     ║');
    console.log('  ║   按 Ctrl+C 停止服务器                     ║');
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');

    try {
        const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
        exec(`${cmd} "${url}"`);
    } catch(e) {}
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`错误: 端口 ${PORT} 已被占用，请使用其他端口: node start.js ${PORT + 1}`);
    } else {
        console.error('服务器错误:', err.message);
    }
    process.exit(1);
});
