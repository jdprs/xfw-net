// Q-Learning 训练模拟器 v10.2：新动作（创建/投资自建股、模仿领先者）+ 多玩家排名
const fs = require('fs');

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }

const AI_CUSTOM_NAMES = ['新能源','半导体','人工智能','生物医药','光伏','白酒','军工','消费电子','地产','金融科技','传媒','新能源汽车','储能','芯片','机器人','元宇宙','云计算','航空航天'];

function makeStock() {
    return {
        A: { price: 100, trend: 0, maxDown: -0.3, maxUp: 0.18, history: [], netFlow: 0, recentMultiplier: 1 },
        B: { price: 100, trend: 0, maxDown: -0.4, maxUp: 0.8, history: [], netFlow: 0, recentMultiplier: 1 },
        C: { price: 100, trend: 0, maxDown: -0.6, maxUp: 1.2, history: [], netFlow: 0, recentMultiplier: 1 },
        D: { price: 100, trend: 0, maxDown: -0.05, maxUp: 0.1, history: [], netFlow: 0, recentMultiplier: 1 }
    };
}

function calcMultiplier(s, key) {
    let trend = s.trend;
    let histLen = s.history.length;
    let realizedVol = 0;
    if (histLen > 2) {
        let recent = s.history.slice(-6);
        let sumSq = recent.reduce((a, h) => a + Math.pow((h.multiplier || h) - 1, 2), 0);
        realizedVol = Math.sqrt(sumSq / Math.max(recent.length, 1));
    }
    let garchVol = 0.08 + 0.5 * realizedVol + 0.3 * Math.abs(trend);
    let meanRevStrength = 0.08 + 0.12 * Math.min(Math.abs(trend) * 5, 0.5);
    let meanReversion = -meanRevStrength * trend;
    let momentumBoost = trend * 0.35 * Math.exp(-Math.abs(trend) * 4);
    let skew = trend < -0.02 ? 1.3 : trend > 0.02 ? 0.85 : 1.0;
    let shock = rand(-garchVol * skew, garchVol);
    let raw = 1 + trend + meanReversion + momentumBoost + shock;
    let capped = clamp(raw, 1 + s.maxDown, 1 + s.maxUp);
    if (key === 'A') capped = Math.max(1, capped);
    s.trend = 0.6 * s.trend + 0.4 * (capped - 1);
    s.netFlow = 0;
    return capped;
}

// 自建股模拟
function makeCustomStock(name, creatorId, investAmt) {
    let ratio = clamp(1 + investAmt / 8000, 1.0, 2.5);
    return {
        id: Date.now() + Math.random(),
        name, creatorId,
        value: investAmt,
        initialInvestment: investAmt,
        ratio,
        maxUp: 0.18, maxDown: 0.18,
        volatility: 0.15,
        trend: 0,
        recentMultiplier: 1,
        history: [],
        revoked: false
    };
}

function calcCustomMultiplier(cs) {
    let trend = cs.trend;
    let shock = rand(-cs.volatility, cs.volatility);
    let upBias = (cs.ratio - 1) * 0.02; // 涨跌比高→略偏涨
    let raw = 1 + trend + upBias + shock;
    let capped = clamp(raw, 1 - cs.maxDown, 1 + cs.maxUp);
    cs.trend = 0.6 * cs.trend + 0.4 * (capped - 1);
    return capped;
}

function makePlayer(id, isAI) {
    return {
        id, isAI,
        cash: 5000,
        sharesA: 0, sharesB: 0, sharesC: 0, sharesD: 0,
        customInvestments: {}, // cid -> amount
        totalAssets: function (stocks, customStocks) {
            let v = this.cash + this.sharesA * stocks.A.price + this.sharesB * stocks.B.price
                + this.sharesC * stocks.C.price + this.sharesD * stocks.D.price;
            for (let cid in this.customInvestments) {
                let cs = customStocks.find(c => c.id == cid);
                if (cs && !cs.revoked) v += this.customInvestments[cid];
            }
            return v;
        }
    };
}

// 状态离散化（与游戏 QLearner v10.2 一致）
function getStateKey(player, stocks, customStocks, allPlayers, round, totalRounds, sentiment) {
    let sent = sentiment < 0.35 ? 'L' : sentiment < 0.65 ? 'M' : 'H';
    let total = player.totalAssets(stocks, customStocks);
    let stockVal = player.sharesA * stocks.A.price + player.sharesB * stocks.B.price
        + player.sharesC * stocks.C.price + player.sharesD * stocks.D.price;
    for (let cid in player.customInvestments) stockVal += player.customInvestments[cid];
    let ratio = total > 0 ? stockVal / total : 0;
    let pos = ratio < 0.2 ? 'L' : ratio < 0.6 ? 'M' : 'H';
    let rnd = round < totalRounds / 3 ? 'E' : round < totalRounds * 2 / 3 ? 'M' : 'L';
    let best = 'N', bestMult = -Infinity;
    for (let k of ['A', 'B', 'C', 'D']) {
        let m = stocks[k].recentMultiplier || 1;
        if (m > bestMult) { bestMult = m; best = k; }
    }
    // 排名
    let sorted = [...allPlayers].sort((a, b) => b.totalAssets(stocks, customStocks) - a.totalAssets(stocks, customStocks));
    let idx = sorted.findIndex(p => p.id === player.id);
    let rank = idx === 0 ? 'F' : idx >= sorted.length - 1 ? 'B' : 'M';
    // 自建股数
    let cc = customStocks.filter(c => !c.revoked).length;
    let cust = cc === 0 ? '0' : cc === 1 ? '1' : '2';
    return sent + '_' + pos + '_' + rnd + '_' + best + '_' + rank + '_' + cust;
}

const ALPHA = 0.15, GAMMA = 0.85, EPSILON = 0.15;
const ACTIONS = ['buy_A', 'buy_B', 'buy_C', 'buy_D', 'create_custom', 'invest_custom', 'copy_leader', 'hold'];
const qTable = {};

function chooseAction(stateKey) {
    if (Math.random() < EPSILON) return ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    let q = qTable[stateKey];
    if (!q) return ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    let best = null, bestVal = -Infinity;
    for (let a of ACTIONS) {
        let v = q[a] || 0;
        if (v > bestVal) { bestVal = v; best = a; }
    }
    return best || ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
}

function updateQ(stateKey, action, reward, nextStateKey) {
    if (!qTable[stateKey]) qTable[stateKey] = {};
    let oldQ = qTable[stateKey][action] || 0;
    let nextQ = qTable[nextStateKey] || {};
    let nextMax = 0;
    for (let a of ACTIONS) { if ((nextQ[a] || 0) > nextMax) nextMax = nextQ[a]; }
    qTable[stateKey][action] = oldQ + ALPHA * (reward + GAMMA * nextMax - oldQ);
}

// 执行动作（学习AI）
function doAction(player, stocks, customStocks, allPlayers, action) {
    if (action === 'hold') return;
    if (action.startsWith('buy_')) {
        let key = action.split('_')[1];
        let price = stocks[key].price;
        if (player.cash < price) return;
        let budget = player.cash * rand(0.1, 0.25);
        let shares = Math.floor(budget / price);
        if (shares > 0) {
            player.cash -= shares * price;
            player['shares' + key] += shares;
        }
        return;
    }
    if (action === 'create_custom') {
        if (customStocks.filter(c => !c.revoked).length >= 3) return;
        if (player.cash < 200) return;
        let usedNames = customStocks.map(c => c.name);
        let available = AI_CUSTOM_NAMES.filter(n => !usedNames.includes(n));
        if (available.length === 0) return;
        let investAmt = Math.round(player.cash * rand(0.15, 0.30));
        investAmt = Math.max(100, Math.min(investAmt, player.cash - 50));
        if (investAmt < 100) return;
        let name = available[randInt(0, available.length - 1)];
        let cs = makeCustomStock(name, player.id, investAmt);
        customStocks.push(cs);
        player.cash -= investAmt;
        player.customInvestments[cs.id] = investAmt;
        return;
    }
    if (action === 'invest_custom') {
        let available = customStocks.filter(c => !c.revoked);
        if (available.length === 0) return;
        let sorted = [...available].sort((a, b) => (b.recentMultiplier || 1) - (a.recentMultiplier || 1));
        let target = sorted[0];
        let amt = Math.round(player.cash * rand(0.1, 0.2));
        amt = Math.max(100, Math.min(amt, player.cash - 50));
        if (amt < 100) return;
        player.cash -= amt;
        player.customInvestments[target.id] = (player.customInvestments[target.id] || 0) + amt;
        // 自建股价值增加
        target.value += amt;
        return;
    }
    if (action === 'copy_leader') {
        let leader = null, leaderAssets = -Infinity;
        for (let p of allPlayers) {
            if (p.id === player.id) continue;
            let a = p.totalAssets(stocks, customStocks);
            if (a > leaderAssets) { leaderAssets = a; leader = p; }
        }
        if (!leader) return;
        // 找领先者持仓最多的普通股
        let bestK = null, maxVal = -1;
        for (let k of ['A', 'B', 'C', 'D']) {
            let v = leader['shares' + k] * stocks[k].price;
            if (v > maxVal) { maxVal = v; bestK = k; }
        }
        if (!bestK || maxVal < 100) return;
        let price = stocks[bestK].price;
        if (player.cash < price) return;
        let budget = player.cash * rand(0.2, 0.4);
        let shares = Math.floor(budget / price);
        if (shares > 0) {
            player.cash -= shares * price;
            player['shares' + bestK] += shares;
        }
        return;
    }
}

// 对手AI简单随机交易
function opponentTrade(player, stocks) {
    if (Math.random() < 0.4) return;
    let keys = ['A', 'B', 'C', 'D'];
    let k = keys[randInt(0, 3)];
    let price = stocks[k].price;
    if (player.cash < price) return;
    let budget = player.cash * rand(0.05, 0.2);
    let shares = Math.floor(budget / price);
    if (shares > 0) {
        player.cash -= shares * price;
        player['shares' + k] += shares;
    }
}

function playGame(totalRounds) {
    let stocks = makeStock();
    let customStocks = [];
    let learner = makePlayer(0, true);
    let opp1 = makePlayer(1, true);
    let opp2 = makePlayer(2, true);
    let allPlayers = [learner, opp1, opp2];
    let lastState = null, lastAction = null, lastAssets = learner.totalAssets(stocks, customStocks);
    let lastRank = 0;

    for (let round = 1; round <= totalRounds; round++) {
        // 股票涨跌
        let mults = {};
        for (let k of ['A', 'B', 'C', 'D']) {
            mults[k] = calcMultiplier(stocks[k], k);
            stocks[k].history.push({ multiplier: mults[k] });
            stocks[k].recentMultiplier = mults[k];
            stocks[k].price = Math.max(1, Math.round(stocks[k].price * mults[k]));
        }
        // 自建股涨跌
        for (let cs of customStocks) {
            if (cs.revoked) continue;
            let m = calcCustomMultiplier(cs);
            cs.history.push({ multiplier: m });
            cs.recentMultiplier = m;
            // 持仓按比例变化
            for (let p of allPlayers) {
                if (p.customInvestments[cs.id]) {
                    p.customInvestments[cs.id] = Math.max(0, Math.round(p.customInvestments[cs.id] * m));
                }
            }
        }
        let sentiment = (mults.A + mults.B + mults.C + mults.D) / 4;
        sentiment = clamp(0.5 + (sentiment - 1) * 3, 0, 1);

        // 对手交易
        opponentTrade(opp1, stocks);
        opponentTrade(opp2, stocks);

        // 学习AI状态与决策
        let state = getStateKey(learner, stocks, customStocks, allPlayers, round, totalRounds, sentiment);
        if (lastState && lastAction) {
            let assets = learner.totalAssets(stocks, customStocks);
            let reward = lastAssets > 0 ? (assets - lastAssets) / lastAssets : 0;
            // 排名奖励
            let sorted = [...allPlayers].sort((a, b) => b.totalAssets(stocks, customStocks) - a.totalAssets(stocks, customStocks));
            let curRank = sorted.findIndex(p => p.id === learner.id);
            if (curRank < lastRank) reward += 0.05;
            else if (curRank > lastRank) reward -= 0.03;
            lastRank = curRank;
            updateQ(lastState, lastAction, reward, state);
            lastAssets = assets;
        }
        let action = chooseAction(state);
        doAction(learner, stocks, customStocks, allPlayers, action);
        lastState = state;
        lastAction = action;
    }
}

// ---------- 训练 ----------
console.log('开始训练 v10.2（新动作空间）...');
const GAMES = 300000;
const start = Date.now();
for (let i = 0; i < GAMES; i++) {
    playGame(60);
    if ((i + 1) % 20000 === 0) {
        let elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log('已完成', i + 1, '局，Q表状态数:', Object.keys(qTable).length, '耗时:', elapsed + 's');
    }
}

// 过滤掉 Q 值全为 0 的状态（减少体积）
let filtered = {};
for (let k in qTable) {
    let hasNonZero = false;
    for (let a in qTable[k]) {
        if (Math.abs(qTable[k][a]) > 0.001) { hasNonZero = true; break; }
    }
    if (hasNonZero) filtered[k] = qTable[k];
}

const out = {
    meta: { games: GAMES, trainedAt: new Date().toISOString(), alpha: ALPHA, gamma: GAMMA, version: '10.2', actions: ACTIONS },
    qTable: filtered
};
fs.writeFileSync('/home/user/Doubao/chats/38445534605091330/xfw-net/src/ai/pretrained-qtable.json', JSON.stringify(out));
console.log('训练完成！Q表状态数:', Object.keys(filtered).length, '/', Object.keys(qTable).length);
console.log('文件已保存到 pretrained-qtable.json');
