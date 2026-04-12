#!/usr/bin/env node
/**
 * 打工生活模拟器 - 优化版启动服务器 v2.1.9
 *
 * 优化项:
 * - gzip 压缩传输（减少 ~70% 传输体积）
 * - 静态资源强缓存（资源文件）
 * - 流式传输（大文件不占满内存）
 * - Range 请求支持（断点续传）
 * - 自动压缩预检（仅对可压缩类型启用gzip）
 *
 * 用法: node start.js [端口号]
 * 默认端口: 8080
 */

const { createServer } = require('http');
const { createReadStream, statSync, existsSync, readFileSync } = require('fs');
const { join, extname, resolve } = require('path');
const { exec } = require('child_process');
const zlib = require('zlib');

const PORT = parseInt(process.argv[2] || '8080', 10);
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.bin': 'application/octet-stream',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.plist': 'application/xml',
    '.atlas': 'text/plain',
    '.txt': 'text/plain',
    '.pcm': 'application/octet-stream',
    '.m4a': 'audio/mp4',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm'
};

// Types that benefit from gzip
const COMPRESSIBLE = new Set([
    'text/html', 'text/css', 'text/plain', 'application/javascript',
    'application/json', 'application/xml', 'image/svg+xml'
]);

// Static asset extensions (immutable, long cache)
const STATIC_EXT = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.mp3', '.wav', '.ogg', '.m4a',
    '.mp4', '.webm', '.bin', '.atlas', '.plist', '.pcm', '.ttf', '.woff', '.woff2'
]);

// Cache for gzip-compressed small files
const gzipCache = new Map();
const MAX_CACHE_SIZE = 200; // Max cached files
const MAX_CACHE_FILE_SIZE = 512 * 1024; // Only cache files < 512KB

function getGzipped(filePath, data) {
    if (gzipCache.has(filePath)) return gzipCache.get(filePath);

    const ext = extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const baseMime = mime.split(';')[0];

    if (!COMPRESSIBLE.has(baseMime)) return null;
    if (data.length > MAX_CACHE_FILE_SIZE) return null; // Too large, stream instead

    try {
        const compressed = zlib.gzipSync(data, { level: 6 });
        // Only use if compression ratio is good
        if (compressed.length < data.length * 0.95) {
            if (gzipCache.size >= MAX_CACHE_SIZE) {
                // Evict oldest entry
                const firstKey = gzipCache.keys().next().value;
                gzipCache.delete(firstKey);
            }
            gzipCache.set(filePath, compressed);
            return compressed;
        }
    } catch (e) {}

    return null;
}

function shouldCache(ext) {
    return STATIC_EXT.has(ext);
}

const server = createServer((req, res) => {
    let url = req.url.split('?')[0];
    if (url === '/') url = '/index.html';

    const filePath = join(ROOT, decodeURIComponent(url));

    // Security: prevent directory traversal
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    let s;
    try {
        s = statSync(filePath);
    } catch (e) {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    if (!s.isFile()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    const ext = extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const isStatic = shouldCache(ext);
    const baseMime = mime.split(';')[0];
    const acceptEncoding = req.headers['accept-encoding'] || '';

    // Handle Range requests for large files
    const range = req.headers.range;

    // Cache headers
    const headers = { 'Content-Type': mime };

    if (isStatic) {
        // Immutable assets: 1 year cache
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    } else {
        // Dynamic files: short cache
        headers['Cache-Control'] = 'no-cache';
    }
    headers['Access-Control-Allow-Origin'] = '*';

    // Small compressible files: use cached gzip
    if (acceptEncoding.includes('gzip') && COMPRESSIBLE.has(baseMime) && s.size <= MAX_CACHE_FILE_SIZE) {
        try {
            const data = readFileSync(filePath);
            const gzipped = getGzipped(filePath, data);
            if (gzipped) {
                headers['Content-Encoding'] = 'gzip';
                headers['Content-Length'] = gzipped.length;
                headers['Vary'] = 'Accept-Encoding';
                res.writeHead(200, headers);
                res.end(gzipped);
                return;
            }
            // Fallback to uncompressed
            headers['Content-Length'] = s.size;
            res.writeHead(200, headers);
            res.end(data);
            return;
        } catch (e) {}
    }

    // Large files or non-compressible: use streaming
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : s.size - 1;
        const chunkSize = end - start + 1;

        headers['Content-Range'] = `bytes ${start}-${end}/${s.size}`;
        headers['Content-Length'] = chunkSize;
        headers['Accept-Ranges'] = 'bytes';

        res.writeHead(206, headers);
        createReadStream(filePath, { start, end }).pipe(res);
    } else {
        headers['Content-Length'] = s.size;
        headers['Accept-Ranges'] = 'bytes';
        res.writeHead(200, headers);

        // Stream large compressible files with gzip
        if (acceptEncoding.includes('gzip') && COMPRESSIBLE.has(baseMime) && s.size > MAX_CACHE_FILE_SIZE) {
            const stream = createReadStream(filePath);
            const gzip = zlib.createGzip({ level: 1 }); // Fast compression for large files
            headers['Content-Encoding'] = 'gzip';
            headers['Vary'] = 'Accept-Encoding';
            // Remove Content-Length as it changes with gzip
            delete headers['Content-Length'];
            res.writeHead(200, headers);
            stream.pipe(gzip).pipe(res);
        } else {
            createReadStream(filePath).pipe(res);
        }
    }
});

server.listen(PORT, '0.0.0.0', () => {
    const url = `http://localhost:${PORT}`;
    const networkUrl = getNetworkIP();

    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║   打工生活模拟器 - 优化版 v2.1.9              ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log(`  ║   本机地址: ${url.padEnd(33)}║`);
    if (networkUrl) {
        console.log(`  ║   局域网:   ${networkUrl.padEnd(33)}║`);
    }
    console.log('  ║   按 Ctrl+C 停止服务器                     ║');
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');

    try {
        const cmd = process.platform === 'win32' ? 'start' :
            process.platform === 'darwin' ? 'open' : 'xdg-open';
        exec(`${cmd} "${url}"`);
    } catch (e) {}
});

function getNetworkIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return `http://${iface.address}:${PORT}`;
            }
        }
    }
    return null;
}

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`错误: 端口 ${PORT} 已被占用，请使用: node start.js ${PORT + 1}`);
    } else {
        console.error('服务器错误:', err.message);
    }
    process.exit(1);
});
