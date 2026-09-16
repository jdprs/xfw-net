/* ================================================================
 * 39. 聊天系统 (v10.0)
 * 可折叠聊天面板；消息经 P2P 广播；房主端过滤被禁言玩家
 * ================================================================
 */
(() => {
    const Chat = {
        history: [],
        maxHistory: 100,
        panel: null,
        body: null
    };
    window.Chat = Chat;

    function nowTime() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    // v10.7: 让网络状态栏浮动在聊天框左上方（聊天框左侧、顶部之上），不遮挡日志
    function placeStatusBar() {
        const bar = document.querySelector('.net-status-bar');
        if (!bar) return;
        bar.style.right = '322px';
        const chat = document.getElementById('chat-panel');
        if (chat) {
            bar.style.bottom = (chat.offsetHeight + 20) + 'px';
        } else {
            bar.style.bottom = '12px';
        }
    }
    window.placeNetStatusBar = placeStatusBar;

    function ensurePanel() {
        if (Chat.panel) return;
        const panel = document.createElement('div');
        panel.className = 'chat-panel';
        panel.id = 'chat-panel';
        panel.innerHTML = `
            <div class="chat-header" id="chat-header">
                <span>💬 聊天室</span>
                <span id="chat-toggle">▾</span>
            </div>
            <div class="chat-body" id="chat-body"></div>
            <div class="chat-input-row">
                <input type="text" id="chat-input" placeholder="发送消息…" maxlength="200" autocomplete="off">
                <button class="btn btn-primary btn-sm" id="chat-send">发送</button>
            </div>`;
        document.body.appendChild(panel);
        Chat.panel = panel;
        Chat.body = panel.querySelector('#chat-body');

        panel.querySelector('#chat-header').onclick = () => {
            panel.classList.toggle('collapsed');
            panel.querySelector('#chat-toggle').textContent = panel.classList.contains('collapsed') ? '▴' : '▾';
            // v10.7: 折叠/展开后重新定位状态栏
            placeStatusBar();
        };
        panel.querySelector('#chat-send').onclick = send;
        panel.querySelector('#chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') send();
        });
        // v10.7: 聊天框创建后定位状态栏
        placeStatusBar();
        // 重放历史
        Chat.history.forEach(m => renderMsg(m));
    }

    function send() {
        const input = document.getElementById('chat-input');
        const text = (input.value || '').trim();
        if (!text) return;
        input.value = '';
        const msg = {
            // v10.6: 玩家端优先用房间内注册名，其次大厅昵称
            playerName: (window.Sync && window.Sync.myName) ? window.Sync.myName : (window.Lobby ? Lobby.username : '玩家'),
            text: text,
            timestamp: Date.now()
        };
        if (window.GAME_MODE === 'master') {
            // 房主直接广播
            netBroadcastRaw({ type: 'chat_message', playerName: msg.playerName, text, timestamp: msg.timestamp });
            append(msg, true);
        } else if (window.GAME_MODE === 'player') {
            // v10.5: 玩家端先本地显示自己的消息，再发送给房主（房主转发给其他玩家）
            append(msg, true);
            netSendToMaster({ type: 'chat_message', playerName: msg.playerName, text, timestamp: msg.timestamp });
        }
    }
    window.chatSend = send;

    function append(msg, local) {
        const item = {
            playerName: msg.playerName || msg.name || '玩家',
            text: msg.text,
            timestamp: msg.timestamp || Date.now(),
            system: false
        };
        Chat.history.push(item);
        if (Chat.history.length > Chat.maxHistory) Chat.history.shift();
        if (Chat.body) renderMsg(item);
    }
    Chat.append = append;

    function appendSystem(text) {
        const item = { text, timestamp: Date.now(), system: true };
        Chat.history.push(item);
        if (Chat.history.length > Chat.maxHistory) Chat.history.shift();
        if (Chat.body) renderMsg(item);
    }
    Chat.appendSystem = appendSystem;

    function renderMsg(m) {
        if (!Chat.body) return;
        const div = document.createElement('div');
        if (m.system) {
            div.className = 'chat-msg system';
            div.textContent = m.text;
        } else {
            div.className = 'chat-msg';
            div.innerHTML = `<span class="cm-name"></span><span class="cm-time"></span><span class="cm-text"></span>`;
            div.querySelector('.cm-name').textContent = m.playerName + '：';
            div.querySelector('.cm-time').textContent = new Date(m.timestamp).toTimeString().slice(0, 5);
            div.querySelector('.cm-text').textContent = m.text;
        }
        Chat.body.appendChild(div);
        Chat.body.scrollTop = Chat.body.scrollHeight;
    }

    function init() {
        const mode = window.GAME_MODE || 'local';
        if (mode === 'master' || mode === 'player') {
            // v10.1: 不在页面加载时立即创建聊天框，等游戏真正开始后由
            // 38-game-sync 调用 chatActivate() 再创建，
            // 避免浏览器恢复标签页/房间失效时残留聊天框等联机元素。
            window.Chat.activate = ensurePanel;
        }
    }
    // 供 38-game-sync 在游戏开始（房主启动 / 玩家收到首个状态）时调用
    window.chatActivate = function() {
        if (window.Chat && typeof window.Chat.activate === 'function') {
            window.Chat.activate();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
