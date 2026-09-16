/**
 * Stock game module loader
 * Loads numbered sections in their original order.
 */
(() => {
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
            //   - 大厅页(index, 无GAME_MODE): 加载 36-p2p + 37-lobby
            //   - 联机游戏页(master/player): 加载全部 36-39
            //   - 单机页(local): 不加载联机模块
            // v10.0 修复: 如果 window.Net 已存在（说明 36-p2p.js 已通过 body 末尾的
            //   直接 script 标签加载），跳过动态加载，避免重复执行和状态冲突
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
                s.src = moduleBasePath + netPaths[netIndex] + '?v=10.8';
                s.onload = () => { netIndex++; loadNet(); };
                s.onerror = () => console.error('Net module load failed: ' + netPaths[netIndex]);
                document.head.appendChild(s);
            };
            loadNet();
            return;
        }
        const script = document.createElement("script");
        script.src = moduleBasePath + modulePaths[index];
        script.onload = () => loadModule(index + 1);
        script.onerror = () => console.error(`Module load failed: ${modulePaths[index]}`);
        document.head.appendChild(script);
    }

    loadModule(0);
})();
