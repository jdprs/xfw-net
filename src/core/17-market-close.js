//  17. 收盘（v9.1 核心改造：统一破产检测 + 资助金）
        // ================================================================

        async function closeMarket() {
            if (!gameActive) return;
            if (decisionState !== 'all_done') {
                showBanner('还有玩家未完成决策', 'warning', null, '⚠️ 无法收盘');
                return;
            }

            // ---- v9.1: 收盘时统一检测破产 ----
            let bankruptcyReport = [];
            for (let p of players) {
                if (p.bankrupt) continue;
                let total = p.totalAssets();
                let threshold = ADMIN_CONFIG.bankruptcyThreshold || BANKRUPTCY_THRESHOLD || 100;
                if (total < threshold) {
                    // 判定破产
                    p.bankrupt = true;
                    p.cash = 0;
                    ['A', 'B', 'C', 'D'].forEach(k => p[`shares${k}`] = 0);
                    p.customStockInvestments = {};
                    if (p.achievementStats) p.achievementStats.hasBankrupted = true;
                    // 发放救助金
                    let fund = ADMIN_CONFIG.bankruptcyFund || BANKRUPTCY_FUND || 1000;
                    p.cash += fund;
                    p.bankrupt = false; // 救助后解除破产状态
                    bankruptcyReport.push(`${p.name} 总资产 ${fmt(total)} 低于阈值 ${fmt(threshold)}，获得救助金 ${fmt(fund)}`);
                    addLog(`💰 ${p.name} 破产救助：总资产 ${fmt(total)} < ${fmt(threshold)}，获得 ${fmt(fund)} 救助金`, 'highlight');
                    showBanner(`💰 ${p.name} 获得 ${fmt(fund)} 破产救助金`, 'success', null, '💰 救助');
                    // 重置决策状态
                    if (playerDecisionStatus[p.id] === 'done') {
                        playerDecisionStatus[p.id] = 'pending';
                    }
                    // 重新初始化成就
                    if (!p.achievements) initPlayerAchievements(p);
                }
            }

            // 如果有破产救助，更新UI
            if (bankruptcyReport.length > 0) {
                updateUI();
                updatePlayersDisplay();
                updateLeaderboard();
                // 重新检查决策状态
                checkAllDone();
                updateDecisionUI();
            }

            // ---- 继续原有收盘逻辑 ----
            let event = null;
            if (Math.random() < 0.28) {
                let evt = RANDOM_EVENTS[randInt(0, RANDOM_EVENTS.length - 1)];
                let stockKeys = Object.keys(stocks);
                let targetStock = stockKeys[randInt(0, stockKeys.length - 1)];
                let evtCopy = { ...evt, stock: targetStock, stockName: targetStock + '股' };
                if (evt.effect({})?.all) {
                    evtCopy.stockName = '市场';
                }
                event = evtCopy;
                await showEventModal(event);
            }

            updateMarketSentiment();

            let darkHorseInfo = getDarkHorse();

            let eventMult = { A: 1, B: 1, C: 1, D: 1 };
            if (event) {
                let effect = event.effect(event.stock || 'A');
                if (effect.all) {
                    Object.keys(eventMult).forEach(k => eventMult[k] = effect.multiplier);
                } else {
                    eventMult[effect.stock] = effect.multiplier;
                }
                addLog(`【${event.name}】${event.desc.replace('{stock}', event.stockName)}`, 'event');
                showBanner(`【${event.name}】${event.desc.replace('{stock}', event.stockName)}`, event.type === 'positive' ?
                    'success' : 'warning', null, event.icon + ' ' + event.name);
            }

            let oldPrices = {};
            Object.keys(stocks).forEach(k => { oldPrices[k] = stocks[k].price; });

            let finalMults = calcAllMultipliers(eventMult, darkHorseInfo);

            // v9.3: 被封股票涨跌冻结（价格不变）
            Object.keys(sealedStocks).forEach(k => {
                if (finalMults[k] !== undefined) finalMults[k] = 1;
            });

            Object.keys(stocks).forEach(k => {
                let old = stocks[k].value;
                stocks[k].value = Math.round(stocks[k].value * finalMults[k]);
                bankAssets += old - stocks[k].value;
                stocks[k].history.push({ round, value: stocks[k].value, multiplier: finalMults[k] });
                if (stocks[k].history.length > 25) stocks[k].history.shift();
                let hist = stocks[k].history;
                if (hist.length > 3) {
                    let recent = hist.slice(-6).map(h => h.multiplier || 1);
                    let avg = recent.reduce((a, b) => a + b, 0) / recent.length;
                    let sq = recent.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / recent.length;
                    stocks[k].volatility = clamp(Math.sqrt(sq) * 1.2, 0.01, 0.6);
                }
            });
            updateCustomStockValues(finalMults);

            resolvePredictions();
            drawLotteries();
            checkLooting();
            calculateAndRewardPortfolioRatings();

            // 收盘后对所有玩家检查成就
            players.forEach(p => {
                if (!p.bankrupt) {
                    checkAchievements(p.id);
                }
            });

            updateStockStatus();
            recordChartData();
            saveGame(true);

            let playerPL = {};
            players.forEach(p => {
                if (p.bankrupt) return;
                let pl = {};
                ['A', 'B', 'C', 'D'].forEach(k => {
                    let shares = p[`shares${k}`] || 0;
                    let oldPrice = oldPrices[k] || 100;
                    let newPrice = stocks[k].price;
                    let profit = Math.round(shares * (newPrice - oldPrice));
                    pl[k] = profit;
                });
                playerPL[p.id] = pl;
            });

            let summary = `📊 第 ${round} 轮收盘总结\n`;
            summary += `🏦 银行资产：${fmt(bankAssets)}\n\n`;

            // v9.1: 在收盘总结中显示破产救助信息
            if (bankruptcyReport.length > 0) {
                summary += '💰 破产救助：\n' + bankruptcyReport.map(s => '  ' + s).join('\n') + '\n\n';
            }

            summary += '📈 个股涨跌：\n';
            let stockKeys = ['A', 'B', 'C', 'D'];
            stockKeys.forEach(k => {
                let m = stocks[k].recentMultiplier || 1;
                let pct = ((m - 1) * 100).toFixed(1);
                let isDark = darkHorseInfo && darkHorseInfo.active && darkHorseInfo.key === k;
                summary += `  ${k}股${isDark ? ' 🐴黑马' : ''}：${pct}%，现价 ${fmt(stocks[k].price)}\n`;
            });
            if (customStocks.length) {
                summary += '✨ 自建股：\n';
                customStocks.forEach(cs => {
                    let m = cs.recentMultiplier || 1;
                    let pct = ((m - 1) * 100).toFixed(1);
                    let isDark = darkHorseInfo && darkHorseInfo.active && darkHorseInfo.key === `custom_${cs.id}`;
                    summary += `  ${cs.name}${isDark ? ' 🐴黑马' : ''}：${pct}%\n`;
                });
            }
            if (darkHorseInfo && darkHorseInfo.active) {
                summary += `🐴 本轮黑马股：${darkHorseInfo.name}（倍率 ${darkHorseInfo.multiplier}x）\n`;
            } else {
                summary += `🐴 本轮无黑马股\n`;
            }

            let events = roundEvents[round] || { lotteryWins: [], lotteryScams: [], predictions: [] };
            if (events.lotteryWins.length > 0) {
                summary += '\n🎉 彩票中奖：\n' + events.lotteryWins.map(s => '  ' + s).join('\n');
            }
            if (events.lotteryScams.length > 0) {
                summary += '\n💔 彩票诈骗：\n' + events.lotteryScams.map(s => '  ' + s).join('\n');
            }
            if (events.predictions.length > 0) {
                summary += '\n🔮 预测结果：\n' + events.predictions.map(s => '  ' + s).join('\n');
            }

            summary += '\n👤 玩家资产变化：\n';
            players.forEach(p => {
                let total = p.totalAssets();
                summary += `  ${p.name}：${fmt(total)}${p.bankrupt ? ' 💀破产' : ''}\n`;
                let pl = playerPL[p.id] || {};
                let plStr = ['A', 'B', 'C', 'D'].map(k => {
                    let v = pl[k] || 0;
                    if (v !== 0) return `${k}股 ${v>0?'+':''}${fmt(v)}`;
                    return '';
                }).filter(s => s).join(' ');
                if (plStr) summary += `    盈亏：${plStr}\n`;
            });
            if (round === totalRounds) {
                summary += '\n🏁 **这是最后一轮！** 游戏即将结束！\n';
            }

            // ---- v9.2: 记录本轮历史快照（供历史记录面板使用） ----
            roundHistory.push({
                round: round,
                bankAssets: bankAssets,
                stocks: Object.keys(stocks).map(k => ({
                    key: k,
                    name: stocks[k].name,
                    price: stocks[k].price,
                    multiplier: stocks[k].recentMultiplier || 1
                })),
                customStocks: customStocks.map(cs => ({
                    id: cs.id,
                    name: cs.name,
                    multiplier: cs.recentMultiplier || 1
                })),
                players: players.map(p => ({
                    id: p.id,
                    name: p.name,
                    total: Math.round(p.totalAssets()),
                    cash: Math.round(p.cash),
                    isAI: !!p.isAI,
                    isExternal: !!p.isExternal,
                    bankrupt: !!p.bankrupt
                })),
                darkHorse: darkHorseInfo ? {
                    active: !!darkHorseInfo.active,
                    key: darkHorseInfo.key || null,
                    name: darkHorseInfo.name || null,
                    multiplier: darkHorseInfo.multiplier || null
                } : null,
                events: roundEvents[round] ? {
                    lotteryWins: (roundEvents[round].lotteryWins || []).slice(),
                    lotteryScams: (roundEvents[round].lotteryScams || []).slice(),
                    predictions: (roundEvents[round].predictions || []).slice()
                } : { lotteryWins: [], lotteryScams: [], predictions: [] }
            });
            if (roundHistory.length > 200) roundHistory.shift();

            roundEvents[round] = { lotteryWins: [], lotteryScams: [], predictions: [] };

            // v10.8: 收盘确认制——所有真人玩家点「确认」后进入下一轮；30 秒未确认自动确认
            const isOnlineClose = window.GAME_MODE === 'master' || window.GAME_MODE === 'player';
            // 推进到下一轮（或结束）的统一函数
            const advanceToNextRound = function() {
                round++;
                if (round > totalRounds) {
                    endGame();
                } else {
                    // v9.3: 新轮开始时处理封股票（恢复到期的 + 银行告急时50%概率封新的）
                    processSealsOnNewRound();
                    resetDecisionState();
                    updateUI();
                    updatePlayersDisplay();
                    updateLeaderboard();
                    updateCharts();
                    updateStockStatus();
                    updateCloseMarketButton();
                    updateEndGameButton();
                    setAllControlsEnabled(false);
                    showBanner(`📊 第 ${round} 轮开始，请玩家点击「决策」`, 'info', null, '🔄 新轮次');
                }
            };
            if (isOnlineClose) {
                window._onRoundAdvance = advanceToNextRound;
                const summaryBody = summary + '\n\n⏳ 请点击「✅ 确认继续」进入下一轮（30 秒未确认将自动确认）';
                showInfoModal(`📊 第 ${round} 轮收盘`, summaryBody, null);
                try { if (window.netBroadcastRaw) window.netBroadcastRaw({ type: 'round_summary', round: round, summary: summaryBody }); } catch (e) {}
                // v10.8: 确认按钮与 30 秒倒计时由联机层（38-game-sync）接管
                if (window.GAME_MODE === 'master' && typeof window.hostBeginConfirm === 'function') {
                    window.hostBeginConfirm();
                }
            } else {
                showInfoModal(`📊 第 ${round} 轮收盘`, summary, advanceToNextRound);
            }
        }

        // ================================================================
