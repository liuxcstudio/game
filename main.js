/**
 * main.js - 打工生活模拟器 优化版 v2.1.9
 *
 * 优化项:
 * - 脚本预加载与并发加载
 * - 启动进度细粒度显示
 * - 帧率自适应控制
 * - 内存监控与自动释放
 * - 全屏支持
 * - 存档管理（导入/导出/备份/恢复）
 * - 性能监控面板
 * - 启动耗时统计
 */

window.boot = function () {
    var settings = window._CCSettings;
    window._CCSettings = undefined;
    var onProgress = null;

    let { RESOURCES, INTERNAL, MAIN, START_SCENE } = cc.AssetManager.BuiltinBundleName;

    var _bootStart = performance.now();

    function setLoadingDisplay() {
        var splash = document.getElementById('splash');
        var progressBar = splash.querySelector('.progress-bar span');
        var tipEl = document.getElementById('splash-tip');
        var tips = [
            '正在加载游戏引擎...',
            '正在初始化资源管理器...',
            '正在加载游戏资源...',
            '即将开始游戏...'
        ];

        onProgress = function (finish, total) {
            var percent = 100 * finish / total;
            if (progressBar) {
                progressBar.style.width = percent.toFixed(2) + '%';
            }
            if (tipEl) {
                var idx = Math.min(Math.floor(percent / 25), tips.length - 1);
                tipEl.textContent = tips[idx] + ' (' + percent.toFixed(0) + '%)';
            }
        };
        splash.style.display = 'block';
        progressBar.style.width = '0%';
        if (tipEl) tipEl.textContent = tips[0];

        cc.director.once(cc.Director.EVENT_AFTER_SCENE_LAUNCH, function () {
            splash.style.display = 'none';
            // 显示工具栏
            var toolbar = document.getElementById('game-toolbar');
            if (toolbar) toolbar.style.display = 'block';
            // 启动性能监控
            startPerfMonitor();
            // 启动存档管理
            initSaveManager();
            // 启动全屏按钮
            initFullscreen();

            var bootTime = ((performance.now() - _bootStart) / 1000).toFixed(2);
            console.log('%c[Perf] Game booted in ' + bootTime + 's', 'color:#4CAF50;font-weight:bold;');
        });
    }

    var onStart = function () {
        cc.view.enableRetina(true);
        cc.view.resizeWithBrowserSize(true);

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

        // 帧率优化：非活跃时降帧省电
        var _hidden = false;
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                _hidden = true;
                cc.game.pause();
                console.log('[Perf] Game paused (tab hidden)');
            } else {
                _hidden = false;
                cc.game.resume();
                console.log('[Perf] Game resumed');
            }
        });

        var bundle = cc.assetManager.bundles.find(function (b) {
            return b.getSceneInfo(launchScene);
        });

        if (!bundle) {
            console.warn('[Game] Launch scene bundle not found:', launchScene, '- trying resources bundle');
            bundle = cc.assetManager.getBundle('resources');
            if (!bundle) {
                console.error('[Game] Resources bundle not available!');
                return;
            }
        }

        bundle.loadScene(launchScene, null, onProgress,
            function (err, scene) {
                if (!err) {
                    cc.director.runSceneImmediate(scene);
                    if (cc.sys.isBrowser) {
                        var canvas = document.getElementById('GameCanvas');
                        canvas.style.visibility = '';
                        var div = document.getElementById('GameDiv');
                        if (div) div.backgroundImage = '';
                        console.log('[Game] Scene loaded successfully:', launchScene);
                    }
                } else {
                    console.error('[Game] Failed to load scene:', err.message);
                }
            }
        );
    };

    var option = {
        id: 'GameCanvas',
        debugMode: cc.debug.DebugMode.ERROR,
        showFPS: false,
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
    var totalCount = bundleRoot.length + 1;
    function cb(err) {
        if (err) {
            console.error('[Game] Bundle load error:', err.message);
            return;
        }
        count++;
        console.log('[Game] Bundle loaded:', count + '/' + totalCount);
        if (count === totalCount) {
            console.log('[Game] All bundles ready, starting game...');
            cc.game.run(option, onStart);
        }
    }

    // Load game scripts
    cc.assetManager.loadScript(settings.jsList.map(function (x) { return 'src/' + x; }), cb);

    // Load bundles concurrently
    for (let i = 0; i < bundleRoot.length; i++) {
        cc.assetManager.loadBundle(bundleRoot[i], cb);
    }
};

// ============================================================
// Bootstrap - Optimized Web loading
// ============================================================
(function () {
    var splash = document.getElementById('splash');
    splash.style.display = 'block';

    var _loadStart = performance.now();
    var _tipEl = document.getElementById('splash-tip');

    function loadScript(moduleName, cb) {
        var domScript = document.createElement('script');
        domScript.async = false; // sequential for dependency order
        domScript.src = moduleName;
        domScript.addEventListener('load', function () {
            document.body.removeChild(domScript);
            console.log('[Boot] Loaded:', moduleName, '(' + ((performance.now() - _loadStart) / 1000).toFixed(2) + 's)');
            if (_tipEl) _tipEl.textContent = '加载中... ' + moduleName.split('/').pop();
            cb && cb();
        }, false);
        domScript.addEventListener('error', function () {
            console.error('[Boot] Failed to load:', moduleName);
            document.body.removeChild(domScript);
        }, false);
        document.body.appendChild(domScript);
    }

    // Step 1: Load SDK stubs first
    loadScript('src/sdk-stub.js', function () {
        console.log('[Boot] SDK stubs loaded');

        // Step 2: Load Cocos Creator engine
        loadScript('cocos2d-js-min.js', function () {
            console.log('[Boot] Cocos engine loaded, version:', cc.ENGINE_VERSION);

            // Step 3: Check physics engine
            if (CC_PHYSICS_BUILTIN || CC_PHYSICS_CANNON) {
                loadScript('physics-min.js', window.boot);
            } else {
                window.boot();
            }
        });
    });
})();

// ============================================================
// Performance Monitor
// ============================================================
var perfPanel = null;
var perfFrameCount = 0;
var perfLastTime = 0;
var perfFPS = 0;
var perfMemory = 0;

function startPerfMonitor() {
    perfLastTime = performance.now();

    function updatePerf() {
        perfFrameCount++;
        var now = performance.now();
        if (now - perfLastTime >= 2000) {
            perfFPS = Math.round(perfFrameCount * 1000 / (now - perfLastTime));
            perfFrameCount = 0;
            perfLastTime = now;

            // Memory (Chrome only)
            if (window.performance && performance.memory) {
                perfMemory = Math.round(performance.memory.usedJSHeapSize / 1048576);
            }

            if (perfPanel) {
                perfPanel.textContent = 'FPS: ' + perfFPS + ' | Mem: ' + perfMemory + 'MB';
            }

            // Auto-release unused assets every 30s
            try {
                if (cc.assetManager && cc.assetManager.gc) {
                    cc.assetManager.gc();
                }
            } catch (e) {}
        }
        requestAnimationFrame(updatePerf);
    }
    requestAnimationFrame(updatePerf);
}

function initFullscreen() {
    var btn = document.getElementById('btn-fullscreen');
    if (!btn) return;
    btn.addEventListener('click', function () {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(function () {});
            btn.textContent = '\u2715 退出全屏';
        } else {
            document.exitFullscreen();
            btn.textContent = '\u26F6 全屏';
        }
    });
    document.addEventListener('fullscreenchange', function () {
        if (document.fullscreenElement) {
            btn.textContent = '\u2715 退出全屏';
        } else {
            btn.textContent = '\u26F6 全屏';
        }
    });
}

function initSaveManager() {
    var modal = document.getElementById('save-modal');
    var status = document.getElementById('save-status');
    var fileInput = document.getElementById('save-file-input');

    if (!modal) return;

    function setStatus(msg) {
        if (status) status.textContent = msg;
    }

    // Get all game saves from localStorage
    function getGameSaves() {
        var saves = {};
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key.indexOf('fs_') === -1 && key.indexOf('__') === -1 && key !== 'wls_backup') {
                try {
                    var val = localStorage.getItem(key);
                    if (val && val.length > 10) {
                        saves[key] = val;
                    }
                } catch (e) {}
            }
        }
        return saves;
    }

    // Open/close modal
    document.getElementById('btn-save').addEventListener('click', function () {
        modal.style.display = 'flex';
        setStatus('共找到 ' + Object.keys(getGameSaves()).length + ' 条存档数据');
    });
    document.getElementById('btn-close-modal').addEventListener('click', function () {
        modal.style.display = 'none';
    });
    modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.style.display = 'none';
    });

    // Export save
    document.getElementById('btn-export-save').addEventListener('click', function () {
        var saves = getGameSaves();
        if (Object.keys(saves).length === 0) {
            setStatus('没有存档可导出');
            return;
        }
        var data = JSON.stringify({ version: '2.1.9', date: new Date().toISOString(), saves: saves });
        var blob = new Blob([data], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'wls_save_' + Date.now() + '.json';
        a.click();
        URL.revokeObjectURL(url);
        setStatus('存档已导出');
    });

    // Import save
    document.getElementById('btn-import-save').addEventListener('click', function () {
        fileInput.click();
    });
    fileInput.addEventListener('change', function () {
        var file = fileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = JSON.parse(e.target.result);
                if (data.saves) {
                    var count = 0;
                    for (var key in data.saves) {
                        localStorage.setItem(key, data.saves[key]);
                        count++;
                    }
                    setStatus('已导入 ' + count + ' 条存档（重启游戏生效）');
                } else {
                    setStatus('无效的存档文件');
                }
            } catch (err) {
                setStatus('导入失败: ' + err.message);
            }
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    // Backup save
    document.getElementById('btn-backup-save').addEventListener('click', function () {
        var saves = getGameSaves();
        if (Object.keys(saves).length === 0) {
            setStatus('没有存档可备份');
            return;
        }
        localStorage.setItem('wls_backup', JSON.stringify({ date: new Date().toISOString(), saves: saves }));
        setStatus('存档已备份（可随时恢复）');
    });

    // Restore save
    document.getElementById('btn-restore-save').addEventListener('click', function () {
        try {
            var backup = localStorage.getItem('wls_backup');
            if (!backup) {
                setStatus('没有备份可恢复');
                return;
            }
            var data = JSON.parse(backup);
            if (data.saves) {
                var count = 0;
                for (var key in data.saves) {
                    localStorage.setItem(key, data.saves[key]);
                    count++;
                }
                setStatus('已恢复 ' + count + ' 条存档（备份时间: ' + (data.date || '未知') + '，重启游戏生效）');
            }
        } catch (err) {
            setStatus('恢复失败: ' + err.message);
        }
    });

    // Clear save
    document.getElementById('btn-clear-save').addEventListener('click', function () {
        var saves = getGameSaves();
        var keys = Object.keys(saves);
        if (keys.length === 0) {
            setStatus('没有存档可清除');
            return;
        }
        keys.forEach(function (key) { localStorage.removeItem(key); });
        setStatus('已清除 ' + keys.length + ' 条存档（重启游戏生效）');
    });
}

// Perf button
document.getElementById('btn-perf').addEventListener('click', function () {
    if (perfPanel) {
        perfPanel.remove();
        perfPanel = null;
        return;
    }
    perfPanel = document.createElement('div');
    perfPanel.style.cssText = 'position:fixed;top:40px;right:8px;z-index:9999;background:rgba(0,0,0,0.7);color:#0f0;padding:4px 8px;border-radius:4px;font-size:11px;font-family:monospace;';
    document.body.appendChild(perfPanel);
});
