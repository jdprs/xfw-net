// 11. Q-Learning AI 决策引擎（难AI使用，跨游戏在线学习，localStorage持久化）
(function () {
    const ALPHA = 0.12;   // 学习率
    const GAMMA = 0.85;   // 折扣因子
    const EPSILON = 0.08; // 探索率
    const ACTIONS = ['buy_A', 'buy_B', 'buy_C', 'buy_D', 'hold'];

    let qTable = {};
    try {
        let raw = localStorage.getItem('xfw_qtable');
        if (raw) qTable = JSON.parse(raw) || {};
    } catch (e) { qTable = {}; }

    // 合并预训练 Q 表（50000局训练），玩家已学习的优先
    if (window.PRETRAINED_QTABLE) {
        for (let k in window.PRETRAINED_QTABLE) {
            if (!qTable[k]) qTable[k] = Object.assign({}, window.PRETRAINED_QTABLE[k]);
            else {
                for (let a in window.PRETRAINED_QTABLE[k]) {
                    if (qTable[k][a] === undefined) qTable[k][a] = window.PRETRAINED_QTABLE[k][a];
                }
            }
        }
    }

    function save() {
        try { localStorage.setItem('xfw_qtable', JSON.stringify(qTable)); } catch (e) {}
    }

    // 离散化状态：市场情绪_仓位_轮次_最强趋势
    function getStateKey(player, marketData) {
        let sentiment = (marketData && marketData.marketSentiment) || 0.5;
        let sent = sentiment < 0.35 ? 'L' : sentiment < 0.65 ? 'M' : 'H';

        let total = player.totalAssets ? player.totalAssets() : (player.cash || 0);
        let stockVal = 0;
        for (let k of ['A', 'B', 'C', 'D']) {
            stockVal += (player['shares' + k] || 0) * ((typeof stocks !== 'undefined' && stocks[k] && stocks[k].price) || 100);
        }
        let ratio = total > 0 ? stockVal / total : 0;
        let pos = ratio < 0.2 ? 'L' : ratio < 0.6 ? 'M' : 'H';

        let r = (typeof round !== 'undefined') ? round : 1;
        let tr = (typeof totalRounds !== 'undefined') ? totalRounds : 60;
        let rnd = r < tr / 3 ? 'E' : r < tr * 2 / 3 ? 'M' : 'L';

        // 最强趋势股（最近涨幅最大的）
        let best = 'N', bestMult = -Infinity;
        if (typeof stocks !== 'undefined') {
            for (let k of ['A', 'B', 'C', 'D']) {
                let m = (stocks[k] && stocks[k].recentMultiplier) || 1;
                if (m > bestMult) { bestMult = m; best = k; }
            }
        }
        return sent + '_' + pos + '_' + rnd + '_' + best;
    }

    function randomAction() {
        return ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    }

    function bestAction(stateKey) {
        let q = qTable[stateKey];
        if (!q) return null;
        let best = null, bestVal = -Infinity;
        for (let a of ACTIONS) {
            let v = q[a] || 0;
            if (v > bestVal) { bestVal = v; best = a; }
        }
        // 如果所有Q值都是0（未学习过），返回null让规则引擎接管
        if (bestVal <= 0 && Object.keys(q).length < 3) return null;
        return best;
    }

    // 难AI选动作：ε-greedy，Q表无数据时退回null（由规则引擎决策）
    function chooseAction(stateKey) {
        if (Math.random() < EPSILON) return randomAction();
        return bestAction(stateKey);
    }

    // 更新Q值：Q(s,a) += α * (r + γ * max Q(s',a') - Q(s,a))
    function update(stateKey, action, reward, nextStateKey) {
        if (!stateKey || !action) return;
        if (!qTable[stateKey]) qTable[stateKey] = {};
        let oldQ = qTable[stateKey][action] || 0;
        let nextQ = qTable[nextStateKey] || {};
        let nextMax = 0;
        for (let a of ACTIONS) { if ((nextQ[a] || 0) > nextMax) nextMax = nextQ[a]; }
        qTable[stateKey][action] = oldQ + ALPHA * (reward + GAMMA * nextMax - oldQ);
        save();
    }

    function reset() {
        qTable = {};
        save();
    }

    function stats() {
        let states = Object.keys(qTable).length;
        let updates = 0;
        for (let k in qTable) updates += Object.keys(qTable[k]).length;
        return { states, updates };
    }

    window.QLearner = {
        getStateKey, chooseAction, update, reset, stats,
        ACTIONS, save
    };
})();
