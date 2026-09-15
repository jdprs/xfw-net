//  29. 游戏初始化 & 结束
        // ================================================================

        function initGame(loadSave = false) {
            try {
                if (loadSave && loadGame()) {
                    document.getElementById('game-setup').style.display = 'none';
                    document.getElementById('game-main').style.display = 'block';
                    showLogPanel();
                    updateUI();
                    updatePlayersDisplay();
                    updateLeaderboard();
                    initCharts();
                    updateCharts();
                    updateStockStatus();
                    rebuildLogs();
                    addLog(`📂 读取存档，继续第 ${round} 轮`, 'highlight');
                    showBanner(`读取存档成功，继续第 ${round} 轮`, 'success', null, '📂 读取存档');
                    updateCloseMarketButton();
                    updateEndGameButton();
                    setAllControlsEnabled(false);
                    updateGameRulesDisplay();
                    return;
                }

                humanCount = parseInt(document.getElementById('human-players').value) || 1;
                aiCount = parseInt(document.getElementById('ai-players').value) || 0;
                totalRounds = parseInt(document.getElementById('total-rounds').value) || 60;
                if (humanCount < 1) humanCount = 1;
                if (aiCount < 0) aiCount = 0;
                let totalPlayers = humanCount + aiCount + externalAIConfigs.length;
                if (totalPlayers > 6) {
                    let maxExtra = 6 - humanCount - aiCount;
                    if (maxExtra < 0) maxExtra = 0;
                    if (externalAIConfigs.length > maxExtra) {
                        showBanner(`总玩家数不能超过6，外接AI ${externalAIConfigs.length} 个，最多 ${maxExtra} 个`, 'warning', null,
                            '⚠️ 玩家超限');
                        externalAIConfigs = externalAIConfigs.slice(0, maxExtra);
                        renderExternalAIConfigs();
                    }
                    totalPlayers = humanCount + aiCount + externalAIConfigs.length;
                }
                if (totalRounds < 10) totalRounds = 10;
                if (totalRounds > 200) totalRounds = 200;

                const bannerDur = parseFloat(document.getElementById('admin-banner-duration').value);
                if (!isNaN(bannerDur) && bannerDur > 0) BANNER_DURATION = bannerDur;

                const thinkMin = parseFloat(document.getElementById('admin-ai-think-min').value);
                const thinkMax = parseFloat(document.getElementById('admin-ai-think-max').value);
                if (!isNaN(thinkMin) && thinkMin > 0) AI_THINK_MIN = thinkMin;
                if (!isNaN(thinkMax) && thinkMax > 0) AI_THINK_MAX = Math.max(thinkMax, AI_THINK_MIN + 0.5);

                CHART_TYPE = document.getElementById('admin-chart-type').value || 'line';

                const sharePrice = parseFloat(document.getElementById('admin-share-price').value);
                if (!isNaN(sharePrice) && sharePrice >= 10) INIT_SHARE_PRICE = sharePrice;
                else INIT_SHARE_PRICE = 100;

                const dhMult = parseFloat(document.getElementById('admin-darkhorse-multiplier').value);
                if (!isNaN(dhMult) && dhMult >= 1.2) DARK_HORSE_MULTIPLIER = dhMult;
                const dhProb = parseFloat(document.getElementById('admin-darkhorse-prob').value);
                if (!isNaN(dhProb) && dhProb >= 0.05 && dhProb <= 1.0) DARK_HORSE_PROB = dhProb;

                // v9.1: 读取破产设置
                const bThreshold = parseInt(document.getElementById('admin-bankruptcy-threshold').value);
                if (!isNaN(bThreshold) && bThreshold >= 10) BANKRUPTCY_THRESHOLD = bThreshold;
                const bFund = parseInt(document.getElementById('admin-bankruptcy-fund').value);
                if (!isNaN(bFund) && bFund >= 100) BANKRUPTCY_FUND = bFund;

                if (adminMode) {
                    INIT_PLAYER_MONEY = parseInt(document.getElementById('admin-init-money').value) || 5000;
                    INIT_BANK_MONEY = parseInt(document.getElementById('admin-bank-money').value) || 200000;
                    LOOT_THRESHOLD = parseInt(document.getElementById('admin-loot-threshold').value) || 8000;
                    LOOT_RATIO = parseInt(document.getElementById('admin-loot-ratio').value) || 15;
                    ADMIN_CONFIG.volatilityScale = parseFloat(document.getElementById('admin-volatility-scale').value) ||
                        1.0;
                    ADMIN_CONFIG.lotteryWinScale = parseFloat(document.getElementById('admin-lottery-win-scale')
                        .value) || 1.0;
                    ADMIN_CONFIG.algoMode = document.getElementById('admin-algo-mode').value || '标准';

                    ADMIN_CONFIG.aMaxUp = stocks.A.maxUp;
                    ADMIN_CONFIG.bMaxDown = stocks.B.maxDown;
                    ADMIN_CONFIG.bMaxUp = stocks.B.maxUp;
                    ADMIN_CONFIG.cMaxDown = stocks.C.maxDown;
                    ADMIN_CONFIG.cMaxUp = stocks.C.maxUp;
                    ADMIN_CONFIG.dMaxDown = stocks.D.maxDown;
                    ADMIN_CONFIG.dMaxUp = stocks.D.maxUp;
                    ADMIN_CONFIG.darkHorseMultiplier = DARK_HORSE_MULTIPLIER;
                    ADMIN_CONFIG.darkHorseProb = DARK_HORSE_PROB;
                    ADMIN_CONFIG.initSharePrice = INIT_SHARE_PRICE;
                    ADMIN_CONFIG.bankruptcyThreshold = BANKRUPTCY_THRESHOLD;
                    ADMIN_CONFIG.bankruptcyFund = BANKRUPTCY_FUND;

                    document.querySelectorAll('.ach-reward-input').forEach(inp => {
                        const id = inp.dataset.id;
                        const v = parseFloat(inp.value) || 0;
                        if (id && v >= 0) achievementRewardRatios[id] = clamp(v / 100, 0, 1);
                    });

                    document.querySelectorAll('.stock-name-input').forEach(inp => {
                        const key = inp.dataset.key;
                        const val = inp.value.trim() || (key + '股');
                        if (stocks[key]) stocks[key].name = val;
                    });
                    document.querySelectorAll('.stock-up-input').forEach(inp => {
                        const key = inp.dataset.key;
                        let val = parseFloat(inp.value) || 0;
                        val = clamp(val, 0, 200) / 100;
                        if (stocks[key]) stocks[key].maxUp = val;
                        if (key === 'A') ADMIN_CONFIG.aMaxUp = val;
                        else if (key === 'B') ADMIN_CONFIG.bMaxUp = val;
                        else if (key === 'C') ADMIN_CONFIG.cMaxUp = val;
                        else if (key === 'D') ADMIN_CONFIG.dMaxUp = val;
                    });
                    document.querySelectorAll('.stock-down-input').forEach(inp => {
                        const key = inp.dataset.key;
                        let val = parseFloat(inp.value) || 0;
                        val = clamp(val, -90, 0) / 100;
                        if (stocks[key]) stocks[key].maxDown = val;
                        if (key === 'B') ADMIN_CONFIG.bMaxDown = val;
                        else if (key === 'C') ADMIN_CONFIG.cMaxDown = val;
                        else if (key === 'D') ADMIN_CONFIG.dMaxDown = val;
                    });
                } else {
                    INIT_PLAYER_MONEY = 5000;
                    INIT_BANK_MONEY = 200000;
                    LOOT_THRESHOLD = 8000;
                    LOOT_RATIO = 15;
                    ADMIN_CONFIG.volatilityScale = 1.0;
                    ADMIN_CONFIG.aMaxUp = 0.18;
                    ADMIN_CONFIG.bMaxDown = -0.40;
                    ADMIN_CONFIG.bMaxUp = 0.80;
                    ADMIN_CONFIG.cMaxDown = -0.60;
                    ADMIN_CONFIG.cMaxUp = 1.20;
                    ADMIN_CONFIG.dMaxDown = -0.05;
                    ADMIN_CONFIG.dMaxUp = 0.10;
                    ADMIN_CONFIG.lotteryWinScale = 1.0;
                    ADMIN_CONFIG.algoMode = '标准';
                    ADMIN_CONFIG.aiStopLoss = 0.20;
                    ADMIN_CONFIG.aiTakeProfit = 0.50;
                    ADMIN_CONFIG.aiCashRatio = 0.15;
                    ADMIN_CONFIG.darkHorseMultiplier = DARK_HORSE_MULTIPLIER;
                    ADMIN_CONFIG.darkHorseProb = DARK_HORSE_PROB;
                    ADMIN_CONFIG.initSharePrice = INIT_SHARE_PRICE;
                    ADMIN_CONFIG.bankruptcyThreshold = BANKRUPTCY_THRESHOLD;
                    ADMIN_CONFIG.bankruptcyFund = BANKRUPTCY_FUND;
                    stocks.A.name = 'A股';
                    stocks.B.name = 'B股';
                    stocks.C.name = 'C股';
                    stocks.D.name = 'D股';
                }

                stocks.A.maxUp = ADMIN_CONFIG.aMaxUp;
                stocks.A.maxDown = 0;
                stocks.B.maxDown = ADMIN_CONFIG.bMaxDown;
                stocks.B.maxUp = ADMIN_CONFIG.bMaxUp;
                stocks.C.maxDown = ADMIN_CONFIG.cMaxDown;
                stocks.C.maxUp = ADMIN_CONFIG.cMaxUp;
                stocks.D.maxDown = ADMIN_CONFIG.dMaxDown;
                stocks.D.maxUp = ADMIN_CONFIG.dMaxUp;
                Object.keys(stocks).forEach(k => {
                    stocks[k].price = INIT_SHARE_PRICE;
                });

                players = [];
                round = 1;
                bankAssets = INIT_BANK_MONEY;
                gameActive = true;
                assetsHistory = [];
                stocksHistory = [];
                logsByRound = {};
                roundHistory = [];
                sealedStocks = {};
                lotteryJackpot = 0;
                currentDarkHorse = null;
                marketSentiment = 0.5;
                predictionsThisRound = {};
                roundEvents = {};
                Object.keys(stocks).forEach(k => {
                    stocks[k].value = 0;
                    stocks[k].history = [];
                    stocks[k].recentMultiplier = 1;
                    stocks[k].trend = 0;
                    stocks[k].volatility = 0.08;
                    stocks[k].netFlow = 0;
                });
                customStocks = [];
                initLotteries();

                for (let i = 0; i < humanCount; i++) {
                    const p = {
                        id: i,
                        name: `玩家${i+1}`,
                        cash: INIT_PLAYER_MONEY,
                        sharesA: 0,
                        sharesB: 0,
                        sharesC: 0,
                        sharesD: 0,
                        customStockInvestments: {},
                        bankrupt: false,
                        isAI: false,
                        isExternal: false,
                        isHuman: true,
                        aiStrategy: null,
                        _lastRating: 'D',
                        totalAssets: function() {
                            let stockVal = ['A', 'B', 'C', 'D'].reduce((sum, k) => {
                                let shares = this[`shares${k}`] || 0;
                                return sum + shares * (stocks[k]?.price || 100);
                            }, 0);
                            let cust = this.customStockInvestments ? Object.values(this.customStockInvestments)
                                .reduce((a, b) => a + b, 0) : 0;
                            return this.cash + stockVal + cust;
                        }
                    };
                    initPlayerAchievements(p);
                    players.push(p);
                }
                let aiStart = humanCount;
                for (let i = 0; i < aiCount; i++) {
                    let strategy = AI_STRATEGIES[randInt(0, AI_STRATEGIES.length - 1)];
                    const p = {
                        id: aiStart + i,
                        name: `AI${i+1}`,
                        cash: INIT_PLAYER_MONEY,
                        sharesA: 0,
                        sharesB: 0,
                        sharesC: 0,
                        sharesD: 0,
                        customStockInvestments: {},
                        bankrupt: false,
                        isAI: true,
                        isExternal: false,
                        isHuman: false,
                        aiStrategy: strategy,
                        _lastRating: 'D',
                        totalAssets: function() {
                            let stockVal = ['A', 'B', 'C', 'D'].reduce((sum, k) => {
                                let shares = this[`shares${k}`] || 0;
                                return sum + shares * (stocks[k]?.price || 100);
                            }, 0);
                            let cust = this.customStockInvestments ? Object.values(this.customStockInvestments)
                                .reduce((a, b) => a + b, 0) : 0;
                            return this.cash + stockVal + cust;
                        }
                    };
                    initPlayerAchievements(p);
                    players.push(p);
                }
                createExternalAIPlayers();

                resetDecisionState();

                document.getElementById('game-setup').style.display = 'none';
                document.getElementById('game-main').style.display = 'block';
                document.getElementById('results-modal').style.display = 'none';

                showLogPanel();
                document.getElementById('history-log').innerHTML = '';
                updateUI();
                updatePlayersDisplay();
                updateLeaderboard();
                initCharts();
                updateStockStatus();

                let playerTypes = [];
                players.forEach(p => {
                    if (p.isAI) playerTypes.push(`${p.name} (场内AI ${p.aiStrategy})`);
                    else if (p.isExternal) playerTypes.push(`${p.name} (外接AI)`);
                    else playerTypes.push(`${p.name} (真人)`);
                });
                addLog(`🚀 新游戏开始！${players.length}位玩家：${playerTypes.join('、')}`, 'highlight');
                showBanner(`🎂 v9.3 新游戏开始！`, 'success', null, '🚀 游戏启动');
                updateCloseMarketButton();
                updateEndGameButton();
                setAllControlsEnabled(false);
                updateGameRulesDisplay();
            } catch (e) {
                showBanner('游戏初始化失败：' + e.message, 'error', null, '❌ 错误');
            }
        }

        function endGame() {
            gameActive = false;
            localStorage.removeItem('stockGameSave');
            players.forEach(p => {
                p.cash = Math.round(p.cash);
            });
            let active = players.filter(p => !p.bankrupt);
            let sorted = [...active].sort((a, b) => b.totalAssets() - a.totalAssets());
            let msg = '';
            if (sorted.length > 0) {
                msg =
                    `<div class="winner">🏆 冠军：${sorted[0].name}，总资产 ${fmt(sorted[0].totalAssets())}</div>`;
            } else {
                msg = `<div class="winner">💀 所有玩家破产！</div>`;
            }
            document.getElementById('winner-message').innerHTML = msg;
            let list = document.getElementById('ranking-list');
            list.innerHTML = '';
            sorted.forEach((p, i) => {
                let div = document.createElement('div');
                div.className = 'ranking-item';
                let tag = p.isAI ? ` (${p.aiStrategy})` : p.isExternal ? ' 🌐' : '';
                let achieveCount = p.achievements ? Object.values(p.achievements).filter(a => a.unlocked).length : 0;
                let badge = achieveCount > 0 ? `<span class="achieve-badge">🏅${achieveCount}</span>` : '';
                let rating = p._lastRating || 'D';
                div.innerHTML =
                    `<div><span class="rank-number">#${i+1}</span><strong>${p.name}${tag}</strong> ${badge} <span class="rating-badge rating-${rating}">${rating}</span></div><div>${fmt(p.totalAssets())}</div>`;
                list.appendChild(div);
            });
            players.filter(p => p.bankrupt).forEach(p => {
                let div = document.createElement('div');
                div.className = 'ranking-item';
                let tag = p.isAI ? ` (${p.aiStrategy})` : p.isExternal ? ' 🌐' : '';
                let achieveCount = p.achievements ? Object.values(p.achievements).filter(a => a.unlocked).length : 0;
                let badge = achieveCount > 0 ? `<span class="achieve-badge">🏅${achieveCount}</span>` : '';
                div.innerHTML =
                    `<div><span class="rank-number">💀</span><strong>${p.name}${tag}</strong> 破产 ${badge}</div><div>¥0</div>`;
                list.appendChild(div);
            });
            document.getElementById('results-modal').style.display = 'flex';
            document.body.classList.add('modal-open');
        }

        // v9.1: 直接结束游戏（确认后调用 endGame）
        function directEndGame() {
            if (!gameActive) {
                showBanner('游戏未开始或已结束', 'warning', null, '⏹ 结束');
                return;
            }
            showConfirmBanner('确定要直接结束当前游戏吗？所有进度将丢失！', () => {
                endGame();
                showBanner('游戏已结束', 'info', null, '⏹ 游戏结束');
            }, () => {});
        }

        function backToSetup() {
            gameActive = false;
            // v10.1: 联机模式（房主/玩家页）没有设置界面，直接返回大厅主页
            if (window.GAME_MODE === 'master' || window.GAME_MODE === 'player') {
                if (typeof window.xfwReturnHome === 'function') {
                    window.xfwReturnHome();
                } else {
                    try { if (window.netClose) netClose(); } catch(e) {}
                    location.href = 'index.html';
                }
                return;
            }
            if (aiThinkTimer) {
                clearInterval(aiThinkTimer);
                aiThinkTimer = null;
            }
            aiThinkPlayerId = null;
            if (pendingAITimeout) {
                clearTimeout(pendingAITimeout);
                pendingAITimeout = null;
            }
            let eaiOverlay = document.getElementById('eai-overlay');
            if (eaiOverlay.classList.contains('active')) {
                eaiOverlay.classList.remove('active');
                document.body.classList.remove('modal-open');
            }
            clearAllBanners();
            document.getElementById('game-setup').style.display = 'block';
            document.getElementById('game-main').style.display = 'none';
            document.getElementById('results-modal').style.display = 'none';
            document.body.classList.remove('modal-open');
            hideLogPanel();
            if (hasSaveData()) {
                document.getElementById('load-save-btn').style.display = 'inline-block';
            }
            updateGameRulesDisplay();
            document.getElementById('achievement-modal').classList.remove('active');

            // v10.0 联机返回设置页时清理联机残留，避免聊天框/状态栏挂在页面上
            // 1. 移除聊天面板
            const chatPanel = document.getElementById('chat-panel');
            if (chatPanel) chatPanel.remove();
            if (window.Chat) { window.Chat.panel = null; window.Chat.body = null; window.Chat.history = []; }
            // 2. 关闭 P2P 连接
            if (window.Net && typeof netClose === 'function') {
                try { netClose(); } catch(e) {}
            }
            // 3. 移除联机状态栏
            const netBar = document.querySelector('.net-status-bar');
            if (netBar) netBar.remove();
            // 4. 移除房主管理面板和收盘倒计时浮层
            const reconnectRoot = document.getElementById('net-reconnect-root');
            if (reconnectRoot) reconnectRoot.remove();
            const closeTimer = document.getElementById('close-timer-overlay');
            if (closeTimer) closeTimer.remove();
        }

        // ================================================================
