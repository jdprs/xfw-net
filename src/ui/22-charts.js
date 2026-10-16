//  22. 图表
        // ================================================================

        function initCharts() {
            let ac = document.getElementById('assets-chart');
            let sc = document.getElementById('stocks-chart');
            if (!ac || !sc) return;
            if (typeof Chart === 'undefined') {
                // Chart.js 尚未就绪（本地脚本加载失败等），有限重试，不阻塞游戏初始化
                if (window.__chartRetryCount === undefined) window.__chartRetryCount = 0;
                if (window.__chartRetryCount < 40) {
                    window.__chartRetryCount++;
                    window.__chartRetryTimer = setTimeout(initCharts, 250);
                }
                return;
            }
            window.__chartRetryCount = 0;
            let colors = ['#ffd700', '#81c784', '#e57373', '#ce93d8', '#4db6ac', '#ffb74d', '#4dd0e1', '#ff8a65', '#aed581'];
            let ds = players.map((p, i) => ({
                label: p.name,
                data: [],
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length] + '30',
                fill: true,
                tension: 0.3,
                pointRadius: 2,
                borderWidth: 2
            }));
            if (assetsChart) assetsChart.destroy();
            assetsChart = new Chart(ac, {
                type: 'line',
                data: { labels: [], datasets: ds },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { labels: { color: '#e3f2fd', font: { size: 9 } } } },
                    scales: {
                        x: { ticks: { color: '#90caf9', font: { size: 8 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
                        y: { ticks: { color: '#90caf9', font: { size: 8 } }, grid: { color: 'rgba(255,255,255,0.06)' } }
                    }
                }
            });
            let stockColors = ['#81c784', '#e57373', '#ce93d8', '#4db6ac', '#ffb74d'];
            let stockLabels = ['A股', 'B股', 'C股', 'D股'];
            let dss = stockLabels.map((l, i) => ({ label: l, data: [], backgroundColor: stockColors[i] + '80' }));
            if (stocksChart) stocksChart.destroy();
            stocksChart = new Chart(sc, {
                type: CHART_TYPE,
                data: { labels: [], datasets: dss },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { labels: { color: '#e3f2fd', font: { size: 9 } } } },
                    scales: {
                        x: { ticks: { color: '#90caf9', font: { size: 8 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
                        y: { ticks: { color: '#90caf9', font: { size: 8 } }, grid: { color: 'rgba(255,255,255,0.06)' } }
                    }
                }
            });
        }

        function recordChartData() {
            let totals = players.map(p => p.totalAssets());
            assetsHistory.push(totals);
            if (assetsHistory.length > 50) assetsHistory.shift();
            let changes = Object.keys(stocks).map(k => Math.round((stocks[k].recentMultiplier - 1) * 1000) / 10);
            customStocks.forEach(cs => changes.push(Math.round((cs.recentMultiplier - 1) * 1000) / 10));
            stocksHistory.push(changes);
            if (stocksHistory.length > 50) stocksHistory.shift();
        }

        function updateCharts() {
            if (!assetsChart || !stocksChart) {
                if (typeof Chart !== 'undefined' && document.getElementById('assets-chart')) initCharts();
                return;
            }
            if (assetsChart.data.datasets.length !== players.length) {
                initCharts();
                let labels = assetsHistory.map((_, i) => `R${i+1}`);
                assetsChart.data.labels = labels;
                players.forEach((p, i) => {
                    if (i < assetsChart.data.datasets.length) {
                        assetsChart.data.datasets[i].data = assetsHistory.map(h => h[i] || 0);
                    }
                });
                assetsChart.update();
                let sLabels = stocksHistory.map((_, i) => `R${i+1}`);
                let baseStocks = ['A', 'B', 'C', 'D'];
                let allLabels = [...baseStocks];
                customStocks.forEach(cs => allLabels.push(cs.name));
                let colors = ['#81c784', '#e57373', '#ce93d8', '#4db6ac', '#ffb74d', '#4dd0e1', '#ff8a65', '#aed581'];
                let datasets = allLabels.map((label, idx) => ({
                    label: label,
                    data: stocksHistory.map(h => h[idx] || 0),
                    backgroundColor: colors[idx % colors.length] + '80',
                    borderColor: colors[idx % colors.length],
                    borderWidth: 1
                }));
                stocksChart.data.labels = sLabels;
                stocksChart.data.datasets = datasets;
                stocksChart.update();
                return;
            }
            let labels = assetsHistory.map((_, i) => `R${i+1}`);
            assetsChart.data.labels = labels;
            players.forEach((p, i) => {
                if (i < assetsChart.data.datasets.length) {
                    assetsChart.data.datasets[i].data = assetsHistory.map(h => h[i] || 0);
                }
            });
            assetsChart.update();
            let sLabels = stocksHistory.map((_, i) => `R${i+1}`);
            let baseStocks = ['A', 'B', 'C', 'D'];
            let allLabels = [...baseStocks];
            customStocks.forEach(cs => allLabels.push(cs.name));
            let colors = ['#81c784', '#e57373', '#ce93d8', '#4db6ac', '#ffb74d', '#4dd0e1', '#ff8a65', '#aed581'];
            let datasets = allLabels.map((label, idx) => ({
                label: label,
                data: stocksHistory.map(h => h[idx] || 0),
                backgroundColor: colors[idx % colors.length] + '80',
                borderColor: colors[idx % colors.length],
                borderWidth: 1
            }));
            stocksChart.data.labels = sLabels;
            stocksChart.data.datasets = datasets;
            stocksChart.config.type = CHART_TYPE;
            stocksChart.update();
        }

        // ================================================================
