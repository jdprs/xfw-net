// Q-Learning 训练模拟器：在 Node 中跑上万局，模拟游戏核心逻辑，输出预训练 Q 表
const fs = require('fs');

// ---------- 股票定义（与游戏一致） ----------
function makeStock() {
    return {
        A: { price: 100, trend: 0, maxDown: -0.3, maxUp: 0.18, history: [], netFlow: 0, recentMultiplier: 1 },
        B: { price: 100, trend: 0, maxDown: -0.4, maxUp: 0.8, history: [], netFlow: 0, recentMultiplier: 1 },
        C: { price: 100, trend: 0, maxDown: -0.6, maxUp: 1.2, history: [], netFlow: 0, recentMultiplier: 1 },
        D: { price: 100, trend: 0, maxDown: -0.05, maxUp: 0.1, history: [], netFlow: 0, recentMultiplier: 1 }
    };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

// 模拟股票涨跌（简化版 05-stock-algorithm）
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

// ---------- 玩家 ----------
function makePlayer() {
    return {
        cash: 5000,
        sharesA: 0, sharesB: 0, sharesC: 0, sharesD: 0,
        totalAssets: function (stocks) {
            return this.cash + this.sharesA * stocks.A.price + this.sharesB * stocks.B.price
                + this.sharesC * stocks.C.price + this.sharesD * stocks.D.price;
        }
    };
}

// ---------- 状态离散化（与游戏 QLearner 一致） ----------
function getStateKey(player, stocks, round, totalRounds, sentiment) {
    let sent = sentiment < 0.35 ? 'L' : sentiment < 0.65 ? 'M' : 'H';
    let total = player.totalAssets(stocks);
    let stockVal = player.sharesA * stocks.A.price + player.sharesB * stocks.B.price
        + player.sharesC * stocks.C.price + player.sharesD * stocks.D.price;
    let ratio = total > 0 ? stockVal / total : 0;
    let pos = ratio < 0.2 ? 'L' : ratio < 0.6 ? 'M' : 'H';
    let rnd = round < totalRounds / 3 ? 'E' : round < totalRounds * 2 / 3 ? 'M' : 'L';
    let best = 'N', bestMult = -Infinity;
    for (let k of ['A', 'B', 'C', 'D']) {
        let m = stocks[k].recentMultiplier || 1;
        if (m > bestMult) { bestMult = m; best = k; }
    }
    return sent + '_' + pos + '_' + rnd + '_' + best;
}

// ---------- Q-Learning ----------
const ALPHA = 0.15, GAMMA = 0.85, EPSILON = 0.15;
const ACTIONS = ['buy_A', 'buy_B', 'buy_C', 'buy_D', 'hold'];
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

// 执行动作
function doAction(player, stocks, action, round) {
    if (action === 'hold') return;
    let key = action.split('_')[1];
    let price = stocks[key].price;
    if (player.cash < price) return;
    // 买入 10-25% 现金
    let budget = player.cash * rand(0.1, 0.25);
    let shares = Math.floor(budget / price);
    if (shares > 0) {
        player.cash -= shares * price;
        player['shares' + key] += shares;
    }
}

// 模拟一局
function playGame(totalRounds) {
    let stocks = makeStock();
    let player = makePlayer();
    let lastState = null, lastAction = null, lastAssets = player.totalAssets(stocks);

    for (let round = 1; round <= totalRounds; round++) {
        // 计算市场情绪（平均涨跌）
        let mults = {};
        for (let k of ['A', 'B', 'C', 'D']) {
            mults[k] = calcMultiplier(stocks[k], k);
            stocks[k].history.push({ multiplier: mults[k] });
            stocks[k].recentMultiplier = mults[k];
            stocks[k].price = Math.round(stocks[k].price * mults[k]);
        }
        let sentiment = (mults.A + mults.B + mults.C + mults.D) / 4;
        sentiment = clamp(0.5 + (sentiment - 1) * 3, 0, 1);

        // 当前状态
        let state = getStateKey(player, stocks, round, totalRounds, sentiment);
        // 上一轮Q更新
        if (lastState && lastAction) {
            let assets = player.totalAssets(stocks);
            let reward = lastAssets > 0 ? (assets - lastAssets) / lastAssets : 0;
            updateQ(lastState, lastAction, reward, state);
            lastAssets = assets;
        }
        // 选动作并执行
        let action = chooseAction(state);
        doAction(player, stocks, action, round);
        lastState = state;
        lastAction = action;
    }
}

// ---------- 训练 ----------
console.log('开始训练...');
const GAMES = 50000;
for (let i = 0; i < GAMES; i++) {
    playGame(60);
    if ((i + 1) % 5000 === 0) {
        console.log('已完成', i + 1, '局，Q表状态数:', Object.keys(qTable).length);
    }
}

// 输出
const out = {
    meta: { games: GAMES, trainedAt: new Date().toISOString(), alpha: ALPHA, gamma: GAMMA },
    qTable: qTable
};
fs.writeFileSync('/home/user/Doubao/chats/38445534605091330/xfw-net/src/ai/pretrained-qtable.json', JSON.stringify(out, null, 0));
console.log('训练完成！Q表状态数:', Object.keys(qTable).length);
console.log('文件已保存到 pretrained-qtable.json');
