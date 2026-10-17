//  9. 场内AI 决策（v10.2：去策略类型，Q表学习创建/投资自建股、模仿领先者）
// ================================================================

// v10.2: AI 难度配置（易/中/难，游戏开始随机分配）
const AI_DIFFICULTY = {
    easy:   { label:'易', color:'#4ade80', skipChance:0.35, cashMul:1.8,  stopLossMul:2.5,  takeProfitMul:0.5,  investMul:0.4,  randomPick:true,  useDarkHorse:false, useCustom:false, useLottery:false, noise:0.5 },
    medium: { label:'中', color:'#facc15', skipChance:0.08, cashMul:1.0,  stopLossMul:1.0,  takeProfitMul:1.0,  investMul:1.0,  randomPick:false, useDarkHorse:true,  useCustom:true,  useLottery:true,  noise:0.15 },
    hard:   { label:'难', color:'#f87171', skipChance:0,    cashMul:0.6,  stopLossMul:0.8,  takeProfitMul:1.2,  investMul:1.3,  randomPick:false, useDarkHorse:true,  useCustom:true,  useLottery:true,  noise:0 }
};
function getDiffCfg(p){ return AI_DIFFICULTY[p.aiDifficulty] || AI_DIFFICULTY.medium; }

// v10.2: AI 创建自建股时使用的系统名称表（玩家创建的自建股名称由玩家自定，AI 从这里选）
const AI_CUSTOM_STOCK_NAMES = [
    '新能源', '半导体', '人工智能', '生物医药', '光伏', '白酒',
    '军工', '消费电子', '地产', '金融科技', '传媒', '新能源汽车',
    '储能', '芯片', '机器人', '元宇宙', '云计算', '航空航天'
];

// 获取玩家排名（0=第一，返回 'leader'/'middle'/'behind'）
function getPlayerRank(player) {
    if (typeof players === 'undefined' || players.length < 2) return 'middle';
    let sorted = [...players].filter(p => !p.bankrupt).sort((a, b) => b.totalAssets() - a.totalAssets());
    let idx = sorted.findIndex(p => p.id === player.id);
    if (idx <= 0) return 'leader';
    if (idx >= sorted.length - 1) return 'behind';
    return 'middle';
}

// v10.2: 统一自适应配置（替代原来的6种策略类型）
// 基于市场情绪 + 玩家排名动态决定仓位、止损止盈、权重
function getAdaptiveConfig(player, marketData) {
    let sentiment = (marketData && marketData.marketSentiment) || 0.5;
    let rank = getPlayerRank(player);
    let baseStop = ADMIN_CONFIG.aiStopLoss || 0.20;
    let baseTake = ADMIN_CONFIG.aiTakeProfit || 0.50;
    let baseCash = ADMIN_CONFIG.aiCashRatio || 0.15;

    // 市场情绪好→仓位高，差→仓位低
    let cashRatio = baseCash + (1 - sentiment) * 0.15;
    // 落后时更激进（低现金、宽止损），领先时更保守（高现金、紧止损）
    if (rank === 'behind') { cashRatio *= 0.6; baseStop *= 1.4; baseTake *= 1.2; }
    else if (rank === 'leader') { cashRatio *= 1.4; baseStop *= 0.7; baseTake *= 0.8; }

    // 权重：基于市场强度动态分配，不再固定策略
    let weights = {};
    for (let k of ['A','B','C','D']) {
        let d = marketData && marketData[k];
        weights[k] = d ? clamp(d.strength, 0.05, 0.95) : 0.25;
    }
    let sum = Object.values(weights).reduce((a,b)=>a+b,0);
    if (sum > 0) for (let k in weights) weights[k] /= sum;

    return { weights, cashRatio: clamp(cashRatio, 0.05, 0.45), stopLoss: baseStop, takeProfit: baseTake };
}

// AI 创建自建股（v10.2 新增）
function aiCreateCustomStock(player, investBudget) {
    if (typeof customStocks === 'undefined' || typeof createCustomStock !== 'function') return false;
    // 选未使用的系统名称
    let usedNames = customStocks.filter(cs => !cs.revoked).map(cs => cs.name);
    let available = AI_CUSTOM_STOCK_NAMES.filter(n => !usedNames.includes(n));
    if (available.length === 0) return false;
    let name = available[randInt(0, available.length - 1)];
    // 投资金额：现金的15~30%，至少100
    let investAmt = Math.round(player.cash * (0.15 + Math.random() * 0.15));
    investAmt = Math.max(100, Math.min(investAmt, player.cash - 50));
    if (investAmt < 100) return false;
    // 风险等级：落后→高风险博弹性，领先→低风险稳健，中游→中
    let rank = getPlayerRank(player);
    let riskLevel = rank === 'behind' ? '高' : rank === 'leader' ? '低' : '中';
    // 波动系数：10~20
    let volPercent = 10 + Math.floor(Math.random() * 11);
    let result = createCustomStock(player.id, name, investAmt, riskLevel, volPercent);
    if (result && result.ok) {
        addLog(`🤖 ${player.name} 创办自建股「${name}」投入${fmt(investAmt)}（${riskLevel}风险/波动${volPercent}%）`);
        return true;
    }
    return false;
}

// AI 投资自建股（v10.2 新增）
function aiInvestCustomStock(player, investBudget) {
    if (typeof customStocks === 'undefined' || typeof investCustomStock !== 'function') return false;
    let available = customStocks.filter(cs => !cs.revoked && cs.value >= 0);
    if (available.length === 0) return false;
    // 选最近涨幅最大的
    let sorted = [...available].sort((a,b) => (b.recentMultiplier||1) - (a.recentMultiplier||1));
    let target = sorted[0];
    let amt = Math.round(investBudget * (0.15 + Math.random() * 0.2));
    amt = Math.max(100, Math.min(amt, player.cash - 50));
    if (amt < 100 || amt > player.cash) return false;
    let cashBefore = player.cash;
    investCustomStock(player.id, target.id, amt);
    if (player.cash < cashBefore) {
        addLog(`🤖 ${player.name} 投资自建股「${target.name}」${fmt(amt)}`);
        return true;
    }
    return false;
}

// AI 模仿领先者（v10.2 新增）：分析领先者持仓，按比例买入差距最大的标的
function aiCopyLeader(player, investBudget) {
    if (typeof players === 'undefined' || players.length < 2) return false;
    // 找总资产最高的非己玩家
    let leader = null, leaderAssets = -Infinity;
    for (let p of players) {
        if (p.id === player.id || p.bankrupt) continue;
        let a = p.totalAssets();
        if (a > leaderAssets) { leaderAssets = a; leader = p; }
    }
    if (!leader) return false;

    // 计算领先者各标的持仓比例
    let leaderTotal = leader.totalAssets() || 1;
    let leaderWeights = {};
    for (let k of ['A','B','C','D']) {
        leaderWeights[k] = ((leader['shares'+k]||0) * (stocks[k].price||100)) / leaderTotal;
    }
    // 计算自己各标的持仓比例
    let myTotal = player.totalAssets() || 1;
    let myWeights = {};
    for (let k of ['A','B','C','D']) {
        myWeights[k] = ((player['shares'+k]||0) * (stocks[k].price||100)) / myTotal;
    }
    // 找差距最大的标的（领先者有而自己少的）
    let bestK = null, maxGap = -Infinity;
    for (let k of ['A','B','C','D']) {
        let gap = leaderWeights[k] - myWeights[k];
        if (gap > maxGap) { maxGap = gap; bestK = k; }
    }
    if (!bestK || maxGap < 0.02) return false; // 差距太小不模仿
    let price = stocks[bestK].price;
    let amt = Math.round(investBudget * (0.3 + Math.random() * 0.3));
    let shares = Math.floor(amt / price);
    if (shares < 1) return false;
    shares = Math.min(shares, Math.floor(player.cash / price));
    if (shares < 1) return false;
    investStock(player.id, bestK, shares);
    addLog(`🤖 ${player.name} 模仿领先者${leader.name}，加仓${bestK}股 ${shares}股`);
    showBanner(`${player.name} 参考${leader.name}的投资，加仓${bestK}股`, 'info', null, '🤖 AI决策');
    return true;
}

function makeAIDecision(player) {
    if (player.bankrupt || !player.isAI) return;
    let diff = getDiffCfg(player);
    if (Math.random() < diff.skipChance) { showBanner(player.name+' 持币观望', 'info', null, '🤖 AI决策'); return; }
    let total = player.totalAssets();
    if (total < 100) {
        showBanner(`${player.name} 资产不足，无法交易`, 'warning', null, '🤖 AI决策');
        return;
    }
    let marketData = analyzeMarket();
    let stockScores = scoreStocks(marketData);

    // 易：随机评分；中：加噪声；难：无噪声（由Q表决策）
    if (diff.randomPick) {
        for (let k of ['A','B','C','D']) stockScores[k] = 0.3 + Math.random()*0.4;
    } else if (diff.noise > 0) {
        for (let k of ['A','B','C','D']) stockScores[k] = clamp(stockScores[k] + (Math.random()-0.5)*diff.noise, 0.05, 0.95);
    }

    if (diff.useDarkHorse && currentDarkHorse) {
        let dhKey = currentDarkHorse.key;
        if (dhKey && stockScores[dhKey] !== undefined) {
            stockScores[dhKey] = Math.min(1, (stockScores[dhKey] || 0.5) + 0.25);
        }
    }

    if (diff.useLottery && Math.random() < 0.08 && player.cash >= 200) {
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

    // 即将破产时撤资保命（优先级最高）
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

    // v10.2: 统一自适应配置（替代策略类型）
    let config = getAdaptiveConfig(player, marketData);
    config.cashRatio = clamp(config.cashRatio * diff.cashMul, 0.05, 0.6);
    config.stopLoss *= diff.stopLossMul;
    config.takeProfit *= diff.takeProfitMul;

    // 止损止盈（所有难度共用）
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
        if (drawdown < -config.stopLoss && Math.random() < 0.65) {
            let sellPct = 0.5 + Math.random() * 0.35;
            let sellShares = Math.floor(holding * sellPct);
            if (sellShares > 0) {
                withdrawStock(player.id, sk, sellShares);
                addLog(`🤖 ${player.name} 触发止损 (${sk}股亏损${(drawdown*100).toFixed(1)}%) 卖出 ${sellShares}股`, 'loss');
                holdings[sk] -= sellShares;
                totalStockVal -= sellShares * stocks[sk].price;
            }
        }
        if (drawdown > config.takeProfit && Math.random() < 0.45) {
            let sellPct = 0.3 + Math.random() * 0.25;
            let sellShares = Math.floor(holding * sellPct);
            if (sellShares > 0) {
                withdrawStock(player.id, sk, sellShares);
                addLog(`🤖 ${player.name} 止盈 (${sk}股盈利${(drawdown*100).toFixed(1)}%) 卖出 ${sellShares}股`, 'profit');
                holdings[sk] -= sellShares;
                totalStockVal -= sellShares * stocks[sk].price;
            }
        }
    }

    // 再平衡（易跳过）
    let targetWeights = config.weights;
    let targetCashRatio = config.cashRatio;
    let totalWealth = player.totalAssets();
    let targetStockVal = totalWealth * (1 - targetCashRatio);

    if (!diff.randomPick && totalStockVal > 500) {
        let rebalanceThreshold = 0.20;
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
                if (holdings[sk] > 0 && score < worstScore) { worstScore = score; worst = sk; }
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

    investBudget = Math.round(investBudget * diff.investMul);

    // ===== 难 AI：Q 表直接决策（v10.2 支持新动作）=====
    if (player.aiDifficulty === 'hard' && typeof QLearner !== 'undefined') {
        let qStateKey = QLearner.getStateKey(player, marketData);
        let qAction = QLearner.chooseAction(qStateKey);
        player._qLastState = qStateKey;
        player._qLastAction = qAction;
        player._qLastAssets = player.totalAssets();

        if (qAction === 'hold') {
            showBanner(player.name+' Q决策：观望', 'info', null, '🤖 AI决策');
            return;
        }
        if (qAction && qAction.startsWith('buy_')) {
            let candidate = qAction.split('_')[1];
            if (stocks[candidate]) {
                let price = stocks[candidate].price;
                let maxShares = Math.floor(player.cash / price);
                let shares = Math.min(maxShares, Math.floor(investBudget / price));
                if (shares > 0) {
                    investStock(player.id, candidate, shares);
                    addLog(`🤖 ${player.name} Q决策买入${candidate}股 ${shares}股`);
                    showBanner(`${player.name} Q决策买入 ${candidate}股 ${shares}股`, 'info', null, '🤖 AI决策');
                    return;
                }
            }
        }
        // v10.2: Q表新动作
        if (qAction === 'create_custom' && diff.useCustom) {
            if (aiCreateCustomStock(player, investBudget)) return;
        }
        if (qAction === 'invest_custom' && diff.useCustom) {
            if (aiInvestCustomStock(player, investBudget)) return;
        }
        if (qAction === 'copy_leader') {
            if (aiCopyLeader(player, investBudget)) return;
        }
        // Q表动作不可行时，继续走规则引擎
    }

    // ===== 易/中：规则引擎 =====
    // v10.2: 中AI有概率创建/投资自建股、落后时模仿领先者
    if (diff.useCustom && !diff.randomPick) {
        let rank = getPlayerRank(player);
        // 落后时优先模仿领先者（30%概率）
        if (rank === 'behind' && Math.random() < 0.30 && investBudget > 200) {
            if (aiCopyLeader(player, investBudget)) return;
        }
        // 有概率创建自建股（10%，且当前自建股<3）
        let customCount = (typeof customStocks !== 'undefined') ? customStocks.filter(cs=>!cs.revoked).length : 0;
        if (customCount < 3 && Math.random() < 0.10 && player.cash > 500) {
            if (aiCreateCustomStock(player, investBudget)) return;
        }
        // 有概率投资自建股（15%）
        if (customCount > 0 && Math.random() < 0.15 && investBudget > 100) {
            if (aiInvestCustomStock(player, investBudget)) return;
        }
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
        data[k] = { trend, momentum, volatility, strength, currentPrice: s.price || 100, recentMultiplier: s.recentMultiplier || 1 };
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

function pickBestStock(scores, holdings) {
    let best = null, bestScore = -Infinity;
    for (let k of ['C', 'B', 'A', 'D']) {
        let score = scores[k] || 0;
        let holdingPenalty = Math.min((holdings[k] || 0) / 30, 0.3);
        let adjusted = score * (1 - holdingPenalty);
        if (adjusted > bestScore) { bestScore = adjusted; best = k; }
    }
    return best;
}

function pickSecondBest(scores, holdings) {
    let best = null, bestScore = -Infinity;
    let first = pickBestStock(scores, holdings);
    for (let k of ['C', 'B', 'A', 'D']) {
        if (k === first) continue;
        let score = scores[k] || 0;
        let holdingPenalty = Math.min((holdings[k] || 0) / 30, 0.3);
        let adjusted = score * (1 - holdingPenalty);
        if (adjusted > bestScore) { bestScore = adjusted; best = k; }
    }
    return best;
}

// ================================================================
