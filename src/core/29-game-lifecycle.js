//  29. 游戏初始化 & 结束
        function assignAIDifficulty() {
            let mode = (typeof ADMIN_CONFIG !== 'undefined' && ADMIN_CONFIG.aiDifficulty) || 'random';
            if (mode === 'easy') return 'easy';
            if (mode === 'medium') return 'medium';
            if (mode === 'hard') return 'hard';
            // random: 易30% 中45% 难25%
            let r = Math.random();
            if (r < 0.30) return 'easy';
            if (r < 0.75) return 'medium';
            return 'hard';
        }

        // ================================================================

        // 高级设置数值校验：非法/越界横幅提示并返回 false（不使用默认值填充）
        function validateAdminInputs() {
            const numFields = [
                {id:'admin-init-money',label:'初始资金',min:1,max:100000000,int:true},
                {id:'admin-bank-money',label:'银行初始资金',min:1,max:1000000000,int:true},
                {id:'admin-loot-threshold',label:'掠夺阈值',min:0,max:100000000,int:true},
                {id:'admin-loot-ratio',label:'掠夺比例',min:1,max:50,int:true},
                {id:'admin-volatility-scale',label:'波动性缩放',min:0.5,max:2.0,int:false},
                {id:'admin-banner-duration',label:'横幅停留秒数',min:1,max:15,int:false},
                {id:'admin-ai-think-min',label:'AI思考下限',min:1,max:12,int:false},
                {id:'admin-ai-think-max',label:'AI思考上限',min:2,max:15,int:false},
                {id:'admin-share-price',label:'每股初始价格',min:10,max:100000,int:false},
                {id:'admin-lottery-win-scale',label:'彩票中奖率缩放',min:0.1,max:3.0,int:false},
                {id:'admin-darkhorse-multiplier',label:'黑马股倍率',min:1.2,max:4.0,int:false},
                {id:'admin-darkhorse-prob',label:'黑马股出现概率',min:0.05,max:1.0,int:false},
                {id:'admin-bankruptcy-threshold',label:'破产阈值',min:10,max:500,int:true},
                {id:'admin-bankruptcy-fund',label:'破产救助金',min:100,max:5000,int:true}
            ];
            for (const f of numFields) {
                const el = document.getElementById(f.id);
                if (!el) continue;
                const raw = el.value.trim();
                const v = f.int ? parseInt(raw, 10) : parseFloat(raw);
                if (raw === '' || isNaN(v) || (f.int && !/^-?\d+$/.test(raw))) {
                    showBanner('「'+f.label+'」请输入有效数字', 'warning', null, '⚠️ 高级设置'); return false;
                }
                if (v < f.min || v > f.max) {
                    showBanner('「'+f.label+'」需在 '+f.min+'~'+f.max+' 之间（当前 '+raw+'）', 'warning', null, '⚠️ 高级设置'); return false;
                }
            }
            const tMinEl = document.getElementById('admin-ai-think-min');
            const tMaxEl = document.getElementById('admin-ai-think-max');
            if (tMinEl && tMaxEl) {
                const tMin = parseFloat(tMinEl.value), tMax = parseFloat(tMaxEl.value);
                if (!isNaN(tMin) && !isNaN(tMax) && tMin > tMax) {
                    showBanner('AI思考下限不能大于上限', 'warning', null, '⚠️ 高级设置'); return false;
                }
            }
            let bad = false;
            document.querySelectorAll('.stock-up-input').forEach(inp => { const v = parseFloat(inp.value); if (isNaN(v) || v < 0 || v > 200) bad = true; });
            document.querySelectorAll('.stock-down-input').forEach(inp => { const v = parseFloat(inp.value); if (isNaN(v) || v < -90 || v > 0) bad = true; });
            if (bad) { showBanner('个股上涨幅度需 0~200%、下跌幅度需 -90~0%', 'warning', null, '⚠️ 高级设置'); return false; }
            let achBad = false;
            document.querySelectorAll('.ach-reward-input').forEach(inp => { const raw = inp.value.trim(); const v = parseFloat(raw); if (raw === '' || isNaN(v) || v < 0 || v > 100) achBad = true; });
            if (achBad) { showBanner('成就奖励比例需在 0~100 之间', 'warning', null, '⚠️ 高级设置'); return false; }
            return true;
        }

        function initGame(loadSave = false) {
            try {
                if (loadSave && loadGame()) {
                    const setup = document.getElementById('game-setup');
                    if (setup) setup.style.display = 'none';
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

                // 主设置输入校验：非法/越界时横幅提示并阻止开始，不使用默认值填充
                function readIntInput(id, label) {
                    const el = document.getElementById(id);
                    const raw = el ? el.value.trim() : '';
                    if (raw === '' || !/^-?\d+$/.test(raw)) { showBanner('「'+label+'」请输入有效整数', 'warning', null, '⚠️ 输入无效'); return null; }
                    return parseInt(raw, 10);
                }
                humanCount = readIntInput('human-players', '人类玩家数');
                if (humanCount === null) return;
                aiCount = readIntInput('ai-players', 'AI玩家数');
                if (aiCount === null) return;
                totalRounds = readIntInput('total-rounds', '总轮数');
                if (totalRounds === null) return;
                if (humanCount < 1 || humanCount > 4) { showBanner('人类玩家数需在 1~4 之间（当前 '+humanCount+'）', 'warning', null, '⚠️ 输入超出范围'); return; }
                if (aiCount < 0 || aiCount > 3) { showBanner('AI玩家数需在 0~3 之间（当前 '+aiCount+'）', 'warning', null, '⚠️ 输入超出范围'); return; }
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
                if (totalRounds < 10 || totalRounds > 200) { showBanner('总轮数需在 10~200 之间（当前 '+totalRounds+'）', 'warning', null, '⚠️ 输入超出范围'); return; }

                if (typeof validateAdminInputs === 'function' && !validateAdminInputs()) return;

                // 读取AI难度（始终生效，不限于adminMode）
                const diffSel = document.getElementById('admin-ai-difficulty');
                ADMIN_CONFIG.aiDifficulty = diffSel ? diffSel.value : 'random';

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
                    ADMIN_CONFIG.lotteryWinScale = parseFloat(document.getElementById('admin-lottery-win-scale').value)
                        || 1.0;
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
                    const animBox = document.getElementById('admin-animations');
                    ADMIN_CONFIG.animations = animBox ? animBox.checked : true;
                    const diffSel = document.getElementById('admin-ai-difficulty');
                    ADMIN_CONFIG.aiDifficulty = diffSel ? diffSel.value : 'random';
                    if (animBox) localStorage.setItem('xfw_animations', animBox.checked ? '1' : '0');

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
                    ADMIN_CONFIG.animations = (localStorage.getItem('xfw_animations') || '0') !== '0'; // 默认关闭
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
                        aiDifficulty: assignAIDifficulty(),
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

                const setup = document.getElementById('game-setup');
                if (setup) setup.style.display = 'none';
                document.getElementById('game-main').style.display = 'block';
                document.getElementById('results-modal').style.display = 'none';

                showLogPanel();
                document.getElementById('history-log').innerHTML = '';
                let playerTypes = [];
                players.forEach(p => {
                    if (p.isAI) playerTypes.push(`${p.name} (场内AI ${p.aiStrategy})`);
                    else if (p.isExternal) playerTypes.push(`${p.name} (外接AI)`);
                    else playerTypes.push(`${p.name} (真人)`);
                });
                addLog(`🚀 新游戏开始！${players.length}位玩家：${playerTypes.join('、')}`, 'highlight');
                const safeRun = (fn, label) => { try { fn(); } catch (e) { console.error('[' + label + ']', e); } };
                safeRun(updateUI, 'updateUI');
                safeRun(updatePlayersDisplay, 'updatePlayersDisplay');
                safeRun(updateLeaderboard, 'updateLeaderboard');
                safeRun(initCharts, 'initCharts');
                safeRun(updateStockStatus, 'updateStockStatus');
                showBanner(`🎂 v10.0 新游戏开始！`, 'success', null, '🚀 游戏启动');
                updateCloseMarketButton();
                updateEndGameButton();
                setAllControlsEnabled(false);
                updateGameRulesDisplay();
            } catch (e) {
                showBanner('游戏初始化失败：' + e.message, 'error', null, '❌ 错误');
            }
        }

        // v10.5: forced 标记区分「房主强制结束」与「自然打完最后一轮」
        function endGame(forced) {
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
                    `<div><span class="rank-number">💀</span><strong>${p.name}</strong> 破产 ${badge}</div><div>¥0</div>`;
                list.appendChild(div);
            });
            document.getElementById('results-modal').style.display = 'flex';
            document.body.classList.add('modal-open');

            // v10.5: 联机模式广播结束结果，玩家端同步排名弹窗与横幅
            if (window.GAME_MODE === 'master' && typeof window.netBroadcastRaw === 'function') {
                try {
                    window.netBroadcastRaw({
                        type: 'game_ended',
                        forced: !!forced,
                        winner: msg,
                        rankings: sorted.map(p => ({
                            name: p.name, total: Math.round(p.totalAssets()),
                            isAI: !!p.isAI, isExternal: !!p.isExternal, aiStrategy: p.aiStrategy || '',
                            rating: p._lastRating || 'D',
                            achieveCount: p.achievements ? Object.values(p.achievements).filter(a => a.unlocked).length : 0,
                            bankrupt: false
                        })).concat(players.filter(p => p.bankrupt).map(p => ({
                            name: p.name, total: 0, bankrupt: true,
                            achieveCount: p.achievements ? Object.values(p.achievements).filter(a => a.unlocked).length : 0
                        })))
                    });
                } catch (e) {}
            }
        }

        // v9.1: 直接结束游戏（确认后调用 endGame）
        function directEndGame() {
            if (!gameActive) {
                showBanner('游戏未开始或已结束', 'warning', null, '⏹ 结束');
                return;
            }
            showConfirmBanner('确定要直接结束当前游戏吗？所有进度将丢失！', () => {
                endGame(true);
                // v10.5: 横幅经 wrapHostHooks 广播，玩家端显示「房主已结束本轮游戏」
                showBanner('房主已结束本轮游戏', 'warning', null, '⏹ 游戏结束');
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
            // v10.2: 单机游戏页(game_local)的"新游戏/重新开始"统一返回主页 index.html，
            // 与联机页行为一致，避免停在 game_local 的设置界面
            if (window.location.pathname.indexOf('game_local') !== -1) {
                location.href = 'index.html';
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
            const setup = document.getElementById('game-setup');
            if (setup) setup.style.display = 'block';
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
