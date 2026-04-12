// InitedEngine.js - adapted for web-desktop local mode
// Original: iOS MeshBuffer workaround for WebGL
// Adapted: Enable anti-aliasing + iOS fix + desktop compatibility
{
    cc.macro.ENABLE_WEBGL_ANTIALIAS = true;

    // iOS WebGL MeshBuffer fix (keep from original)
    const s = cc.sys.os === cc.sys.OS_IOS && cc.sys.isBrowser && /(iPhone OS 14)|(Version\/14(\.|[0-9])*)|(iOS 14)/.test(window.navigator.userAgent);
    const t = cc.sys.os === cc.sys.OS_IOS && cc.sys.isBrowser && /(iPhone OS 15)|(Version\/15(\.|[0-9])*)|(iOS 15)/.test(window.navigator.userAgent);
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

    // Desktop: increase max texture size for better quality
    if (cc.sys.os === cc.sys.OS_WINDOWS || cc.sys.os === cc.sys.OS_OSX || cc.sys.os === cc.sys.OS_LINUX) {
        cc.macro.MAX_VERTEX_ATTRIBS = 31;
    }
}
