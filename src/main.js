/**
 * Stock game module loader
 * Loads numbered sections in their original order.
 */
(() => {
    // ===== 全局版本号（以后改版本号只需要改这里） =====
    const GAME_VERSION = '10.0.11';
    window.GAME_VERSION = GAME_VERSION;

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
    ];

    function loadModule(index) {
        if (index >= modulePaths.length) {
            // v10.0: 联机模块加载
            if (window.Net) {
                if (typeof window.onAllModulesLoaded === 'function') window.onAllModulesLoaded();
                return;
            }
            const mode = window.GAME_MODE;
            let netPaths = [];
            if (mode === 'master' || mode === 'player') {
                netPaths = ['net/36-p2p.js', 'net/37-lobby.js', 'net/38-game-sync.js', 'net/39-chat.js'];
            } else if (!mode || mode === 'lobby') {
                netPaths = ['net/36-p2p.js', 'net/37-lobby.js'];
            }
            if (netPaths.length === 0) {
                if (typeof window.onAllModulesLoaded === 'function') window.onAllModulesLoaded();
                return;
            }
            let netIndex = 0;
            const loadNet = () => {
                if (netIndex >= netPaths.length) {
                    if (typeof window.onAllModulesLoaded === 'function') window.onAllModulesLoaded();
                    return;
                }
                const s = document.createElement('script');
                s.src = moduleBasePath + netPaths[netIndex] + '?v=' + GAME_VERSION;
                s.onload = () => { netIndex++; loadNet(); };
                s.onerror = () => {
                    console.error('Net module load failed: ' + netPaths[netIndex]);
                    netIndex++;
                    loadNet();
                };
                document.head.appendChild(s);
            };
            loadNet();
            return;
        }
        const script = document.createElement("script");
        script.src = moduleBasePath + modulePaths[index];
        script.onload = () => loadModule(index + 1);
        script.onerror = () => {
            console.error(`Module load failed: ${modulePaths[index]}`);
            loadModule(index + 1);
        };
        document.head.appendChild(script);
    }

    loadModule(0);
})();
