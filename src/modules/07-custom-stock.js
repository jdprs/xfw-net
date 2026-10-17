//  7. 自建股
        // ================================================================

        // 自建股参数公式（v10.1 新语义）：
        //   - 初始投资金额  → 决定 上涨:下跌 的比例（投资越多，上涨相对下跌越大）
        //   - 风险等级      → 同时决定涨停与跌停的幅度（风险越高，涨跌都越大）
        //   - 波动系数      → 决定每轮实际涨跌的量（标准差）
        // 上涨/下跌/事件与普通股共用同一套 GARCH+均值回归+资金流+涨跌停算法
        function customStockParams(initInvestment, riskLevel, volPercent) {
            const riskBase = ({ '低': 0.10, '中': 0.18, '高': 0.30 })[riskLevel] || 0.18;
            // 涨跌比：投资 8000 元达到 2.0，上限 2.5
            const ratio = 1 + clamp(Number(initInvestment) / 8000, 0, 1.5);
            const maxDown = riskBase;               // 跌停幅度（风险决定）
            const maxUp = riskBase * ratio;          // 涨停幅度（风险×投资比）
            const volatility = clamp(Number(volPercent) / 100, 0.04, 0.35); // 每轮波动标准差
            const band = volatility * 2;             // 常见波动区间（约 ±2σ）
            const riskText = riskLevel === '低' ? '🟢 低风险' : riskLevel === '高' ? '🔴 高风险' : '🟡 中风险';
            return { volatility, maxUp, maxDown, ratio, band, riskText, drift: 0 };
        }

        function createCustomStock(creatorId, name, initInvestment, riskLevel, volPercent) {
            let creator = players[creatorId];
            if (!creator || !name.trim()) return { ok: false };
            name = name.trim().slice(0, 12);

            initInvestment = Math.round(Number(initInvestment));
            if (!isFinite(initInvestment) || initInvestment <= 0) {
                showBanner('请输入有效的初始投资金额（正整数）', 'warning', null, '⚠️ 创建失败');
                return { ok: false };
            }
            if (initInvestment < 100) {
                showBanner('初始投资至少需要 100 元', 'warning', null, '⚠️ 金额过小');
                return { ok: false };
            }
            if (initInvestment > creator.cash) {
                showBanner(`初始投资不能超过现金 ${fmt(creator.cash)}`, 'warning', null, '⚠️ 资金不足');
                return { ok: false };
            }
            let activeCount = customStocks.filter(cs => !cs.revoked).length;
            if (activeCount >= 4) {
                showBanner('最多创建 4 只自建股', 'warning', null, '⚠️ 数量超限');
                return { ok: false };
            }

            let params = customStockParams(initInvestment, riskLevel, volPercent);
            let newStock = {
                id: customStocks.length,
                name: name,
                creatorId: creatorId,
                initInvestment: initInvestment,
                riskLevel: riskLevel,
                volatility: params.volatility,
                maxUp: params.maxUp,
                maxDown: params.maxDown,
                ratio: params.ratio,
                drift: 0,
                keepRatio: 0.5,
                downRatio: -params.maxDown,
                value: initInvestment,
                price: 100,
                history: [],
                recentMultiplier: 1,
                netFlow: 0,
                color: '#ffb74d',
                trend: 0,
                revoked: false
            };
            customStocks.push(newStock);

            // 创办者必须初始投资（投多少自己定）
            creator.cash -= initInvestment;
            if (!creator.customStockInvestments) creator.customStockInvestments = {};
            creator.customStockInvestments[newStock.id] = initInvestment;
            updateAchievementStats(creatorId, 'buy', initInvestment, 'custom');

            addLog(`${creator.name} 创办自建股「${name}」并投入 ${fmt(initInvestment)}（涨跌比 ${params.ratio.toFixed(2)}:1，${params.riskText}，波动 ${(params.volatility*100).toFixed(0)}%）`,
                'highlight');
            showBanner(`${creator.name} 创办「${name}」并投入 ${fmt(initInvestment)}`, 'success', null, '✨ 自建股上市');
            updateUI();
            updatePlayersDisplay();
            updateStockStatus();
            if (window.GAME_MODE === 'master' && typeof window.xfwBroadcastState === 'function') window.xfwBroadcastState();
            return { ok: true, stock: newStock };
        }

        // 创办者撤销自建股：所有持有者按当前持仓价值退回现金，股票标记撤销（id 保持稳定）
        function revokeCustomStock(creatorId, stockId) {
            let cs = customStocks[stockId];
            if (!cs || cs.revoked) return false;
            if (cs.creatorId !== creatorId) {
                showBanner('只有创办者可以撤销该自建股', 'warning', null, '⚠️ 无权撤销');
                return false;
            }
            let creator = players[creatorId];
            let refunded = 0;
            players.forEach(p => {
                let hold = p.customStockInvestments ? p.customStockInvestments[stockId] : 0;
                if (hold) {
                    p.cash += hold;
                    refunded += hold;
                    delete p.customStockInvestments[stockId];
                }
            });
            cs.revoked = true;
            cs.value = 0;
            cs.netFlow = 0;
            addLog(`${creator.name} 撤销自建股「${cs.name}」，共退回 ${fmt(refunded)} 给所有持有者`, 'highlight');
            showBanner(`已撤销「${cs.name}」，退回 ${fmt(refunded)}`, 'info', null, '↩️ 撤销创建');
            updateUI();
            updatePlayersDisplay();
            updateStockStatus();
            updateLeaderboard();
            if (window.GAME_MODE === 'master' && typeof window.xfwBroadcastState === 'function') window.xfwBroadcastState();
            return true;
        }

        function investCustomStock(playerId, stockId, amount) {
            let p = players[playerId];
            let stock = customStocks[stockId];
            if (!stock || stock.revoked || p.bankrupt) return;
            amount = Math.round(Number(amount));
            if (!isFinite(amount) || amount <= 0) {
                showBanner('请输入有效金额（正整数）', 'warning', null, '⚠️ 投资失败');
                return;
            }
            if (amount > p.cash) {
                showBanner(`现金不足，最多可投 ${fmt(p.cash)}`, 'warning', null, '⚠️ 资金不足');
                return;
            }
            p.cash -= amount;
            if (!p.customStockInvestments) p.customStockInvestments = {};
            p.customStockInvestments[stockId] = (p.customStockInvestments[stockId] || 0) + amount;
            stock.value += amount;
            stock.netFlow = (stock.netFlow || 0) + amount;
            addLog(`${p.name} 投资自建股「${stock.name}」${fmt(amount)}`, 'profit');
            showBanner(`${p.name} 投资「${stock.name}」${fmt(amount)}`, 'success', null, '📈 投资');
            updateAchievementStats(playerId, 'buy', amount, 'custom');
            updateUI();
            updatePlayersDisplay();
            updateLeaderboard();
            if (window.GAME_MODE === 'master' && typeof window.xfwBroadcastState === 'function') window.xfwBroadcastState();
        }

        function withdrawCustomStock(playerId, stockId, amount) {
            let p = players[playerId];
            let stock = customStocks[stockId];
            if (!stock || stock.revoked || p.bankrupt) return;
            let inv = p.customStockInvestments?.[stockId] || 0;
            let wd = amount ? Math.min(amount, inv) : inv;
            wd = Math.round(wd);
            if (wd <= 0) {
                showBanner('该自建股没有可取回的份额', 'warning', null, '⚠️ 取回失败');
                return;
            }
            p.cash += wd;
            p.customStockInvestments[stockId] -= wd;
            if (p.customStockInvestments[stockId] <= 0) delete p.customStockInvestments[stockId];
            stock.value -= wd;
            stock.netFlow = (stock.netFlow || 0) - wd;
            addLog(`${p.name} 从「${stock.name}」取回 ${fmt(wd)}`);
            showBanner(`${p.name} 从「${stock.name}」取回 ${fmt(wd)}`, 'info', null, '💰 取回');
            updateAchievementStats(playerId, 'sell', wd, 'custom');
            updateUI();
            updatePlayersDisplay();
            updateLeaderboard();
            if (window.GAME_MODE === 'master' && typeof window.xfwBroadcastState === 'function') window.xfwBroadcastState();
        }

        function updateCustomStockValues(mults) {
            customStocks.forEach((stock, idx) => {
                if (stock.revoked) return;
                let mult = mults[`custom_${idx}`] || 1;
                stock.value = Math.round(stock.value * mult);
                stock.recentMultiplier = mult;
                stock.history.push({ round, value: stock.value, multiplier: mult });
                if (stock.history.length > 25) stock.history.shift();
                stock.trend = 0.5 * (stock.trend || 0) + 0.5 * (mult - 1);
                stock.netFlow = 0;
                players.forEach(p => {
                    if (p.customStockInvestments && p.customStockInvestments[idx]) {
                        p.customStockInvestments[idx] = Math.round(p.customStockInvestments[idx] * mult);
                    }
                });
            });
        }

        // ================================================================
