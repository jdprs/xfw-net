//  24. 存档
        // ================================================================

        function saveGame(auto = false) {
            try {
                let state = {
                    players,
                    round,
                    totalRounds,
                    bankAssets,
                    stocks,
                    customStocks,
                    lotteries,
                    assetsHistory,
                    stocksHistory,
                    logsByRound,
                    roundHistory,
                    humanCount,
                    aiCount,
                    playerCount,
                    gameActive,
                    lotteryJackpot,
                    externalAIConfigs,
                    achievementRewardRatios,
                    AI_THINK_MIN,
                    AI_THINK_MAX,
                    CHART_TYPE,
                    DARK_HORSE_MULTIPLIER,
                    DARK_HORSE_PROB,
                    currentDarkHorse,
                    marketSentiment,
                    predictionsThisRound,
                    playersRatings: players.map(p => p._lastRating || 'D'),
                    INIT_SHARE_PRICE,
                    roundEvents,
                    playerDecisionStatus,
                    BANKRUPTCY_THRESHOLD,
                    BANKRUPTCY_FUND,
                    sealedStocks
                };
                localStorage.setItem('stockGameSave', JSON.stringify(state));
                if (!auto) showNotification();
            } catch (e) {
                showBanner('保存失败：' + e.message, 'error', null, '💾 保存');
            }
        }

        function loadGame() {
            try {
                let raw = localStorage.getItem('stockGameSave');
                if (!raw) return false;
                let state = JSON.parse(raw);
                players = state.players.map(p => {
                    ['A', 'B', 'C', 'D'].forEach(k => {
                        if (p[`shares${k}`] === undefined) p[`shares${k}`] = 0;
                    });
                    return {
                        ...p,
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
                });
                if (state.playersRatings) {
                    state.playersRatings.forEach((rating, idx) => {
                        if (players[idx]) players[idx]._lastRating = rating;
                    });
                }
                round = state.round;
                totalRounds = state.totalRounds;
                bankAssets = state.bankAssets;
                stocks = state.stocks;
                customStocks = state.customStocks || [];
                lotteries = state.lotteries || [];
                assetsHistory = state.assetsHistory || [];
                stocksHistory = state.stocksHistory || [];
                logsByRound = state.logsByRound || {};
                roundHistory = state.roundHistory || [];
                humanCount = state.humanCount;
                aiCount = state.aiCount;
                playerCount = state.playerCount;
                gameActive = state.gameActive;
                lotteryJackpot = state.lotteryJackpot || 0;
                externalAIConfigs = state.externalAIConfigs || [];
                if (state.achievementRewardRatios) {
                    achievementRewardRatios = state.achievementRewardRatios;
                }
                if (state.AI_THINK_MIN !== undefined) AI_THINK_MIN = state.AI_THINK_MIN;
                if (state.AI_THINK_MAX !== undefined) AI_THINK_MAX = state.AI_THINK_MAX;
                if (state.CHART_TYPE) CHART_TYPE = state.CHART_TYPE;
                if (state.DARK_HORSE_MULTIPLIER) DARK_HORSE_MULTIPLIER = state.DARK_HORSE_MULTIPLIER;
                if (state.DARK_HORSE_PROB) DARK_HORSE_PROB = state.DARK_HORSE_PROB;
                if (state.currentDarkHorse) currentDarkHorse = state.currentDarkHorse;
                if (state.marketSentiment !== undefined) marketSentiment = state.marketSentiment;
                if (state.predictionsThisRound) predictionsThisRound = state.predictionsThisRound;
                if (state.INIT_SHARE_PRICE) INIT_SHARE_PRICE = state.INIT_SHARE_PRICE;
                if (state.roundEvents) roundEvents = state.roundEvents;
                if (state.playerDecisionStatus) {
                    playerDecisionStatus = state.playerDecisionStatus;
                } else {
                    resetDecisionState();
                }
                if (state.BANKRUPTCY_THRESHOLD !== undefined) BANKRUPTCY_THRESHOLD = state.BANKRUPTCY_THRESHOLD;
                if (state.BANKRUPTCY_FUND !== undefined) BANKRUPTCY_FUND = state.BANKRUPTCY_FUND;
                sealedStocks = state.sealedStocks || {};
                ADMIN_CONFIG.bankruptcyThreshold = BANKRUPTCY_THRESHOLD;
                ADMIN_CONFIG.bankruptcyFund = BANKRUPTCY_FUND;

                decisionState = 'idle';
                decidingPlayerId = null;
                players.forEach(p => {
                    if (playerDecisionStatus[p.id] !== 'done') {
                        playerDecisionStatus[p.id] = 'pending';
                    }
                    if (p.bankrupt) playerDecisionStatus[p.id] = 'done';
                });
                checkAllDone();
                return true;
            } catch (e) {
                showBanner('读取存档失败：' + e.message, 'error', null, '💾 读取');
                return false;
            }
        }

        function hasSaveData() { return !!localStorage.getItem('stockGameSave'); }

        function showNotification() {
            let el = document.getElementById('save-notification');
            el.style.display = 'block';
            setTimeout(() => el.style.display = 'none', 2000);
        }

        function exportCode() {
            try {
                let state = {
                    players,
                    round,
                    totalRounds,
                    bankAssets,
                    stocks,
                    customStocks,
                    lotteries,
                    assetsHistory,
                    stocksHistory,
                    logsByRound,
                    roundHistory,
                    humanCount,
                    aiCount,
                    playerCount,
                    gameActive,
                    lotteryJackpot,
                    externalAIConfigs,
                    achievementRewardRatios,
                    AI_THINK_MIN,
                    AI_THINK_MAX,
                    CHART_TYPE,
                    DARK_HORSE_MULTIPLIER,
                    DARK_HORSE_PROB,
                    currentDarkHorse,
                    marketSentiment,
                    predictionsThisRound,
                    playersRatings: players.map(p => p._lastRating || 'D'),
                    INIT_SHARE_PRICE,
                    roundEvents,
                    playerDecisionStatus,
                    BANKRUPTCY_THRESHOLD,
                    BANKRUPTCY_FUND,
                    sealedStocks
                };
                let json = JSON.stringify(state);
                let code = btoa(encodeURIComponent(json));
                document.getElementById('code-textarea').value = code;
                document.getElementById('code-modal-title').textContent = '📋 导出存档码';
                document.getElementById('code-import-confirm-btn').style.display = 'none';
                document.getElementById('code-copy-btn').style.display = 'inline-block';
                document.getElementById('code-modal').style.display = 'flex';
            } catch (e) {
                showBanner('导出失败：' + e.message, 'error', null, '📋 存档码');
            }
        }

        function importCode() {
            document.getElementById('code-modal-title').textContent = '📥 导入存档码';
            document.getElementById('code-import-confirm-btn').style.display = 'inline-block';
            document.getElementById('code-copy-btn').style.display = 'none';
            document.getElementById('code-textarea').value = '';
            document.getElementById('code-modal').style.display = 'flex';
        }

        function doImportCode() {
            let code = document.getElementById('code-textarea').value.trim();
            if (!code) { showBanner('请输入存档码', 'warning', null, '📥 导入'); return; }
            try {
                let json = decodeURIComponent(atob(code));
                let state = JSON.parse(json);
                players = state.players.map(p => {
                    ['A', 'B', 'C', 'D'].forEach(k => {
                        if (p[`shares${k}`] === undefined) p[`shares${k}`] = 0;
                    });
                    return {
                        ...p,
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
                });
                if (state.playersRatings) {
                    state.playersRatings.forEach((rating, idx) => {
                        if (players[idx]) players[idx]._lastRating = rating;
                    });
                }
                round = state.round;
                totalRounds = state.totalRounds;
                bankAssets = state.bankAssets;
                stocks = state.stocks;
                customStocks = state.customStocks || [];
                lotteries = state.lotteries || [];
                assetsHistory = state.assetsHistory || [];
                stocksHistory = state.stocksHistory || [];
                logsByRound = state.logsByRound || {};
                roundHistory = state.roundHistory || [];
                humanCount = state.humanCount;
                aiCount = state.aiCount;
                playerCount = state.playerCount;
                gameActive = state.gameActive;
                lotteryJackpot = state.lotteryJackpot || 0;
                externalAIConfigs = state.externalAIConfigs || [];
                if (state.achievementRewardRatios) {
                    achievementRewardRatios = state.achievementRewardRatios;
                }
                if (state.AI_THINK_MIN !== undefined) AI_THINK_MIN = state.AI_THINK_MIN;
                if (state.AI_THINK_MAX !== undefined) AI_THINK_MAX = state.AI_THINK_MAX;
                if (state.CHART_TYPE) CHART_TYPE = state.CHART_TYPE;
                if (state.DARK_HORSE_MULTIPLIER) DARK_HORSE_MULTIPLIER = state.DARK_HORSE_MULTIPLIER;
                if (state.DARK_HORSE_PROB) DARK_HORSE_PROB = state.DARK_HORSE_PROB;
                if (state.currentDarkHorse) currentDarkHorse = state.currentDarkHorse;
                if (state.marketSentiment !== undefined) marketSentiment = state.marketSentiment;
                if (state.predictionsThisRound) predictionsThisRound = state.predictionsThisRound;
                if (state.INIT_SHARE_PRICE) INIT_SHARE_PRICE = state.INIT_SHARE_PRICE;
                if (state.roundEvents) roundEvents = state.roundEvents;
                if (state.playerDecisionStatus) {
                    playerDecisionStatus = state.playerDecisionStatus;
                } else {
                    resetDecisionState();
                }
                if (state.BANKRUPTCY_THRESHOLD !== undefined) BANKRUPTCY_THRESHOLD = state.BANKRUPTCY_THRESHOLD;
                if (state.BANKRUPTCY_FUND !== undefined) BANKRUPTCY_FUND = state.BANKRUPTCY_FUND;
                sealedStocks = state.sealedStocks || {};
                ADMIN_CONFIG.bankruptcyThreshold = BANKRUPTCY_THRESHOLD;
                ADMIN_CONFIG.bankruptcyFund = BANKRUPTCY_FUND;

                decisionState = 'idle';
                decidingPlayerId = null;
                players.forEach(p => {
                    if (playerDecisionStatus[p.id] !== 'done') {
                        playerDecisionStatus[p.id] = 'pending';
                    }
                    if (p.bankrupt) playerDecisionStatus[p.id] = 'done';
                });
                checkAllDone();

                document.getElementById('code-modal').style.display = 'none';
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
                addLog('✅ 成功导入存档码', 'highlight');
                showBanner('存档导入成功！', 'success', null, '📥 导入');
                updateCloseMarketButton();
                updateEndGameButton();
                setAllControlsEnabled(false);
            } catch (e) {
                showBanner('存档码无效：' + e.message, 'error', null, '📥 导入');
            }
        }

        // ================================================================
