/**
 * SDK Stub Layer - 打工生活模拟器 优化版 v2.1.9
 *
 * 优化项:
 * - 合并 XHR 拦截器（减少原型覆盖次数）
 * - 使用 WeakSet 替代属性标记（更高效）
 * - 移除冗余的 XMLHttpRequest.prototype.open 覆盖
 * - FairyGUI 包降级延迟初始化
 * - 更精确的域名拦截列表
 */

// ============================================================
// 0. 小程序平台全局变量预定义
// ============================================================
if (!window.wx) window.wx = undefined;
if (!window.qq) window.qq = undefined;
if (!window.tt) window.tt = undefined;
if (!window.swan) window.swan = undefined;
if (!window.hbs) window.hbs = undefined;
if (!window.qg) window.qg = undefined;
if (!window.loadRuntime) window.loadRuntime = undefined;
if (!window.Laya) window.Laya = undefined;

// ============================================================
// 1. jsb 全局对象桩
// ============================================================
if (typeof window.jsb === 'undefined') {
    window.jsb = {};
}

window.jsb.fileUtils = {
    getWritablePath: function () { return './user-data/'; },
    getStringFromFile: function (path) {
        try { return localStorage.getItem('fs_' + path) || ''; } catch (e) { return ''; }
    },
    isFileExist: function () { return false; },
    isDirectoryExist: function () { return false; },
    createDirectory: function () {},
    removeDirectory: function () {},
    getSearchPaths: function () { return ['./']; },
    setSearchPaths: function () {},
    fullPathForFilename: function (path) { return path; },
    fullPathFromRelativeFile: function (rel, base) { return base + rel; }
};

window.jsb.reflection = {
    callStaticMethod: function () {} // 静默处理
};

// jsb.AssetsManager - 热更新管理器（禁用）
window.jsb.EventAssetsManager = {
    ERROR: 0, UPDATE_FINISHED: 1, NEW_VERSION_FOUND: 2,
    ALREADY_UP_TO_DATE: 3, DOWNLOADING_VERSION: 3, VERSION_LOADED: 4, UPDATE_PROGRESSION: 0
};
window.jsb.EventListenerAssetsManager = function () {
    return { setEnabled: function () {}, release: function () {} };
};
window.jsb.Manifest = function () {
    return { getSearchPaths: function () { return []; }, getVersion: function () { return '0.0.0'; } };
};
window.jsb.AssetsManager = function () {
    var cb = null;
    return {
        setVersionCompareHandle: function () {},
        setEventCallback: function (fn) {
            cb = fn;
            setTimeout(function () {
                if (cb) cb({ getEventCode: function () { return 3; }, getMessage: function () { return ''; }, getAssetId: function () { return ''; }, getDownloadedBytes: function () { return 0; }, getTotalBytes: function () { return 0; }, getPercent: function () { return 100; } });
            }, 50);
        },
        getManifest: function () { return null; },
        getLocalManifest: function () { return { getVersion: function () { return '2.1.9'; } }; },
        setVerifyCallback: function () {},
        loadLocalManifest: function () { return true; },
        checkUpdate: function () {},
        hotUpdate: function () {},
        update: function () {}
    };
};

// ============================================================
// 2. callNative 桩
// ============================================================
function callNative(functionName, params, callback) {
    if (callback) setTimeout(function () { callback({ code: 0 }); }, 50);
}
window.callNative = callNative;

// ============================================================
// 3. Ultralisk SDK 桩
// ============================================================
window.ULModuleMegadata = window.ULModuleMegadata || { init: function () {}, sendEvent: function () {}, setUserData: function () {} };
window.ULAdvManager = window.ULAdvManager || {
    showRewardedAd: function (cb) { if (cb) setTimeout(function () { cb(true); }, 300); },
    showInterstitialAd: function () {}, showBannerAd: function () {}, hideBannerAd: function () {},
    isAdReady: function () { return false; }, preloadAd: function () {}
};
window.ULModuleCdk = window.ULModuleCdk || { useCDK: function (code, cb) { if (cb) cb({ code: 0 }); } };
window.ULModuleCheckerManager = window.ULModuleCheckerManager || { check: function () {}, init: function () {} };
window.ULCloudStorage = window.ULCloudStorage || { save: function (d, cb) { if (cb) cb({ code: 0 }); }, load: function (cb) { if (cb) cb({ code: 0, data: null }); }, sync: function () {} };
window.ULRankList = window.ULRankList || { submitScore: function (s, cb) { if (cb) cb({ code: 0 }); }, getRankList: function (cb) { if (cb) cb({ code: 0, data: [] }); } };
window.ULModuleUlsdkDemo = window.ULModuleUlsdkDemo || {};

// ============================================================
// 4. WebSocket 桩
// ============================================================
(function () {
    var OrigWebSocket = window.WebSocket || function () {};
    window.WebSocket = function (url) {
        return {
            url: url, readyState: 3, CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3,
            send: function () {}, close: function () {},
            onopen: null, onmessage: null, onerror: null, onclose: null
        };
    };
    window.WebSocket.prototype = OrigWebSocket.prototype || {};
    window.WebSocket.CONNECTING = 0;
    window.WebSocket.OPEN = 1;
    window.WebSocket.CLOSING = 2;
    window.WebSocket.CLOSED = 3;
})();

// ============================================================
// 5. 统一 XHR/Fetch 拦截（单次原型覆盖）
// ============================================================
(function () {
    var blockedHosts = [
        'ultralisk.cn', 'h005up.ultralisk.cn', 'h005.ultralisk.cn',
        'gamesres.ultralisk.cn', 'megadatav7.ultralisk.cn', 'copv7.ultralisk.cn',
        'common.ultralisk.cn', 'gamedata.ultralisk.cn', 'hkcop.ultralisk.cn',
        'sdkserver.ultralisk.cn', 'cdkey.ultralisk.cn', 'rank.ultralisk.cn',
        'snssdk.com', 'pstatp.com', 'leishouwin.cc', 'oppomobile.com',
        'vivo.com.cn', 'onelink.me', 'winudf.com', 'mini1.cn', 'douyin.com', 'dbankcdn.com'
    ];

    // Pre-compute lowercased hosts for fast lookup
    var blockedLower = blockedHosts.map(function (h) { return h.toLowerCase(); });

    // Use WeakSet for O(1) blocked request tracking
    var blockedRequests = new WeakSet();

    function isBlocked(url) {
        if (!url || typeof url !== 'string') return false;
        var lower = url.toLowerCase();
        if (lower.indexOf('://') === -1 || lower.indexOf('localhost') !== -1 || lower.indexOf('127.0.0.1') !== -1) {
            return false;
        }
        for (var i = 0; i < blockedLower.length; i++) {
            if (lower.indexOf(blockedLower[i]) !== -1) return true;
        }
        return false;
    }

    function getStubResponse(url) {
        if (url.indexOf('checkNetwork') !== -1) return '{"code":0,"data":{"connected":true}}';
        if (url.indexOf('getservertime') !== -1 || url.indexOf('getServerTime') !== -1 || url.indexOf('checktime') !== -1) return String(Date.now());
        if (url.indexOf('rank') !== -1) return '{"code":0,"data":{"list":[]}}';
        if (url.indexOf('save') !== -1 || url.indexOf('cloud') !== -1) return '{"code":0}';
        if (url.indexOf('config') !== -1 || url.indexOf('channel') !== -1) return '{"code":0,"data":{}}';
        return '{}';
    }

    // Single XHR open + send override
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, async) {
        if (isBlocked(url)) {
            blockedRequests.add(this);
            this._stubUrl = url;
        }
        return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        if (blockedRequests.has(this)) {
            var self = this;
            var response = getStubResponse(this._stubUrl || '');
            setTimeout(function () {
                Object.defineProperty(self, 'status', { value: 200, writable: false });
                Object.defineProperty(self, 'responseText', { value: response, writable: false });
                Object.defineProperty(self, 'response', { value: response, writable: false });
                Object.defineProperty(self, 'readyState', { value: 4, writable: false });
                if (self.onreadystatechange) self.onreadystatechange();
                if (self.onload) self.onload();
            }, 10);
            return;
        }
        return origSend.apply(this, arguments);
    };

    // Fetch interception
    if (window.fetch) {
        var origFetch = window.fetch;
        window.fetch = function (url, options) {
            if (isBlocked(typeof url === 'string' ? url : (url && url.url))) {
                return Promise.resolve(new Response('{}', { status: 200 }));
            }
            return origFetch.apply(this, arguments);
        };
    }
})();

// ============================================================
// 6. localStorage 增强（带内存回退）
// ============================================================
(function () {
    try {
        localStorage.setItem('__st', '1');
        localStorage.removeItem('__st');
    } catch (e) {
        var ms = {};
        window.localStorage = {
            getItem: function (k) { return ms[k] || null; },
            setItem: function (k, v) { ms[k] = String(v); },
            removeItem: function (k) { delete ms[k]; },
            clear: function () { ms = {}; },
            get length() { return Object.keys(ms).length; },
            key: function (i) { return Object.keys(ms)[i] || null; }
        };
    }
})();

// ============================================================
// 7. 系统信息设置
// ============================================================
(function () {
    function ensureWebMode() {
        if (typeof cc !== 'undefined' && cc.sys) {
            cc.sys.isNative = false;
            cc.sys.isBrowser = true;
            cc.sys.isMobile = false;
            if (cc.sys.DESKTOP_BROWSER) cc.sys.platform = cc.sys.DESKTOP_BROWSER;
        }
    }
    ensureWebMode();
    if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(ensureWebMode);
    }
})();

// Screen orientation fix
if (typeof screen !== 'undefined' && !screen.orientation) {
    screen.orientation = { type: 'landscape-primary', lock: function () {}, unlock: function () {} };
}

// ============================================================
// 8. 全局错误捕获
// ============================================================
(function () {
    try {
        window.addEventListener('error', function (event) {
            if (event.message && (
                event.message.indexOf('ultralisk') !== -1 ||
                event.message.indexOf('ULModule') !== -1 ||
                event.message.indexOf('callNative') !== -1 ||
                event.message.indexOf('jsb.') !== -1 ||
                event.message.indexOf('WebSocket') !== -1
            )) {
                event.preventDefault();
                return true;
            }
        }, true);
    } catch (e) {}

    try {
        window.addEventListener('unhandledrejection', function (event) {
            var reason = String(event.reason || '');
            if (reason.indexOf('ultralisk') !== -1 || reason.indexOf('NetworkError') !== -1) {
                event.preventDefault();
            }
        });
    } catch (e) {}
})();

// ============================================================
// 9. FairyGUI 包缺失降级处理
// ============================================================
(function () {
    var _fguiPackages = [
        'base', 'vHR', 'vSlots1', 'newPalyerBonus', 'vAnniversary2025',
        'vBicycle', 'vLight', 'vFishScale2', 'vNightKill', 'vSWM2',
        'vEggyCar', 'vAntique', 'vTruck', 'vSuperMarket', 'vHotRecommend',
        'vFishScale', 'vMillionaire', 'vSlots', 'vIdolAgent', 'vMillinaire3',
        'vChannel', 'vLost', 'vLoverChangeClothes', 'vWorkingChallenge',
        'vDiver', 'vSisterTest', 'happyNewYear2025', 'vGame', 'vSetting',
        'icons', 'vLoading', 'vNightCook', 'vTravel', 'vAnniversary', 'explain'
    ];
    var _pkgSet = {};
    _fguiPackages.forEach(function (p) { _pkgSet[p] = true; });

    function patchGUIPackage() {
        var GUIPackage = null;

        if (typeof cc !== 'undefined' && cc._RF) {
            try {
                var modules = cc._RF._modules || {};
                for (var key in modules) {
                    var mod = modules[key];
                    if (mod && mod.exports && mod.exports.default &&
                        typeof mod.exports.default.loadPackage === 'function' &&
                        mod.exports.default._instByName !== undefined) {
                        GUIPackage = mod.exports.default;
                        break;
                    }
                }
            } catch (e) {}
        }

        if (!GUIPackage) return false;

        var _origLoad = GUIPackage.loadPackage;
        var _origLoadWithDep = GUIPackage.loadPackageWithDependencies;

        GUIPackage.loadPackage = function () {
            var args = Array.prototype.slice.call(arguments);
            var pkgName = null;
            if (args.length > 0) {
                if (typeof args[0] === 'string') pkgName = args[0];
                else if (args.length > 1 && typeof args[1] === 'string') pkgName = args[1];
            }
            if (pkgName && pkgName.indexOf('/') !== -1) pkgName = pkgName.split('/').pop();
            if (pkgName && _pkgSet[pkgName]) {
                var cb = null;
                for (var i = 0; i < args.length; i++) { if (typeof args[i] === 'function') cb = args[i]; }
                if (cb) setTimeout(function () { cb(null, null); }, 5);
                return;
            }
            return _origLoad.apply(this, arguments);
        };

        if (_origLoadWithDep) {
            GUIPackage.loadPackageWithDependencies = function (pkgName, cb) {
                if (pkgName && pkgName.indexOf('/') !== -1) {
                    var name = pkgName.split('/').pop();
                    if (_pkgSet[name]) { if (cb) setTimeout(function () { cb(null); }, 5); return; }
                }
                return _origLoadWithDep.apply(this, arguments);
            };
        }

        var _origRemove = GUIPackage.removePackage;
        GUIPackage.removePackage = function () {
            try { return _origRemove.apply(this, arguments); } catch (e) {}
        };

        var _origGetByUrl = GUIPackage.getItemByURL;
        GUIPackage.getItemByURL = function () {
            try { return _origGetByUrl.apply(this, arguments); } catch (e) { return null; }
        };

        return true;
    }

    var _attempts = 0;
    function tryPatch() {
        if (patchGUIPackage()) return;
        if (++_attempts < 200) setTimeout(tryPatch, 50);
    }

    if (typeof cc !== 'undefined') tryPatch();
    else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () { setTimeout(tryPatch, 100); });
})();

// Console branding
console.log('%c 打工生活模拟器 优化版 v2.1.9 ',
    'background:#4CAF50;color:white;font-size:16px;padding:8px 16px;border-radius:4px;');
