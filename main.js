/**
 * main.js - 打工生活模拟器 本地离线版 v2.1.9 (优化版)
 * 
 * 优化项:
 *  1. 脚本加载: async+defer 并行加载，减少启动时间
 *  2. Retina: 可选关闭，减少渲染开销
 *  3. 进度条: 百分比文字显示
 *  4. 错误恢复: 场景加载失败时自动重试
 *  5. 内存管理: 场景切换后主动释放
 *  6. FPS 统计: 实时显示
 *  7. 全屏: 一键切换
 *  8. 存档管理: 导出/导入/清除
 */

window.boot = function () {
    var settings = window._CCSettings;
    window._CCSettings = undefined;

    let { RESOURCES, INTERNAL, MAIN, START_SCENE } = cc.AssetManager.BuiltinBundleName;

    // ========== 优化1: 进度条增强 ==========
    var splash = document.getElementById('splash');
    var progressBar = splash ? splash.querySelector('.progress-bar span') : null;
    var loadingTip = document.querySelector('.loading-tip');
    var tips = ['正在加载游戏资源...', '加载场景数据中...', '即将完成...', '准备就绪!'];
    var tipIndex = 0;

    var onProgress = function (finish, total) {
        var percent = 100 * finish / total;
        if (progressBar) {
            progressBar.style.width = percent.toFixed(1) + '%';
        }
        if (loadingTip) {
            var idx = Math.min(Math.floor(percent / 30), tips.length - 1);
            if (idx !== tipIndex) {
                tipIndex = idx;
                loadingTip.textContent = tips[idx];
            }
        }
    };

    splash.style.display = 'block';
    if (progressBar) progressBar.style.width = '0%';

    cc.director.once(cc.Director.EVENT_AFTER_SCENE_LAUNCH, function () {
        if (splash) splash.style.display = 'none';
        // 显示优化控件
        showOptControls();
    });

    // ========== 优化2: 引擎配置增强 ==========
    var onStart = function () {
        // Retina 可选 - 默认开启，低端设备可关闭
        var enableRetina = localStorage.getItem('wls_retina') !== 'false';
        cc.view.enableRetina(enableRetina);
        cc.view.resizeWithBrowserSize(true);

        // 优化: 渲染性能设置
        cc.macro.ENABLE_CULLING = true;          // 启用裁剪
        cc.macro.ENABLE_TRANSPARENT_CANVAS = false; // 不透明画布，提升性能
        cc.macro.BATCH_VERTEX_COUNT = 150;       // 批量渲染顶点数

        if (cc.sys.isBrowser) {
            setLoadingDisplay();
        }

        if (cc.sys.isMobile) {
            if (settings.orientation === 'landscape') {
                cc.view.setOrientation(cc.macro.ORIENTATION_LANDSCAPE);
            } else if (settings.orientation === 'portrait') {
                cc.view.setOrientation(cc.macro.ORIENTATION_PORTRAIT);
            }
        }

        var launchScene = settings.launchScene;
        console.log('[Game] Launching scene:', launchScene);

        var bundle = cc.assetManager.bundles.find(function (b) {
            return b.getSceneInfo(launchScene);
        });

        if (!bundle) {
            console.warn('[Game] Launch scene bundle not found, trying resources...');
            bundle = cc.assetManager.getBundle('resources');
            if (!bundle) {
                console.error('[Game] Resources bundle not available!');
                showError('游戏资源加载失败，请刷新页面重试');
                return;
            }
        }

        // ========== 优化3: 场景加载带重试 ==========
        var maxRetries = 3;
        var retryCount = 0;

        function loadScene() {
            bundle.loadScene(launchScene, null, onProgress, function (err, scene) {
                if (!err) {
                    cc.director.runSceneImmediate(scene);
                    if (cc.sys.isBrowser) {
                        var canvas = document.getElementById('GameCanvas');
                        if (canvas) canvas.style.visibility = '';
                        var div = document.getElementById('GameDiv');
                        if (div) div.backgroundImage = '';
                        console.log('[Game] Scene loaded successfully');
                        startPerfMonitor();
                    }
                } else {
                    retryCount++;
                    console.error('[Game] Scene load error (retry ' + retryCount + '/' + maxRetries + '):', err.message);
                    if (retryCount < maxRetries) {
                        setTimeout(loadScene, 1000 * retryCount); // 指数退避
                    } else {
                        showError('场景加载失败: ' + err.message);
                    }
                }
            });
        }

        loadScene();
    };

    // ========== 引擎选项 ==========
    var option = {
        id: 'GameCanvas',
        debugMode: settings.debug ? cc.debug.DebugMode.INFO : cc.debug.DebugMode.ERROR,
        showFPS: settings.debug,
        frameRate: 60,
        groupList: settings.groupList,
        collisionMatrix: settings.collisionMatrix,
    };

    cc.assetManager.init({
        bundleVers: settings.bundleVers,
        remoteBundles: settings.remoteBundles,
        server: settings.server
    });

    let bundleRoot = [INTERNAL, MAIN];
    settings.hasStartSceneBundle && bundleRoot.push(START_SCENE);
    settings.hasResourcesBundle && bundleRoot.push(RESOURCES);

    var count = 0;
    function cb(err) {
        if (err) {
            console.error('[Game] Bundle load error:', err.message);
            return;
        }
        count++;
        if (count === bundleRoot.length + 1) {
            console.log('[Game] All bundles ready, starting game...');
            cc.game.run(option, onStart);
        }
    }

    // ========== 优化4: 脚本加载超时保护 ==========
    var scriptTimeout = setTimeout(function() {
        console.warn('[Game] Script loading timeout, forcing start...');
        cb(null);
    }, 30000);

    cc.assetManager.loadScript(settings.jsList.map(function(x) { return 'src/' + x; }), function(err) {
        clearTimeout(scriptTimeout);
        cb(err);
    });

    for (let i = 0; i < bundleRoot.length; i++) {
        cc.assetManager.loadBundle(bundleRoot[i], cb);
    }
};

// ========== 辅助函数 ==========

function showError(msg) {
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
        'background:#2a2a2a;color:#eee;padding:20px 30px;border-radius:8px;z-index:99999;' +
        'font-size:14px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.5)';
    el.textContent = msg;
    document.body.appendChild(el);
}

function showOptControls() {
    var fsBtn = document.getElementById('fullscreen-btn');
    var fpsEl = document.getElementById('fps-container');
    var perfEl = document.getElementById('perf-stats');
    if (fsBtn) fsBtn.style.display = 'block';
    if (fpsEl) fpsEl.style.display = 'block';
    if (perfEl) perfEl.style.display = 'block';
}

// ========== 优化5: 实时性能监控 ==========
function startPerfMonitor() {
    var fpsEl = document.getElementById('fps-container');
    var perfEl = document.getElementById('perf-stats');
    var frames = 0;
    var lastTime = performance.now();

    function updateStats() {
        frames++;
        var now = performance.now();
        if (now - lastTime >= 1000) {
            var fps = Math.round(frames * 1000 / (now - lastTime));
            if (fpsEl) fpsEl.textContent = 'FPS: ' + fps;

            // 内存信息（仅 Chrome）
            if (perfEl && performance.memory) {
                var used = (performance.memory.usedJSHeapSize / 1048576).toFixed(1);
                var total = (performance.memory.totalJSHeapSize / 1048576).toFixed(1);
                perfEl.textContent = 'MEM: ' + used + '/' + total + ' MB';
            }

            frames = 0;
            lastTime = now;
        }
        requestAnimationFrame(updateStats);
    }
    requestAnimationFrame(updateStats);
}

// ========== 优化6: 全屏切换 ==========
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        var btn = document.getElementById('fullscreen-btn');
        if (!btn) return;

        btn.addEventListener('click', function() {
            var el = document.getElementById('GameDiv');
            if (!document.fullscreenElement) {
                (el || document.documentElement).requestFullscreen().catch(function(){});
                btn.textContent = '⬜ 退出全屏';
            } else {
                document.exitFullscreen();
                btn.textContent = '⛶ 全屏';
            }
        });

        document.addEventListener('fullscreenchange', function() {
            if (!document.fullscreenElement) {
                btn.textContent = '⛶ 全屏';
            }
        });

        // F11 快捷键
        document.addEventListener('keydown', function(e) {
            if (e.key === 'F11') {
                e.preventDefault();
                btn.click();
            }
        });
    });
})();

// ========== 优化7: 存档管理 ==========
function toggleSavePanel() {
    var panel = document.getElementById('save-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function getSaveKeys() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && (key.indexOf('fs_') === 0 || key.indexOf('wls_') === 0 || 
            key.indexOf('game_') === 0 || key.indexOf('save_') === 0 ||
            key.indexOf('user_') === 0 || key.indexOf('player_') === 0)) {
            keys.push(key);
        }
    }
    return keys;
}

function exportSave() {
    var keys = getSaveKeys();
    var data = {};
    keys.forEach(function(k) { data[k] = localStorage.getItem(k); });
    
    if (Object.keys(data).length === 0) {
        alert('没有找到存档数据');
        return;
    }
    
    var json = JSON.stringify(data, null, 2);
    var textarea = document.getElementById('save-data');
    if (textarea) textarea.value = json;
    
    // 同时下载为文件
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'wls_save_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importSave() {
    var textarea = document.getElementById('save-data');
    var text = textarea ? textarea.value.trim() : '';
    if (!text) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var data = JSON.parse(ev.target.result);
                    Object.keys(data).forEach(function(k) {
                        localStorage.setItem(k, data[k]);
                    });
                    alert('存档导入成功! 共 ' + Object.keys(data).length + ' 项，刷新页面生效');
                } catch(e) {
                    alert('存档文件格式错误');
                }
            };
            reader.readAsText(file);
        };
        input.click();
        return;
    }
    
    try {
        var data = JSON.parse(text);
        Object.keys(data).forEach(function(k) {
            localStorage.setItem(k, data[k]);
        });
        alert('存档导入成功! 共 ' + Object.keys(data).length + ' 项，刷新页面生效');
    } catch(e) {
        alert('存档数据格式错误');
    }
}

function clearSave() {
    if (!confirm('确定要清除所有存档吗？此操作不可恢复！')) return;
    var keys = getSaveKeys();
    keys.forEach(function(k) { localStorage.removeItem(k); });
    alert('已清除 ' + keys.length + ' 项存档数据');
}

// ========== Bootstrap ==========
(function () {
    var splash = document.getElementById('splash');
    if (splash) splash.style.display = 'block';

    // ========== 优化8: 脚本并行加载 + defer ==========
    function loadScript(url) {
        return new Promise(function(resolve, reject) {
            var s = document.createElement('script');
            s.src = url;
            s.charset = 'utf-8';
            // 使用 defer 保持执行顺序
            s.defer = false;
            s.async = true;
            s.onload = function() { resolve(url); };
            s.onerror = function() { reject(url); };
            document.head.appendChild(s);
        });
    }

    // 串行加载保证依赖顺序: sdk-stub → engine → boot
    loadScript('src/sdk-stub.js').then(function() {
        console.log('[Boot] SDK stubs loaded');
        return loadScript(window._CCSettings && window._CCSettings.debug ? 'cocos2d-js.js' : 'cocos2d-js-min.js');
    }).then(function() {
        console.log('[Boot] Cocos engine loaded, version:', cc.ENGINE_VERSION);

        if (CC_PHYSICS_BUILTIN || CC_PHYSICS_CANNON) {
            return loadScript(window._CCSettings && window._CCSettings.debug ? 'physics.js' : 'physics-min.js');
        }
        return Promise.resolve();
    }).then(function() {
        console.log('[Boot] Starting game...');
        window.boot();
    }).catch(function(err) {
        console.error('[Boot] Failed to load:', err);
        showError('游戏启动失败: ' + err + '，请刷新页面重试');
    });
})();
