/* ================================================================
 * 38. 游戏状态同步 (v10.0)
 * 房主端(权威)：运行完整引擎，序列化广播 state_sync，处理 player_action
 * 玩家端：不运行逻辑，反序列化状态并渲染，本地操作封装为 player_action
 * 注意：01-state.js 中的状态变量是顶层 let 声明（全局词法绑定），
 *       不在 window 上，因此这里统一使用裸变量名访问/赋值。
 * ================================================================
 */
(() => {
    const Sync = {
        myPlayerId: -1,
        seats: [],            // master: [{peerId?, name, isHost, playerId, connected}]
        gameStarted: false,
        closing: false,
        chartsInited: false,
        lastSeq: 0
    };
    window.Sync = Sync;

    function toast(m, t, title) { if (typeof showBanner === 'function') showBanner(m, t || 'info', null, title || ''); }
    function mode() { return window.GAME_MODE || 'local'; }

    // ============================================================
    //  序列化 / 反序列化
    // ============================================================
    function makeTotalAssetsMethod() {
        return function() {
            let stockVal = ['A', 'B', 'C', 'D'].reduce((sum, k) => {
                let shares = this['shares' + k] || 0;
                return sum + shares * (stocks[k] && stocks[k].price != null ? stocks[k].price : 100);
            }, 0);
            let cust = this.customStockInvestments ? Object.values(this.customStockInvestments).reduce((a, b) => a + b, 0) : 0;
            return this.cash + stockVal + cust;
        };
    }
    window.xfwTotalAssets = makeTotalAssetsMethod;

    function serializeState() {
        const stocksCopy = {};
        Object.keys(stocks).forEach(k => {
            const s = stocks[k];
            stocksCopy[k] = {
                value: s.value, history: s.history ? s.history.slice(-25) : [],
                recentMultiplier: s.recentMultiplier, name: s.name, color: s.color,
                maxUp: s.maxUp, maxDown: s.maxDown, trend: s.trend, netFlow: s.netFlow,
                volatility: s.volatility, price: s.price
            };
        });
        return {
            players: players.map(p => {
                const o = Object.assign({}, p);
                delete o.totalAssets;
                return o;
            }),
            round: round,
            totalRounds: totalRounds,
            bankAssets: bankAssets,
            gameActive: gameActive,
            stocks: stocksCopy,
            customStocks: JSON.parse(JSON.stringify(customStocks || [])),
            lotteries: JSON.parse(JSON.stringify(lotteries || [])),
            lotteryJackpot: lotteryJackpot,
            decisionState: decisionState,
            decidingPlayerId: decidingPlayerId,
            playerDecisionStatus: Object.assign({}, playerDecisionStatus),
            sealedStocks: Object.assign({}, sealedStocks),
            currentDarkHorse: currentDarkHorse,
            predictionsThisRound: JSON.parse(JSON.stringify(predictionsThisRound || {})),
            roundEvents: JSON.parse(JSON.stringify(roundEvents || {})),
            assetsHistory: (assetsHistory || []).slice(),
            stocksHistory: (stocksHistory || []).slice(),
            roundHistory: (roundHistory || []).slice(-200),
            logsByRound: JSON.parse(JSON.stringify(logsByRound || {})),
            marketSentiment: marketSentiment,
            myPlayerId: Sync.myPlayerId,
            seq: ++Sync.lastSeq,
            serverTime: Date.now()
        };
    }
    window.xfwSerialize = serializeState;

    function applyState(s) {
        players = (s.players || []).map(p => { p.totalAssets = makeTotalAssetsMethod(); return p; });
        round = s.round;
        totalRounds = s.totalRounds;
        bankAssets = s.bankAssets;
        gameActive = s.gameActive;
        customStocks = s.customStocks || [];
        lotteries = s.lotteries || [];
        lotteryJackpot = s.lotteryJackpot || 0;
        decisionState = s.decisionState || 'idle';
        decidingPlayerId = s.decidingPlayerId;
        playerDecisionStatus = s.playerDecisionStatus || {};
        sealedStocks = s.sealedStocks || {};
        currentDarkHorse = s.currentDarkHorse;
        predictionsThisRound = s.predictionsThisRound || {};
        roundEvents = s.roundEvents || {};
        assetsHistory = s.assetsHistory || [];
        stocksHistory = s.stocksHistory || [];
        roundHistory = s.roundHistory || [];
        logsByRound = s.logsByRound || {};
        marketSentiment = (s.marketSentiment != null) ? s.marketSentiment : 0.5;
        if (s.stocks) {
            Object.keys(s.stocks).forEach(k => {
                if (!stocks[k]) return;
                Object.keys(s.stocks[k]).forEach(f => { stocks[k][f] = s.stocks[k][f]; });
            });
        }
    }
    window.xfwApplyState = applyState;

    function renderAll() {
        try {
            if (!Sync.chartsInited && typeof initCharts === 'function') { initCharts(); Sync.chartsInited = true; }
            if (typeof updateUI === 'function') updateUI();
            if (typeof updateStockStatus === 'function') updateStockStatus();
            if (typeof updatePlayersDisplay === 'function') updatePlayersDisplay();
            if (typeof updateLeaderboard === 'function') updateLeaderboard();
            if (typeof updateCharts === 'function') updateCharts();
            if (typeof updateDecisionUI === 'function') updateDecisionUI();
        } catch (e) { console.error('renderAll', e); }
    }
    window.xfwRenderAll = renderAll;

    function broadcastState() {
        if (mode() !== 'master') return;
        netBroadcastRaw({ type: 'state_sync', gameState: serializeState() });
    }
    window.xfwBroadcastState = broadcastState;

    // ============================================================
    //  房主端：消息处理
    // ============================================================
    function hostHandleMessage(peerId, msg) {
        switch (msg.type) {
            case 'join_request': hostOnJoin(peerId, msg); break;
            case 'player_action': hostOnAction(peerId, msg); break;
            case 'chat_message': {
                if (Net.muted.has(peerId)) {
                    netSendToPeer(peerId, { type: 'muted_notice' });
                    return;
                }
                netBroadcastRaw({ type: 'chat_message', fromPeerId: peerId, playerName: msg.playerName, text: msg.text, timestamp: Date.now() });
                break;
            }
            case 'mute_player': {
                if (msg.muted) Net.muted.add(msg.targetPeerId); else Net.muted.delete(msg.targetPeerId);
                netBroadcastRaw({ type: 'mute_player', targetPeerId: msg.targetPeerId, muted: msg.muted });
                break;
            }
            case 'ping': case 'pong': break;
        }
    }

    function hostOnJoin(peerId, msg) {
        let seat = Sync.seats.find(s => !s.isHost && s.name === msg.playerName);
        if (seat) {
            seat.peerId = peerId;
            seat.connected = true;
        } else {
            const idx = Sync.seats.length;
            seat = { peerId, name: msg.playerName, isHost: false, playerId: idx, connected: true };
            Sync.seats.push(seat);
        }
        const playerId = seat.playerId;

        netSendToPeer(peerId, {
            type: 'join_accepted',
            playerId: playerId,
            players: Sync.seats.map((s, i) => ({ seat: i, name: s.name, isHost: s.isHost }))
        });
        toast(`${msg.playerName} 已重连`, 'success', '🔌');
        renderReconnectWait();
        if (Sync.gameStarted) {
            netSendToPeer(peerId, { type: 'state_sync', gameState: serializeState() });
        }
        netBroadcastRaw({ type: 'player_joined', playerName: msg.playerName });
        maybeAutoStart();
    }

    function hostOnAction(peerId, msg) {
        if (!Sync.gameStarted) return;
        const seat = Sync.seats.find(s => s.peerId === peerId);
        if (!seat) return;
        const pid = seat.playerId;
        if (msg.actionType !== 'complete' && decisionState !== 'deciding') {
            netSendToPeer(peerId, { type: 'action_rejected', reason: '当前不在决策阶段' });
            return;
        }
        if (msg.actionType !== 'complete' && decidingPlayerId !== pid) {
            netSendToPeer(peerId, { type: 'action_rejected', reason: '现在不是你的回合' });
            return;
        }
        const d = msg.actionData || {};
        try {
            switch (msg.actionType) {
                case 'buy_stock': investStock(pid, d.stock, d.shares); break;
                case 'sell_stock': withdrawStock(pid, d.stock, d.shares); break;
                case 'buy_custom': investCustomStock(pid, d.stockId, d.amount); break;
                case 'sell_custom': withdrawCustomStock(pid, d.stockId, d.amount); break;
                case 'create_custom': createCustomStock(pid, d.name, d.maxUp, d.keep); break;
                case 'buy_lottery': buyLottery(pid, d.lotteryId, d.qty); break;
                case 'predict': makePrediction(pid, d.stock, d.direction, d.amount); break;
                case 'undo_predict': undoPrediction(pid); break;
                case 'complete': completeDecision(pid); break;
            }
            netSendToPeer(peerId, { type: 'action_accepted' });
        } catch (e) {
            netSendToPeer(peerId, { type: 'action_rejected', reason: e.message });
        }
        broadcastState();
        renderHostAdminPanel();
    }

    // ============================================================
    //  房主端：自动推进回合
    // ============================================================
    function seatConnectedForPlayer(pid) {
        const seat = Sync.seats[pid];
        if (!seat) return true;
        if (seat.isHost) return true;
        return !!seat.connected;
    }

    function hostAdvanceTurn() {
        if (!Sync.gameStarted || !gameActive) return;
        if (decisionState !== 'idle') return;
        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            if (p.bankrupt) continue;
            if (playerDecisionStatus[p.id] === 'done') continue;
            if (p.isAI || p.isExternal) { startDecision(p.id); return; }
            if (!seatConnectedForPlayer(p.id)) continue;
            startDecision(p.id);
            return;
        }
    }
    window.xfwAdvanceTurn = hostAdvanceTurn;

    // 包装核心函数：广播 + 推进
    function wrapHostHooks() {
        const origMark = markPlayerDone;
        markPlayerDone = function(pid) {
            origMark(pid);
            broadcastState();
            hostAdvanceTurn();
        };
        const origReset = resetDecisionState;
        resetDecisionState = function() {
            origReset();
            broadcastState();
            setTimeout(hostAdvanceTurn, 300);
        };
        const origClose = closeMarket;
        closeMarket = async function() {
            if (Sync.closing) return;
            Sync.closing = true;
            showCloseTimer(30);
            netBroadcastRaw({ type: 'market_close_timer', duration: 30 });
            await new Promise(r => setTimeout(r, 30000));
            hideCloseTimer();
            await origClose();
            Sync.closing = false;
            broadcastState();
        };
    }

    // ============================================================
    //  玩家端：包装操作函数为发送
    // ============================================================
    function wrapPlayerActions() {
        const acts = {
            investStock: (pid, stock, shares) => ['buy_stock', { stock, shares }],
            withdrawStock: (pid, stock, shares) => ['sell_stock', { stock, shares }],
            investCustomStock: (pid, stockId, amount) => ['buy_custom', { stockId, amount }],
            withdrawCustomStock: (pid, stockId, amount) => ['sell_custom', { stockId, amount }],
            createCustomStock: (pid, name, maxUp, keep) => ['create_custom', { name, maxUp, keep }],
            buyLottery: (pid, lotteryId, qty) => ['buy_lottery', { lotteryId, qty }],
            makePrediction: (pid, stock, direction, amount) => ['predict', { stock, direction, amount }],
            undoPrediction: (pid) => ['undo_predict', {}],
            completeDecision: (pid) => ['complete', {}]
        };
        Object.keys(acts).forEach(fnName => {
            const orig = window[fnName];
            if (typeof orig !== 'function') return;
            window[fnName] = function(playerId, ...args) {
                if (playerId !== Sync.myPlayerId) {
                    toast('现在不是你的回合', 'warning', '⏳');
                    return;
                }
                const [actionType, data] = acts[fnName](playerId, ...args);
                netSendToMaster({ type: 'player_action', actionType, actionData: data });
            };
        });
    }

    // ============================================================
    //  玩家端：消息处理
    // ============================================================
    function playerHandleMessage(fromPeerId, msg) {
        switch (msg.type) {
            case 'join_accepted':
                Sync.myPlayerId = msg.playerId;
                toast(`已进入游戏，你是 ${msg.playerId + 1} 号玩家`, 'success', '🎮');
                break;
            case 'state_sync':
                applyState(msg.gameState);
                if (document.getElementById('game-setup')) document.getElementById('game-setup').style.display = 'none';
                if (document.getElementById('game-main')) document.getElementById('game-main').style.display = 'block';
                renderAll();
                break;
            case 'market_close_timer':
                showCloseTimer(msg.duration || 30);
                setTimeout(hideCloseTimer, (msg.duration || 30) * 1000);
                break;
            case 'action_rejected':
                toast('操作被拒绝：' + msg.reason, 'warning', '⚠️');
                break;
            case 'action_accepted':
                break;
            case 'player_joined':
                if (window.Chat) Chat.appendSystem(`${msg.playerName} 加入了游戏`);
                break;
            case 'player_left':
                if (window.Chat) Chat.appendSystem('有玩家离开了游戏');
                break;
            case 'muted_notice':
                toast('你已被房主禁言', 'error', '🔇');
                break;
            case 'room_closed': case 'close_room':
                toast('房间已关闭：' + (msg.reason || ''), 'warning', '🚪');
                setTimeout(() => { window.location.href = 'index.html'; }, 2500);
                break;
            case 'chat_message':
                if (window.Chat) Chat.append(msg, false);
                break;
            case 'mute_player':
                toast('房主切换了禁言状态', 'info', '🔇');
                break;
        }
    }

    // ============================================================
    //  收盘倒计时浮层（所有端）
    // ============================================================
    function showCloseTimer(seconds) {
        hideCloseTimer();
        const ov = document.createElement('div');
        ov.id = 'close-timer-overlay';
        ov.className = 'close-timer-overlay';
        ov.innerHTML = `<div class="close-timer-box">
            <div style="font-size:1.1rem;color:var(--text-secondary);">📊 本轮收盘结算中</div>
            <div class="ct-count" id="ct-count">${seconds}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);">倒计时结束后进入下一轮</div>
        </div>`;
        document.body.appendChild(ov);
        let s = seconds;
        const el = document.getElementById('ct-count');
        Sync._ctTimer = setInterval(() => {
            s--;
            if (el) el.textContent = Math.max(0, s);
            if (s <= 0) { clearInterval(Sync._ctTimer); hideCloseTimer(); }
        }, 1000);
    }
    function hideCloseTimer() {
        const ov = document.getElementById('close-timer-overlay');
        if (ov) ov.remove();
        if (Sync._ctTimer) { clearInterval(Sync._ctTimer); Sync._ctTimer = null; }
    }
    window.xfwShowCloseTimer = showCloseTimer;

    // ============================================================
    //  房主重连等待界面
    // ============================================================
    function renderReconnectWait() {
        const root = document.getElementById('net-reconnect-root');
        if (!root) return;
        const rows = Sync.seats.map((s) => `
            <div class="waiting-player-item ${s.isHost ? 'host' : ''}">
                <span class="wp-dot" style="background:${s.isHost ? '#4fc3f7' : (s.connected ? '#66bb6a' : '#ef5350')};"></span>
                <span class="wp-name">${s.name}${s.isHost ? ' 👑(你)' : ''}</span>
                <span class="wp-tag">${s.isHost ? '' : (s.connected ? '已连接' : '等待重连…')}</span>
            </div>`).join('');
        const remoteAll = Sync.seats.filter(s => !s.isHost).every(s => s.connected);
        root.innerHTML = `
            <div class="mp-panel">
                <div class="mp-title">🔌 等待玩家进入游戏</div>
                <div class="waiting-player-list">${rows}</div>
                <button class="btn btn-success" id="mp-game-start-now" style="width:100%;margin-top:10px;">
                    ${remoteAll ? '🚀 全部就绪，开始！' : '🚀 立即开始（未连接者跳过）'}
                </button>
            </div>`;
        document.getElementById('mp-game-start-now').onclick = startMasterGame;
        if (remoteAll && !Sync.gameStarted) {
            setTimeout(startMasterGame, 800);
        }
    }
    window.xfwRenderReconnectWait = renderReconnectWait;

    function maybeAutoStart() { renderReconnectWait(); }

    // ============================================================
    //  房主端启动
    // ============================================================
    function startMasterGame() {
        if (Sync.gameStarted) return;
        Sync.gameStarted = true;
        const cfg = JSON.parse(localStorage.getItem('xfw_room_config') || '{}');
        const seats = cfg.seats || [];
        setVal('human-players', seats.length);
        setVal('ai-players', cfg.aiCount || 0);
        setVal('total-rounds', cfg.totalRounds || 60);
        // 重建外接AI配置（仅房主端运行）
        externalAIConfigs = [];
        const extN = cfg.extAiCount || 0;
        for (let i = 0; i < extN; i++) {
            externalAIConfigs.push({
                playerId: null, name: '外接AI-' + (i + 1), accessMode: 'command',
                apiKey: '', model: 'gpt-3.5-turbo', endpoint: 'https://api.openai.com/v1/chat/completions'
            });
        }
        // 初始化座位映射（boot 已按 cfg.seats 建立，这里补齐 playerId 并保留已连接的 peerId）
        if (!Sync.seats || !Sync.seats.length) {
            Sync.seats = (cfg.seats || []).map((s, i) => ({
                peerId: s.peerId, name: s.name, isHost: s.isHost,
                playerId: i, connected: s.isHost ? true : false
            }));
        } else {
            Sync.seats.forEach((s, i) => { s.playerId = i; });
        }
        Sync.myPlayerId = 0;

        initGame(false);
        Sync.seats.forEach((s, i) => { if (players[i]) players[i].name = s.name; });

        const root = document.getElementById('net-reconnect-root');
        if (root) root.innerHTML = '';

        wrapHostHooks();
        buildHostAdminPanel();
        renderAll();
        broadcastState();
        setTimeout(hostAdvanceTurn, 500);
        toast('游戏已开始！', 'success', '🚀');
    }
    window.xfwStartMasterGame = startMasterGame;

    function setVal(id, v) { const e = document.getElementById(id); if (e) e.value = v; }

    // ============================================================
    //  房主管理面板
    // ============================================================
    function buildHostAdminPanel() {
        let panel = document.getElementById('host-admin-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'host-admin-panel';
            panel.className = 'host-admin-panel';
            document.getElementById('game-main').appendChild(panel);
        }
        renderHostAdminPanel();
    }

    function renderHostAdminPanel() {
        const panel = document.getElementById('host-admin-panel');
        if (!panel) return;
        const rows = (players || []).map(p => {
            if (p.isAI || p.isExternal) return '';
            const seat = Sync.seats[p.id];
            const conn = seat && !seat.isHost ? (seat.connected ? '🟢' : '🔴') : '🟢';
            return `<div class="host-admin-row">
                <span class="har-name">${conn} ${p.name}${p.id === 0 ? ' 👑' : ''}</span>
                <button class="btn btn-warning btn-sm" data-act="skip" data-pid="${p.id}">⏭ 跳过回合</button>
                <button class="btn btn-danger btn-sm" data-act="mute" data-pid="${p.id}">🔇 禁言</button>
            </div>`;
        }).join('');
        panel.innerHTML = `
            <h3>🛠 房主管理</h3>
            ${rows}
            <div class="host-admin-row">
                <button class="btn btn-danger btn-sm" id="host-force-close" style="width:100%;">📊 强制收盘</button>
            </div>
            <div class="host-admin-row">
                <button class="btn btn-gold btn-sm" id="host-end-game" style="width:100%;">⏹ 结束游戏</button>
            </div>`;
        panel.querySelectorAll('button[data-act]').forEach(btn => {
            btn.onclick = () => {
                const pid = parseInt(btn.dataset.pid);
                if (btn.dataset.act === 'skip') {
                    if (playerDecisionStatus[pid] !== 'done') {
                        markPlayerDone(pid);
                        toast(`已跳过 ${players[pid].name} 的回合`, 'info', '⏭');
                    }
                } else if (btn.dataset.act === 'mute') {
                    const seat = Sync.seats[pid];
                    if (seat && !seat.isHost && seat.peerId) {
                        const muted = !Net.muted.has(seat.peerId);
                        if (muted) Net.muted.add(seat.peerId); else Net.muted.delete(seat.peerId);
                        netBroadcastRaw({ type: 'mute_player', targetPeerId: seat.peerId, muted });
                        toast(muted ? `已禁言 ${players[pid].name}` : `已解除禁言 ${players[pid].name}`, 'info', '🔇');
                    }
                }
            };
        });
        const fc = document.getElementById('host-force-close');
        if (fc) fc.onclick = () => {
            (players || []).forEach(p => { if (playerDecisionStatus[p.id] !== 'done') markPlayerDone(p.id); });
            decisionState = 'all_done';
            if (typeof updateCloseMarketButton === 'function') updateCloseMarketButton();
            closeMarket();
        };
        const eg = document.getElementById('host-end-game');
        if (eg) eg.onclick = () => {
            if (typeof endGame === 'function') endGame();
            netBroadcastRaw({ type: 'state_sync', gameState: serializeState() });
        };
    }

    // ============================================================
    //  启动入口
    // ============================================================
    function boot() {
        const m = mode();
        if (m === 'master') {
            const cfg = JSON.parse(localStorage.getItem('xfw_room_config') || '{}');
            if (!cfg.code) { toast('未找到房间配置', 'error', '❌'); return; }
            Sync.seats = (cfg.seats || []).map((s, i) => ({
                peerId: s.isHost ? 'HOST' : null, name: s.name, isHost: s.isHost,
                playerId: i, connected: s.isHost ? true : false
            }));
            let root = document.getElementById('net-reconnect-root');
            if (!root) {
                root = document.createElement('div');
                root.id = 'net-reconnect-root';
                document.querySelector('.container').appendChild(root);
            }
            renderReconnectWait();
            netHostCreate(cfg.code, cfg.signal).then(() => {
                Net.onMessage = hostHandleMessage;
                toast('房间已就绪，等待玩家重连…', 'info', '🔌');
            }).catch(() => {});
        } else if (m === 'player') {
            const my = JSON.parse(localStorage.getItem('xfw_myseat') || '{}');
            if (!my.code) { toast('未找到房间信息，请从大厅加入', 'error', '❌'); return; }
            wrapPlayerActions();
            if (document.getElementById('game-setup')) document.getElementById('game-setup').style.display = 'none';
            const signal = (window.SIGNAL_SERVERS || [])[0];
            netPlayerJoin(my.code, signal, my.yourName).then(() => {
                Net.onMessage = playerHandleMessage;
                toast('已连接房主，等待游戏开始…', 'info', '🔌');
            }).catch(() => {});
        }
    }
    window.xfwBootSync = boot;

    window.onAllModulesLoaded = () => {
        if (typeof window.xfwBootSync === 'function') window.xfwBootSync();
    };
})();
