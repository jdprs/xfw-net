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
        role: null,
        peer: null,
        peerId: null,
        roomCode: null,
        myPlayerName: '',
        masterPeerId: null,
        conns: new Map(),
        masterConn: null,
        muted: new Set(),
        onMessage: null,
        onPeerOpen: null,
        onPeerClose: null,
        _hbTimer: null,
        _hbTimeoutTimer: null,
        _lastPong: 0,
        _peerOpened: false,
        _lastErrorBanner: 0,
        _disconnectRedirectTimer: null,
        _lastSignal: null,
        _reconnectAttempts: 0,
        _reconnectTimer: null,
        _maxReconnectAttempts: 5
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

    function startHeartbeat() {
        stopHeartbeat();
        Net._hbTimer = setInterval(() => {
            if (Net.role === 'master') {
                broadcastRaw({ type: 'ping', t: Date.now() });
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

    function sendToMaster(obj) {
        Net._lastPong = Date.now();
        return sendRaw(Net.masterConn, obj);
    }
    window.netSendToMaster = sendToMaster;

    function broadcastRaw(obj, excludePeerId) {
        Net.conns.forEach((conn, pid) => {
            if (excludePeerId && pid === excludePeerId) return;
            sendRaw(conn, obj);
        });
    }
    window.netBroadcastRaw = broadcastRaw;

    function sendToPeer(peerId, obj) {
        const conn = Net.conns.get(peerId);
        return sendRaw(conn, obj);
    }
    window.netSendToPeer = sendToPeer;

    async function hostCreate(roomCode, signal, options) {
        return new Promise((resolve, reject) => {
            Net.role = 'master';
            Net.roomCode = roomCode;
            Net._peerOpened = false;
            const id = roomPeerId(roomCode);
            const opts = signal && signal.custom ? {} : { host: signal.host, port: signal.port, secure: signal.secure, key: 'peerjs' };
            let settled = false;
            try {
                Net.peer = new Peer(id, Object.keys(opts).length ? opts : undefined);
            } catch (e) { reject(e); return; }
            setStatus('信令服务器连接中…', 'connecting');
            Net.peer.on('open', (pid) => {
                if (settled) return;
                settled = true;
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
                if (settled) {
                    if (Net._peerOpened) {
                        const now = Date.now();
                        if (now - Net._lastErrorBanner > 5000) {
                            Net._lastErrorBanner = now;
                            console.warn('Peer error (after open):', {
                                type: err && err.type,
                                message: err && err.message,
                                stack: err && err.stack,
                                error: err
                            });
                        }
                    }
                    return;
                }
                settled = true;
                setStatus('网络错误', 'disconnected');
                const msg = (err && err.type) ? ('信令错误：' + err.type) : '网络连接失败';
                const suppressError = options && Array.isArray(options.suppressErrorTypes) && options.suppressErrorTypes.includes(err && err.type);
                console.error('Peer hostCreate error:', {
                    type: err && err.type,
                    message: err && err.message,
                    stack: err && err.stack,
                    error: err,
                    roomCode: roomCode,
                    peerId: id,
                    signal: signal
                });
                if (!suppressError && typeof showBanner === 'function') showBanner(msg, 'error', null, '联机错误', '📡');
                reject(err);
            });
        });
    }
    window.netHostCreate = hostCreate;

    async function playerJoin(roomCode, signal, playerName) {
        return new Promise((resolve, reject) => {
            Net.role = 'player';
            Net.roomCode = roomCode;
            Net.myPlayerName = playerName;
            Net._lastSignal = signal;
            Net._peerOpened = false;
            Net.masterPeerId = roomPeerId(roomCode);
            const opts = signal && signal.custom ? {} : { host: signal.host, port: signal.port, secure: signal.secure, key: 'peerjs' };
            let joined = false;
            let settled = false;
            function safeReject(err) {
                if (settled) return;
                settled = true;
                reject(err);
            }
            function safeResolve(pid) {
                if (settled) return;
                settled = true;
                resolve(pid);
            }
            try {
                Net.peer = new Peer(Object.keys(opts).length ? opts : undefined);
            } catch (e) { safeReject(e); return; }
            setStatus('正在连接房主…', 'connecting');
            Net.peer.on('open', (pid) => {
                Net._peerOpened = true;
                Net.peerId = pid;
                const conn = Net.peer.connect(Net.masterPeerId, { reliable: true });
                Net.masterConn = conn;
                const timer = setTimeout(() => {
                    if (joined || settled) return;
                    setStatus('连接超时', 'disconnected');
                    safeReject(new Error('timeout'));
                }, 8000);
                conn.on('open', () => {
                    if (settled) return;
                    joined = true;
                    clearTimeout(timer);
                    setStatus('已连接房主', 'connected');
                    startHeartbeat();
                    let savedPlayerId = null;
                    try {
                        const myseat = JSON.parse(localStorage.getItem('xfw_myseat') || '{}');
                        savedPlayerId = myseat.playerId;
                    } catch (e) {}
                    sendRaw(conn, { type: 'join_request', playerName: playerName, playerId: savedPlayerId });
                    safeResolve(pid);
                });
                conn.on('data', (data) => handleIncoming(Net.masterPeerId, data));
                conn.on('close', () => {
                    if (settled) return;
                    if (joined) { handlePeerDisconnect(Net.masterPeerId); return; }
                    clearTimeout(timer);
                    const e = new Error('连接已关闭'); e.type = 'conn-closed';
                    safeReject(e);
                });
                conn.on('error', (err) => {
                    if (settled) return;
                    if (joined) { handlePeerDisconnect(Net.masterPeerId); return; }
                    clearTimeout(timer);
                    const e = new Error('连接失败');
                    e.type = (err && err.type) ? err.type : 'conn-error';
                    safeReject(e);
                });
            });
            Net.peer.on('error', (err) => {
                if (settled) {
                    if (joined) {
                        const now = Date.now();
                        if (now - Net._lastErrorBanner > 5000) {
                            Net._lastErrorBanner = now;
                            console.warn('Peer error (after open):', err && err.type ? err.type : err);
                        }
                    }
                    return;
                }
                setStatus('网络错误', 'disconnected');
                safeReject(err);
            });
        });
    }
    window.netPlayerJoin = playerJoin;

    function handleIncoming(fromPeerId, data) {
        if (!data || typeof data !== 'object') return;
        if (data.type === 'ping') {
            if (Net.role === 'master') sendToPeer(fromPeerId, { type: 'pong', t: Date.now() });
            else sendToMaster({ type: 'pong', t: Date.now() });
            return;
        }
        if (data.type === 'pong') { Net._lastPong = Date.now(); return; }
        Net._lastPong = Date.now();
        if (typeof Net.onMessage === 'function') Net.onMessage(fromPeerId, data);
    }

    function tryReconnect() {
        if (Net.role !== 'player') return;
        if (Net._reconnectAttempts >= Net._maxReconnectAttempts) {
            setStatus('重连失败，请返回大厅', 'disconnected');
            if (typeof showBanner === 'function') showBanner('重连失败，请返回大厅重新加入', 'error', null, '重连失败', '📡');
            return;
        }
        Net._reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, Net._reconnectAttempts - 1), 8000);
        setStatus(`与房主断开，${delay / 1000}秒后第${Net._reconnectAttempts}次重连…`, 'connecting');
        Net._reconnectTimer = setTimeout(async () => {
            try {
                try { if (Net.masterConn) Net.masterConn.close(); } catch (e) {}
                try { if (Net.peer) Net.peer.destroy(); } catch (e) {}
                Net.masterConn = null;
                Net.peer = null;
                await playerJoin(Net.roomCode, Net._lastSignal, Net.myPlayerName);
                Net._reconnectAttempts = 0;
                setStatus('已重连房主', 'connected');
                if (typeof showBanner === 'function') showBanner('已重新连接房主', 'success', null, '重连成功', '🔌');
                if (typeof Net.onReconnect === 'function') Net.onReconnect();
            } catch (e) {
                console.warn('Reconnect attempt failed:', Net._reconnectAttempts, e);
                tryReconnect();
            }
        }, delay);
    }

    function handlePeerDisconnect(peerId) {
        // v10.0.16: 主动跳转游戏页时关闭连接是预期行为，不弹断连横幅
        if (Net._navigating) return;
        if (Net.role === 'master') {
            if (!Net.conns.has(peerId)) return;
            Net.conns.delete(peerId);
            if (typeof showBanner === 'function') showBanner('有玩家断开了连接', 'warning', null, '断线', '📡');
            if (Net.onPeerClose) Net.onPeerClose(peerId);
        } else {
            setStatus('与房主断开', 'disconnected');
            if (typeof showBanner === 'function') showBanner('与房主断开连接，正在尝试重连…', 'warning', null, '断线', '📡');
            if (Net._disconnectRedirectTimer) clearTimeout(Net._disconnectRedirectTimer);
            Net._disconnectRedirectTimer = null;
            if (Net._lastSignal && Net.roomCode && typeof window !== 'undefined' && window.GAME_MODE === 'player') {
                tryReconnect();
            }
        }
    }
    window.netHandlePeerDisconnect = handlePeerDisconnect;

    function netClose(reason) {
        stopHeartbeat();
        if (Net._reconnectTimer) { clearTimeout(Net._reconnectTimer); Net._reconnectTimer = null; }
        Net._reconnectAttempts = 0;
        if (Net._disconnectRedirectTimer) { clearTimeout(Net._disconnectRedirectTimer); Net._disconnectRedirectTimer = null; }
        try { Net.conns.forEach(c => c.close()); } catch (e) {}
        try { if (Net.masterConn) Net.masterConn.close(); } catch (e) {}
        try { if (Net.peer) Net.peer.destroy(); } catch (e) {}
        Net.conns.clear();
        Net._peerOpened = false;
    }
    window.netClose = netClose;

    function netCloseAndWait(timeoutMs) {
        return new Promise((resolve) => {
            const peer = Net.peer;
            if (!peer || peer.destroyed) {
                netClose();
                resolve();
                return;
            }
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                resolve();
            };
            const timer = setTimeout(finish, timeoutMs || 3000);
            peer.on('close', finish);
            netClose();
        });
    }
    window.netCloseAndWait = netCloseAndWait;
})();