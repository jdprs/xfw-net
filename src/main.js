/**
 * Stock game module loader
 * Loads numbered sections in their original order.
 */
(() => {
    // ===== 全局版本号（以后改版本号只需要改这里） =====
    const GAME_VERSION = '10.2';
    // 缓存戳（CACHE_BUST）：只在改代码后更新，用于强制浏览器刷新模块，不影响显示版本号
    // 小改动递增末尾数字（10.2.1、10.2.2…），发版时再与 GAME_VERSION 对齐
    const CACHE_BUST = '10.2.2';
    window.GAME_VERSION = GAME_VERSION;
    window.CACHE_BUST = CACHE_BUST;

    // 自动同步页面上的版本号显示
    function syncVersion() {
        const v = GAME_VERSION;
        // 更新 title
        if (document.title) {
            document.title = document.title.replace(/v[\d.]+/g, 'v' + v);
        }
        // 更新主标题
        const mainTitle = document.getElementById('main-title');
        if (mainTitle) {
            mainTitle.innerHTML = mainTitle.innerHTML.replace(/v[\d.]+/g, 'v' + v);
        }
        // 更新 .version 元素
        document.querySelectorAll('.version').forEach(el => {
            el.textContent = el.textContent.replace(/v[\d.]+/g, 'v' + v);
        });
    }
    // DOM 就绪后立即同步
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncVersion);
    } else {
        syncVersion();
    }

    const moduleBasePath = 'src/';
    const modulePaths = [
        'app/44-capacitor-bridge.js',
        'core/01-state.js',
        'utils/02-utils.js',
        'ui/03-banners-modals.js',
        'utils/04-password.js',
        'core/05-stock-algorithm.js',
        'modules/06-lottery.js',
        'modules/07-custom-stock.js',
        'core/08-stock-trading.js',
        'ai/09-internal-ai.js',
        'ai/10-external-ai.js',
        'ai/12-pretrained-qtable.js',
        'ai/11-qlearning.js',
        'modules/11-prediction.js',
        'modules/12-achievements.js',
        'modules/13-portfolio-rating.js',
        'modules/14-dark-horse.js',
        'core/15-looting.js',
        'core/16-decision.js',
        'core/17-market-close.js',
        'ui/18-ui-update.js',
        'ui/19-player-cards.js',
        'ui/20-action-modals.js',
        'ui/21-logs.js',
        'ui/22-charts.js',
        'ui/23-event-modal.js',
        'core/24-save-load.js',
        'ui/25-log-panel.js',
        'modules/26-external-ai-config.js',
        'ui/27-rules-display.js',
        'config/28-admin-settings.js',
        'core/29-game-lifecycle.js',
        'ui/30-admin-entry.js',
        'ui/31-event-bindings.js',
        'ui/32-health-warning.js',
        'ui/33-external-ai-panel.js',
        'ui/34-round-history.js',
        'ui/35-expand-charts.js',
        'ui/40-premium.js',
        'ui/42-help.js',
        'i18n/43-i18n.js',
    ];

    // 通用脚本加载：失败自动重试（最多 3 次，退避 400/900/1600ms），返回 Promise
    function loadScript(src, retriesLeft) {
        return new Promise((resolve) => {
            const attempt = (left) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = () => resolve(true);
                s.onerror = () => {
                    s.remove();
                    if (left > 0) {
                        setTimeout(() => attempt(left - 1), 400 + (3 - left) * 500);
                    } else {
                        resolve(false);
                    }
                };
                document.head.appendChild(s);
            };
            attempt(retriesLeft);
        });
    }

    // 全部模块加载失败时，显示明显错误（避免静默后界面空白、日志/面板不出现）
    function showLoadError(failedNames) {
        const d = document.createElement('div');
        d.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(8,16,32,0.96);padding:24px;font-family:sans-serif;';
        d.innerHTML = `<div style="max-width:420px;text-align:center;color:#e8eef7;">
            <div style="font-size:2.4rem;margin-bottom:12px;">⚠️</div>
            <div style="font-size:1.15rem;font-weight:700;margin-bottom:8px;">部分游戏文件加载失败</div>
            <div style="font-size:0.88rem;opacity:0.75;margin-bottom:6px;">通常是网络不稳定导致，刷新页面即可恢复。</div>
            <div style="font-size:0.75rem;opacity:0.5;margin-bottom:18px;word-break:break-all;">${failedNames.join(', ')}</div>
            <button onclick="location.reload()" style="padding:10px 26px;font-size:1rem;border:none;border-radius:8px;background:#3b82f6;color:#fff;cursor:pointer;">🔄 刷新页面</button>
        </div>`;
        document.body.appendChild(d);
    }

    async function loadModule(index) {
        // 顺序加载核心模块，失败重试；最终失败记录并提示
        const failed = [];
        for (let i = 0; i < modulePaths.length; i++) {
            const src = moduleBasePath + modulePaths[i] + '?v=' + CACHE_BUST;
            const ok = await loadScript(src, 3);
            if (!ok) {
                console.error('Module load failed after retries: ' + modulePaths[i]);
                failed.push(modulePaths[i].split('/').pop());
            }
        }

        // 加载联机（net）模块（若当前模式需要）
        const mode = window.GAME_MODE;
        let netPaths = [];
        if (mode === 'master' || mode === 'player') {
            netPaths = ['net/36-p2p.js', 'net/37-lobby.js', 'net/38-game-sync.js', 'net/39-chat.js'];
        } else if (!mode || mode === 'lobby') {
            netPaths = ['net/36-p2p.js', 'net/37-lobby.js'];
        }
        for (const np of netPaths) {
            const ok = await loadScript(moduleBasePath + np + '?v=' + CACHE_BUST, 3);
            if (!ok) {
                console.error('Net module load failed after retries: ' + np);
                failed.push(np.split('/').pop());
            }
        }

        // 有关键模块失败则阻止开局，显示错误（避免空白界面）
        if (failed.length > 0) {
            showLoadError(failed);
            return;
        }
        if (typeof window.onAllModulesLoaded === 'function') window.onAllModulesLoaded();
    }
    loadModule(0);
})();