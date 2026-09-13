/* ================================================================
 * 37. 大厅与房间系统 (v10.0)
 * 负责：用户名、创建房间、加入房间、广场(kvdb.io)、等待室、倒计时
 * 在 index.html（大厅）以及联机阶段的房主/玩家页面都可加载，
 * 通过检测 DOM 元素是否存在决定是否初始化大厅 UI。
 *
 * v10.0 修复：所有弹窗按钮统一使用 inline onclick + window 全局函数，
 * 避免动态 innerHTML 后 .onclick 赋值失效导致按钮点不动的问题。
 * ================================================================
 */
(() => {
    // 调试用：?reset=1 清除保存的用户名，强制弹出用户名弹窗
    if (location.search.indexOf('reset=1') >= 0) {
        try { localStorage.removeItem('xfw_username'); } catch(e) {}
    }
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
        // z-index:99999 确保在 health-modal(9999) 等所有层之上；
        // 不使用 backdrop-filter 避免某些浏览器下鼠标事件穿透异常
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:99999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:16px;';
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
        // pointer-events:auto 确保面板及内部按钮可接收鼠标点击；
        // position:relative + z-index:1 确保面板在遮罩背景之上
        b.style.cssText = 'max-width:460px;width:100%;max-height:90vh;overflow-y:auto;pointer-events:auto;position:relative;z-index:1;';
        b.innerHTML = innerHtml;
        ov.appendChild(b);
        // 点击遮罩层空白处关闭（点击面板内不关闭）
        ov.onclick = function(e) { if (e.target === ov) closeOverlay(); };
        return b;
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ---------- 用户名 ----------
    function askUsername(next) {
        if (Lobby.username) { next && next(); return; }
        Lobby._nextAfterUsername = next;
        box(`
            <div class="mp-title">👤 输入你的游戏昵称</div>
            <div class="mp-field"><input type="text" id="mp-username" maxlength="12" placeholder="昵称（可不唯一，仅作辨识）" value="${esc(Lobby.username)}"></div>
            <div style="display:flex;gap:10px;margin-top:12px;">
                <div id="mp-ok-btn" role="button" tabindex="0" style="flex:1;background:linear-gradient(135deg,#388e3c,#1b5e20);color:#fff;padding:10px 20px;border-radius:10px;text-align:center;cursor:pointer;font-size:0.9rem;user-select:none;box-shadow:0 4px 14px rgba(46,125,50,0.35);" onmousedown="event.preventDefault();window.mpUsernameOk()" onclick="window.mpUsernameOk()">✅ 确认</div>
                <div id="mp-cancel-btn" role="button" tabindex="0" style="background:linear-gradient(135deg,#f57c00,#e65100);color:#fff;padding:10px 20px;border-radius:10px;text-align:center;cursor:pointer;font-size:0.9rem;user-select:none;box-shadow:0 4px 14px rgba(245,124,0,0.35);" onmousedown="event.preventDefault();window.lobbyCloseOverlay()" onclick="window.lobbyCloseOverlay()">返回</div>
            </div>
            <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:8px;text-align:center;">昵称不需要唯一，仅用于房间内辨识</div>`);
        // 自动聚焦输入框
        setTimeout(function() {
            const inp = document.getElementById('mp-username');
            if (inp) inp.focus();
        }, 50);
        // 绑定键盘 Enter 支持（role=button 的 div 需要手动处理）
        setTimeout(function() {
            const okBtn = document.getElementById('mp-ok-btn');
            const cancelBtn = document.getElementById('mp-cancel-btn');
            if (okBtn) okBtn.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); window.mpUsernameOk(); } });
            if (cancelBtn) cancelBtn.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); window.lobbyCloseOverlay(); } });
            // 输入框按回车也确认
            const inp = document.getElementById('mp-username');
            if (inp) inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); window.mpUsernameOk(); } });
        }, 60);
        // ===== 终极兜底：捕获阶段 mousedown + 边界盒检测 =====
        // 即使有透明层高阶覆盖导致 e.target 不是按钮，也能通过坐标判断点击了哪个按钮
        setTimeout(function() {
            const handler = function(e) {
                const okBtn = document.getElementById('mp-ok-btn');
                const cancelBtn = document.getElementById('mp-cancel-btn');
                const inp = document.getElementById('mp-username');
                // 检查确认按钮
                if (okBtn) {
                    const r = okBtn.getBoundingClientRect();
                    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
                        e.preventDefault();
                        e.stopPropagation();
                        okBtn.style.opacity = '0.7';
                        setTimeout(function() { if (okBtn) okBtn.style.opacity = ''; }, 150);
                        window.mpUsernameOk();
                        return;
                    }
                }
                // 检查返回按钮
                if (cancelBtn) {
                    const r = cancelBtn.getBoundingClientRect();
                    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
                        e.preventDefault();
                        e.stopPropagation();
                        window.lobbyCloseOverlay();
                        return;
                    }
                }
                // 检查输入框（点击则聚焦）
                if (inp) {
                    const r = inp.getBoundingClientRect();
                    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
                        inp.focus();
                        return;
                    }
                }
            };
            document.addEventListener('mousedown', handler, true);
            // 弹窗关闭时移除监听器
            const origClose = window.lobbyCloseOverlay;
            window.lobbyCloseOverlay = function() {
                document.removeEventListener('mousedown', handler, true);
                window.lobbyCloseOverlay = origClose;
                origClose();
            };
        }, 70);
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
            <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:10px;">当前昵称：<strong style="color:var(--accent-gold);">${esc(Lobby.username)}</strong> <a href="javascript:void(0)" onclick="window.mpChangeUsername()" style="font-size:0.75rem;color:var(--text-secondary);margin-left:6px;">修改昵称</a></p>
            <div class="flex-row mb-8">
                <button class="btn btn-success flex-grow" onmousedown="event.preventDefault()" onclick="window.mpShowCreateForm()">➕ 创建房间</button>
                <button class="btn btn-primary flex-grow" onmousedown="event.preventDefault()" onclick="window.mpShowJoinForm()">🔍 加入房间</button>
            </div>
            <button class="btn btn-outline" onmousedown="event.preventDefault()" onclick="window.lobbyCloseOverlay()" style="width:100%;">返回单机设置</button>`);
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
            <label class="mp-check-row"><input type="checkbox" id="mp-public" checked> 公开到广场（其他玩家可搜索到）</label>
            <div class="flex-row mt-8">
                <button class="btn btn-success flex-grow" onmousedown="event.preventDefault()" onclick="window.mpDoCreate()">🚀 创建房间</button>
                <button class="btn btn-warning" onmousedown="event.preventDefault()" onclick="window.mpShowMainMenu()">返回</button>
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
            const publicRoom = !!(document.getElementById('mp-public') || {}).checked;
            const signal = parseSignal(signalIdx);

            const code = genRoomCode();
            Lobby.roomConfig = {
                roomName: roomName.trim() || (Lobby.username + '的房间'),
                hostName: Lobby.username, code, aiCount, extAiCount,
                maxPlayers, totalRounds, publicRoom, signal, createdAt: Date.now()
            };
            Lobby.lobbyPlayers = [{ peerId: 'HOST', name: Lobby.username, isHost: true, online: true }];

            toast('正在创建房间…', 'info', '⏳');
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
            if (publicRoom) await publishRoom();
            startHostCountdown();
            renderHostWait();
        } catch (e) {
            console.error('create room error:', e);
            toast('创建房间失败：' + ((e && e.type) ? e.type : (e.message || '网络错误')), 'error', '❌');
        }
    }

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
            await fetch(KV_BASE + '/' + Lobby.roomConfig.code + '?ttl=60', {
                method: 'PUT', body: JSON.stringify(info)
            });
            if (Lobby.plazaTimer) clearInterval(Lobby.plazaTimer);
            Lobby.plazaTimer = setInterval(async function() {
                try { await fetch(KV_BASE + '/' + Lobby.roomConfig.code + '?ttl=60', { method: 'PUT', body: JSON.stringify(info) }); } catch (e) {}
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
            for (const k of (keys || []).slice(0, 30)) {
                try {
                    const r = await fetch(KV_BASE + '/' + k);
                    if (r.ok) { const j = await r.json(); if (j && j.code) rooms.push(j); }
                } catch (e) {}
            }
            return rooms;
        } catch (e) {
            return null;
        }
    }
    window.lobbyFetchPlaza = fetchPlaza;

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
                if (Lobby.plazaTimer) clearInterval(Lobby.plazaTimer);
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
                <button class="btn btn-success flex-grow" onmousedown="event.preventDefault()" onclick="window.mpHostStartGame()">🚀 开始游戏</button>
                <button class="btn btn-danger" onmousedown="event.preventDefault()" onclick="window.mpHostCloseRoom()">✖ 关闭房间</button>
            </div>`);
    }

    function mpHostStartGame() {
        try {
            const cfg = Object.assign({}, Lobby.roomConfig, {
                seats: Lobby.lobbyPlayers.map(function(p) { return { peerId: p.peerId, name: p.name, isHost: p.isHost }; })
            });
            localStorage.setItem('xfw_room_config', JSON.stringify(cfg));
            netBroadcastRaw({ type: 'start_game' });
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
        if (Lobby.plazaTimer) clearInterval(Lobby.plazaTimer);
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
            if (Lobby.roomConfig.publicRoom) publishRoom();
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
                    <input type="text" id="mp-join-code" maxlength="6" placeholder="如 123456" style="letter-spacing:2px;flex:1;">
                    <button class="btn btn-primary" onmousedown="event.preventDefault()" onclick="window.mpJoinGo()">加入</button>
                </div>
            </div>
            <div class="section-title" style="margin:10px 0 6px;color:var(--text-secondary);font-size:0.85rem;">🌐 广场公开房间</div>
            <div id="mp-plaza" class="plaza-list"><div class="plaza-empty">加载中…</div></div>
            <div class="flex-row mt-8">
                <button class="btn btn-warning flex-grow" onmousedown="event.preventDefault()" onclick="window.mpShowMainMenu()">返回</button>
                <button class="btn btn-outline flex-grow" onmousedown="event.preventDefault()" onclick="window.mpRefreshPlaza()">🔄 刷新广场</button>
            </div>`);
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
        rooms.sort(function(a, b) { return (b.players - b.max) - (a.players - a.max); });
        rooms.forEach(function(r) {
            const item = el('div', 'plaza-room');
            item.innerHTML = `
                <div class="pr-name">${esc(r.name)}<div class="pr-meta">房主：${esc(r.host)} · AI×${r.ai || 0}${r.extAi ? ' 外接×' + r.extAi : ''}</div></div>
                <div style="text-align:right;">
                    <div class="pr-meta">${r.players}/${r.max} 人</div>
                    <div class="pr-code">${esc(r.code)}</div>
                </div>`;
            item.onclick = function() { mpJoinByCode(r.code); };
            container.appendChild(item);
        });
    }

    function mpRefreshPlaza() {
        const container = document.getElementById('mp-plaza');
        if (container) container.innerHTML = '<div class="plaza-empty">加载中…</div>';
        loadPlaza();
    }

    function mpJoinGo() {
        const code = (document.getElementById('mp-join-code') || {}).value || '';
        if (!/^\d{6}$/.test(code.trim())) { toast('请输入6位数字房间号', 'warning', '⚠️'); return; }
        mpJoinByCode(code.trim());
    }

    async function mpJoinByCode(code) {
        if (Lobby.joining) return;
        Lobby.joining = true;
        const signal = (window.SIGNAL_SERVERS || [])[0];
        toast('正在连接房间 ' + code + ' …', 'info', '⏳');
        try {
            await netPlayerJoin(code, signal, Lobby.username);
        } catch (e) {
            Lobby.joining = false;
            return; // 错误提示已在 p2p 层显示
        }
        Net.onMessage = handleGuestMessage;
        renderGuestWait({ code: code });
    }

    // ---------- 玩家等待室 ----------
    function renderGuestWait(meta) {
        box(`
            <div class="mp-title">⏳ 等待房主开始</div>
            <p style="font-size:0.85rem;color:var(--text-secondary);">房间号：<strong style="color:var(--accent-gold);letter-spacing:2px;">${esc(meta.code)}</strong></p>
            <div id="mp-guest-roominfo" style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">连接成功，等待房主确认…</div>
            <div class="waiting-player-list" id="mp-guest-list"></div>
            <div style="font-size:0.75rem;color:var(--text-secondary);text-align:center;margin:8px 0;">房主开始游戏后将自动进入</div>
            <button class="btn btn-warning" onmousedown="event.preventDefault()" onclick="window.mpGuestExit()" style="width:100%;">🚪 退出等待</button>`);
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
        // 防重复绑定：如果已初始化过则直接返回（避免脚本重复加载导致事件多次绑定）
        if (window.__lobbyInitialized) return;
        if (!isLobbyPage()) return;
        window.__lobbyInitialized = true;
        const btn = document.getElementById('mp-online-btn');
        if (btn) {
            btn.addEventListener('click', function() { askUsername(showMainMenu); });
        }
        const localBtn = document.getElementById('mp-local-btn');
        if (localBtn) {
            localBtn.addEventListener('click', function() {
                saveLocalSetup();
                window.location.href = 'game_local.html';
            });
        }
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
    window.mpRefreshPlaza = mpRefreshPlaza;
    window.mpGuestExit = mpGuestExit;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
