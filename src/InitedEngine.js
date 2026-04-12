// InitedEngine.js - 优化版
// 增强: 桌面端渲染优化 + 内存管理
{
    // 抗锯齿
    cc.macro.ENABLE_WEBGL_ANTIALIAS = true;

    // 渲染优化
    cc.macro.ENABLE_CULLING = true;             // 启用视锥体裁剪
    cc.macro.ENABLE_TRANSPARENT_CANVAS = false;  // 不透明画布，减少合成开销
    cc.macro.BATCH_VERTEX_COUNT = 200;           // 提高批处理顶点数
    cc.macro.CLEANUP_IMAGE_CACHE = true;         // 自动清理图片缓存

    // iOS WebGL MeshBuffer 修复
    var ua = window.navigator.userAgent;
    var isIOS14 = cc.sys.os === cc.sys.OS_IOS && cc.sys.isBrowser && /(iPhone OS 14|iOS 14)/.test(ua);
    var isIOS15 = cc.sys.os === cc.sys.OS_IOS && cc.sys.isBrowser && /(iPhone OS 15|iOS 15)/.test(ua);
    if (isIOS14 || isIOS15) {
        cc.MeshBuffer.prototype.checkAndSwitchBuffer = function(s) {
            if (this.vertexOffset + s > 65535) { this.uploadData(); this._batcher._flush(); }
        };
        cc.MeshBuffer.prototype.forwardIndiceStartToOffset = function() {
            this.uploadData(); this.switchBuffer();
        };
    }

    // 桌面端优化
    if (cc.sys.os === cc.sys.OS_WINDOWS || cc.sys.os === cc.sys.OS_OSX || cc.sys.os === cc.sys.OS_LINUX) {
        cc.macro.MAX_VERTEX_ATTRIBS = 31;

        // 自动设置合适的分辨率
        var dpr = window.devicePixelRatio || 1;
        if (dpr > 2) {
            console.log('[Opt] High DPI detected (' + dpr + 'x), consider setting wls_retina=false in localStorage');
        }
    }

    // 内存管理: 监控内存并在必要时警告
    if (cc.sys.isBrowser && performance.memory) {
        var memCheckInterval = setInterval(function() {
            var used = performance.memory.usedJSHeapSize;
            var limit = performance.memory.jsHeapSizeLimit;
            if (used > limit * 0.85) {
                console.warn('[Memory] JS heap usage ' + (used/1048576).toFixed(0) + 'MB exceeds 85% of limit ' + (limit/1048576).toFixed(0) + 'MB');
                // 尝试释放引擎纹理缓存
                if (cc.textureCache && cc.textureCache._textures) {
                    cc.textureCache.releaseAll();
                    console.log('[Memory] Released texture cache');
                }
            }
        }, 30000); // 每30秒检查一次
    }
}
