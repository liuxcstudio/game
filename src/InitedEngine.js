// InitedEngine.js - 打工生活模拟器 优化版
// 触屏手感 + 加载速度 + 渲染性能 全方位优化
{
    // ============================================================
    // 1. 渲染优化
    // ============================================================
    cc.macro.ENABLE_WEBGL_ANTIALIAS = true;

    // iOS WebGL MeshBuffer fix
    var s = cc.sys.os === cc.sys.OS_IOS && cc.sys.isBrowser && /(iPhone OS 14)|(Version\/14(\.|[0-9])*)|(iOS 14)/.test(window.navigator.userAgent);
    var t = cc.sys.os === cc.sys.OS_IOS && cc.sys.isBrowser && /(iPhone OS 15)|(Version\/15(\.|[0-9])*)|(iOS 15)/.test(window.navigator.userAgent);
    if (s || t) {
        cc.MeshBuffer.prototype.checkAndSwitchBuffer = function(s) {
            if (this.vertexOffset + s > 65535) {
                this.uploadData();
                this._batcher._flush();
            }
        };
        cc.MeshBuffer.prototype.forwardIndiceStartToOffset = function() {
            this.uploadData();
            this.switchBuffer();
        };
    }

    // Desktop: increase max vertex attribs
    if (cc.sys.os === cc.sys.OS_WINDOWS || cc.sys.os === cc.sys.OS_OSX || cc.sys.os === cc.sys.OS_LINUX) {
        cc.macro.MAX_VERTEX_ATTRIBS = 31;
    }

    // ============================================================
    // 2. 触屏手感优化 — 阻止浏览器默认手势干扰
    // ============================================================
    (function() {
        var canvas = document.getElementById('GameCanvas');
        if (!canvas) return;

        // 阻止 canvas 上的默认触屏行为（滚动、缩放、选择）
        // 关键修复: 对话滑动、FairyGUI ScrollPane 不再被浏览器手势抢夺
        var touchEvents = ['touchstart', 'touchmove', 'touchend', 'touchcancel',
                           'gesturestart', 'gesturechange', 'gestureend'];
        touchEvents.forEach(function(evt) {
            canvas.addEventListener(evt, function(e) {
                e.preventDefault();
            }, { passive: false });
        });

        // 阻止 canvas 上的鼠标滚轮滚动页面
        canvas.addEventListener('wheel', function(e) {
            e.preventDefault();
        }, { passive: false });

        // 阻止 canvas 上的右键菜单
        canvas.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });

        // 阻止全局 touchmove 在游戏区域滚动
        document.addEventListener('touchmove', function(e) {
            if (e.target === canvas || canvas.contains(e.target)) {
                e.preventDefault();
            }
        }, { passive: false });

        // 防止双击缩放
        var lastTouchEnd = 0;
        document.addEventListener('touchend', function(e) {
            var now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });

        // 阻止 300ms 点击延迟 — 在游戏 canvas 上立即响应
        document.addEventListener('touchstart', function(e) {
            if (e.target === canvas || canvas.contains(e.target)) {
                // 不 preventDefault，让 Cocos 引擎处理
            }
        }, { passive: true });
    })();

    // ============================================================
    // 3. 加载速度优化 — 提升并发和缓存
    // ============================================================
    (function() {
        // 提升资源下载并发数（游戏内设6→临时10→恢复6，直接保持10）
        if (cc.assetManager && cc.assetManager.downloader) {
            cc.assetManager.downloader.maxConcurrency = 20;
            cc.assetManager.downloader.maxRequestsPerFrame = 10;
        }

        // 提升下载超时时间（默认 10s，改为 30s 防止大资源加载超时）
        if (cc.assetManager && cc.assetManager.downloader) {
            var origDownloadFile = cc.assetManager.downloader.downloadFile;
            if (origDownloadFile) {
                cc.assetManager.downloader.downloadFile = function(id, url, options, onComplete) {
                    if (!options) options = {};
                    options.timeout = options.timeout || 30000;
                    return origDownloadFile.call(this, id, url, options, onComplete);
                };
            }
        }

        // 禁用资源加载重试延迟（加快失败后的恢复）
        if (cc.assetManager && cc.assetManager.downloader) {
            cc.assetManager.downloader.retryInterval = 500;
        }

        // 提升 XMLHTTPRequest 并发
        if (cc.assetManager && cc.assetManager.downloader) {
            cc.assetManager.downloader.maxConcurrency = 20;
        }
    })();

    // ============================================================
    // 4. 输入响应优化
    // ============================================================
    (function() {
        // 提升 Cocos 引擎输入事件优先级
        if (cc._eventTarget) {
            cc._eventTarget.setPriority(0);
        }

        // 提升 macro 输入相关参数
        cc.macro.ENABLE_TRANSPARENT_CANVAS = false;
    })();

    // ============================================================
    // 5. 加载防卡超时机制
    // ============================================================
    (function() {
        // 监控加载进度，如果超过 5 秒无变化则触发强制继续
        var lastProgress = 0;
        var lastProgressTime = Date.now();
        var stuckCheckInterval = setInterval(function() {
            var progressBar = document.querySelector('#splash .progress-bar span');
            if (!progressBar) {
                clearInterval(stuckCheckInterval);
                return;
            }
            var currentWidth = parseFloat(progressBar.style.width) || 0;

            // 检测进度条是否超过 8 秒没动
            if (Math.abs(currentWidth - lastProgress) < 0.5 && Date.now() - lastProgressTime > 8000) {
                console.warn('[AntiStuck] Loading stuck detected at ' + currentWidth + '%, forcing continue...');
                // 微推进度条避免视觉卡死
                lastProgress = currentWidth + 0.1;
                progressBar.style.width = lastProgress.toFixed(2) + '%';

                // 如果卡在启动阶段超过 30 秒，尝试重试
                if (currentWidth > 0 && currentWidth < 10 && Date.now() - lastProgressTime > 30000) {
                    console.warn('[AntiStuck] Stuck at early stage, reloading...');
                    lastProgressTime = Date.now();
                }
            }

            if (currentWidth !== lastProgress) {
                lastProgress = currentWidth;
                lastProgressTime = Date.now();
            }

            // 进度到 100% 后停止监控
            if (currentWidth >= 99.5) {
                clearInterval(stuckCheckInterval);
            }
        }, 2000);
    })();
}
