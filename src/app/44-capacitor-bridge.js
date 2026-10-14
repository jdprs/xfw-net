// 44. Capacitor 原生桥接（仅 App 环境生效，网页版自动降级/跳过）
(function () {
    var isApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    var Haptics = null, Clipboard = null, Share = null;
    if (isApp) {
        try {
            Haptics = window.Capacitor.Plugins.Haptics;
            Clipboard = window.Capacitor.Plugins.Clipboard;
            Share = window.Capacitor.Plugins.Share;
        } catch (e) { isApp = false; }
    }

    var Bridge = {
        isApp: isApp,

        // 横幅震动：按类型区分强度
        vibrate: function (type) {
            if (!isApp || !Haptics) return;
            try {
                var d = 15;
                if (type === 'error') d = 300;
                else if (type === 'achievement') d = 150;
                else if (type === 'warning') d = 80;
                else if (type === 'success') d = 30;
                Haptics.vibrate({ duration: d });
            } catch (e) { /* 忽略 */ }
        },

        // 复制到剪贴板（App 用原生，网页降级）
        copy: function (text) {
            if (isApp && Clipboard) { return Clipboard.write({ value: String(text) }); }
            if (navigator.clipboard && navigator.clipboard.writeText) { return navigator.clipboard.writeText(String(text)); }
            return Promise.resolve();
        },

        // 读取剪贴板
        read: function () {
            if (isApp && Clipboard) { return Clipboard.read().then(function (r) { return r.value || ''; }); }
            if (navigator.clipboard && navigator.clipboard.readText) { return navigator.clipboard.readText(); }
            return Promise.resolve('');
        },

        // 系统分享（App 调原生分享面板，网页降级为复制）
        share: function (title, text) {
            if (isApp && Share) { return Share.share({ title: title || '', text: String(text) }); }
            return this.copy(text);
        },

        // 检测剪贴板内容：房间号(6位数字) / 存档码
        detectClipboard: function () {
            return this.read().then(function (text) {
                if (!text) return null;
                text = String(text).trim();
                if (/^\d{6}$/.test(text)) return { kind: 'room', value: text };
                if (/^xfw:/i.test(text) || (text.length > 40 && /^[A-Za-z0-9+/=\s]+$/.test(text))) return { kind: 'save', value: text };
                return null;
            }).catch(function () { return null; });
        },

        // 剪贴板变化回调（由原生插件触发）
        onClipboardChange: null
    };

    window.CapBridge = Bridge;

    // 监听原生剪贴板变化（自定义 ClipboardWatcher 插件）
    if (isApp && window.Capacitor.Plugins.ClipboardWatcher) {
        try {
            window.Capacitor.Plugins.ClipboardWatcher.addListener('clipboardChanged', function (data) {
                if (Bridge.onClipboardChange) Bridge.onClipboardChange(data.value);
            });
        } catch (e) { /* 忽略 */ }
    }

    // 启动后检测剪贴板：房间号 / 存档码
    function startClipboardCheck() {
        if (!isApp) return;
        Bridge.detectClipboard().then(function (r) {
            if (!r) return;
            if (r.kind === 'room') {
                if (typeof showInfoModal === 'function') {
                    showInfoModal('📋 检测到房间号', '剪贴板中有房间号 ' + r.value + '，是否加入？', function () {
                        if (typeof window.mpShowJoinForm === 'function') window.mpShowJoinForm();
                        setTimeout(function () {
                            var input = document.getElementById('mp-join-code');
                            if (input) input.value = r.value;
                            if (typeof window.mpJoinGo === 'function') window.mpJoinGo();
                        }, 150);
                    });
                }
            } else if (r.kind === 'save') {
                if (typeof showInfoModal === 'function') {
                    showInfoModal('📋 检测到存档码', '剪贴板中有存档码，是否导入？', function () {
                        if (typeof importCode === 'function') importCode();
                        setTimeout(function () {
                            var ta = document.getElementById('code-textarea');
                            if (ta) ta.value = r.value;
                            var btn = document.getElementById('code-import-confirm-btn');
                            if (btn) btn.click();
                        }, 150);
                    });
                }
            }
        });
    }

    // 所有模块加载完后执行检测
    var _origOnLoaded = window.onAllModulesLoaded;
    window.onAllModulesLoaded = function () {
        if (_origOnLoaded) _origOnLoaded();
        setTimeout(startClipboardCheck, 400);
    };
})();
