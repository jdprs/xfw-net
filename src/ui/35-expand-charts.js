//  35. 展开图表总览（v9.2）
        //  在两个主图表下方点击「展开图表」按钮打开，
        //  分「玩家涨跌」「股票涨跌」两个页签，用迷你折线图逐个展示
        //  每位玩家的资产走势与每只股票的涨跌幅走势。
        // ================================================================

        let expandTab = 'players';
        let expandCharts = [];

        function openExpandCharts() {
            document.getElementById('expand-overlay').style.display = 'flex';
            switchExpandTab('players');
        }

        function closeExpandCharts() {
            destroyExpandCharts();
            document.getElementById('expand-overlay').style.display = 'none';
        }

        function switchExpandTab(tab) {
            expandTab = tab;
            document.querySelectorAll('.expand-tab').forEach(b => {
                b.classList.toggle('active', b.dataset.tab === tab);
            });
            destroyExpandCharts();
            if (tab === 'players') {
                renderPlayerMiniCharts();
            } else {
                renderStockMiniCharts();
            }
        }

        function destroyExpandCharts() {
            expandCharts.forEach(c => { try { c.destroy(); } catch (e) {} });
            expandCharts = [];
            let grid = document.getElementById('expand-grid');
            if (grid) grid.innerHTML = '';
        }

        // —— 玩家涨跌：每位玩家一张资产走势迷你图 ——
        function renderPlayerMiniCharts() {
            let grid = document.getElementById('expand-grid');
            if (!assetsHistory || assetsHistory.length === 0) {
                grid.innerHTML = '<div class="expand-empty">📭 暂无数据，完成至少一轮收盘后即可查看</div>';
                return;
            }
            let labels = assetsHistory.map((_, i) => `R${i + 1}`);
            let colors = ['#ffd700', '#4fc3f7', '#81c784', '#ff8a65', '#ba68c8', '#f06292'];
            players.forEach((p, pi) => {
                let card = document.createElement('div');
                card.className = 'expand-card';
                let title = document.createElement('div');
                title.className = 'expand-card-title';
                let cur = players.length > pi ? Math.round(players[pi].totalAssets()) : 0;
                title.textContent = `${p.name}（${fmt(cur)}）`;
                let canvas = document.createElement('canvas');
                card.appendChild(title);
                card.appendChild(canvas);
                grid.appendChild(card);
                let data = assetsHistory.map(h => (h[pi] !== undefined ? h[pi] : 0));
                let color = colors[pi % colors.length];
                expandCharts.push(new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: p.name,
                            data: data,
                            borderColor: color,
                            backgroundColor: color + '22',
                            fill: true,
                            tension: 0.3,
                            pointRadius: 1,
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { ticks: { color: '#90caf9', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                            y: { ticks: { color: '#90caf9', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
                        }
                    }
                }));
            });
        }

        // —— 股票涨跌：每只股票一张涨跌幅走势迷你图 ——
        function renderStockMiniCharts() {
            let grid = document.getElementById('expand-grid');
            if (!stocksHistory || stocksHistory.length === 0) {
                grid.innerHTML = '<div class="expand-empty">📭 暂无数据，完成至少一轮收盘后即可查看</div>';
                return;
            }
            let labels = stocksHistory.map((_, i) => `R${i + 1}`);
            let baseKeys = Object.keys(stocks);
            let allKeys = baseKeys.concat(customStocks.map(cs => 'custom_' + cs.id));
            let colors = ['#81c784', '#e57373', '#ce93d8', '#4db6ac', '#ffb74d', '#4dd0e1', '#ff8a65', '#aed581'];

            allKeys.forEach((k, idx) => {
                let name = k.indexOf('custom_') === 0 ?
                    (customStocks.find(cs => 'custom_' + cs.id === k) ? customStocks.find(cs => 'custom_' + cs.id === k).name : '自建股') :
                    (stocks[k] ? stocks[k].name : k);
                let card = document.createElement('div');
                card.className = 'expand-card';
                let title = document.createElement('div');
                title.className = 'expand-card-title';
                title.textContent = name;
                let canvas = document.createElement('canvas');
                card.appendChild(title);
                card.appendChild(canvas);
                grid.appendChild(card);
                let data = stocksHistory.map(row => (row[idx] !== undefined ? row[idx] : 0));
                let color = colors[idx % colors.length];
                expandCharts.push(new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: name,
                            data: data,
                            borderColor: color,
                            backgroundColor: color + '22',
                            fill: true,
                            tension: 0.3,
                            pointRadius: 1,
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { ticks: { color: '#90caf9', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                            y: {
                                ticks: { color: '#90caf9', font: { size: 9 } },
                                grid: { color: 'rgba(255,255,255,0.05)' },
                                title: { display: true, text: '涨跌幅 %', color: '#90caf9', font: { size: 9 } }
                            }
                        }
                    }
                }));
            });
        }

        // —— 事件绑定（v9.2）——
        let expandBtn = document.getElementById('expand-charts-btn');
        if (expandBtn) expandBtn.addEventListener('click', openExpandCharts);
        let expandCloseBtn = document.getElementById('expand-close-btn');
        if (expandCloseBtn) expandCloseBtn.addEventListener('click', closeExpandCharts);
        document.querySelectorAll('.expand-tab').forEach(b => {
            b.addEventListener('click', function() { switchExpandTab(this.dataset.tab); });
        });
        let expandOverlay = document.getElementById('expand-overlay');
        if (expandOverlay) {
            expandOverlay.addEventListener('mousedown', function(e) {
                if (e.target === expandOverlay) closeExpandCharts();
            });
        }

        // ================================================================
