//  8. 股票投资（股份投资）
        // ================================================================

        function investStock(playerId, stockType, shares) {
            if (!gameActive) return;
            // v9.3: 被封股票不能买入
            if (isStockSealed(stockType)) {
                showBanner(`${stocks[stockType].name} 已跑路，暂停交易`, 'error', null, '🚫 股票跑路');
                return;
            }
            let p = players[playerId];
            if (p.bankrupt) {
                showBanner(`${p.name} 已破产，无法交易`, 'error', null, '💀 破产');
                return;
            }
            shares = Math.floor(shares);
            if (shares <= 0) {
                showBanner('股份数量必须为正整数', 'warning', null, '⚠️ 操作失败');
                return;
            }
            let price = stocks[stockType].price;
            let amount = Math.round(shares * price);
            if (amount <= 0 || amount > p.cash) {
                showBanner(`金额 ${fmt(amount)} 超出现金 ${fmt(p.cash)}`, 'warning', null, '⚠️ 现金不足');
                return;
            }
            p.cash -= amount;
            if (p[`shares${stockType}`] === undefined) p[`shares${stockType}`] = 0;
            p[`shares${stockType}`] += shares;
            stocks[stockType].value += amount;
            stocks[stockType].netFlow = (stocks[stockType].netFlow || 0) + amount;
            Object.keys(stocks).forEach(k => stocks[k].value = Math.round(stocks[k].value));
            addLog(`${p.name} 买入 ${shares}股 ${stockType}股（${fmt(amount)}）`, 'profit');
            showBanner(`${p.name} 买入 ${shares}股 ${stockType}股（${fmt(amount)}）`, 'success', null, '📈 买入');
            updateAchievementStats(playerId, 'buy', amount, stockType);
            updateUI();
            updatePlayersDisplay();
            updateLeaderboard();
        }

        function withdrawStock(playerId, stockType, shares) {
            if (!gameActive) return;
            // v9.3: 被封股票不能卖出（持仓已在封的时候清零）
            if (isStockSealed(stockType)) {
                showBanner(`${stocks[stockType].name} 已跑路，暂停交易`, 'error', null, '🚫 股票跑路');
                return;
            }
            let p = players[playerId];
            if (p.bankrupt) {
                showBanner(`${p.name} 已破产，无法交易`, 'error', null, '💀 破产');
                return;
            }
            shares = Math.floor(shares);
            if (shares <= 0) {
                showBanner('股份数量必须为正整数', 'warning', null, '⚠️ 操作失败');
                return;
            }
            let key = `shares${stockType}`;
            if (!p[key] || p[key] < shares) {
                showBanner(`持仓不足 ${shares}股，最多 ${p[key]||0}股`, 'warning', null, '⚠️ 持仓不足');
                return;
            }
            let price = stocks[stockType].price;
            let amount = Math.round(shares * price);
            p[key] -= shares;
            p.cash += amount;
            stocks[stockType].value -= amount;
            stocks[stockType].netFlow = (stocks[stockType].netFlow || 0) - amount;
            Object.keys(stocks).forEach(k => stocks[k].value = Math.round(stocks[k].value));
            addLog(`${p.name} 卖出 ${shares}股 ${stockType}股（${fmt(amount)}）`);
            showBanner(`${p.name} 卖出 ${shares}股 ${stockType}股（${fmt(amount)}）`, 'info', null, '💰 卖出');
            updateAchievementStats(playerId, 'sell', amount, stockType);
            updateUI();
            updatePlayersDisplay();
            updateLeaderboard();
        }

        // ================================================================
