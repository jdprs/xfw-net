//  9. 场内AI 决策
        // ================================================================

        function makeAIDecision(player) {
            if (player.bankrupt || !player.isAI) return;
            let strategy = player.aiStrategy;
            let total = player.totalAssets();
            if (total < 100) {
                showBanner(`${player.name} 资产不足，无法交易`, 'warning', null, '🤖 AI决策');
                return;
            }
            let marketData = analyzeMarket();
            let stockScores = scoreStocks(marketData);

            if (currentDarkHorse) {
                let dhKey = currentDarkHorse.key;
                if (dhKey && stockScores[dhKey] !== undefined) {
                    stockScores[dhKey] = Math.min(1, (stockScores[dhKey] || 0.5) + 0.25);
                }
            }

            if (Math.random() < 0.08 && player.cash >= 200) {
                let available = lotteries.filter(l => l.price <= player.cash * 0.04);
                if (available.length) {
                    let lot = available[randInt(0, available.length - 1)];
                    let maxQty = Math.floor(player.cash * 0.02 / lot.price);
                    if (maxQty >= 1) {
                        let qty = randInt(1, Math.min(2, maxQty));
                        buyLottery(player.id, lot.id, qty);
                    }
                }
            }

            let holdings = {
                A: player.sharesA || 0,
                B: player.sharesB || 0,
                C: player.sharesC || 0,
                D: player.sharesD || 0
            };
            let totalStockVal = 0;
            Object.keys(holdings).forEach(k => {
                totalStockVal += holdings[k] * stocks[k].price;
            });

            // v9.3: 即将破产时撤资保命（优先级最高）
            let dangerLine = BANKRUPTCY_THRESHOLD * 8;
            if (total < dangerLine && totalStockVal > 0) {
                addLog(`🤖 ${player.name} 资产告急（${fmt(total)}），启动撤资保命`, 'warning');
                let sortedByRisk = ['C', 'B', 'A', 'D'].filter(k => holdings[k] > 0)
                    .sort((a, b) => (stockScores[a] || 0) - (stockScores[b] || 0));
                for (let sk of sortedByRisk) {
                    let sellShares = holdings[sk];
                    if (sellShares > 0) {
                        withdrawStock(player.id, sk, sellShares);
                        addLog(`🤖 ${player.name} 撤资卖出${sk}股 ${sellShares}股（保命）`, 'loss');
                    }
                }
                showBanner(`${player.name} 资产接近破产线，全部撤资保命`, 'warning', null, '🤖 AI决策');
                return;
            }

            let config = getStrategyConfig(strategy, marketData);

            // 止损止盈
            for (let sk of ['C', 'B', 'A', 'D']) {
                let holding = holdings[sk];
                if (holding < 1) continue;
                let mult = stocks[sk].recentMultiplier || 1;
                let hist = stocks[sk].history || [];
                let estCost = 1;
                if (hist.length > 2) {
                    let recentMults = hist.slice(-3).map(h => h.multiplier || 1);
                    estCost = recentMults.reduce((a, b) => a + b, 0) / recentMults.length;
                }
                let drawdown = (mult - estCost) / estCost;
                let stopLoss = config.stopLoss;
                if (drawdown < -stopLoss && Math.random() < 0.65) {
                    let sellPct = 0.5 + Math.random() * 0.35;
                    let sellShares = Math.floor(holding * sellPct);
                    if (sellShares > 0) {
                        withdrawStock(player.id, sk, sellShares);
                        addLog(`🤖 ${player.name} 触发止损 (${sk}股亏损${(drawdown*100).toFixed(1)}%) 卖出 ${sellShares}股`,
                            'loss');
                        holdings[sk] -= sellShares;
                        totalStockVal -= sellShares * stocks[sk].price;
                    }
                }
                let takeProfit = config.takeProfit;
                if (drawdown > takeProfit && Math.random() < 0.45) {
                    let sellPct = 0.3 + Math.random() * 0.25;
                    let sellShares = Math.floor(holding * sellPct);
                    if (sellShares > 0) {
                        withdrawStock(player.id, sk, sellShares);
                        addLog(`🤖 ${player.name} 止盈 (${sk}股盈利${(drawdown*100).toFixed(1)}%) 卖出 ${sellShares}股`,
                            'profit');
                        holdings[sk] -= sellShares;
                        totalStockVal -= sellShares * stocks[sk].price;
                    }
                }
            }

            // 再平衡
            let targetWeights = config.weights;
            let targetCashRatio = config.cashRatio;
            let totalWealth = player.totalAssets();
            let targetStockVal = totalWealth * (1 - targetCashRatio);

            let rebalanceThreshold = 0.20;
            if (totalStockVal > 500) {
                for (let sk of Object.keys(targetWeights)) {
                    if (targetWeights[sk] <= 0) continue;
                    let currentVal = holdings[sk] * stocks[sk].price;
                    let currentRatio = totalStockVal > 0 ? currentVal / totalStockVal : 0;
                    let targetRatio = targetWeights[sk];
                    let deviation = targetRatio > 0 ? (currentRatio - targetRatio) / targetRatio : 0;
                    if (deviation > rebalanceThreshold && holdings[sk] > 0 && Math.random() < 0.5) {
                        let sellShares = Math.floor(holdings[sk] * (deviation * 0.3));
                        if (sellShares > 0) {
                            withdrawStock(player.id, sk, sellShares);
                            addLog(`🤖 ${player.name} 再平衡减持${sk}股 ${sellShares}股`);
                            holdings[sk] -= sellShares;
                            totalStockVal -= sellShares * stocks[sk].price;
                        }
                    }
                }
            }

            let investBudget = Math.round(Math.max(0, targetStockVal - totalStockVal));
            if (player.cash > totalWealth * targetCashRatio * 1.5) {
                let extra = Math.round((player.cash - totalWealth * targetCashRatio) * 0.5);
                investBudget = Math.max(investBudget, extra);
            }

            if (player.cash < totalWealth * targetCashRatio * 0.4 && totalStockVal > 500) {
                let needCash = Math.round(totalWealth * targetCashRatio * 0.6 - player.cash);
                if (needCash > 100) {
                    let worst = 'D';
                    let worstScore = Infinity;
                    for (let sk of ['C', 'B', 'A', 'D']) {
                        let score = stockScores[sk] || 0;
                        if (holdings[sk] > 0 && score < worstScore) {
                            worstScore = score;
                            worst = sk;
                        }
                    }
                    let price = stocks[worst].price;
                    let maxShares = Math.floor(holdings[worst]);
                    let needShares = Math.floor(needCash / price);
                    let sellShares = Math.min(maxShares, needShares);
                    if (sellShares > 0) {
                        withdrawStock(player.id, worst, sellShares);
                        addLog(`🤖 ${player.name} 补充现金，卖出${worst}股 ${sellShares}股`);
                        holdings[worst] -= sellShares;
                        totalStockVal -= sellShares * stocks[worst].price;
                        player.cash += sellShares * stocks[worst].price;
                    }
                }
                investBudget = 0;
            }

            if (investBudget < 100 || player.cash < 100) {
                if (player.cash > 500 && totalStockVal > 0) {
                    let drip = Math.round(player.cash * 0.08);
                    if (drip >= 100) {
                        let best = pickBestStock(stockScores, holdings);
                        if (best) {
                            let price = stocks[best].price;
                            let shares = Math.floor(drip / price);
                            if (shares > 0) {
                                investStock(player.id, best, shares);
                                addLog(`🤖 ${player.name} 定投${best}股 ${shares}股`);
                                showBanner(`${player.name} 定投 ${best}股 ${shares}股`, 'info', null, '🤖 AI决策');
                                return;
                            }
                        }
                    }
                }
                showBanner(`${player.name} 未进行操作（现金不足或市场观望）`, 'info', null, '🤖 AI决策');
                return;
            }

            // 自建股
            let customWeight = strategy === '进取型' ? 0.12 : strategy === '平衡型' ? 0.04 : 0.02;
            if (customStocks.length > 0 && Math.random() < customWeight * 3) {
                let available = customStocks.filter(cs => cs.creatorId !== player.id && cs.value >= 0);
                if (available.length) {
                    let sorted = [...available].sort((a, b) => (b.recentMultiplier || 1) - (a.recentMultiplier || 1));
                    let target = sorted[0];
                    let amt = Math.round(investBudget * (0.15 + Math.random() * 0.2));
                    if (amt >= 100 && amt <= player.cash) {
                        investCustomStock(player.id, target.id, amt);
                        addLog(`🤖 ${player.name} 投资自建股「${target.name}」${fmt(amt)}`);
                        showBanner(`${player.name} 投资自建股「${target.name}」${fmt(amt)}`, 'info', null, '🤖 AI决策');
                        return;
                    }
                }
            }

            let candidate = pickBestStock(stockScores, holdings);
            if (!candidate) {
                showBanner(`${player.name} 未找到合适标的，暂不操作`, 'info', null, '🤖 AI决策');
                return;
            }
            let score = stockScores[candidate] || 0.5;
            let confidence = clamp(score / 0.7, 0.2, 1.0);
            let price = stocks[candidate].price;
            let maxShares = Math.floor(player.cash / price);
            let targetShares = Math.floor(investBudget / price * (0.4 + confidence * 0.5));
            let shares = Math.min(maxShares, targetShares);
            if (shares > 0) {
                investStock(player.id, candidate, shares);
                let action = confidence > 0.7 ? '加仓' : '建仓';
                addLog(`🤖 ${player.name} ${action}${candidate}股 ${shares}股 (评分${(score*100).toFixed(0)})`);
                showBanner(`${player.name} ${action} ${candidate}股 ${shares}股`, 'info', null, '🤖 AI决策');
            } else if (player.cash > 500) {
                let small = Math.round(player.cash * 0.05);
                let sec = pickSecondBest(stockScores, holdings);
                if (sec) {
                    let secPrice = stocks[sec].price;
                    let secShares = Math.floor(small / secPrice);
                    if (secShares > 0) {
                        investStock(player.id, sec, secShares);
                        addLog(`🤖 ${player.name} 小额分散买入${sec}股 ${secShares}股`);
                        showBanner(`${player.name} 小额分散买入 ${sec}股 ${secShares}股`, 'info', null, '🤖 AI决策');
                        return;
                    }
                }
                showBanner(`${player.name} 未进行操作（资金不足）`, 'info', null, '🤖 AI决策');
            } else {
                showBanner(`${player.name} 未进行操作`, 'info', null, '🤖 AI决策');
            }
        }

        function analyzeMarket() {
            let data = {};
            let stocksKeys = ['A', 'B', 'C', 'D'];
            for (let k of stocksKeys) {
                let s = stocks[k];
                let hist = s.history || [];
                let mults = hist.map(h => h.multiplier || 1);
                let recent = mults.slice(-5);
                let trend = s.trend || 0;
                let volatility = s.volatility || 0.1;
                let momentum = 0;
                if (recent.length >= 3) {
                    momentum = (recent[recent.length - 1] - recent[0]) / Math.max(recent[0], 0.01);
                }
                let strength = 0.5 + trend * 2 + momentum * 1.5;
                strength = clamp(strength, 0, 1);
                data[k] = { trend, momentum, volatility, strength, currentPrice: s.price || 100, recentMultiplier: s
                        .recentMultiplier || 1 };
            }
            let avgStrength = (data.A.strength + data.B.strength + data.C.strength + data.D.strength) / 4;
            data.marketSentiment = avgStrength;
            return data;
        }

        function scoreStocks(marketData) {
            let scores = {};
            for (let k of ['A', 'B', 'C', 'D']) {
                let d = marketData[k];
                if (!d) { scores[k] = 0.5; continue; }
                let trendScore = clamp(d.trend * 5 + 0.5, 0, 1);
                let momentumScore = clamp(d.momentum * 3 + 0.5, 0, 1);
                let strengthScore = d.strength;
                let volAdj = clamp(1 - d.volatility * 1.2, 0.3, 1);
                let score = trendScore * 0.30 + momentumScore * 0.25 + strengthScore * 0.25 + volAdj * 0.20;
                scores[k] = clamp(score, 0.05, 0.95);
            }
            return scores;
        }

        function getStrategyConfig(strategy, marketData) {
            let weights, cashRatio, stopLoss, takeProfit;
            let sentiment = marketData.marketSentiment || 0.5;
            let riskAdj = clamp(sentiment * 0.6 + 0.2, 0.3, 0.8);
            let baseStop = ADMIN_CONFIG.aiStopLoss || 0.20;
            let baseTake = ADMIN_CONFIG.aiTakeProfit || 0.50;
            let baseCash = ADMIN_CONFIG.aiCashRatio || 0.15;
            switch (strategy) {
                case '稳健型':
                    weights = { A: 0.50, B: 0.05, C: 0, D: 0.45 };
                    cashRatio = 0.25 + (1 - riskAdj) * 0.15;
                    stopLoss = baseStop * 0.6;
                    takeProfit = baseTake * 0.7;
                    break;
                case '平衡型':
                    weights = { A: 0.30, B: 0.20, C: 0.15, D: 0.35 };
                    cashRatio = 0.15 + (1 - riskAdj) * 0.10;
                    stopLoss = baseStop;
                    takeProfit = baseTake;
                    break;
                case '进取型':
                    weights = { A: 0.10, B: 0.25, C: 0.55, D: 0.10 };
                    cashRatio = 0.08 + (1 - riskAdj) * 0.08;
                    stopLoss = baseStop * 1.5;
                    takeProfit = baseTake * 1.4;
                    break;
                case '趋势跟随':
                    let best = 'A',
                        bestVal = -Infinity;
                    for (let k of ['C', 'B', 'A', 'D']) {
                        let s = stocks[k].recentMultiplier || 1;
                        if (s > bestVal) { bestVal = s;
                            best = k; }
                    }
                    weights = { A: 0.15, B: 0.15, C: 0.15, D: 0.15 };
                    weights[best] = 0.40;
                    cashRatio = 0.12 + (1 - riskAdj) * 0.08;
                    stopLoss = baseStop * 0.9;
                    takeProfit = baseTake * 0.9;
                    break;
                case '逆向投资':
                    let worst = 'A',
                        worstVal = Infinity;
                    for (let k of ['C', 'B', 'A', 'D']) {
                        let s = stocks[k].recentMultiplier || 1;
                        if (s < worstVal) { worstVal = s;
                            worst = k; }
                    }
                    weights = { A: 0.20, B: 0.20, C: 0.20, D: 0.20 };
                    weights[worst] = 0.40;
                    cashRatio = 0.12 + (1 - riskAdj) * 0.10;
                    stopLoss = baseStop * 1.25;
                    takeProfit = baseTake * 0.8;
                    break;
                case '价值发现':
                    weights = { A: 0.25, B: 0.15, C: 0.10, D: 0.50 };
                    cashRatio = 0.20 + (1 - riskAdj) * 0.10;
                    stopLoss = baseStop * 0.75;
                    takeProfit = baseTake * 0.9;
                    break;
                default:
                    weights = { A: 0.30, B: 0.20, C: 0.15, D: 0.35 };
                    cashRatio = 0.15;
                    stopLoss = baseStop;
                    takeProfit = baseTake;
            }
            let sum = Object.values(weights).reduce((a, b) => a + b, 0);
            if (sum > 0) { for (let k in weights) weights[k] /= sum; }
            return { weights, cashRatio: clamp(cashRatio, 0.05, 0.45), stopLoss, takeProfit };
        }

        function pickBestStock(scores, holdings) {
            let best = null,
                bestScore = -Infinity;
            for (let k of ['C', 'B', 'A', 'D']) {
                let score = scores[k] || 0;
                let holdingPenalty = Math.min((holdings[k] || 0) / 30, 0.3);
                let adjusted = score * (1 - holdingPenalty);
                if (adjusted > bestScore) { bestScore = adjusted;
                    best = k; }
            }
            return best;
        }

        function pickSecondBest(scores, holdings) {
            let best = null,
                bestScore = -Infinity;
            let first = pickBestStock(scores, holdings);
            for (let k of ['C', 'B', 'A', 'D']) {
                if (k === first) continue;
                let score = scores[k] || 0;
                let holdingPenalty = Math.min((holdings[k] || 0) / 30, 0.3);
                let adjusted = score * (1 - holdingPenalty);
                if (adjusted > bestScore) { bestScore = adjusted;
                    best = k; }
            }
            return best;
        }

        // ================================================================
