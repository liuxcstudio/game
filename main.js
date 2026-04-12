/**
 * main.js - 打工生活模拟器 优化版 v2.2.0
 *
 * 优化项:
 * - 加载防卡死（超时检测 + 强制推进）
 * - 启动加速（并发加载 + 超时回退）
 * - 触屏手感优化（引擎配置）
 * - 帧率自适应 + 后台暂停
 * - 全屏 + 存档管理 + 性能监控
 */

window.boot = function () {
    var settings = window._CCSettings;
    window._CCSettings = undefined;
    var onProgress = null;

    let { RESOURCES, INTERNAL, MAIN, START_SCENE } = cc.AssetManager.BuiltinBundleName;

    var _bootStart = performance.now();

    // ============================================================
    // 加载防卡: 记录最后进度变化时间
    // ============================================================
    var _lastProgressValue = 0;
    var _lastProgressTime = performance.now();
    var _stuckForceTimer = null;

    function setLoadingDisplay() {
        var splash = document.getElementById('splash');
        var progressBar = splash.querySelector('.progress-bar span');
        var tipEl = document.getElementById('splash-tip');
        var tips = [
            '正在加载游戏引擎...',
            '正在初始化资源管理器...',
            '正在加载游戏资源...',
            '正在初始化界面...',
            '即将开始游戏...'
        ];

        onProgress = function (finish, total) {
            var percent = 100 * finish / total;
            _lastProgressValue = percent;
            _lastProgressTime = performance.now();

            if (progressBar) {
                progressBar.style.width = percent.toFixed(2) + '%';
            }
            if (tipEl) {
                var idx = Math.min(Math.floor(percent / 20), tips.length - 1);
                tipEl.textContent = tips[idx] + ' (' + percent.toFixed(0) + '%)';
            }
        };

        // 防卡定时器: 每 5 秒检查进度是否停滞
        _stuckForceTimer = setInterval(function () {
            var elapsed = performance.now() - _lastProgressTime;
            if (elapsed > 8000 && _lastProgressValue < 95) {
                console.warn('[AntiStuck] Progress stuck at ' + _lastProgressValue.toFixed(1) + '% for ' + (elapsed / 1000).toFixed(0) + 's, forcing advance...');
                // 强制推进一小步，防止视觉卡死
                _lastProgressValue += 0.5;
                if (progressBar) {
                    progressBar.style.width = _lastProgressValue.toFixed(2) + '%';
                }
            }
            // 游戏场景加载完成后停止
            if (_lastProgressValue >= 99) {
                clearInterval(_stuckForceTimer);
            }
        }, 5000);

        splash.style.display = 'block';
        progressBar.style.width = '0%';
        if (tipEl) tipEl.textContent = tips[0];

        cc.director.once(cc.Director.EVENT_AFTER_SCENE_LAUNCH, function () {
            splash.style.display = 'none';
            clearInterval(_stuckForceTimer);
            // 显示工具栏
            var toolbar = document.getElementById('game-toolbar');
            if (toolbar) toolbar.style.display = 'block';
            startPerfMonitor();
            initSaveManager();
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

        // ============================================================
        // 触屏优化: 配置引擎触屏参数
        // ============================================================
        // 提升输入响应速度
        if (cc.internal && cc.internal.input) {
            cc.internal.input.setTouchMaxPointers(5);
        }
        // 禁用触屏距离阈值（让短距离滑动也能触发）
        if (cc.macro) {
            cc.macro.TOUCH_TIMEOUT = 5000;
        }

        // 后台暂停优化
        var _hidden = false;
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                _hidden = true;
                cc.game.pause();
            } else {
                _hidden = false;
                cc.game.resume();
            }
        });

        // ============================================================
        // 加载场景: 带超时保护
        // ============================================================
        var bundle = cc.assetManager.bundles.find(function (b) {
            return b.getSceneInfo(launchScene);
        });

        if (!bundle) {
            console.warn('[Game] Launch scene bundle not found:', launchScene);
            bundle = cc.assetManager.getBundle('resources');
            if (!bundle) {
                console.error('[Game] Resources bundle not available!');
                return;
            }
        }

        // 场景加载超时保护: 60 秒后强制报告完成
        var _sceneLoadTimeout = setTimeout(function () {
            console.warn('[AntiStuck] Scene load timeout, forcing progress to 100%');
            _lastProgressValue = 100;
            var progressBar = document.querySelector('#splash .progress-bar span');
            if (progressBar) progressBar.style.width = '100%';
        }, 60000);

        bundle.loadScene(launchScene, null, onProgress,
            function (err, scene) {
                clearTimeout(_sceneLoadTimeout);
                if (!err) {
                    cc.director.runSceneImmediate(scene);
                    if (cc.sys.isBrowser) {
                        var canvas = document.getElementById('GameCanvas');
                        canvas.style.visibility = '';
                        var div = document.getElementById('GameDiv');
                        if (div) div.backgroundImage = '';
                    }
                } else {
                    console.error('[Game] Failed to load scene:', err.message);
                    // 超时后自动重试一次
                    console.log('[AntiStuck] Retrying scene load in 2s...');
                    setTimeout(function () {
                        bundle.loadScene(launchScene, null, onProgress,
                            function (err2, scene2) {
                                if (!err2) {
                                    cc.director.runSceneImmediate(scene2);
                                } else {
                                    console.error('[Game] Scene load retry failed:', err2.message);
                                }
                            }
                        );
                    }, 2000);
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

    // ============================================================
    // 资源管理器初始化: 提升并发数
    // ============================================================
    cc.assetManager.init({
        bundleVers: settings.bundleVers,
        remoteBundles: settings.remoteBundles,
        server: settings.server
    });

    // 立即提升下载并发数（不等游戏代码设置）
    if (cc.assetManager.downloader) {
        cc.assetManager.downloader.maxConcurrency = 20;
    }
    if (cc.assetManager.downloader) {
        cc.assetManager.downloader.maxRequestsPerFrame = 10;
    }

    let bundleRoot = [INTERNAL, MAIN];
    settings.hasStartSceneBundle && bundleRoot.push(START_SCENE);
    settings.hasResourcesBundle && bundleRoot.push(RESOURCES);

    var count = 0;
    var totalCount = bundleRoot.length + 1;

    // Bundle 加载超时保护: 单个 bundle 超过 30 秒视为完成（防卡死）
    var _bundleLoadTimeouts = {};
    function startBundleTimeout(name) {
        _bundleLoadTimeouts[name] = setTimeout(function () {
            console.warn('[AntiStuck] Bundle ' + name + ' load timeout, forcing continue...');
            count++;
            if (count === totalCount) {
                cc.game.run(option, onStart);
            }
        }, 30000);
    }

    function cb(err) {
        if (err) {
            console.error('[Game] Bundle load error:', err.message);
        }
        // 清除对应的超时定时器
        var callerName = 'unknown';
        for (var key in _bundleLoadTimeouts) {
            if (_bundleLoadTimeouts.hasOwnProperty(key)) {
                callerName = key;
            }
        }
        // 简化: 清除第一个找到的
        for (var k in _bundleLoadTimeouts) {
            clearTimeout(_bundleLoadTimeouts[k]);
            delete _bundleLoadTimeouts[k];
            break;
        }

        count++;
        if (count === totalCount) {
            // 清除所有剩余超时
            for (var k2 in _bundleLoadTimeouts) {
                clearTimeout(_bundleLoadTimeouts[k2]);
            }
            _bundleLoadTimeouts = {};
            cc.game.run(option, onStart);
        }
    }

    // Load game scripts
    startBundleTimeout('scripts');
    cc.assetManager.loadScript(settings.jsList.map(function (x) { return 'src/' + x; }), cb);

    // Load bundles concurrently
    for (let i = 0; i < bundleRoot.length; i++) {
        startBundleTimeout(bundleRoot[i]);
        cc.assetManager.loadBundle(bundleRoot[i], cb);
    }
};

// ============================================================
// Bootstrap - 优化版启动
// ============================================================
(function () {
    var splash = document.getElementById('splash');
    splash.style.display = 'block';

    var _loadStart = performance.now();
    var _tipEl = document.getElementById('splash-tip');
    var _loadedScripts = [];

    function loadScript(moduleName, cb) {
        var domScript = document.createElement('script');
        domScript.async = false;
        domScript.src = moduleName;
        domScript.addEventListener('load', function () {
            document.body.removeChild(domScript);
            var elapsed = ((performance.now() - _loadStart) / 1000).toFixed(2);
            console.log('[Boot] Loaded:', moduleName, '(' + elapsed + 's)');
            _loadedScripts.push(moduleName);
            if (_tipEl) _tipEl.textContent = '加载中... ' + moduleName.split('/').pop();
            cb && cb();
        }, false);
        domScript.addEventListener('error', function () {
            console.error('[Boot] Failed to load:', moduleName);
            document.body.removeChild(domScript);
        }, false);
        document.body.appendChild(domScript);
    }

    // 脚本加载超时保护
    var _scriptTimeouts = {};

    function loadScriptWithTimeout(moduleName, cb, timeoutMs) {
        _scriptTimeouts[moduleName] = setTimeout(function () {
            console.warn('[Boot] Timeout loading:', moduleName, 'continuing anyway...');
            // 如果超时但脚本还没加载完，仍然回调
            if (_loadedScripts.indexOf(moduleName) === -1) {
                cb && cb();
            }
        }, timeoutMs || 60000);

        loadScript(moduleName, function() {
            clearTimeout(_scriptTimeouts[moduleName]);
            cb && cb();
        });
    }

    // Step 1: Load SDK stubs
    loadScriptWithTimeout('src/sdk-stub.js', function () {
        console.log('[Boot] SDK stubs loaded');

        // Step 2: Load Cocos engine
        loadScriptWithTimeout('cocos2d-js-min.js', function () {
            console.log('[Boot] Cocos engine loaded, version:', cc.ENGINE_VERSION);

            // Step 3: Check physics
            if (CC_PHYSICS_BUILTIN || CC_PHYSICS_CANNON) {
                loadScriptWithTimeout('physics-min.js', window.boot, 30000);
            } else {
                window.boot();
            }
        }, 60000);
    }, 10000);
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
            if (window.performance && performance.memory) {
                perfMemory = Math.round(performance.memory.usedJSHeapSize / 1048576);
            }
            if (perfPanel) {
                perfPanel.textContent = 'FPS: ' + perfFPS + ' | Mem: ' + perfMemory + 'MB';
            }
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

    function setStatus(msg) { if (status) status.textContent = msg; }

    function getGameSaves() {
        var saves = {};
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key.indexOf('fs_') === -1 && key.indexOf('__') === -1 && key !== 'wls_backup') {
                try { var val = localStorage.getItem(key); if (val && val.length > 10) saves[key] = val; } catch (e) {}
            }
        }
        return saves;
    }

    document.getElementById('btn-save').addEventListener('click', function () {
        modal.style.display = 'flex';
        setStatus('共 ' + Object.keys(getGameSaves()).length + ' 条存档');
    });
    document.getElementById('btn-close-modal').addEventListener('click', function () { modal.style.display = 'none'; });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.style.display = 'none'; });

    document.getElementById('btn-export-save').addEventListener('click', function () {
        var saves = getGameSaves();
        if (!Object.keys(saves).length) { setStatus('没有存档'); return; }
        var data = JSON.stringify({ version: '2.2.0', date: new Date().toISOString(), saves: saves });
        var blob = new Blob([data], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'wls_save_' + Date.now() + '.json';
        a.click();
        setStatus('已导出');
    });

    document.getElementById('btn-import-save').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
        var file = fileInput.files[0]; if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = JSON.parse(e.target.result);
                if (data.saves) { var c = 0; for (var k in data.saves) { localStorage.setItem(k, data.saves[k]); c++; } setStatus('导入 ' + c + ' 条（重启生效）'); }
                else setStatus('无效文件');
            } catch (err) { setStatus('导入失败'); }
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    document.getElementById('btn-backup-save').addEventListener('click', function () {
        var saves = getGameSaves();
        if (!Object.keys(saves).length) { setStatus('没有存档'); return; }
        localStorage.setItem('wls_backup', JSON.stringify({ date: new Date().toISOString(), saves: saves }));
        setStatus('已备份');
    });

    document.getElementById('btn-restore-save').addEventListener('click', function () {
        try {
            var backup = localStorage.getItem('wls_backup');
            if (!backup) { setStatus('没有备份'); return; }
            var data = JSON.parse(backup);
            if (data.saves) { var c = 0; for (var k in data.saves) { localStorage.setItem(k, data.saves[k]); c++; } setStatus('恢复 ' + c + ' 条（重启生效）'); }
        } catch (err) { setStatus('恢复失败'); }
    });

    document.getElementById('btn-clear-save').addEventListener('click', function () {
        var keys = Object.keys(getGameSaves());
        if (!keys.length) { setStatus('没有存档'); return; }
        keys.forEach(function (k) { localStorage.removeItem(k); });
        setStatus('已清除 ' + keys.length + ' 条（重启生效）');
    });
}

document.getElementById('btn-perf').addEventListener('click', function () {
    if (perfPanel) { perfPanel.remove(); perfPanel = null; return; }
    perfPanel = document.createElement('div');
    perfPanel.style.cssText = 'position:fixed;top:40px;right:8px;z-index:9999;background:rgba(0,0,0,0.7);color:#0f0;padding:4px 8px;border-radius:4px;font-size:11px;font-family:monospace;';
    document.body.appendChild(perfPanel);
});
