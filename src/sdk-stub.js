/**
 * sdk-stub.js - 打工生活模拟器 本地离线版 v2.1.9 (优化版)
 *
 * 优化项:
 *  1. 缓存 XHR 拦截结果，减少重复匹配开销
 *  2. 减少 FairyGUI 补丁轮询频率
 *  3. 合并原版两个 XHR 拦截器为一个
 *  4. WebSocket 惰性单例拦截
 *  5. 预构建响应对象复用
 */

// ============================================================
// 0. 小程序平台全局变量
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
if (typeof window.jsb === 'undefined') window.jsb = {};

window.jsb.fileUtils = {
    getWritablePath: function() { return './user-data/'; },
    getStringFromFile: function(path) {
        try { return localStorage.getItem('fs_' + path) || ''; } catch(e) { return ''; }
    },
    isFileExist: function() { return false; },
    isDirectoryExist: function() { return false; },
    createDirectory: function() {},
    removeDirectory: function() {},
    getSearchPaths: function() { return ['./']; },
    setSearchPaths: function() {},
    fullPathForFilename: function(p) { return p; },
    fullPathFromRelativeFile: function(r, b) { return b + r; }
};

window.jsb.reflection = { callStaticMethod: function() {} };

window.jsb.EventAssetsManager = {
    ERROR: 0, UPDATE_FINISHED: 1, NEW_VERSION_FOUND: 2,
    ALREADY_UP_TO_DATE: 3, DOWNLOADING_VERSION: 3, VERSION_LOADED: 4,
    UPDATE_PROGRESSION: 0
};
window.jsb.EventListenerAssetsManager = function() {
    return { setEnabled: function(){}, release: function(){} };
};
window.jsb.Manifest = function() {
    return { getSearchPaths: function(){ return []; }, getVersion: function(){ return '0.0.0'; } };
};
window.jsb.AssetsManager = function() {
    return {
        setVersionCompareHandle: function(){}, setVerifyCallback: function(){},
        getManifest: function(){ return null; }, loadLocalManifest: function(){ return true; },
        checkUpdate: function(){}, hotUpdate: function(){}, update: function(){},
        setEventCallback: function(cb) {
            setTimeout(function() {
                if (cb) cb({
                    getEventCode: function(){ return 3; },
                    getMessage: function(){ return ''; },
                    getAssetId: function(){ return ''; },
                    getDownloadedBytes: function(){ return 0; },
                    getTotalBytes: function(){ return 0; },
                    getPercent: function(){ return 100; }
                });
            }, 50);
        },
        getLocalManifest: function(){ return { getVersion: function(){ return '2.1.9'; } }; }
    };
};

// ============================================================
// 2. callNative 桩
// ============================================================
function callNative(fn, params, callback) {
    if (callback) setTimeout(function(){ callback({ code: 0 }); }, 50);
}
window.callNative = callNative;

// ============================================================
// 3. SDK 桩
// ============================================================
window.ULModuleMegadata = window.ULModuleMegadata || { init: function(){}, sendEvent: function(){}, setUserData: function(){} };
window.ULAdvManager = window.ULAdvManager || {
    showRewardedAd: function(cb){ if(cb) setTimeout(function(){ cb(true); }, 300); },
    showInterstitialAd: function(){}, showBannerAd: function(){}, hideBannerAd: function(){},
    isAdReady: function(){ return false; }, preloadAd: function(){}
};
window.ULModuleCdk = window.ULModuleCdk || { useCDK: function(c,cb){ if(cb) cb({code:0}); } };
window.ULModuleCheckerManager = window.ULModuleCheckerManager || { check: function(){}, init: function(){} };
window.ULCloudStorage = window.ULCloudStorage || { save: function(d,cb){ if(cb) cb({code:0}); }, load: function(cb){ if(cb) cb({code:0,data:null}); }, sync: function(){} };
window.ULRankList = window.ULRankList || { submitScore: function(s,cb){ if(cb) cb({code:0}); }, getRankList: function(cb){ if(cb) cb({code:0,data:[]}); } };
window.ULModuleUlsdkDemo = window.ULModuleUlsdkDemo || {};

// ============================================================
// 4. 统一网络拦截（合并原版两个拦截器 + URL缓存 + 响应复用）
// ============================================================
(function() {
    var blockedHosts = [
        'ultralisk.cn','h005up.ultralisk.cn','h005.ultralisk.cn',
        'gamesres.ultralisk.cn','megadatav7.ultralisk.cn','copv7.ultralisk.cn',
        'common.ultralisk.cn','gamedata.ultralisk.cn','hkcop.ultralisk.cn',
        'sdkserver.ultralisk.cn','cdkey.ultralisk.cn','rank.ultralisk.cn',
        '192.168.1.','snssdk.com','pstatp.com','leishouwin.cc',
        'oppomobile.com','vivo.com.cn','onelink.me','winudf.com',
        'mini1.cn','douyin.com','dbankcdn.com'
    ];
    var _cache = {};

    function isBlocked(url) {
        if (!url) return false;
        if (_cache[url] !== undefined) return _cache[url];
        var l = url.toLowerCase();
        var r = l.indexOf('://') === -1 || l.indexOf('localhost') !== -1 || l.indexOf('127.0.0.1') !== -1;
        if (!r) {
            for (var i = 0; i < blockedHosts.length; i++) {
                if (l.indexOf(blockedHosts[i]) !== -1) { r = true; break; }
            }
        }
        _cache[url] = r;
        return r;
    }

    // 预构建响应方法
    function stubSend(self, resp) {
        setTimeout(function() {
            try {
                Object.defineProperty(self, 'status', {value:200,writable:false});
                Object.defineProperty(self, 'responseText', {value:resp,writable:false});
                Object.defineProperty(self, 'response', {value:resp,writable:false});
                Object.defineProperty(self, 'readyState', {value:4,writable:false});
                if (self.onreadystatechange) self.onreadystatechange();
                if (self.onload) self.onload();
            } catch(e){}
        }, 10);
    }

    function getResp(url) {
        if (url.indexOf('servertime') !== -1 || url.indexOf('checktime') !== -1) return String(Date.now());
        if (url.indexOf('rank') !== -1) return '{"code":0,"data":{"list":[]}}';
        if (url.indexOf('checkNetwork') !== -1) return '{"code":0,"data":{"connected":true}}';
        if (url.indexOf('save') !== -1 || url.indexOf('cloud') !== -1) return '{"code":0}';
        return '{}';
    }

    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(m, url, a) {
        this._stub = isBlocked(url);
        if (this._stub) this._resp = getResp(url);
        return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
        if (this._stub) return stubSend(this, this._resp);
        return origSend.apply(this, arguments);
    };

    if (window.fetch) {
        var origFetch = window.fetch;
        window.fetch = function(url) {
            if (isBlocked(typeof url === 'string' ? url : (url && url.url)))
                return Promise.resolve(new Response('{}', {status:200}));
            return origFetch.apply(this, arguments);
        };
    }
})();

// ============================================================
// 5. WebSocket 惰性单例拦截
// ============================================================
(function() {
    var _stub = null;
    function getStub() {
        if (_stub) return _stub;
        _stub = {
            url:'', readyState:3, CONNECTING:0, OPEN:1, CLOSING:2, CLOSED:3,
            send:function(){}, close:function(){},
            onopen:null, onmessage:null, onerror:null, onclose:null
        };
        return _stub;
    }
    window.WebSocket = function(url) { var s = getStub(); s.url = url; return s; };
    window.WebSocket.prototype = getStub();
    window.WebSocket.CONNECTING = 0; window.WebSocket.OPEN = 1;
    window.WebSocket.CLOSING = 2; window.WebSocket.CLOSED = 3;
})();

// ============================================================
// 6. localStorage 增强
// ============================================================
(function() {
    try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); }
    catch(e) {
        var m = {};
        window.localStorage = {
            getItem: function(k){ return m[k]||null; }, setItem: function(k,v){ m[k]=String(v); },
            removeItem: function(k){ delete m[k]; }, clear: function(){ m={}; },
            get length(){ return Object.keys(m).length; }, key: function(i){ return Object.keys(m)[i]||null; }
        };
    }
})();

// ============================================================
// 7. 系统信息
// ============================================================
(function() {
    function fix() {
        if (typeof cc !== 'undefined' && cc.sys) {
            cc.sys.isNative = false; cc.sys.isBrowser = true; cc.sys.isMobile = false;
            if (cc.sys.DESKTOP_BROWSER) cc.sys.platform = cc.sys.DESKTOP_BROWSER;
        }
    }
    fix();
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(fix);
})();

// ============================================================
// 8. Screen orientation fix
// ============================================================
if (typeof screen !== 'undefined' && !screen.orientation) {
    screen.orientation = { type: 'landscape-primary', lock: function(){}, unlock: function(){} };
}

// ============================================================
// 9. 全局错误捕获
// ============================================================
(function() {
    try { window.addEventListener('error', function(e) {
        if (e.message && (e.message.indexOf('ultralisk') !== -1 || e.message.indexOf('ULModule') !== -1 ||
            e.message.indexOf('callNative') !== -1 || e.message.indexOf('jsb.') !== -1 ||
            e.message.indexOf('WebSocket') !== -1)) { e.preventDefault(); return true; }
    }, true); } catch(e) {}
    try { window.addEventListener('unhandledrejection', function(e) {
        if (e.reason && (String(e.reason).indexOf('ultralisk') !== -1 || String(e.reason).indexOf('NetworkError') !== -1))
            e.preventDefault();
    }); } catch(e) {}
})();

// ============================================================
// 10. FairyGUI 包缺失降级（优化: 减少 CPU 轮询）
// ============================================================
(function() {
    var _pkgs = [
        'base','vHR','vSlots1','newPalyerBonus','vAnniversary2025','vBicycle','vLight',
        'vFishScale2','vNightKill','vSWM2','vEggyCar','vAntique','vTruck','vSuperMarket',
        'vHotRecommend','vFishScale','vMillionaire','vSlots','vIdolAgent','vMillinaire3',
        'vChannel','vLost','vLoverChangeClothes','vWorkingChallenge','vDiver','vSisterTest',
        'happyNewYear2025','vGame','vSetting','icons','vLoading','vNightCook','vTravel',
        'vAnniversary','explain'
    ];
    var _lookup = {};
    for (var i = 0; i < _pkgs.length; i++) _lookup[_pkgs[i]] = true;

    function patchGUIPackage() {
        var GUIPackage = null;
        if (typeof cc !== 'undefined' && cc._RF) {
            try {
                var mods = cc._RF._modules || {};
                for (var k in mods) {
                    var e = mods[k] && mods[k].exports && mods[k].exports.default;
                    if (e && typeof e.loadPackage === 'function' && typeof e.getItemByURL === 'function' && e._instByName !== undefined) {
                        GUIPackage = e; break;
                    }
                }
            } catch(x) {}
        }
        if (!GUIPackage) return false;

        var _origLoad = GUIPackage.loadPackage;
        var _origLoadDep = GUIPackage.loadPackageWithDependencies;

        GUIPackage.loadPackage = function() {
            var a = Array.prototype.slice.call(arguments);
            var name = null;
            if (a.length > 0 && typeof a[0] === 'string') name = a[0].split('/').pop();
            else if (a.length > 1 && typeof a[1] === 'string') name = a[1].split('/').pop();
            if (name && _lookup[name]) {
                var cb = null;
                for (var i = 0; i < a.length; i++) if (typeof a[i] === 'function') { cb = a[i]; break; }
                if (cb) setTimeout(function(){ cb(null, null); }, 5);
                return;
            }
            return _origLoad.apply(this, arguments);
        };

        if (_origLoadDep) {
            GUIPackage.loadPackageWithDependencies = function(name, cb) {
                var p = name ? name.split('/').pop() : null;
                if (p && _lookup[p]) { if (cb) setTimeout(function(){ cb(null); }, 5); return; }
                return _origLoadDep.apply(this, arguments);
            };
        }

        console.log('[FairyGUI] Patched ' + _pkgs.length + ' packages');
        return true;
    }

    var _done = false;
    function tryPatch() {
        if (_done) return;
        if (patchGUIPackage()) { _done = true; return; }
        setTimeout(tryPatch, 100);
    }
    if (typeof cc !== 'undefined') tryPatch();
    else document.addEventListener('DOMContentLoaded', function(){ setTimeout(tryPatch, 200); });
})();

console.log('%c打工生活模拟器 v2.1.9 (优化版)', 'background:#4CAF50;color:white;font-size:16px;padding:8px 16px;border-radius:4px;');
