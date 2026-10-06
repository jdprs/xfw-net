/* ============================================================
   42. 帮助内容（统一注入所有页面，含联机页）
   从 index.html 抽出的游戏规则说明，所有页面注入 #help-content-body，
   修复联机页帮助内容为空的问题。文案由 43-i18n.js 在英文模式下翻译。
   ============================================================ */
(function () {
    function buildHelpContent(lang) {
        if ((lang || window.LANG) === 'en') return buildHelpContentEn();
        return `
            <h2>📖 游戏规则详解</h2>

            <div class="help-section">
                <h3>🎯 游戏目标</h3>
                <p>在 <span class="highlight">总轮数</span> 内，通过股票投资、彩票、自建股等方式积累资产，成为总资产最高的玩家。</p>
                <p>总资产 = 💵 现金 + 📈 股票市值（持股数 × 股价）+ 🏢 自建股投资。</p>
                <div class="help-rule-box">
                    <p>⚠️ 总资产低于 <span class="danger">破产阈值</span>（默认 100 元）即判定 <span class="danger">破产</span>，清空所有资产。</p>
                    <p>💡 v9.1 改进：收盘时统一检测破产，并自动发放 <span class="highlight">破产救助金</span>（默认 1000 元），帮助玩家继续游戏。</p>
                </div>
            </div>

            <div class="help-section">
                <h3>📊 股票类型</h3>
                <p>四只基础股票，各有不同的波动特性，适合不同风险偏好的玩家。</p>
                <div class="stock-info-grid" id="help-stock-grid"></div>
                <p style="margin-top:6px;font-size:0.85rem;">💡 股价每日变动，涨跌幅基于算法生成，受 <span class="highlight">市场事件</span> 和 <span class="highlight">黑马股</span> 影响。</p>
            </div>

            <div class="help-section">
                <h3>🐴 黑马股</h3>
                <p>每轮有 <span class="highlight">概率</span> 随机一只股票成为「黑马」，其涨跌幅乘以 <span class="highlight">倍率</span>（默认 2 倍）。</p>
                <p>黑马股出现时会有横幅提示，抓住机会可以获得超额收益！</p>
            </div>

            <div class="help-section">
                <h3>🔮 股神预测</h3>
                <p>每轮你可以对某只股票进行 <span class="highlight">方向预测</span>（上涨 / 下跌 / 持平），押注金额上限为 <span class="danger">总资产的 5%</span>。</p>
                <ul>
                    <li>✅ <span class="success">预测正确</span>：获得押注 × <span class="highlight">2.5</span> 倍奖金。</li>
                    <li>❌ <span class="danger">预测错误</span>：押金 <span class="danger">全部没收</span>（不返还）。</li>
                    <li>📌 <span class="info">持平判定</span>：股价变化在 <span class="highlight">±1.5%</span> 以内视为持平。</li>
                    <li>📌 预测 <span class="highlight">上涨/下跌</span> 但实际持平时，押金 <span class="danger">没收</span>。</li>
                </ul>
                <p style="font-size:0.85rem;margin-top:4px;">⚠️ A股 <span class="success">只涨不跌</span>，因此下跌选项不可用。</p>
            </div>

            <div class="help-section">
                <h3>⭐ 投资组合评级</h3>
                <p>系统根据你的 <span class="highlight">持仓分散度</span> 和 <span class="highlight">总资产</span> 进行评级（S / A / B / C / D），评级越高奖励越多。</p>
                <ul>
                    <li><span class="highlight">S 级</span>：奖励总资产 × 15%</li>
                    <li><span class="highlight">A 级</span>：奖励总资产 × 10%</li>
                    <li><span class="highlight">B 级</span>：奖励总资产 × 6%</li>
                    <li><span class="highlight">C 级</span>：奖励总资产 × 3%</li>
                    <li><span class="highlight">D 级</span>：无奖励</li>
                </ul>
                <p style="font-size:0.85rem;">💡 分散投资于多只股票，避免单一持仓过重，有助于获得更高评级。</p>
            </div>

            <div class="help-section">
                <h3>🎫 彩票系统</h3>
                <p>每轮可购买多种彩票，每张彩票有 <span class="highlight">中奖概率</span> 和 <span class="danger">诈骗风险</span>。</p>
                <ul>
                    <li>🎉 <span class="success">中奖</span>：获得现金 × 奖励比例 + 奖池分成。</li>
                    <li>💀 <span class="danger">诈骗</span>：可能被罚款甚至 <span class="danger">破产</span>！</li>
                </ul>
                <p style="font-size:0.85rem;">⚠️ 彩票是高风险高回报的玩法，请谨慎参与！</p>
            </div>

            <div class="help-section">
                <h3>✨ 自建股</h3>
                <p>玩家可以 <span class="highlight">创建</span> 自己的股票，设定上涨利率和利润留存比例。</p>
                <ul>
                    <li>创建者 <span class="danger">不能</span> 投资自己创建的股票。</li>
                    <li>其他玩家可以投资自建股（以金额计），共享涨跌。</li>
                    <li>自建股也会受到 <span class="highlight">黑马股</span> 机制影响。</li>
                </ul>
            </div>

            <div class="help-section">
                <h3>🏅 成就系统</h3>
                <p>游戏内置 <span class="highlight">9 项成就</span>（v9.1 移除「破产者」成就），达成后按 <span class="highlight">当前总资产</span> 比例获得奖励。</p>
                <p>成就包括：首次投资、投资达人、股神、彩票幸运儿、彩票倒霉蛋、百万富翁、交易狂、稳健投资者、冒险家。</p>
            </div>

            <div class="help-section">
                <h3>⚡ 掠夺机制</h3>
                <p>当 <span class="highlight">银行资产</span> 低于 <span class="danger">掠夺阈值</span>（默认 ¥8,000）时，触发掠夺模式。</p>
                <p>系统会从 <span class="highlight">高资产玩家</span> 中征收 "掠夺税"，补充银行资金，防止银行破产。</p>
            </div>

            <div class="help-section">
                <h3>🚫 股票跑路（v9.3）</h3>
                <p>掠夺模式触发后，<span class="danger">下一轮</span>有 <span class="highlight">50% 概率</span>随机封掉一只股票（老板跑路）。</p>
                <ul>
                    <li>被封股票：所有玩家<span class="danger">持仓清零</span>，无法买卖、无法预测，价格冻结。</li>
                    <li>银行仍告急时，下一轮继续 50% 概率封股，可能同时封多只。</li>
                    <li><span class="highlight">4 轮后</span>该股票重新上市，价格重置为初始价（默认 ¥100）。</li>
                    <li>⚠️ 之前投资的持仓<span class="danger">不会恢复</span>，损失由玩家自行承担。</li>
                </ul>
                <p style="font-size:0.8rem;color:var(--text-secondary);">示例：第 11 轮触发掠夺 → 第 12 轮封 A 股 → 第 16 轮 A 股重开（价格重置）。</p>
            </div>

            <div class="help-section">
                <h3>🌐 外接AI</h3>
                <p>支持接入 <span class="highlight">外部AI</span>（如 ChatGPT、Claude 等）代为决策。</p>
                <ul>
                    <li><span class="info">指令模式</span>：复制系统生成的指令文本，粘贴到外部AI，再将回复粘贴回游戏。</li>
                    <li><span class="info">API模式</span>：配置 API 密钥和端点，系统自动调用外部AI决策。</li>
                </ul>
                <p style="font-size:0.85rem;">💡 外接AI拥有完整的市场信息和决策能力，可帮你制定更优策略。</p>
                <p style="font-size:0.85rem;">📌 v9.1 外接AI支持：买入/卖出股票、投资/取回自建股、购买彩票、股神预测、创建自建股等全部操作。</p>
            </div>

            <div class="help-section">
                <h3>🌐 联机玩法 (v10.0)</h3>
                <p>v10.0 新增基于 <span class="highlight">P2P 点对点</span> 的联机对战功能，无需服务器，浏览器直连。</p>
                <ul>
                    <li><span class="info">创建房间</span>：点击「联机开始」→ 输入昵称 → 创建房间，系统生成 6 位房间号。</li>
                    <li><span class="info">加入房间</span>：朋友输入 6 位房间号加入。</li>
                    <li><span class="info">等待室</span>：房主可设置房间人数、内置/外接 AI 数、总轮数；等待 5 分钟内随时「开始游戏」。</li>
                    <li><span class="info">聊天</span>：游戏右下角聊天面板可与其他玩家交流，房主可禁言刷屏者。</li>
                    <li><span class="danger">房主权限</span>：房主作为权威端维护状态，可「跳过回合」「强制收盘」「禁言」「结束游戏」。</li>
                    <li>玩家端不运行计算，所有操作发送给房主后由房主统一下发最新状态，保证所有人数据一致。</li>
                </ul>
                <p style="font-size:0.85rem;">💡 联机使用免费公共信令服务器（peerjs），如连不上可在创建房间时切换信令服务器或填写自建服务器地址。</p>
            </div>

            <div class="help-section">
                <h3>📌 操作提示</h3>
                <ul>
                    <li>所有金额均为 <span class="highlight">整数（元）</span>，输入股份数后系统自动计算金额。</li>
                    <li>点击「<span class="highlight">上限</span>」按钮自动填入当前现金可买的最大股数。</li>
                    <li>每轮点击「<span class="highlight">决策</span>」开始操作，完成后点击「<span class="highlight">完成</span>」。</li>
                    <li>所有玩家完成决策后，点击「<span class="highlight">收盘</span>」进入下一轮。</li>
                    <li>游戏支持 <span class="highlight">存档</span> 和 <span class="highlight">存档码</span> 导出/导入，方便跨设备游玩。</li>
                    <li>v9.1 新增「<span class="highlight">直接结束游戏</span>」按钮，可随时终止当前对局。</li>
                </ul>
            </div>

            <div class="help-copy-row">
                <button class="btn btn-gold" id="help-copy-btn">📋 复制帮助内容</button>
                <button class="btn btn-primary" id="help-close-btn">关闭帮助</button>
            </div>
        
        `;
    }
    function buildHelpContentEn() {
        return `
            <h2>📖 Game Rules</h2>

            <div class="help-section">
                <h3>🎯 Goal</h3>
                <p>Within <span class="highlight">total rounds</span>, build wealth through stock trading, lottery and custom stocks to become the player with the <span class="highlight">highest total assets</span>.</p>
                <p>Total Assets = 💵 Cash + 📈 Stock Value (shares × price) + 🏢 Custom Stock Investment.</p>
                <div class="help-rule-box">
                    <p>⚠️ If total assets fall below the <span class="danger">bankruptcy line</span> (default ¥100) you are judged <span class="danger">bankrupt</span> and all assets are cleared.</p>
                    <p>💡 v9.1: Bankruptcy is checked uniformly at close, and a <span class="highlight">bankruptcy aid</span> (default ¥1000) is auto-granted so you can keep playing.</p>
                </div>
            </div>

            <div class="help-section">
                <h3>📊 Stock Types</h3>
                <p>Four base stocks, each with its own volatility profile, suit players of different risk appetite.</p>
                <div class="stock-info-grid" id="help-stock-grid"></div>
                <p style="margin-top:6px;font-size:0.85rem;">💡 Prices change daily; the change is algorithm-driven and affected by <span class="highlight">market events</span> and <span class="highlight">dark horse</span> stocks.</p>
            </div>

            <div class="help-section">
                <h3>🐴 Dark Horse</h3>
                <p>Each round there is a <span class="highlight">chance</span> that one stock becomes a “Dark Horse”; its change is multiplied by a <span class="highlight">multiplier</span> (default 2×).</p>
                <p>When a dark horse appears a banner shows — seize the chance for extra profit!</p>
            </div>

            <div class="help-section">
                <h3>🔮 Stock Prediction</h3>
                <p>Each round you may make a <span class="highlight">direction prediction</span> (Up / Down / Flat) on a stock; the bet cap is <span class="danger">5% of your total assets</span>.</p>
                <ul>
                    <li>✅ <span class="success">Correct</span>: you win bet × <span class="highlight">2.5</span> bonus.</li>
                    <li>❌ <span class="danger">Wrong</span>: your deposit is <span class="danger">fully confiscated</span> (not returned).</li>
                    <li>📌 <span class="info">Flat rule</span>: a price change within <span class="highlight">±1.5%</span> counts as flat.</li>
                    <li>📌 Predicting <span class="highlight">Up/Down</span> but price ends flat: deposit is <span class="danger">confiscated</span>.</li>
                </ul>
                <p style="font-size:0.85rem;margin-top:4px;">⚠️ A-stock <span class="success">only rises</span>, so the Down option is disabled for it.</p>
            </div>

            <div class="help-section">
                <h3>⭐ Portfolio Rating</h3>
                <p>You are rated (S / A / B / C / D) by your <span class="highlight">portfolio diversification</span> and <span class="highlight">total assets</span>; a higher rating gives bigger rewards.</p>
                <ul>
                    <li><span class="highlight">S</span>: reward total assets × 15%</li>
                    <li><span class="highlight">A</span>: reward total assets × 10%</li>
                    <li><span class="highlight">B</span>: reward total assets × 6%</li>
                    <li><span class="highlight">C</span>: reward total assets × 3%</li>
                    <li><span class="highlight">D</span>: no reward</li>
                </ul>
                <p style="font-size:0.85rem;">💡 Diversify across stocks instead of over-concentrating for a higher rating.</p>
            </div>

            <div class="help-section">
                <h3>🎫 Lottery</h3>
                <p>Each round you can buy several lottery tickets; each has a <span class="highlight">win chance</span> and a <span class="danger">scam risk</span>.</p>
                <ul>
                    <li>🎉 <span class="success">Win</span>: get cash × reward ratio plus jackpot share.</li>
                    <li>💀 <span class="danger">Scam</span>: you may be fined or even go <span class="danger">bankrupt</span>!</li>
                </ul>
                <p style="font-size:0.85rem;">⚠️ Lottery is high-risk, high-reward — play carefully!</p>
            </div>

            <div class="help-section">
                <h3>✨ Custom Stocks</h3>
                <p>Players can <span class="highlight">create</span> their own stock, setting an up-rate and a profit-retention ratio.</p>
                <ul>
                    <li>The creator <span class="danger">cannot</span> invest in their own stock.</li>
                    <li>Other players can invest in a custom stock (by amount) and share its ups and downs.</li>
                    <li>Custom stocks are also affected by the <span class="highlight">dark horse</span> mechanic.</li>
                </ul>
            </div>

            <div class="help-section">
                <h3>🏅 Achievements</h3>
                <p>The game has <span class="highlight">9 achievements</span> (the “Bankrupt” one was removed in v9.1); each grants a reward proportional to your <span class="highlight">current total assets</span>.</p>
                <p>Achievements: First Investment, Investment Pro, Stock God, Lottery Lucky, Lottery Unlucky, Millionaire, Trade Maniac, Steady Investor, Adventurer.</p>
            </div>

            <div class="help-section">
                <h3>⚡ Plunder</h3>
                <p>When <span class="highlight">bank assets</span> fall below the <span class="danger">plunder threshold</span> (default ¥8,000), plunder mode triggers.</p>
                <p>The system levies a “plunder tax” on <span class="highlight">high-asset players</span> to refill the bank and prevent bank bankruptcy.</p>
            </div>

            <div class="help-section">
                <h3>🚫 Stock Runs Away (v9.3)</h3>
                <p>After plunder triggers, the <span class="danger">next round</span> has a <span class="highlight">50% chance</span> to block one stock (the boss flees).</p>
                <ul>
                    <li>Blocked stock: all players’ <span class="danger">holdings are cleared</span>; no trading, no predicting, price frozen.</li>
                    <li>While the bank is still in trouble, the next round again has a 50% chance to block a stock — several may be blocked at once.</li>
                    <li>After <span class="highlight">4 rounds</span> the stock is re-listed with the price reset to its initial value (default ¥100).</li>
                    <li>⚠️ Previous holdings are <span class="danger">not restored</span>; the loss is borne by the players.</li>
                </ul>
                <p style="font-size:0.8rem;color:var(--text-secondary);">Example: plunder triggers in round 11 → A-stock is blocked in round 12 → A-stock reopens in round 16 (price reset).</p>
            </div>

            <div class="help-section">
                <h3>🌐 External AI</h3>
                <p>Support for plugging in an <span class="highlight">external AI</span> (ChatGPT, Claude, etc.) to decide for you.</p>
                <ul>
                    <li><span class="info">Command mode</span>: copy the generated command text, paste it to an external AI, then paste its reply back.</li>
                    <li><span class="info">API mode</span>: configure an API key and endpoint; the game calls the external AI automatically.</li>
                </ul>
                <p style="font-size:0.85rem;">💡 An external AI has full market info and can help you devise a better strategy.</p>
                <p style="font-size:0.85rem;">📌 v9.1 external AI supports all operations: buy/sell stock, invest/withdraw custom stock, buy lottery, predict, create custom stock, and more.</p>
            </div>

            <div class="help-section">
                <h3>🌐 Online Play (v10.0)</h3>
                <p>v10.0 adds browser-to-browser <span class="highlight">P2P</span> online battles — no server needed.</p>
                <ul>
                    <li><span class="info">Create room</span>: click “Start Online” → enter a nickname → create a room; a 6-digit room code is generated.</li>
                    <li><span class="info">Join room</span>: a friend enters the 6-digit room code to join.</li>
                    <li><span class="info">Waiting room</span>: the host sets room size, built-in/external AI count and total rounds; anyone can “Start Game” within 5 minutes.</li>
                    <li><span class="info">Chat</span>: the chat panel at the bottom-right lets you talk to other players; the host can mute spammers.</li>
                    <li><span class="danger">Host rights</span>: as the authoritative end the host maintains state and can “Skip Turn”, “Force Close”, “Mute” and “End Game”.</li>
                    <li>Players run no calculations; all actions are sent to the host, who broadcasts the latest state so everyone stays in sync.</li>
                </ul>
                <p style="font-size:0.85rem;">💡 Online play uses the free public PeerJS signaling server; if it fails, switch servers or fill in a self-hosted one when creating a room.</p>
            </div>

            <div class="help-section">
                <h3>📌 Tips</h3>
                <ul>
                    <li>All amounts are <span class="highlight">whole yuan</span>; enter a share count and the system calculates the amount.</li>
                    <li>Click the “<span class="highlight">Max</span>” button to auto-fill the most shares your cash can buy.</li>
                    <li>Each round click “<span class="highlight">Start</span>” to act, then “<span class="highlight">Done</span>” when finished.</li>
                    <li>After all players finish, click “<span class="highlight">Close</span>” to enter the next round.</li>
                    <li>The game supports <span class="highlight">saving</span> and <span class="highlight">save codes</span> for cross-device play.</li>
                    <li>v9.1 added a “<span class="highlight">End Game Now</span>” button to stop the current match anytime.</li>
                </ul>
            </div>

            <div class="help-copy-row">
                <button class="btn btn-gold" id="help-copy-btn">📋 Copy Help</button>
                <button class="btn btn-primary" id="help-close-btn">Close Help</button>
            </div>
        
        `;
    }
    window.buildHelpContent = buildHelpContent;
    function inject(lang) {
        var host = document.getElementById('help-content-body');
        if (host) {
            host.innerHTML = buildHelpContent(lang);
            host.setAttribute('data-help-filled', '1');
        }
    }
    // 供 i18n 在语言切换/就绪后显式重注入帮助内容
    window.refreshHelp = function (lang) { inject(lang || window.LANG); };
    function boot() {
        inject(window.LANG);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
