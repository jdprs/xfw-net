// 44. Capacitor 原生桥接（仅 App 环境生效，网页版自动降级/跳过）
(function () {
    var isApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    var Haptics = null, Clipboard = null, Share = null, Browser = null;
    if (isApp) {
        try {
            Haptics = window.Capacitor.Plugins.Haptics;
            Clipboard = window.Capacitor.Plugins.Clipboard;
            Share = window.Capacitor.Plugins.Share;
            Browser = window.Capacitor.Plugins.Browser;
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

    // ===== 启动时检查更新（仅 App）=====
    var UPDATE_API = 'https://api.github.com/repos/jdprs/xfw-net-app/releases/latest';

    // 解析版本号为数字数组（去掉前导 v）
    function parseVersion(v) {
        return String(v == null ? '' : v).replace(/^v/i, '').trim().split('.').map(function (n) {
            return parseInt(n, 10) || 0;
        });
    }
    // 判断 latest 是否比 current 新
    function isNewer(latest, current) {
        var a = parseVersion(latest), b = parseVersion(current);
        for (var i = 0; i < Math.max(a.length, b.length); i++) {
            var x = a[i] || 0, y = b[i] || 0;
            if (x > y) return true;
            if (x < y) return false;
        }
        return false;
    }
    // 用系统浏览器打开下载链接（Browser 插件，失败退回 window.open）
    function openDownload(url) {
        try {
            if (Browser && Browser.open) { Browser.open({ url: url }); return; }
        } catch (e) { /* 忽略 */ }
        window.open(url, '_system');
    }
    // 弹出更新提示（自定义弹窗，风格与现有 modal 统一）
    function showUpdateModal(release, downloadUrl) {
        var overlay = document.createElement('div');
        overlay.style.cssText =
            'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(4px);';
        var box = document.createElement('div');
        box.style.cssText =
            'background:var(--bg-card);padding:24px 26px;border-radius:16px;max-width:420px;width:92%;border:2px solid var(--accent-gold);';
        var h = document.createElement('h3');
        h.style.cssText = 'color:var(--accent-gold);margin-bottom:10px;text-align:center;';
        h.textContent = '🔄 发现新版本 ' + release.tag_name;
        var p = document.createElement('div');
        p.style.cssText = 'color:var(--text-secondary);font-size:0.88rem;line-height:1.6;margin-bottom:18px;max-height:220px;overflow-y:auto;white-space:pre-wrap;';
        p.textContent = release.body ? String(release.body).slice(0, 800) : '修复了一些问题，提升了体验。';
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:10px;justify-content:center;';
        var yes = document.createElement('button');
        yes.className = 'btn btn-success';
        yes.textContent = '立即更新';
        var no = document.createElement('button');
        no.className = 'btn btn-secondary';
        no.textContent = '以后再说';
        row.appendChild(yes); row.appendChild(no);
        box.appendChild(h); box.appendChild(p); box.appendChild(row);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        yes.onclick = function () { overlay.remove(); openDownload(downloadUrl); };
        no.onclick = function () { overlay.remove(); };
        overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
    }
    // 检查更新：拉取最新 release，比对当前版本
    function checkForUpdate() {
        if (!isApp) return;
        try {
            fetch(UPDATE_API, { cache: 'no-store' })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (release) {
                    if (!release || !release.tag_name) return;
                    var current = window.GAME_VERSION || '0';
                    if (!isNewer(release.tag_name, current)) return; // 已是最新
                    // 优先找 APK 资产，否则用 release 页面
                    var downloadUrl = release.html_url;
                    if (release.assets && release.assets.length) {
                        var apk = release.assets.filter(function (a) { return /\.apk$/i.test(a.name); })[0];
                        if (apk) downloadUrl = apk.browser_download_url;
                    }
                    showUpdateModal(release, downloadUrl);
                    if (Bridge.vibrate) Bridge.vibrate('success');
                })
                .catch(function () { /* 检查失败静默处理，不打扰用户 */ });
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
        setTimeout(checkForUpdate, 800);   // 每次启动检查更新
    };
})();
