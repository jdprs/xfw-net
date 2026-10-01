//  34. 历史记录面板（v9.2）
        //  每轮收盘时由 closeMarket 记录 roundHistory 快照，
        //  本模块负责渲染「历史记录」弹窗：按轮次展示股票行情、玩家资产与事件。
        // ================================================================

        function openHistoryModal() {
            renderHistorySummary();
            renderHistoryList();
            document.getElementById('history-modal').style.display = 'flex';
        }

        function closeHistoryModal() {
            document.getElementById('history-modal').style.display = 'none';
        }

        function renderHistorySummary() {
            let el = document.getElementById('history-summary');
            if (!roundHistory || roundHistory.length === 0) {
                el.innerHTML = '<div class="history-empty">📭 暂无历史记录，每轮收盘后系统会自动记录行情与资产快照。</div>';
                return;
            }
            let last = roundHistory[roundHistory.length - 1];
            let winners = [...last.players].sort((a, b) => b.total - a.total);
            el.innerHTML =
                `<div class="history-summary-stats">
                    <span>🗓️ 已记录 <b>${roundHistory.length}</b> 轮</span>
                    <span>💼 银行资产 ${fmt(last.bankAssets)}</span>
                    <span>🥇 当前领先：${winners[0].name}（${fmt(winners[0].total)}）</span>
                </div>`;
        }

        function renderHistoryList() {
            let el = document.getElementById('history-list');
            el.innerHTML = '';
            if (!roundHistory || roundHistory.length === 0) return;

            for (let i = roundHistory.length - 1; i >= 0; i--) {
                let snap = roundHistory[i];
                let entry = document.createElement('div');
                entry.className = 'history-round';

                let hdr = document.createElement('div');
                hdr.className = 'history-round-header';
                hdr.innerHTML = `<span>📌 第 ${snap.round} 轮</span><span class="history-toggle">▶</span>`;
                hdr.onclick = () => {
                    entry.classList.toggle('expanded');
                    let t = hdr.querySelector('.history-toggle');
                    if (t) t.textContent = entry.classList.contains('expanded') ? '▼' : '▶';
                };

                let body = document.createElement('div');
                body.className = 'history-round-body';

                // —— 股票行情 ——
                let sHtml = '<div class="history-block-title">📈 股票行情</div>';
                (snap.stocks || []).forEach(s => {
                    let pct = calcStockPct(i, s.key, s.price);
                    let cls = pct >= 0 ? 'hist-up' : 'hist-down';
                    sHtml += `<div class="history-row"><span>${s.name}</span><span class="${cls}">${fmt(s.price)}（${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%）</span></div>`;
                });
                (snap.customStocks || []).forEach(cs => {
                    let m = cs.multiplier || 1;
                    let pct = (m - 1) * 100;
                    let cls = pct >= 0 ? 'hist-up' : 'hist-down';
                    sHtml += `<div class="history-row"><span>${cs.name}（自建）</span><span class="${cls}">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</span></div>`;
                });
                if (snap.darkHorse && snap.darkHorse.active) {
                    sHtml += `<div class="history-row"><span>🐴 黑马股</span><span class="hist-dark">${snap.darkHorse.name} × ${snap.darkHorse.multiplier}</span></div>`;
                }

                // —— 玩家资产 ——
                let pHtml = '<div class="history-block-title">👤 玩家资产</div>';
                let sorted = [...(snap.players || [])].sort((a, b) => b.total - a.total);
                sorted.forEach(pl => {
                    let tag = pl.bankrupt ? ' 💀破产' : (pl.isExternal ? ' 🌐外接' : pl.isAI ? ' 🤖AI' : ' 🙋真人');
                    pHtml += `<div class="history-row"><span>${pl.name}${tag}</span><span class="hist-asset">${fmt(pl.total)}（现金 ${fmt(pl.cash)}）</span></div>`;
                });

                // —— 本轮事件 ——
                let ev = snap.events || { lotteryWins: [], lotteryScams: [], predictions: [] };
                let eHtml = '<div class="history-block-title">🎲 本轮事件</div>';
                if (ev.predictions.length || ev.lotteryWins.length || ev.lotteryScams.length) {
                    ev.predictions.forEach(t => { eHtml += `<div class="history-row hist-event">🔮 ${t}</div>`; });
                    ev.lotteryWins.forEach(t => { eHtml += `<div class="history-row hist-event">🎉 ${t}</div>`; });
                    ev.lotteryScams.forEach(t => { eHtml += `<div class="history-row hist-event">💔 ${t}</div>`; });
                } else {
                    eHtml += '<div class="history-row hist-event" style="opacity:0.6;">本轮无特殊事件</div>';
                }

                body.innerHTML = sHtml + pHtml + eHtml;
                entry.appendChild(hdr);
                entry.appendChild(body);
                el.appendChild(entry);
            }

            // 默认展开最新一轮
            if (el.children.length > 0) {
                el.children[0].classList.add('expanded');
                let t = el.children[0].querySelector('.history-toggle');
                if (t) t.textContent = '▼';
            }
        }

        // 计算第 idx 个快照中某只基础股票的涨跌幅（相对上一轮快照；若无上轮则按初始价）
        function calcStockPct(idx, key, price) {
            let prev = null;
            if (idx > 0) {
                let p = (roundHistory[idx - 1].stocks || []).find(s => s.key === key);
                if (p) prev = p.price;
            }
            if (prev === null || prev === undefined) prev = INIT_SHARE_PRICE || 100;
            if (!prev) return 0;
            return (price - prev) / prev * 100;
        }

        // —— 事件绑定（v9.2）——
        let historyBtn = document.getElementById('history-btn');
        if (historyBtn) historyBtn.addEventListener('click', openHistoryModal);
        let historyCloseBtn = document.getElementById('history-close-btn');
        if (historyCloseBtn) historyCloseBtn.addEventListener('click', closeHistoryModal);
        let historyModal = document.getElementById('history-modal');
        if (historyModal) {
            historyModal.addEventListener('mousedown', function(e) {
                if (e.target === historyModal) closeHistoryModal();
            });
        }

        // ================================================================
