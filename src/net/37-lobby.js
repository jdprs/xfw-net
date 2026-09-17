/* ================================================================
 * 37. 大厅与房间系统 (v10.0)
 * 负责：用户名、创建房间、加入房间、等待室、倒计时
 * 在 index.html（大厅）以及联机阶段的房主/玩家页面都可加载，
 * 通过检测 DOM 元素是否存在决定是否初始化大厅 UI。
 *
 * v10.0 修复：所有弹窗按钮统一使用 inline onclick + window 全局函数，
 * 避免动态 innerHTML 后 .onclick 赋值失效导致按钮点不动的问题。
 *
 * v10.9: 移除「广场」（公开房间列表）功能。kvdb.io 已不可匿名写，
 * 后续临时接入的 extendsclass 免费 bin 也有限流与稳定性问题，
 * 现统一改为仅通过 6 位房间号直连，不再保留公开房间列表。
 * ================================================================
 */
(() => {
    // 调试用：?reset=1 清除保存的用户名，强制弹出用户名弹窗
    if (location.search.indexOf('reset=1') >= 0) {
        try { localStorage.removeItem('xfw_username'); } catch(e) {}
    }
    const WAIT_MAX_SECONDS = 5 * 60; // 5 分钟等待上限

    const Lobby = {
        username: localStorage.getItem('xfw_username') || '',
        lobbyPlayers: [],   // {peerId, name, isHost, online}
        roomConfig: null,
        countdownTimer: null,
        waitSeconds: WAIT_MAX_SECONDS,
        mySeatId: null,     // player 端：自己分配到的 playerId
        joining: false
    };
    window.Lobby = Lobby;

    function genRoomCode() {
        let code = '';
        for (let i = 0; i < 6; i++) code += Math.floor(Math.random() * 10);
        return code;
    }

    function toast(msg, type, title) {
        try {
            if (typeof showBanner === 'function') showBanner(msg, type || 'info', null, title || '');
        } catch (e) { console.warn('toast error:', e); }
    }

    // 仅在大厅页初始化
    function isLobbyPage() {
        const mode = window.GAME_MODE || 'local';
        return !!document.getElementById('mp-lobby-root') && mode !== 'master' && mode !== 'player';
    }

    function el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    }

    // ---------- 打开大厅覆盖层 ----------
    function openOverlay() {
        let ov = document.getElementById('mp-overlay');
        if (ov) return ov;
        ov = el('div', 'mp-overlay');
        ov.id = 'mp-overlay';
        // 与游戏内 password-modal 完全一致：z-index 2001 + backdrop-filter
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:2001;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);overflow-y:auto;padding:16px;';
        document.body.appendChild(ov);
        return ov;
    }
    function closeOverlay() {
        const ov = document.getElementById('mp-overlay');
        if (ov) ov.remove();
        stopTimers();
    }
    function stopTimers() {
        if (Lobby.countdownTimer) clearInterval(Lobby.countdownTimer);
        Lobby.countdownTimer = null;
    }
    window.lobbyCloseOverlay = closeOverlay;

    function box(innerHtml) {
        const ov = openOverlay();
        ov.innerHTML = '';
        const b = el('div', 'mp-panel');
        b.style.cssText = 'max-width:460px;width:100%;max-height:90vh;overflow-y:auto;';
        b.innerHTML = innerHtml;
        ov.appendChild(b);
        // 点击遮罩层空白处关闭（点击面板内不关闭）
        ov.onclick = function(e) { if (e.target === ov) closeOverlay(); };
        return b;
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ---------- 加载动画浮层（v10.1：网络操作期间给出明确反馈） ----------
    let _loadingEl = null;
    function showLoading(text) {
        hideLoading();
        const ov = document.createElement('div');
        ov.id = 'mp-loading-overlay';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:3000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;backdrop-filter:blur(3px);';
        ov.innerHTML = '<div class="mp-loader"></div><div class="mp-loading-text" id="mp-loading-text">' + esc(text || '加载中…') + '</div>';
        document.body.appendChild(ov);
        _loadingEl = ov;
    }
    function hideLoading() {
        if (_loadingEl) { _loadingEl.remove(); _loadingEl = null; }
    }
    function updateLoadingText(text) {
        const t = document.getElementById('mp-loading-text');
        if (t) t.textContent = text;
    }
    window.mpShowLoading = showLoading;
    window.mpHideLoading = hideLoading;
    window.mpUpdateLoadingText = updateLoadingText;

    // ---------- 返回主页（大厅 overlay 内使用） ----------
    function mpGoHome() {
        try { if (typeof netClose === 'function') netClose(); } catch(e) {}
        stopTimers();
        location.href = 'index.html';
    }
    window.mpGoHome = mpGoHome;

    // ---------- 用户名 ----------
    function askUsername(next) {
        if (Lobby.username) { next && next(); return; }
        Lobby._nextAfterUsername = next;
        box(`
            <div class="mp-title">👤 输入你的游戏昵称</div>
            <div class="mp-field"><input type="text" id="mp-username" maxlength="12" placeholder="昵称（可不唯一，仅作辨识）" value="${esc(Lobby.username)}" autofocus onkeydown="if(event.key==='Enter')window.mpUsernameOk()"></div>
            <div class="btn-row">
                <button class="btn btn-success" onclick="window.mpUsernameOk()">✅ 确认</button>
                <button class="btn btn-warning" onclick="window.lobbyCloseOverlay()">返回</button>
            </div>
            <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:8px;text-align:center;">昵称不需要唯一，仅用于房间内辨识</div>`);
    }

    function mpUsernameOk() {
        try {
            const inp = document.getElementById('mp-username');
            const v = inp ? inp.value.trim() : '';
            if (!v) { toast('请输入昵称', 'warning', '⚠️'); return; }
            Lobby.username = v;
            localStorage.setItem('xfw_username', v);
            const next = Lobby._nextAfterUsername;
            Lobby._nextAfterUsername = null;
            if (next) next();
        } catch (e) {
            console.error('mpUsernameOk error:', e);
            toast('操作出错：' + e.message, 'error', '❌');
        }
    }

    // ---------- 主菜单 ----------
    function showMainMenu() {
        box(`
            <div class="mp-title">🌐 联机大厅</div>
            <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:10px;">当前昵称：<strong style="color:var(--accent-gold);">${esc(Lobby.username)}</strong> <a href="javascript:void(0)" id="mp-change-username" onclick="window.mpChangeUsername()" style="font-size:0.75rem;color:var(--text-secondary);margin-left:6px;">修改昵称</a></p>
            <div class="flex-row mb-8">
                <button class="btn btn-success flex-grow" onclick="window.mpShowCreateForm()">➕ 创建房间</button>
                <button class="btn btn-primary flex-grow" onclick="window.mpShowJoinForm()">🔍 加入房间</button>
            </div>
            <button class="btn btn-outline" onclick="window.lobbyCloseOverlay()" style="width:100%;">返回单机设置</button>
            <button class="btn btn-outline" onclick="window.mpGoHome()" style="width:100%;margin-top:6px;">🏠 返回主页</button>`);
    }

    function mpChangeUsername() {
        Lobby.username = '';
        localStorage.removeItem('xfw_username');
        askUsername(showMainMenu);
    }

    // ---------- 创建房间表单 ----------
    function showCreateForm() {
        const serverOpts = (window.SIGNAL_SERVERS || []).map(function(s, i) {
            return '<option value="' + i + '">' + esc(s.label) + '</option>';
        }).join('');
        box(`
            <div class="mp-title">➕ 创建房间</div>
            <div class="mp-field"><label>房间名</label><input type="text" id="mp-room-name" maxlength="20" placeholder="如：周末炒股局" value="${esc(Lobby.username + '的房间')}"></div>
            <div class="flex-row">
                <div class="mp-field flex-grow"><label>内置AI数</label><input type="number" id="mp-ai" min="0" max="3" value="1"></div>
                <div class="mp-field flex-grow"><label>外接AI数</label><input type="number" id="mp-extai" min="0" max="2" value="0"></div>
            </div>
            <div class="flex-row">
                <div class="mp-field flex-grow"><label>最多玩家(含房主)</label><input type="number" id="mp-maxp" min="2" max="6" value="4"></div>
                <div class="mp-field flex-grow"><label>总轮数</label><input type="number" id="mp-rounds" min="10" max="200" value="60"></div>
            </div>
            <div class="mp-field"><label>信令服务器（P2P连接用，免费）</label><select id="mp-signal" onchange="window.mpSignalChange(this.value)">${serverOpts}</select></div>
            <div class="mp-field" id="mp-custom-host-wrap" style="display:none;">
                <label>自建服务器 host:port:path</label>
                <input type="text" id="mp-custom-host" placeholder="如：example.com:9000:myroom">
            </div>
            <div class="flex-row mt-8">
                <button class="btn btn-success flex-grow" onclick="window.mpDoCreate()">🚀 创建房间</button>
                <button class="btn btn-warning" onclick="window.mpShowMainMenu()">返回</button>
            </div>`);
    }

    function mpSignalChange(val) {
        const s = (window.SIGNAL_SERVERS || [])[parseInt(val)];
        const wrap = document.getElementById('mp-custom-host-wrap');
        if (wrap) wrap.style.display = (s && s.custom) ? 'block' : 'none';
    }

    function parseSignal(selectedIdx) {
        const s = (window.SIGNAL_SERVERS || [])[selectedIdx] || (window.SIGNAL_SERVERS && window.SIGNAL_SERVERS[0]);
        if (!s) return { host: '0.peerjs.com', port: 443, secure: true, path: '/', key: 'peerjs' };
        if (!s.custom) return { host: s.host, port: s.port, secure: s.secure, path: '/', key: 'peerjs' };
        const raw = (document.getElementById('mp-custom-host') || {}).value || '';
        const parts = raw.trim().split(':');
        const host = parts[0] || 'localhost';
        const port = parseInt(parts[1] || '9000');
        const path = parts[2] ? '/' + parts[2] : '/';
        return { host, port, secure: location.protocol === 'https:', path, key: 'peerjs' };
    }

    function clampInt(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

    async function mpDoCreate() {
        try {
            const roomName = (document.getElementById('mp-room-name') || {}).value || (Lobby.username + '的房间');
            const aiCount = clampInt(parseInt((document.getElementById('mp-ai') || {}).value) || 0, 0, 3);
            const extAiCount = clampInt(parseInt((document.getElementById('mp-extai') || {}).value) || 0, 0, 2);
            const maxPlayers = clampInt(parseInt((document.getElementById('mp-maxp') || {}).value) || 2, 2, 6);
            const totalRounds = clampInt(parseInt((document.getElementById('mp-rounds') || {}).value) || 60, 10, 200);
            const signalIdx = parseInt((document.getElementById('mp-signal') || {}).value) || 0;
            const signal = parseSignal(signalIdx);

            const code = genRoomCode();
            Lobby.roomConfig = {
                roomName: roomName.trim() || (Lobby.username + '的房间'),
                hostName: Lobby.username, code, aiCount, extAiCount,
                maxPlayers, totalRounds, signal, createdAt: Date.now()
            };
            Lobby.lobbyPlayers = [{ peerId: 'HOST', name: Lobby.username, isHost: true, online: true }];

            showLoading('正在创建房间，连接信令服务器…');
            await netHostCreate(code, signal);

            Net.onMessage = handleHostMessage;
            Net.onPeerOpen = function() {};
            Net.onPeerClose = function(peerId) {
                const idx = Lobby.lobbyPlayers.findIndex(function(p) { return p.peerId === peerId; });
                if (idx >= 0) {
                    Lobby.lobbyPlayers.splice(idx, 1);
                    renderHostWait();
                    netBroadcastRaw({ type: 'player_left', peerId: peerId });
                    toast('玩家离开：' + ((Net._peerNames && Net._peerNames[peerId]) || '未知'), 'warning', '👋');
                }
            };
            Lobby.mySeatId = 0;
            startHostCountdown();
            hideLoading();
            renderHostWait();
        } catch (e) {
            hideLoading();
            console.error('create room error:', e);
            toast('创建房间失败：' + ((e && e.type) ? e.type : (e.message || '网络错误')), 'error', '❌');
        }
    }

    // ---------- 房主等待室 ----------
    function startHostCountdown() {
        Lobby.waitSeconds = WAIT_MAX_SECONDS;
        if (Lobby.countdownTimer) clearInterval(Lobby.countdownTimer);
        Lobby.countdownTimer = setInterval(function() {
            Lobby.waitSeconds--;
            const el = document.getElementById('mp-wait-timer');
            if (el) el.textContent = formatCountdown(Lobby.waitSeconds);
            if (Lobby.waitSeconds <= 0) {
                netBroadcastRaw({ type: 'room_closed', reason: '等待超时，房间已关闭' });
                toast('等待超时，房间已关闭', 'warning', '⏰');
                setTimeout(function() { netClose(); closeOverlay(); }, 1500);
            }
        }, 1000);
    }
    function formatCountdown(s) {
        const m = Math.floor(s / 60), ss = s % 60;
        return m + ':' + (ss < 10 ? '0' : '') + ss;
    }

    function renderHostWait() {
        const list = Lobby.lobbyPlayers.map(function(p, i) {
            return `<div class="waiting-player-item ${p.isHost ? 'host' : ''}">
                <span class="wp-dot" style="background:${p.online ? '#66bb6a' : '#ef5350'};"></span>
                <span class="wp-name">${esc(p.name)}${p.isHost ? ' 👑(房主)' : ''}</span>
                <span class="wp-tag">座位 ${i}</span>
            </div>`;
        }).join('');
        box(`
            <div class="mp-title">🏠 等待玩家加入</div>
            <p style="font-size:0.85rem;color:var(--text-secondary);">房间名：<strong>${esc(Lobby.roomConfig.roomName)}</strong></p>
            <p style="font-size:0.85rem;color:var(--text-secondary);">把下面房间号告诉朋友：</p>
            <div class="mp-code-display" id="mp-code">${Lobby.roomConfig.code}</div>
            <div class="waiting-timer">⏳ 房间将在 <span id="mp-wait-timer">${formatCountdown(Lobby.waitSeconds)}</span> 后关闭</div>
            <div class="waiting-player-list">${list}</div>
            <div style="font-size:0.75rem;color:var(--text-secondary);text-align:center;margin:6px 0;">${Lobby.lobbyPlayers.length}/${Lobby.roomConfig.maxPlayers} 人 · 房主可随时开始游戏</div>
            <div class="flex-row mt-12">
                <button class="btn btn-success flex-grow" onclick="window.mpHostStartGame()">🚀 开始游戏</button>
                <button class="btn btn-danger" onclick="window.mpHostCloseRoom()">✖ 关闭房间</button>
            </div>`);
    }

    function mpHostStartGame() {
        try {
            const cfg = Object.assign({}, Lobby.roomConfig, {
                seats: Lobby.lobbyPlayers.map(function(p) { return { peerId: p.peerId, name: p.name, isHost: p.isHost }; })
            });
            localStorage.setItem('xfw_room_config', JSON.stringify(cfg));
            netBroadcastRaw({ type: 'start_game' });
            // 进入联机页前显示加载动画，避免“以为点不动”
            showLoading('正在进入游戏…');
            window.location.href = 'game_connect_master.html';
        } catch (e) {
            console.error('start game error:', e);
            toast('开始游戏失败：' + e.message, 'error', '❌');
        }
    }
    window.lobbyHostStartGame = mpHostStartGame;

    function mpHostCloseRoom() {
        try {
            netBroadcastRaw({ type: 'close_room' });
        } catch (e) {}
        try { netClose(); } catch (e) {}
        closeOverlay();
        toast('房间已关闭', 'info', '🚪');
    }

    // ---------- 房主消息处理（大厅阶段） ----------
    function handleHostMessage(peerId, msg) {
        if (msg.type === 'join_request') {
            if (Lobby.lobbyPlayers.length >= Lobby.roomConfig.maxPlayers) {
                netSendToPeer(peerId, { type: 'join_rejected', reason: '房间已满' });
                return;
            }
            const seatId = Lobby.lobbyPlayers.length;
            if (!Net._peerNames) Net._peerNames = {};
            Net._peerNames[peerId] = msg.playerName;
            Lobby.lobbyPlayers.push({ peerId: peerId, name: msg.playerName, isHost: false, online: true });
            netSendToPeer(peerId, {
                type: 'join_accepted',
                playerId: seatId,
                yourName: msg.playerName,
                roomConfig: {
                    roomName: Lobby.roomConfig.roomName,
                    hostName: Lobby.roomConfig.hostName,
                    totalRounds: Lobby.roomConfig.totalRounds,
                    aiCount: Lobby.roomConfig.aiCount,
                    extAiCount: Lobby.roomConfig.extAiCount
                },
                players: Lobby.lobbyPlayers.map(function(p, i) { return { seat: i, name: p.name, isHost: p.isHost }; })
            });
            netBroadcastRaw({ type: 'player_joined', peerId: peerId, playerName: msg.playerName, seat: seatId });
            renderHostWait();
            toast(msg.playerName + ' 加入了房间', 'success', '👋');
        } else if (msg.type === 'chat_message') {
            netBroadcastRaw({ type: 'chat_message', fromPeerId: peerId, playerName: msg.playerName, text: msg.text, timestamp: msg.timestamp });
        }
    }

    // ---------- 加入房间 ----------
    function showJoinForm() {
        box(`
            <div class="mp-title">🔍 加入房间</div>
            <div class="mp-field"><label>输入房间号（6位数字）</label>
                <div class="flex-row">
                    <input type="text" id="mp-join-code" maxlength="6" placeholder="如 123456" style="letter-spacing:2px;flex:1;" onkeydown="if(event.key==='Enter')window.mpJoinGo()">
                    <button class="btn btn-primary" onclick="window.mpJoinGo()">加入</button>
                </div>
            </div>
            <div class="flex-row mt-8">
                <button class="btn btn-warning flex-grow" onclick="window.mpShowMainMenu()">返回</button>
            </div>`);
    }

    function mpJoinGo() {
        const code = (document.getElementById('mp-join-code') || {}).value || '';
        if (!/^\d{6}$/.test(code.trim())) { toast('请输入6位数字房间号', 'warning', '⚠️'); return; }
        mpJoinByCode(code.trim());
    }

    async function mpJoinByCode(code) {
        if (Lobby.joining) return;
        Lobby.joining = true;
        showLoading('正在连接房间 ' + code + ' …');
        // 自动遍历所有公共信令服务器（房主可能用了任意一个）
        const servers = (window.SIGNAL_SERVERS || []).filter(function(s) { return !s.custom; });
        let lastErr = null;
        for (let i = 0; i < servers.length; i++) {
            const signal = servers[i];
            updateLoadingText('正在通过 ' + signal.label + ' 连接房间 ' + code + ' …（' + (i+1) + '/' + servers.length + '）');
            try {
                await netPlayerJoin(code, signal, Lobby.username);
                // 连接成功
                Net.onMessage = handleGuestMessage;
                hideLoading();
                renderGuestWait({ code: code });
                return;
            } catch (e) {
                lastErr = e;
                try { netClose(); } catch (_) {}
                // 继续尝试下一个服务器
            }
        }
        Lobby.joining = false;
        hideLoading();
        const type = lastErr && lastErr.type;
        let msg = '加入房间失败，请检查房间号或网络';
        if (type === 'peer-unavailable') msg = '房间不存在或房主已离线，请确认房间号';
        else if (lastErr && lastErr.message === 'timeout') msg = '连接超时，所有信令服务器均无响应，请稍后重试';
        else if (lastErr && lastErr.message) msg = '连接失败：' + lastErr.message;
        toast(msg, 'error', '❌');
    }

    // ---------- 玩家等待室 ----------
    function renderGuestWait(meta) {
        box(`
            <div class="mp-title">⏳ 等待房主开始</div>
            <p style="font-size:0.85rem;color:var(--text-secondary);">房间号：<strong style="color:var(--accent-gold);letter-spacing:2px;">${esc(meta.code)}</strong></p>
            <div id="mp-guest-roominfo" style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">连接成功，等待房主确认…</div>
            <div class="waiting-player-list" id="mp-guest-list"></div>
            <div style="font-size:0.75rem;color:var(--text-secondary);text-align:center;margin:8px 0;">房主开始游戏后将自动进入</div>
            <button class="btn btn-warning" onclick="window.mpGuestExit()" style="width:100%;">🚪 退出等待</button>`);
    }

    function mpGuestExit() {
        try { netClose(); } catch (e) {}
        Lobby.joining = false;
        showMainMenu();
    }

    function renderGuestList(info) {
        const listEl = document.getElementById('mp-guest-list');
        if (!listEl) return;
        if (info.roomConfig) {
            const ri = document.getElementById('mp-guest-roominfo');
            if (ri) ri.textContent = '房间：' + info.roomConfig.roomName + ' · 房主 ' + info.roomConfig.hostName + ' · 共 ' + info.roomConfig.totalRounds + ' 轮';
        }
        const players = info.players || [];
        listEl.innerHTML = players.map(function(p, i) {
            return `<div class="waiting-player-item ${p.isHost ? 'host' : ''}">
                <span class="wp-dot" style="background:${i === info.playerId ? '#4fc3f7' : '#66bb6a'};"></span>
                <span class="wp-name">${esc(p.name)}${p.isHost ? ' 👑' : ''}${i === info.playerId ? ' (就是你)' : ''}</span>
            </div>`;
        }).join('');
    }

    // ---------- 玩家消息处理（大厅阶段） ----------
    function handleGuestMessage(fromPeerId, msg) {
        if (msg.type === 'join_accepted') {
            Lobby.joining = false;
            Lobby.mySeatId = msg.playerId;
            localStorage.setItem('xfw_myseat', JSON.stringify({
                playerId: msg.playerId, yourName: msg.yourName, code: Net.roomCode
            }));
            renderGuestList(msg);
            toast('已加入房间，你的座位是 ' + (msg.playerId + 1) + ' 号', 'success', '✅');
        } else if (msg.type === 'join_rejected') {
            Lobby.joining = false;
            toast('加入被拒绝：' + (msg.reason || '未知原因'), 'error', '❌');
            showMainMenu();
        } else if (msg.type === 'player_joined') {
            toast(msg.playerName + ' 加入了房间', 'info', '👋');
        } else if (msg.type === 'start_game') {
            window.location.href = 'game_connect_player.html';
        } else if (msg.type === 'room_closed' || msg.type === 'close_room') {
            toast('房间已关闭：' + (msg.reason || '房主关闭了房间'), 'warning', '🚪');
            setTimeout(function() { try { netClose(); } catch(e){} showMainMenu(); }, 1500);
        } else if (msg.type === 'chat_message') {
            if (window.Chat) Chat.append(msg, true);
        }
    }

    // ---------- 初始化大厅入口 ----------
    function init() {
        if (!isLobbyPage()) return;
        // 大厅按钮已在 HTML 中用 inline onclick 绑定（window.lobbyStartOnline / window.lobbyStartLocal），
        // 此处不做任何 addEventListener，避免重复绑定
    }

    function saveLocalSetup() {
        const read = function(id) { const e = document.getElementById(id); return e ? e.value : null; };
        const cfg = {
            humanPlayers: parseInt(read('human-players')) || 1,
            aiPlayers: parseInt(read('ai-players')) || 1,
            totalRounds: parseInt(read('total-rounds')) || 60,
            admin: (typeof adminMode !== 'undefined' && adminMode) ? {
                initMoney: read('admin-init-money'), bankMoney: read('admin-bank-money'),
                lootThreshold: read('admin-loot-threshold'), lootRatio: read('admin-loot-ratio'),
                volatilityScale: read('admin-volatility-scale'), algoMode: read('admin-algo-mode'),
                bannerDuration: read('admin-banner-duration'), thinkMin: read('admin-ai-think-min'),
                thinkMax: read('admin-ai-think-max'), chartType: read('admin-chart-type'),
                sharePrice: read('admin-share-price'), dhMult: read('admin-darkhorse-multiplier'),
                dhProb: read('admin-darkhorse-prob'), bThreshold: read('admin-bankruptcy-threshold'),
                bFund: read('admin-bankruptcy-fund')
            } : null
        };
        localStorage.setItem('xfw_local_config', JSON.stringify(cfg));
    }
    window.lobbySaveLocalSetup = saveLocalSetup;

    // ===== 暴露所有弹窗按钮的全局函数（inline onclick 调用） =====
    window.lobbyStartOnline = function() { askUsername(showMainMenu); };
    window.lobbyStartLocal = function() { saveLocalSetup(); window.location.href = 'game_local.html'; };
    window.mpUsernameOk = mpUsernameOk;
    window.mpShowMainMenu = showMainMenu;
    window.mpChangeUsername = mpChangeUsername;
    window.mpShowCreateForm = showCreateForm;
    window.mpShowJoinForm = showJoinForm;
    window.mpSignalChange = mpSignalChange;
    window.mpDoCreate = mpDoCreate;
    window.mpHostStartGame = mpHostStartGame;
    window.mpHostCloseRoom = mpHostCloseRoom;
    window.mpJoinGo = mpJoinGo;
    window.mpJoinByCode = mpJoinByCode;
    window.mpGuestExit = mpGuestExit;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
