/* ================================================================
 * 36. P2P 网络层 (v10.0)
 * 基于 PeerJS，纯经典脚本，全局对象 window.Net
 * 角色：master（房主/权威端） / player（联机玩家）
 * 消息协议为 JSON，字段 type 区分
 * ================================================================
 */
(() => {
    // 信令服务器候选
    const SIGNAL_SERVERS = [
        { label: '0.peerjs.com (官方)', host: '0.peerjs.com', port: 443, secure: true },
        { label: '1.peerjs.com (官方)', host: '1.peerjs.com', port: 443, secure: true },
        { label: '自定义自建服务器', host: '', port: 9000, secure: false, custom: true }
    ];

    const Net = {
        role: null,            // 'master' | 'player'
        peer: null,
        peerId: null,          // 本机 peer id
        roomCode: null,
        myPlayerName: '',
        masterPeerId: null,    // player 端：房主 peer id
        conns: new Map(),      // master 端：peerId -> DataConnection
        masterConn: null,      // player 端：到房主的连接
        muted: new Set(),      // 房主端：被禁言 peerId 集合
        onMessage: null,      // function(fromPeerId, msg)
        onPeerOpen: null,
        onPeerClose: null,
        _hbTimer: null,
        _hbTimeoutTimer: null,
        _lastPong: 0,
        _peerOpened: false,   // 标记 peer 是否已经 open（open 后忽略非致命 error，避免疯狂弹 banner 卡死）
        _lastErrorBanner: 0,  // error banner 防抖时间戳
        _disconnectRedirectTimer: null  // 连接建立后断线的“返回大厅”跳转 timer，便于 join 重试时取消
    };
    window.Net = Net;
    window.SIGNAL_SERVERS = SIGNAL_SERVERS;

    function roomPeerId(code) { return 'xfw-' + String(code); }
    window.roomPeerId = roomPeerId;

    function setStatus(text, cls) {
        const dot = document.getElementById('net-status-dot');
        const txt = document.getElementById('net-status-text');
        if (txt) txt.textContent = text;
        if (dot) {
            dot.className = 'net-status-dot ' + (cls || '');
        }
    }
    window.netSetStatus = setStatus;

    // 心跳：master 周期性 ping 所有；player 收到 ping 回 pong
    function startHeartbeat() {
        stopHeartbeat();
        Net._hbTimer = setInterval(() => {
            if (Net.role === 'master') {
                broadcastRaw({ type: 'ping', t: Date.now() });
                // 15 秒无 pong 判定断线
                if (Date.now() - Net._lastPong > 15000 && Net._lastPong > 0) {
                    // 由各连接自身的 close 事件处理，这里仅兜底
                }
            } else if (Net.masterConn && Net.masterConn.open) {
                sendRaw(Net.masterConn, { type: 'ping', t: Date.now() });
            }
        }, 5000);
    }
    function stopHeartbeat() {
        if (Net._hbTimer) clearInterval(Net._hbTimer);
        Net._hbTimer = null;
    }

    function sendRaw(conn, obj) {
        if (!conn || !conn.open) return false;
        try { conn.send(obj); return true; } catch (e) {
            console.error('sendRaw error', e); return false;
        }
    }
    window.netSendRaw = sendRaw;

    // 玩家端：发送给房主
    function sendToMaster(obj) {
        Net._lastPong = Date.now();
        return sendRaw(Net.masterConn, obj);
    }
    window.netSendToMaster = sendToMaster;

    // 房主端：广播给所有玩家（可排除指定 peer，用于聊天等"发送者已本地显示"的场景）
    function broadcastRaw(obj, excludePeerId) {
        Net.conns.forEach((conn, pid) => {
            if (excludePeerId && pid === excludePeerId) return;
            sendRaw(conn, obj);
        });
    }
    window.netBroadcastRaw = broadcastRaw;

    // 房主端：发给指定玩家
    function sendToPeer(peerId, obj) {
        const conn = Net.conns.get(peerId);
        return sendRaw(conn, obj);
    }
    window.netSendToPeer = sendToPeer;

    // ---------- 房主：创建房间 ----------
    async function hostCreate(roomCode, signal) {
        return new Promise((resolve, reject) => {
            Net.role = 'master';
            Net.roomCode = roomCode;
            Net._peerOpened = false;
            const id = roomPeerId(roomCode);
            const opts = signal && signal.custom ? {} : { host: signal.host, port: signal.port, secure: signal.secure, key: 'peerjs' };
            try {
                Net.peer = new Peer(id, Object.keys(opts).length ? opts : undefined);
            } catch (e) { reject(e); return; }
            setStatus('信令服务器连接中…', 'connecting');
            Net.peer.on('open', (pid) => {
                Net._peerOpened = true;
                Net.peerId = pid;
                setStatus('房间已创建，等待玩家…', 'connected');
                startHeartbeat();
                resolve(pid);
            });
            Net.peer.on('connection', (conn) => {
                conn.on('open', () => {
                    Net.conns.set(conn.peer, conn);
                    if (Net.onPeerOpen) Net.onPeerOpen(conn.peer, conn);
                });
                conn.on('data', (data) => handleIncoming(conn.peer, data));
                conn.on('close', () => handlePeerDisconnect(conn.peer));
                conn.on('error', () => handlePeerDisconnect(conn.peer));
            });
            Net.peer.on('error', (err) => {
                // open 之后的信令错误（如临时断开、网络抖动）不弹 banner，避免疯狂弹 banner 导致页面卡死
                if (Net._peerOpened) {
                    const now = Date.now();
                    if (now - Net._lastErrorBanner > 5000) {
                        Net._lastErrorBanner = now;
                        console.warn('Peer error (after open):', err && err.type ? err.type : err);
                    }
                    return;
                }
                setStatus('网络错误', 'disconnected');
                const msg = (err && err.type) ? ('信令错误：' + err.type) : '网络连接失败';
                if (typeof showBanner === 'function') showBanner(msg, 'error', null, '📡 联机错误');
                reject(err);
            });
        });
    }
    window.netHostCreate = hostCreate;

    // ---------- 玩家：加入房间 ----------
    async function playerJoin(roomCode, signal, playerName) {
        return new Promise((resolve, reject) => {
            Net.role = 'player';
            Net.roomCode = roomCode;
            Net.myPlayerName = playerName;
            Net._peerOpened = false;
            Net.masterPeerId = roomPeerId(roomCode);
            const opts = signal && signal.custom ? {} : { host: signal.host, port: signal.port, secure: signal.secure, key: 'peerjs' };
            // joined 提升到外层：peer.on('error') 也需据此判断是否已真正连到房主
            let joined = false;
            try {
                Net.peer = new Peer(Object.keys(opts).length ? opts : undefined);
            } catch (e) { reject(e); return; }
            setStatus('正在连接房主…', 'connecting');
            Net.peer.on('open', (pid) => {
                Net._peerOpened = true;
                Net.peerId = pid;
                const conn = Net.peer.connect(Net.masterPeerId, { reliable: true });
                Net.masterConn = conn;
                // joined=true 表示 P2P 数据通道已成功 open：此后再收到 close/error 才视为“真正断线”；
                // 在此之前（如 peer-unavailable、信令打洞失败）必须 reject，让上层切换信令服务器重试，
                // 绝不能误走 handlePeerDisconnect 把玩家踢回大厅。
                const timer = setTimeout(() => {
                    if (joined) return;
                    setStatus('连接超时', 'disconnected');
                    reject(new Error('timeout'));
                }, 8000);
                conn.on('open', () => {
                    joined = true;
                    clearTimeout(timer);
                    setStatus('已连接房主', 'connected');
                    startHeartbeat();
                    sendRaw(conn, { type: 'join_request', playerName: playerName });
                    resolve(pid);
                });
                conn.on('data', (data) => handleIncoming(Net.masterPeerId, data));
                conn.on('close', () => {
                    if (joined) { handlePeerDisconnect(Net.masterPeerId); return; }
                    clearTimeout(timer);
                    const e = new Error('连接已关闭'); e.type = 'conn-closed';
                    reject(e);
                });
                conn.on('error', (err) => {
                    if (joined) { handlePeerDisconnect(Net.masterPeerId); return; }
                    clearTimeout(timer);
                    const e = new Error('连接失败');
                    e.type = (err && err.type) ? err.type : 'conn-error';
                    reject(e);
                });
            });
            Net.peer.on('error', (err) => {
                // 已真正连到房主后（joined）的信令抖动才静默；尚未连上时（如 peer-unavailable：
                // 房主不在当前信令服务器）必须 reject，让上层立刻切换其它信令服务器，
                // 而不是因为 _peerOpened 就静默吞掉、干等 8 秒超时。
                if (joined) {
                    const now = Date.now();
                    if (now - Net._lastErrorBanner > 5000) {
                        Net._lastErrorBanner = now;
                        console.warn('Peer error (after open):', err && err.type ? err.type : err);
                    }
                    return;
                }
                setStatus('网络错误', 'disconnected');
                reject(err);
            });
        });
    }
    window.netPlayerJoin = playerJoin;

    // ---------- 统一消息分发 ----------
    function handleIncoming(fromPeerId, data) {
        if (!data || typeof data !== 'object') return;
        // 心跳
        if (data.type === 'ping') {
            if (Net.role === 'master') sendToPeer(fromPeerId, { type: 'pong', t: Date.now() });
            else sendToMaster({ type: 'pong', t: Date.now() });
            return;
        }
        if (data.type === 'pong') { Net._lastPong = Date.now(); return; }
        Net._lastPong = Date.now();
        if (typeof Net.onMessage === 'function') Net.onMessage(fromPeerId, data);
    }

    function handlePeerDisconnect(peerId) {
        if (Net.role === 'master') {
            // 去重：同一个 peerId 的 close+error 只会处理一次，避免重复触发 renderHostWait 导致页面卡死
            if (!Net.conns.has(peerId)) return;
            Net.conns.delete(peerId);
            if (typeof showBanner === 'function') showBanner('有玩家断开了连接', 'warning', null, '📡 断线');
            if (Net.onPeerClose) Net.onPeerClose(peerId);
        } else {
            setStatus('与房主断开', 'disconnected');
            if (typeof showBanner === 'function') showBanner('与房主断开连接，返回大厅', 'error', 5000, '📡 断线');
            if (Net._disconnectRedirectTimer) clearTimeout(Net._disconnectRedirectTimer);
            Net._disconnectRedirectTimer = setTimeout(() => { window.location.href = 'index.html'; }, 2500);
        }
    }
    window.netHandlePeerDisconnect = handlePeerDisconnect;

    // 关闭所有连接
    function netClose(reason) {
        stopHeartbeat();
        if (Net._disconnectRedirectTimer) { clearTimeout(Net._disconnectRedirectTimer); Net._disconnectRedirectTimer = null; }
        try { Net.conns.forEach(c => c.close()); } catch (e) {}
        try { if (Net.masterConn) Net.masterConn.close(); } catch (e) {}
        try { if (Net.peer) Net.peer.destroy(); } catch (e) {}
        Net.conns.clear();
        Net._peerOpened = false;
    }
    window.netClose = netClose;
})();
