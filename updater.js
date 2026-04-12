#!/usr/bin/env node
/**
 * 打工生活模拟器 - 自动更新器
 * 
 * 从 Gitee 拉取最新版本代码并覆盖本地文件（不碰 assets/）
 * 
 * 用法:
 *   node updater.js          # 检查并更新
 *   node updater.js --force   # 强制更新（不询问）
 *   node updater.js --check   # 仅检查版本
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================
// 配置
// ============================================================
const GITEE_USER = 'liuxcstudio';
const GITEE_REPO = 'game';
const GITEE_TOKEN = 'd8064d65b313e9b0a6f1639add90a7b1';
const BRANCH = 'main';
const API_BASE = `https://gitee.com/api/v5/repos/${GITEE_USER}/${GITEE_REPO}`;

// 需要更新的文件列表（相对于仓库根目录）
const UPDATE_FILES = [
    'index.html',
    'main.js',
    'start.js',
    'cocos2d-js-min.js',
    'favicon.ico',
    'splash.png',
    'style-desktop.css',
    'style-mobile.css',
    'src/settings.js',
    'src/InitedEngine.js',
    'src/sdk-stub.js',
    'README.txt'
];

// 本地版本记录文件
const VERSION_FILE = path.join(__dirname, '.local-version');

// ============================================================
// 工具函数
// ============================================================

function colorText(text, color) {
    var colors = {
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        cyan: '\x1b[36m',
        gray: '\x1b[90m',
        reset: '\x1b[0m'
    };
    return (colors[color] || '') + text + (colors.reset || '');
}

function getLocalVersion() {
    try {
        return fs.readFileSync(VERSION_FILE, 'utf-8').trim();
    } catch (e) {
        return null;
    }
}

function saveLocalVersion(ver) {
    fs.writeFileSync(VERSION_FILE, ver, 'utf-8');
}

// HTTP GET 请求（返回 Promise）
function httpGet(url) {
    return new Promise(function (resolve, reject) {
        var req = https.get(url, function (res) {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Follow redirect
                httpGet(res.headers.location).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
                return;
            }
            var chunks = [];
            res.on('data', function (chunk) { chunks.push(chunk); });
            res.on('end', function () {
                var buf = Buffer.concat(chunks);
                resolve(buf);
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, function () {
            req.destroy();
            reject(new Error('Timeout: ' + url));
        });
    });
}

// 获取远程最新 commit 信息
function getLatestCommit() {
    return new Promise(function (resolve, reject) {
        var url = API_BASE + '/commits?access_token=' + GITEE_TOKEN + '&ref=' + BRANCH + '&per_page=1';
        https.get(url, function (res) {
            var data = '';
            res.on('data', function (chunk) { data += chunk; });
            res.on('end', function () {
                try {
                    var commits = JSON.parse(data);
                    if (commits.length > 0) {
                        resolve({
                            sha: commits[0].sha,
                            message: commits[0].commit.message,
                            date: commits[0].commit.author.date
                        });
                    } else {
                        reject(new Error('No commits found'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// 获取单个文件内容（通过 Gitee API，支持私有仓库）
function fetchFile(filePath) {
    return new Promise(function (resolve, reject) {
        // 用 API 获取文件内容（base64 编码）
        var url = API_BASE + '/contents/' + filePath + '?access_token=' + GITEE_TOKEN + '&ref=' + BRANCH;
        https.get(url, function (res) {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                https.get(res.headers.location, function (redirRes) {
                    var data = '';
                    redirRes.on('data', function (chunk) { data += chunk; });
                    redirRes.on('end', function () {
                        try {
                            var json = JSON.parse(data);
                            if (json.content) {
                                resolve(Buffer.from(json.content, 'base64'));
                            } else {
                                reject(new Error('No content in API response'));
                            }
                        } catch (e) { reject(e); }
                    });
                }).on('error', reject);
                return;
            }
            var data = '';
            res.on('data', function (chunk) { data += chunk; });
            res.on('end', function () {
                try {
                    var json = JSON.parse(data);
                    if (json.content) {
                        var buf = Buffer.from(json.content, 'base64');
                        resolve(buf);
                    } else if (json.message) {
                        reject(new Error(json.message));
                    } else {
                        reject(new Error('Unexpected response'));
                    }
                } catch (e) { reject(e); }
            });
        }).on('error', reject).setTimeout(30000, function () {
            this.destroy();
            reject(new Error('Timeout: ' + filePath));
        });
    });
}

// 保存文件
function saveFile(filePath, data) {
    var fullPath = path.join(__dirname, filePath);
    var dir = path.dirname(fullPath);

    // 确保目录存在
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, data);
}

// ============================================================
// 主流程
// ============================================================

async function checkOnly() {
    console.log('');
    console.log(colorText('  ╔══════════════════════════════════════╗', 'cyan'));
    console.log(colorText('  ║     打工生活模拟器 - 版本检查         ║', 'cyan'));
    console.log(colorText('  ╚══════════════════════════════════════╝', 'cyan'));
    console.log('');

    var local = getLocalVersion();
    console.log('  本地版本: ' + colorText(local || '未知', local ? 'green' : 'yellow'));

    try {
        console.log('  正在连接 Gitee...', colorText('', 'gray'));
        var latest = await getLatestCommit();
        console.log('  远程版本: ' + colorText(latest.sha.substring(0, 8), 'blue'));
        console.log('  提交信息: ' + latest.message);
        console.log('  提交时间: ' + latest.date);
        console.log('');

        if (local === latest.sha.substring(0, 8)) {
            console.log('  ' + colorText('已是最新版本!', 'green'));
        } else {
            console.log('  ' + colorText('有新版本可用!', 'yellow'));
        }
    } catch (e) {
        console.log('  ' + colorText('检查失败: ' + e.message, 'red'));
    }
    console.log('');
}

async function doUpdate(forceMode) {
    console.log('');
    console.log(colorText('  ╔══════════════════════════════════════╗', 'cyan'));
    console.log(colorText('  ║     打工生活模拟器 - 自动更新         ║', 'cyan'));
    console.log(colorText('  ╚══════════════════════════════════════╝', 'cyan'));
    console.log('');

    var local = getLocalVersion();
    if (local) {
        console.log('  当前版本: ' + colorText(local, 'green'));
    } else {
        console.log('  当前版本: ' + colorText('首次运行', 'yellow'));
    }

    try {
        console.log('  正在连接 Gitee...', colorText('', 'gray'));
        var latest = await getLatestCommit();
        var newVer = latest.sha.substring(0, 8);
        console.log('  最新版本: ' + colorText(newVer, 'blue'));
        console.log('  提交信息: ' + latest.message);
        console.log('  提交时间: ' + latest.date);
        console.log('');

        // 检查是否需要更新
        if (local === newVer) {
            console.log('  ' + colorText('已是最新版本，无需更新!', 'green'));
            console.log('');
            return;
        }

        if (!forceMode) {
            console.log('  ' + colorText('发现新版本，准备更新以下文件:', 'yellow'));
            for (var i = 0; i < UPDATE_FILES.length; i++) {
                console.log('    - ' + UPDATE_FILES[i]);
            }
            console.log('');
            console.log('  ' + colorText('注意: assets/ 目录不会被修改', 'gray'));
            console.log('');
        }

        // 开始下载
        console.log('  ' + colorText('开始更新...', 'cyan'));
        console.log('');

        var success = 0;
        var failed = 0;
        var skipped = 0;

        for (var j = 0; j < UPDATE_FILES.length; j++) {
            var file = UPDATE_FILES[j];
            var localPath = path.join(__dirname, file);

            try {
                // 显示进度
                var pct = Math.round((j + 1) / UPDATE_FILES.length * 100);
                process.stdout.write('\r  [' + padLeft(pct, 3) + '%] 下载: ' + file);

                var data = await fetchFile(file);
                saveFile(file, data);
                success++;
            } catch (e) {
                if (e.message && e.message.indexOf('404') !== -1) {
                    // 文件在远程不存在，跳过
                    skipped++;
                    // 如果本地有该文件且远程没有，删除本地文件
                    if (fs.existsSync(localPath)) {
                        fs.unlinkSync(localPath);
                        console.log('\r  [' + padLeft(pct, 3) + '%] ' + colorText('删除: ' + file + ' (远程已移除)', 'yellow') + '                    ');
                    }
                } else {
                    failed++;
                    console.log('\r  [' + padLeft(pct, 3) + '%] ' + colorText('失败: ' + file + ' - ' + e.message, 'red') + '                    ');
                }
            }
        }

        console.log('');
        console.log('  ─────────────────────────────────────');
        console.log('  更新完成: ' + colorText(success + ' 成功', 'green') + 
                     (failed > 0 ? ', ' + colorText(failed + ' 失败', 'red') : '') +
                     (skipped > 0 ? ', ' + colorText(skipped + ' 跳过', 'yellow') : ''));
        console.log('');

        if (failed === 0) {
            // 保存版本号
            saveLocalVersion(newVer);
            console.log('  ' + colorText('更新成功! 重新启动游戏即可生效。', 'green'));
        } else {
            console.log('  ' + colorText('部分文件更新失败，请检查网络后重试。', 'red'));
        }
    } catch (e) {
        console.log('');
        console.log('  ' + colorText('更新失败: ' + e.message, 'red'));
        console.log('  请检查网络连接后重试。');
    }
    console.log('');
}

function padLeft(str, len) {
    str = String(str);
    while (str.length < len) str = ' ' + str;
    return str;
}

// ============================================================
// 入口
// ============================================================

var args = process.argv.slice(2);
var mode = 'update';

if (args.indexOf('--check') !== -1) {
    mode = 'check';
} else if (args.indexOf('--force') !== -1) {
    mode = 'force';
}

if (mode === 'check') {
    checkOnly().catch(function (e) {
        console.log(colorText('Error: ' + e.message, 'red'));
    });
} else {
    doUpdate(mode === 'force').catch(function (e) {
        console.log(colorText('Error: ' + e.message, 'red'));
    });
}
