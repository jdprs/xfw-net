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
        lastSeq: 0,
        // v10.8: 收盘确认制状态（所有端共用）
        roundConfirm: null,
        myConfirmSent: false
    };
    window.Sync = Sync;

    function toast(m, t, title) { if (typeof showBanner === 'function') showBanner(m, t || 'info', null, title || ''); }
    function mode() { return window.GAME_MODE || 'local'; }

    // ============================================================
    //  页面级加载浮层（v10.1：玩家端连接/等待期间给出反馈）
    // ============================================================
    function showPageLoading(text) {
        hidePageLoading();
        const ov = document.createElement('div');
        ov.id = 'mp-page-loading';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:2600;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;backdrop-filter:blur(3px);';
        // v10.5: 加载遮罩内提供返回大厅按钮——连接中/失败时状态栏被遮罩挡住，玩家也能随时退出
        ov.innerHTML = '<div class="mp-loader"></div><div class="mp-loading-text" id="mp-page-loading-text">' + (text || '加载中…') + '</div>' +
            '<button class="btn btn-warning" id="mp-loading-home" onclick="window.xfwReturnHome()">🏠 返回大厅</button>';
        document.body.appendChild(ov);
    }
    function hidePageLoading() {
        const el = document.getElementById('mp-page-loading');
        if (el) el.remove();
    }
    function updatePageLoadingText(text) {
        const t = document.getElementById('mp-page-loading-text');
        if (t) t.textContent = text;
    }
    window.xfwShowPageLoading = showPageLoading;
    window.xfwHidePageLoading = hidePageLoading;
    window.xfwUpdatePageLoadingText = updatePageLoadingText;

    // ============================================================
    //  返回大厅（v10.1：联机页顶部状态栏按钮 / 结束后返回主页）
    // ============================================================
    function xfwReturnHome() {
        try { if (typeof netClose === 'function') netClose(); } catch(e) {}
        hidePageLoading();
        const chatPanel = document.getElementById('chat-panel');
        if (chatPanel) chatPanel.remove();
        if (window.Chat) { window.Chat.panel = null; window.Chat.body = null; window.Chat.history = []; }
        const bar = document.querySelector('.net-status-bar');
        if (bar) bar.remove();
        const rr = document.getElementById('net-reconnect-root');
        if (rr) rr.remove();
        const ct = document.getElementById('close-timer-overlay');
        if (ct) ct.remove();
        const ov = document.getElementById('mp-overlay');
        if (ov) ov.remove();
        location.href = 'index.html';
    }
    window.xfwReturnHome = xfwReturnHome;

    function goLobbyAfter(msg) {
        toast(msg || '即将返回大厅', 'warning', '🏠');
        setTimeout(function() { location.href = 'index.html'; }, 1500);
    }
    window.xfwGoLobbyAfter = goLobbyAfter;

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
            case 'round_confirm': hostOnRoundConfirm(peerId); break;
            case 'chat_message': {
                if (Net.muted.has(peerId)) {
                    netSendToPeer(peerId, { type: 'muted_notice' });
                    return;
                }
                // v10.5: 房主端本地显示玩家消息，并转发给其他玩家（排除发送者，避免其重复显示）
                if (window.Chat && typeof Chat.append === 'function') Chat.append({ playerName: msg.playerName, text: msg.text, timestamp: Date.now() }, false);
                netBroadcastRaw({ type: 'chat_message', fromPeerId: peerId, playerName: msg.playerName, text: msg.text, timestamp: Date.now() }, peerId);
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
            // v10.8: 若正处于收盘确认阶段，把确认状态补发给重连玩家
            const c = Sync.roundConfirm;
            if (c && c.active && seat.playerId !== 0) {
                if (c.needed.indexOf(seat.playerId) === -1) c.needed.push(seat.playerId);
                netSendToPeer(peerId, { type: 'round_confirm_state', needed: c.needed.slice(), confirmed: Object.assign({}, c.confirmed), timeoutSec: c.timeoutSec });
                renderConfirmBanner();
            }
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
                case 'cancel': cancelDecision(pid); break;
            }
            netSendToPeer(peerId, { type: 'action_accepted' });
        } catch (e) {
            netSendToPeer(peerId, { type: 'action_rejected', reason: e.message });
        }
        broadcastState();
        renderHostAdminPanel();
    }

    // ============================================================
    //  房主端：自动推进回合（v10.3：房主先决策 → 房主指定下一位决策者）
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
        // 1) 房主先决策（每轮优先）
        const host = players.find(p => p.id === 0);
        if (host && !host.bankrupt && playerDecisionStatus[0] !== 'done') {
            startDecision(0);
            return;
        }
        // 2) 房主已完成 → 全部（含 AI/外接）由房主指定，不再自动决策
        const hasPending = players.some(p => !p.bankrupt && playerDecisionStatus[p.id] !== 'done');
        if (!hasPending) return;
        decisionState = 'host_select';
        decidingPlayerId = null;
        updateDecisionUI();
        broadcastState();
    }
    window.xfwAdvanceTurn = hostAdvanceTurn;

    // v10.4: 房主在 host_select 状态点选下一位决策者（真人/AI/外接均由房主决定）
    function hostPickNext(pid) {
        if (!Sync.gameStarted || !gameActive) return;
        if (decisionState !== 'host_select') return;
        const p = players.find(x => x.id === pid);
        if (!p || p.bankrupt) return;
        if (playerDecisionStatus[pid] === 'done') return;
        startDecision(pid);
        broadcastState();
    }
    window.xfwHostPickNext = hostPickNext;

    // 包装核心函数：广播 + 推进
    function wrapHostHooks() {
        // v10.5: 横幅与事件弹窗同步到玩家端（外接AI面板等房主专属内容不同步）
        const origBanner = showBanner;
        showBanner = function(message, type, duration, title) {
            origBanner(message, type, duration, title);
            try {
                netBroadcastRaw({ type: 'banner', text: message || '', btype: type || 'info', title: title || '' });
            } catch (e) {}
        };
        const origEventModal = showEventModal;
        showEventModal = function(evt) {
            try {
                if (evt) netBroadcastRaw({ type: 'event_modal', event: { name: evt.name, desc: evt.desc, icon: evt.icon, type: evt.type, stockName: evt.stockName || '市场' } });
            } catch (e) {}
            return origEventModal(evt);
        };
        // v10.3: 房主启动某玩家回合后立即广播，玩家端才能知道「轮到自己」
        const origStart = startDecision;
        startDecision = function(pid) {
            const before = decisionState;
            origStart(pid);
            if (before !== decisionState) broadcastState();
        };
        const origMark = markPlayerDone;
        markPlayerDone = function(pid) {
            origMark(pid);
            broadcastState();
            hostAdvanceTurn();
        };
        // v10.3: 取消决策后回到「房主指定」状态并广播
        const origCancel = cancelDecision;
        cancelDecision = function(pid) {
            origCancel(pid);
            broadcastState();
            setTimeout(hostAdvanceTurn, 300);
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
            // v10.8: 结算立即执行；收盘确认阶段（30 秒倒计时）由 origClose 内部的 hostBeginConfirm 接管
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
            completeDecision: (pid) => ['complete', {}],
            cancelDecision: (pid) => ['cancel', {}]
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
                updatePageLoadingText('已连接房主，等待游戏开始…');
                toast(`已进入游戏，你是 ${msg.playerId + 1} 号玩家`, 'success', '🎮');
                break;
            case 'state_sync':
                applyState(msg.gameState);
                if (document.getElementById('game-setup')) document.getElementById('game-setup').style.display = 'none';
                if (document.getElementById('game-main')) document.getElementById('game-main').style.display = 'block';
                hidePageLoading();
                if (window.chatActivate) chatActivate();
                renderAll();
                break;
            case 'market_close_timer':
                showCloseTimer(msg.duration || 30);
                setTimeout(hideCloseTimer, (msg.duration || 30) * 1000);
                break;
            // v10.8: 收盘总结——玩家点「确认」后由房主汇总，全部确认后进入下一轮
            case 'round_summary':
                Sync.myConfirmSent = false;
                showInfoModal(msg.title || '📊 收盘总结', msg.summary || '', null);
                {
                    const ok = document.getElementById('info-modal-ok');
                    if (ok) {
                        ok.textContent = '✅ 确认继续';
                        ok.style.display = '';
                        ok.disabled = false;
                        ok.onclick = function() { playerConfirmSelf(); };
                    }
                }
                break;
            // v10.8: 确认进度同步（房主 → 玩家）
            case 'round_confirm_state':
                Sync.roundConfirm = {
                    active: true,
                    needed: msg.needed || [],
                    confirmed: msg.confirmed || {},
                    timeoutSec: msg.timeoutSec || 30,
                    remainSec: msg.timeoutSec || 30,
                    _countdownTimer: null
                };
                {
                    const ok = document.getElementById('info-modal-ok');
                    if (ok && msg.confirmed && msg.confirmed[Sync.myPlayerId]) {
                        ok.textContent = '✓ 已确认，等待其他玩家…';
                        ok.disabled = true;
                    }
                }
                renderConfirmBanner();
                startConfirmCountdown();
                break;
            // v10.8: 全部确认 → 关闭收盘总结，进入下一轮
            case 'round_all_confirmed':
                stopConfirmCountdown();
                hideConfirmWaitBanner();
                {
                    const modal = document.getElementById('info-modal');
                    if (modal) modal.classList.remove('active');
                    document.body.classList.remove('modal-open');
                }
                break;
            // v10.5: 横幅同步（房主 → 玩家）
            case 'banner':
                if (typeof showBanner === 'function') showBanner(msg.text, msg.btype || 'info', null, msg.title || '');
                break;
            // v10.5: 随机事件弹窗同步
            case 'event_modal':
                if (msg.event && typeof showEventModal === 'function') showEventModal(msg.event);
                break;
            // v10.5: 游戏结束（强制结束/最后一轮），同步结果弹窗与横幅
            case 'game_ended':
                // v10.8: 清理收盘确认残留（横幅 / 收盘总结弹窗）
                stopConfirmCountdown();
                hideConfirmWaitBanner();
                {
                    const im = document.getElementById('info-modal');
                    if (im) im.classList.remove('active');
                    document.body.classList.remove('modal-open');
                }
                if (typeof showBanner === 'function') showBanner(msg.forced ? '房主已结束本轮游戏' : '🏁 游戏结束，查看最终排名', msg.forced ? 'warning' : 'info', null, '⏹ 游戏结束');
                if (msg.winner && typeof document !== 'undefined') {
                    const wm = document.getElementById('winner-message');
                    const rl = document.getElementById('ranking-list');
                    if (wm) wm.innerHTML = msg.winner;
                    if (rl) {
                        rl.innerHTML = '';
                        (msg.rankings || []).forEach((p, i) => {
                            const div = document.createElement('div');
                            div.className = 'ranking-item';
                            const badge = p.achieveCount > 0 ? `<span class="achieve-badge">🏅${p.achieveCount}</span>` : '';
                            if (p.bankrupt) {
                                div.innerHTML = `<div><span class="rank-number">💀</span><strong>${p.name}</strong> 破产 ${badge}</div><div>¥0</div>`;
                            } else {
                                const tag = p.isAI ? ` (${p.aiStrategy || ''})` : p.isExternal ? ' 🌐' : '';
                                div.innerHTML = `<div><span class="rank-number">#${i + 1}</span><strong>${p.name}${tag}</strong> ${badge} <span class="rating-badge rating-${p.rating || 'D'}">${p.rating || 'D'}</span></div><div>${p.total}</div>`;
                            }
                            rl.appendChild(div);
                        });
                    }
                    const rm = document.getElementById('results-modal');
                    if (rm) { rm.style.display = 'flex'; document.body.classList.add('modal-open'); }
                }
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
    window.xfwHideCloseTimer = hideCloseTimer;

    // ============================================================
    //  收盘确认制（v10.8，所有端）
    //  流程：收盘结算后每个真人玩家点「确认」→ 房主收集全部确认 → 进入下一轮
    //        30 秒未确认自动确认；先确认者看到等待横幅
    // ============================================================

    function confirmBannerText() {
        const c = Sync.roundConfirm;
        if (!c || !c.active) return '';
        const total = (c.needed || []).length;
        if (total <= 0) return '';
        const done = (c.needed || []).filter(id => c.confirmed && c.confirmed[id]).length;
        const sec = (c.remainSec != null) ? c.remainSec : (c.timeoutSec || 30);
        if (done >= total) return '';
        return `⏳ 等待玩家确认… ${done}/${total}（${sec}s 后自动确认）`;
    }
    function renderConfirmBanner() {
        const t = confirmBannerText();
        if (!t) { hideConfirmWaitBanner(); return; }
        let el = document.getElementById('confirm-wait-banner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'confirm-wait-banner';
            el.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:3000;' +
                'background:var(--bg-card,#1f2937);border:2px solid #f59e0b;color:#fde68a;' +
                'padding:10px 22px;border-radius:12px;font-size:0.95rem;box-shadow:0 8px 24px rgba(0,0,0,0.45);' +
                'white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis;';
            document.body.appendChild(el);
        }
        el.textContent = t;
        el.style.display = 'block';
    }
    function hideConfirmWaitBanner() {
        const el = document.getElementById('confirm-wait-banner');
        if (el) el.style.display = 'none';
    }
    window.xfwHideConfirmWaitBanner = hideConfirmWaitBanner;

    function startConfirmCountdown() {
        const c = Sync.roundConfirm;
        if (!c) return;
        c.remainSec = c.timeoutSec || 30;
        stopConfirmCountdown();
        c._countdownTimer = setInterval(function() {
            if (!c.active) { stopConfirmCountdown(); return; }
            c.remainSec = Math.max(0, c.remainSec - 1);
            renderConfirmBanner();
            if (c.remainSec <= 0) stopConfirmCountdown();
        }, 1000);
    }
    function stopConfirmCountdown() {
        const c = Sync.roundConfirm;
        if (c && c._countdownTimer) { clearInterval(c._countdownTimer); c._countdownTimer = null; }
    }

    // ---- 房主端：权威收集确认 ----
    function hostBeginConfirm() {
        if (!Sync.gameStarted || !gameActive) return;
        if (Sync.roundConfirm && Sync.roundConfirm.active) return;
        // 需要确认的玩家：所有在线真人玩家（含房主；AI / 外接 AI / 断线玩家不需要确认）
        const needed = players.filter(function(p) {
            if (p.isAI || p.isExternal) return false;
            if (p.id === 0) return true;
            const seat = Sync.seats[p.id];
            return seat && seat.connected;
        }).map(p => p.id);
        Sync.roundConfirm = {
            active: true,
            needed: needed,
            confirmed: {},
            timeoutSec: 30,
            remainSec: 30,
            _countdownTimer: null,
            timer: null
        };
        // 房主端确认按钮
        const okBtn = document.getElementById('info-modal-ok');
        if (okBtn) {
            okBtn.textContent = '✅ 确认继续';
            okBtn.style.display = '';
            okBtn.disabled = false;
            okBtn.onclick = function() { hostConfirmSelf(); };
        }
        renderConfirmBanner();
        startConfirmCountdown();
        netBroadcastRaw({ type: 'round_confirm_state', needed: needed.slice(), confirmed: {}, timeoutSec: 30 });
        Sync.roundConfirm.timer = setTimeout(hostConfirmTimeout, 30000);
    }
    window.hostBeginConfirm = hostBeginConfirm;

    function hostConfirmSelf() {
        const c = Sync.roundConfirm;
        if (!c || !c.active) return;
        c.confirmed[0] = true;
        const okBtn = document.getElementById('info-modal-ok');
        if (okBtn) { okBtn.textContent = '✓ 已确认，等待其他玩家…'; okBtn.disabled = true; }
        renderConfirmBanner();
        netBroadcastRaw({ type: 'round_confirm_state', needed: c.needed.slice(), confirmed: Object.assign({}, c.confirmed), timeoutSec: c.timeoutSec });
        hostTryAdvance();
    }
    window.hostConfirmSelf = hostConfirmSelf;

    function hostOnRoundConfirm(peerId) {
        const c = Sync.roundConfirm;
        if (!c || !c.active) return;
        const seat = Sync.seats.find(s => s.peerId === peerId);
        if (!seat) return;
        if (c.needed.indexOf(seat.playerId) === -1) return;
        c.confirmed[seat.playerId] = true;
        renderConfirmBanner();
        netBroadcastRaw({ type: 'round_confirm_state', needed: c.needed.slice(), confirmed: Object.assign({}, c.confirmed), timeoutSec: c.timeoutSec });
        hostTryAdvance();
    }

    function hostTryAdvance() {
        const c = Sync.roundConfirm;
        if (!c || !c.active) return;
        const allIn = c.needed.every(id => c.confirmed[id]);
        if (!allIn) return;
        finishConfirmRound(false);
    }

    function hostConfirmTimeout() {
        const c = Sync.roundConfirm;
        if (!c || !c.active) return;
        // 30 秒到：未确认玩家自动确认
        c.needed.forEach(id => { if (!c.confirmed[id]) c.confirmed[id] = true; });
        if (typeof showBanner === 'function') showBanner('⏰ 30 秒已到，自动确认进入下一轮', 'info', null, '⏰ 自动确认');
        finishConfirmRound(true);
    }

    function finishConfirmRound(auto) {
        const c = Sync.roundConfirm;
        if (!c) return;
        c.active = false;
        if (c.timer) { clearTimeout(c.timer); c.timer = null; }
        stopConfirmCountdown();
        netBroadcastRaw({ type: 'round_all_confirmed', auto: !!auto });
        hideConfirmWaitBanner();
        // 关闭本地模态框并推进下一轮
        const modal = document.getElementById('info-modal');
        if (modal) modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        if (typeof window._onRoundAdvance === 'function') {
            try { window._onRoundAdvance(); } catch (e) { console.error('advance round', e); }
        }
    }

    // ---- 玩家端：点击确认发送给房主 ----
    function playerConfirmSelf() {
        if (Sync.myConfirmSent) return;
        Sync.myConfirmSent = true;
        const ok = document.getElementById('info-modal-ok');
        if (ok) { ok.textContent = '✓ 已确认，等待其他玩家…'; ok.disabled = true; }
        netSendToMaster({ type: 'round_confirm' });
        const c = Sync.roundConfirm;
        const total = (c && c.needed && c.needed.length) ? c.needed.length : 1;
        let el = document.getElementById('confirm-wait-banner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'confirm-wait-banner';
            el.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:3000;' +
                'background:var(--bg-card,#1f2937);border:2px solid #f59e0b;color:#fde68a;' +
                'padding:10px 22px;border-radius:12px;font-size:0.95rem;box-shadow:0 8px 24px rgba(0,0,0,0.45);' +
                'white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis;';
            document.body.appendChild(el);
        }
        el.textContent = `✅ 你已确认（1/${total}），等待其他玩家…`;
        el.style.display = 'block';
    }
    window.playerConfirmSelf = playerConfirmSelf;
    window.xfwPlayerConfirmSelf = playerConfirmSelf;

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
        // v10.8: 新游戏重置收盘确认状态
        Sync.roundConfirm = null;
        Sync.myConfirmSent = false;
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
        if (window.chatActivate) chatActivate();
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
                        netBroadcastRaw({ type: 'mute_player', targetPeerId: seat.peerId, muted: muted });
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
            // v10.5: 强制结束，玩家端同步「房主已结束本轮游戏」横幅与排名弹窗
            if (typeof endGame === 'function') endGame(true);
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
            // v10.1: 无房间配置（如浏览器恢复历史标签页）时直接回大厅，不残留开始界面
            if (!cfg.code) {
                goLobbyAfter('未找到房间配置，即将返回大厅');
                return;
            }
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
            }).catch(() => {
                goLobbyAfter('房间恢复失败，即将返回大厅');
            });
        } else if (m === 'player') {
            const my = JSON.parse(localStorage.getItem('xfw_myseat') || '{}');
            // v10.1: 无房间信息（浏览器恢复历史标签页/房间已失效）时直接回大厅
            if (!my.code) {
                goLobbyAfter('未找到房间信息，即将返回大厅');
                return;
            }
            wrapPlayerActions();
            // v10.6: 记录玩家名供聊天等展示（玩家页无 Lobby.username）
            Sync.myName = my.yourName || '玩家';
            if (document.getElementById('game-setup')) document.getElementById('game-setup').style.display = 'none';
            showPageLoading('正在连接房主…');
            // v10.7 修复：与大厅加入策略一致，遍历所有公共信令服务器。
            // 房主重建游戏页时用的是创建房间时选择的信令服务器（cfg.signal），不一定是 [0]；
            // 之前硬编码 [0] 会导致房主在其它信令服务器时玩家永远 peer-unavailable、连不上。
            const servers = (window.SIGNAL_SERVERS || []).filter(function (s) { return !s.custom; });
            (async () => {
                for (let i = 0; i < servers.length; i++) {
                    const signal = servers[i];
                    updatePageLoadingText('正在通过 ' + signal.label + ' 连接房主…（' + (i + 1) + '/' + servers.length + '）');
                    try {
                        await netPlayerJoin(my.code, signal, my.yourName);
                        Net.onMessage = playerHandleMessage;
                        updatePageLoadingText('已连接房主，等待游戏开始…');
                        toast('已连接房主，等待游戏开始…', 'info', '🔌');
                        return;
                    } catch (e) {
                        try { netClose(); } catch (_) {}
                    }
                }
                hidePageLoading();
                goLobbyAfter('无法连接房主（房间可能已关闭），即将返回大厅');
            })();
        }
    }
    window.xfwBootSync = boot;

    // v10.5: 暴露消息处理入口（供测试/调试/扩展使用）
    window.playerHandleMessage = playerHandleMessage;
    window.hostHandleMessage = hostHandleMessage;

    window.onAllModulesLoaded = () => {
        if (typeof window.xfwBootSync === 'function') window.xfwBootSync();
    };
})();
