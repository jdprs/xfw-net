/* ================================================================
 * 37. 大厅与房间系统 (v10.0)
 * 负责：用户名、创建房间、加入房间、广场(kvdb.io)、等待室、倒计时
 * 在 index.html（大厅）以及联机阶段的房主/玩家页面都可加载，
 * 通过检测 DOM 元素是否存在决定是否初始化大厅 UI。
 * ================================================================
 */
(() => {
    const KV_BUCKET = 'xfw-new-rooms';
    const KV_BASE = 'https://kvdb.io/' + KV_BUCKET;
    const WAIT_MAX_SECONDS = 5 * 60; // 5 分钟等待上限

    const Lobby = {
        username: localStorage.getItem('xfw_username') || '',
        lobbyPlayers: [],   // {peerId, name, isHost, online}
        roomConfig: null,
        countdownTimer: null,
        plazaTimer: null,
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
        if (typeof showBanner === 'function') showBanner(msg, type || 'info', null, title || '');
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
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:2000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);overflow-y:auto;padding:16px;';
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
        if (Lobby.plazaTimer) clearInterval(Lobby.plazaTimer);
        Lobby.countdownTimer = null; Lobby.plazaTimer = null;
    }
    window.lobbyCloseOverlay = closeOverlay;

    function box(innerHtml) {
        const ov = openOverlay();
        ov.innerHTML = '';
        const b = el('div', 'mp-panel');
        b.style.cssText = 'max-width:460px;width:100%;max-height:90vh;overflow-y:auto;';
        b.innerHTML = innerHtml;
        ov.appendChild(b);
        ov.onclick = (e) => { if (e.target === ov) closeOverlay(); };
        return b;
    }

    // ---------- 用户名 ----------
    function askUsername(next) {
        if (Lobby.username) { next && next(); return; }
        const b = box(`
            <div class="mp-title">👤 输入你的游戏昵称</div>
            <div class="mp-field"><input type="text" id="mp-username" maxlength="12" placeholder="昵称（可不唯一）" value="${Lobby.username.replace(/"/g,'&quot;')}"></div>
            <div class="flex-row">
                <button class="btn btn-success flex-grow" id="mp-username-ok">确认</button>
                <button class="btn btn-warning" id="mp-username-cancel">返回</button>
            </div>`);
        document.getElementById('mp-username-ok').onclick = () => {
            const v = document.getElementById('mp-username').value.trim();
            if (!v) { toast('请输入昵称', 'warning'); return; }
            Lobby.username = v;
            localStorage.setItem('xfw_username', v);
            next && next();
        };
        document.getElementById('mp-username-cancel').onclick = closeOverlay;
    }

    // ---------- 主菜单 ----------
    function showMainMenu() {
        const b = box(`
            <div class="mp-title">🌐 联机大厅</div>
            <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:10px;">当前昵称：<strong style="color:var(--accent-gold);">${Lobby.username}</strong></p>
            <div class="flex-row mb-8">
                <button class="btn btn-success flex-grow" id="mp-create">➕ 创建房间</button>
                <button class="btn btn-primary flex-grow" id="mp-join">🔍 加入房间</button>
            </div>
            <button class="btn btn-outline" id="mp-back" style="width:100%;">返回单机设置</button>`);
        document.getElementById('mp-create').onclick = showCreateForm;
        document.getElementById('mp-join').onclick = showJoinForm;
        document.getElementById('mp-back').onclick = closeOverlay;
    }

    // ---------- 创建房间表单 ----------
    function showCreateForm() {
        const serverOpts = (window.SIGNAL_SERVERS || []).map((s, i) =>
            `<option value="${i}">${s.label}</option>`).join('');
        const b = box(`
            <div class="mp-title">➕ 创建房间</div>
            <div class="mp-field"><label>房间名</label><input type="text" id="mp-room-name" maxlength="20" placeholder="如：周末炒股局" value="${Lobby.username}的房间"></div>
            <div class="flex-row">
                <div class="mp-field flex-grow"><label>内置AI数</label><input type="number" id="mp-ai" min="0" max="3" value="1"></div>
                <div class="mp-field flex-grow"><label>外接AI数</label><input type="number" id="mp-extai" min="0" max="2" value="0"></div>
            </div>
            <div class="flex-row">
                <div class="mp-field flex-grow"><label>最多玩家(含房主)</label><input type="number" id="mp-maxp" min="2" max="6" value="4"></div>
                <div class="mp-field flex-grow"><label>总轮数</label><input type="number" id="mp-rounds" min="10" max="200" value="60"></div>
            </div>
            <div class="mp-field"><label>信令服务器</label><select id="mp-signal">${serverOpts}</select></div>
            <div class="mp-field" id="mp-custom-host-wrap" style="display:none;">
                <label>自建服务器 host:port:path</label>
                <input type="text" id="mp-custom-host" placeholder="如：example.com:9000:myroom">
            </div>
            <label class="mp-check-row"><input type="checkbox" id="mp-public" checked> 公开到广场（其他玩家可直接搜索到）</label>
            <div class="flex-row mt-8">
                <button class="btn btn-success flex-grow" id="mp-do-create">🚀 创建</button>
                <button class="btn btn-warning" id="mp-create-back">返回</button>
            </div>`);
        document.getElementById('mp-signal').onchange = (e) => {
            const s = (window.SIGNAL_SERVERS || [])[parseInt(e.target.value)];
            document.getElementById('mp-custom-host-wrap').style.display = (s && s.custom) ? 'block' : 'none';
        };
        document.getElementById('mp-create-back').onclick = showMainMenu;
        document.getElementById('mp-do-create').onclick = doCreateRoom;
    }

    function parseSignal(selectedIdx) {
        const s = (window.SIGNAL_SERVERS || [])[selectedIdx] || (window.SIGNAL_SERVERS[0]);
        if (!s.custom) return { host: s.host, port: s.port, secure: s.secure, path: '/', key: 'peerjs' };
        const raw = document.getElementById('mp-custom-host').value.trim();
        const parts = raw.split(':');
        const host = parts[0] || 'localhost';
        const port = parseInt(parts[1] || '9000');
        const path = parts[2] ? '/' + parts[2] : '/';
        return { host, port, secure: location.protocol === 'https:', path, key: 'peerjs' };
    }

    async function doCreateRoom() {
        const roomName = document.getElementById('mp-room-name').value.trim() || (Lobby.username + '的房间');
        const aiCount = clampInt(parseInt(document.getElementById('mp-ai').value) || 0, 0, 3);
        const extAiCount = clampInt(parseInt(document.getElementById('mp-extai').value) || 0, 0, 2);
        const maxPlayers = clampInt(parseInt(document.getElementById('mp-maxp').value) || 2, 2, 6);
        const totalRounds = clampInt(parseInt(document.getElementById('mp-rounds').value) || 60, 10, 200);
        const signalIdx = parseInt(document.getElementById('mp-signal').value) || 0;
        const publicRoom = document.getElementById('mp-public').checked;
        const signal = parseSignal(signalIdx);

        const code = genRoomCode();
        Lobby.roomConfig = {
            roomName, hostName: Lobby.username, code, aiCount, extAiCount,
            maxPlayers, totalRounds, publicRoom, signal, createdAt: Date.now()
        };
        Lobby.lobbyPlayers = [{ peerId: 'HOST', name: Lobby.username, isHost: true, online: true }];

        toast('正在创建房间…', 'info', '⏳');
        try {
            await netHostCreate(code, signal);
        } catch (e) {
            toast('创建房间失败：' + (e && e.type ? e.type : '网络错误'), 'error', '❌');
            return;
        }
        Net.onMessage = handleHostMessage;
        Net.onPeerOpen = (peerId) => { /* join_request 携带名字 */ };
        Net.onPeerClose = (peerId) => {
            const idx = Lobby.lobbyPlayers.findIndex(p => p.peerId === peerId);
            if (idx >= 0) {
                Lobby.lobbyPlayers.splice(idx, 1);
                renderHostWait();
                netBroadcastRaw({ type: 'player_left', peerId });
                toast('玩家离开：' + (Net._peerNames?.[peerId] || '未知'), 'warning', '👋');
            }
        };
        // 登记房主自身为玩家0
        Lobby.mySeatId = 0;
        if (publicRoom) await publishRoom();
        startHostCountdown();
        renderHostWait();
    }

    function clampInt(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

    // ---------- 广场：发布 / 拉取 ----------
    async function publishRoom() {
        try {
            const info = {
                name: Lobby.roomConfig.roomName,
                host: Lobby.roomConfig.hostName,
                players: Lobby.lobbyPlayers.length,
                max: Lobby.roomConfig.maxPlayers,
                ai: Lobby.roomConfig.aiCount,
                extAi: Lobby.roomConfig.extAiCount,
                code: Lobby.roomConfig.code
            };
            await fetch(`${KV_BASE}/${Lobby.roomConfig.code}?ttl=60`, {
                method: 'PUT', body: JSON.stringify(info)
            });
            // 每 20 秒心跳刷新
            if (Lobby.plazaTimer) clearInterval(Lobby.plazaTimer);
            Lobby.plazaTimer = setInterval(async () => {
                try { await fetch(`${KV_BASE}/${Lobby.roomConfig.code}?ttl=60`, { method: 'PUT', body: JSON.stringify(info) }); } catch (e) {}
            }, 20000);
        } catch (e) {
            toast('广场发布失败，将仅用房间号加入', 'warning', '⚠️');
        }
    }

    async function fetchPlaza() {
        try {
            const resp = await fetch(KV_BASE);
            if (!resp.ok) throw new Error('kv unavailable');
            const keys = await resp.json();
            const rooms = [];
            for (const k of keys.slice(0, 30)) {
                try {
                    const r = await fetch(`${KV_BASE}/${k}`);
                    if (r.ok) { const j = await r.json(); if (j && j.code) rooms.push(j); }
                } catch (e) {}
            }
            return rooms;
        } catch (e) {
            return null; // 不可用
        }
    }
    window.lobbyFetchPlaza = fetchPlaza;

    // ---------- 房主等待室 ----------
    function startHostCountdown() {
        Lobby.waitSeconds = WAIT_MAX_SECONDS;
        if (Lobby.countdownTimer) clearInterval(Lobby.countdownTimer);
        Lobby.countdownTimer = setInterval(() => {
            Lobby.waitSeconds--;
            const el = document.getElementById('mp-wait-timer');
            if (el) el.textContent = formatCountdown(Lobby.waitSeconds);
            if (Lobby.waitSeconds <= 0) {
                // 到点强关
                netBroadcastRaw({ type: 'room_closed', reason: '等待超时，房间已关闭' });
                if (Lobby.plazaTimer) clearInterval(Lobby.plazaTimer);
                toast('等待超时，房间已关闭', 'warning', '⏰');
                setTimeout(() => { netClose(); closeOverlay(); }, 1500);
            }
        }, 1000);
    }
    function formatCountdown(s) {
        const m = Math.floor(s / 60), ss = s % 60;
        return `${m}:${ss < 10 ? '0' : ''}${ss}`;
    }

    function renderHostWait() {
        const list = Lobby.lobbyPlayers.map((p, i) => `
            <div class="waiting-player-item ${p.isHost ? 'host' : ''}">
                <span class="wp-dot" style="background:${p.online ? '#66bb6a' : '#ef5350'};"></span>
                <span class="wp-name">${p.name}${p.isHost ? ' 👑(房主)' : ''}</span>
                <span class="wp-tag">座位 ${i}</span>
            </div>`).join('');
        const b = box(`
            <div class="mp-title">🏠 等待玩家加入</div>
            <p style="font-size:0.85rem;color:var(--text-secondary);">房间名：<strong>${Lobby.roomConfig.roomName}</strong></p>
            <p style="font-size:0.85rem;color:var(--text-secondary);">把下面房间号告诉朋友：</p>
            <div class="mp-code-display" id="mp-code">${Lobby.roomConfig.code}</div>
            <div class="waiting-timer">⏳ 等待剩余 <span id="mp-wait-timer">${formatCountdown(Lobby.waitSeconds)}</span></div>
            <div class="waiting-player-list">${list}</div>
            <div class="flex-row mt-12">
                <button class="btn btn-success flex-grow" id="mp-start-game">🚀 开始游戏</button>
                <button class="btn btn-danger" id="mp-close-room">✖ 关闭房间</button>
            </div>`);
        document.getElementById('mp-start-game').onclick = () => hostStartGame();
        document.getElementById('mp-close-room').onclick = () => {
            netBroadcastRaw({ type: 'close_room' });
            if (Lobby.plazaTimer) clearInterval(Lobby.plazaTimer);
            netClose(); closeOverlay();
        };
    }

    function hostStartGame() {
        const cfg = {
            ...Lobby.roomConfig,
            seats: Lobby.lobbyPlayers.map(p => ({ peerId: p.peerId, name: p.name, isHost: p.isHost }))
        };
        localStorage.setItem('xfw_room_config', JSON.stringify(cfg));
        // 通知所有人开始
        netBroadcastRaw({ type: 'start_game' });
        // 房主页跳转
        window.location.href = 'game_connect_master.html';
    }
    window.lobbyHostStartGame = hostStartGame;

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
            Lobby.lobbyPlayers.push({ peerId, name: msg.playerName, isHost: false, online: true });
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
                players: Lobby.lobbyPlayers.map((p, i) => ({ seat: i, name: p.name, isHost: p.isHost }))
            });
            netBroadcastRaw({ type: 'player_joined', peerId, playerName: msg.playerName, seat: seatId });
            renderHostWait();
            toast(`${msg.playerName} 加入了房间`, 'success', '👋');
            // 刷新广场人数
            if (Lobby.roomConfig.publicRoom) publishRoom();
        } else if (msg.type === 'chat_message') {
            netBroadcastRaw({ type: 'chat_message', ...msg, fromPeerId: peerId });
        } else if (msg.type === 'ping' || msg.type === 'pong') {
            // handled in p2p layer
        }
    }

    // ---------- 加入房间 ----------
    function showJoinForm() {
        const b = box(`
            <div class="mp-title">🔍 加入房间</div>
            <div class="mp-field"><label>输入房间号（6位）</label>
                <div class="flex-row">
                    <input type="text" id="mp-join-code" maxlength="6" placeholder="如 123456" style="letter-spacing:2px;">
                    <button class="btn btn-primary" id="mp-join-go">加入</button>
                </div>
            </div>
            <div class="section-title" style="margin:10px 0 6px;color:var(--text-secondary);font-size:0.85rem;">🌐 广场公开房间</div>
            <div id="mp-plaza" class="plaza-list"><div class="plaza-empty">加载中…</div></div>
            <button class="btn btn-warning" id="mp-join-back" style="width:100%;margin-top:8px;">返回</button>`);
        document.getElementById('mp-join-back').onclick = showMainMenu;
        document.getElementById('mp-join-go').onclick = () => {
            const code = document.getElementById('mp-join-code').value.trim();
            if (!/^\d{6}$/.test(code)) { toast('请输入6位数字房间号', 'warning', '⚠️'); return; }
            doJoinRoom(code);
        };
        loadPlaza();
    }

    async function loadPlaza() {
        const container = document.getElementById('mp-plaza');
        if (!container) return;
        const rooms = await fetchPlaza();
        if (rooms === null) {
            container.innerHTML = '<div class="plaza-empty">⚠️ 广场暂时不可用，请使用房间号直接加入</div>';
            return;
        }
        if (!rooms.length) {
            container.innerHTML = '<div class="plaza-empty">暂无公开房间，创建一个吧！</div>';
            return;
        }
        container.innerHTML = '';
        rooms.sort((a, b) => (b.players - b.max) - (a.players - a.max));
        rooms.forEach(r => {
            const item = el('div', 'plaza-room');
            item.innerHTML = `
                <div class="pr-name">${r.name}<div class="pr-meta">房主：${r.host} · AI×${r.ai||0}${r.extAi?` 外接×${r.extAi}`:''}</div></div>
                <div style="text-align:right;">
                    <div class="pr-meta">${r.players}/${r.max} 人</div>
                    <div class="pr-code">${r.code}</div>
                </div>`;
            item.onclick = () => doJoinRoom(r.code);
            container.appendChild(item);
        });
    }

    async function doJoinRoom(code) {
        if (Lobby.joining) return;
        Lobby.joining = true;
        const signal = (window.SIGNAL_SERVERS || [])[0];
        toast('正在连接 ' + code + ' …', 'info', '⏳');
        try {
            await netPlayerJoin(code, signal, Lobby.username);
        } catch (e) {
            Lobby.joining = false;
            return;
        }
        Net.onMessage = handleGuestMessage;
        renderGuestWait({ code });
    }

    // ---------- 玩家等待室 ----------
    function renderGuestWait(meta) {
        const b = box(`
            <div class="mp-title">⏳ 等待房主开始</div>
            <p style="font-size:0.85rem;color:var(--text-secondary);">房间号：<strong style="color:var(--accent-gold);letter-spacing:2px;">${meta.code}</strong></p>
            <div id="mp-guest-roominfo" style="font-size:0.85rem;color:var(--text-secondary);"></div>
            <div class="waiting-player-list" id="mp-guest-list"></div>
            <button class="btn btn-warning" id="mp-guest-exit" style="width:100%;">🚪 退出等待</button>`);
        document.getElementById('mp-guest-exit').onclick = () => {
            netClose();
            Lobby.joining = false;
            showMainMenu();
        };
    }

    function renderGuestList(info) {
        const listEl = document.getElementById('mp-guest-list');
        if (!listEl) return;
        if (info.roomConfig) {
            const ri = document.getElementById('mp-guest-roominfo');
            if (ri) ri.textContent = `房间：${info.roomConfig.roomName} · 房主 ${info.roomConfig.hostName} · 共 ${info.roomConfig.totalRounds} 轮`;
        }
        const players = info.players || [];
        listEl.innerHTML = players.map((p, i) => `
            <div class="waiting-player-item ${p.isHost ? 'host' : ''}">
                <span class="wp-dot" style="background:${i===info.playerId?'#4fc3f7':'#66bb6a'};"></span>
                <span class="wp-name">${p.name}${p.isHost ? ' 👑' : ''}${i===info.playerId ? ' (就是你)' : ''}</span>
            </div>`).join('');
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
            toast(`已加入房间，你的座位是 ${msg.playerId + 1} 号`, 'success', '✅');
        } else if (msg.type === 'join_rejected') {
            Lobby.joining = false;
            toast('加入被拒绝：' + msg.reason, 'error', '❌');
            showMainMenu();
        } else if (msg.type === 'player_joined') {
            toast(`${msg.playerName} 加入了房间`, 'info', '👋');
        } else if (msg.type === 'player_left') {
            // 由 game-sync 阶段处理
        } else if (msg.type === 'start_game') {
            window.location.href = 'game_connect_player.html';
        } else if (msg.type === 'room_closed' || msg.type === 'close_room') {
            toast('房间已关闭：' + (msg.reason || '房主关闭了房间'), 'warning', '🚪');
            setTimeout(() => { netClose(); showMainMenu(); }, 1500);
        } else if (msg.type === 'chat_message') {
            if (window.Chat) Chat.append(msg, true);
        }
    }

    // ---------- 初始化大厅入口 ----------
    function init() {
        if (!isLobbyPage()) return;
        const btn = document.getElementById('mp-online-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            askUsername(() => showMainMenu());
        });
        // 单机开始按钮
        const localBtn = document.getElementById('mp-local-btn');
        if (localBtn) localBtn.addEventListener('click', () => {
            // 把当前设置存入 localStorage 供 game_local 读取
            saveLocalSetup();
            window.location.href = 'game_local.html';
        });
    }

    function saveLocalSetup() {
        const read = (id) => { const e = document.getElementById(id); return e ? e.value : null; };
        const cfg = {
            humanPlayers: parseInt(read('human-players')) || 1,
            aiPlayers: parseInt(read('ai-players')) || 1,
            totalRounds: parseInt(read('total-rounds')) || 60,
            admin: adminMode ? {
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
    // 暴露联机入口（供 inline onclick 兜底调用）
    window.lobbyStartOnline = function() { askUsername(() => showMainMenu()); };
    window.lobbyStartLocal = function() { saveLocalSetup(); window.location.href = 'game_local.html'; };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
