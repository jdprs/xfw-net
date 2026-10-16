//  7. 自建股
        // ================================================================

        // 自建股参数公式（由玩家输入的"波动系数"与"风险偏好"推导）
        // 这些公式同时用于创建时的实时预览与实际建仓，保证所见即所得
        function customStockParams(volPercent, driftMode) {
            // 基础波动系数（小数），限制在 4%~35%
            let v = clamp(volPercent / 100, 0.04, 0.35);
            // 涨跌停：由波动系数推导
            let maxUp = v * 2.2;        // 涨停幅度
            let maxDown = v * 2.0;      // 跌停幅度（略小于涨停，轻微正向偏向）
            // 单轮趋势漂移（长期期望）：保守偏正、稳健中性、激进高风险
            let drift = 0;
            if (driftMode === '保守') drift = v * 0.06;
            else if (driftMode === '激进') drift = -v * 0.04;
            // 单轮常见波动区间（约 ±2 倍标准差，覆盖约 95% 情形）
            let band = v * 2;
            // 风险评级
            let riskLevel = v < 0.08 ? '🟢 低风险' : v < 0.16 ? '🟡 中风险' : v < 0.25 ? '🟠 高风险' : '🔴 极高风险';
            return {
                volatility: v,
                maxUp: maxUp,
                maxDown: maxDown,
                drift: drift,
                band: band,
                riskLevel: riskLevel
            };
        }

        function createCustomStock(creatorId, name, initInvestment, volPercent, driftMode) {
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
            if (customStocks.length >= 4) {
                showBanner('最多创建 4 只自建股', 'warning', null, '⚠️ 数量超限');
                return { ok: false };
            }

            let params = customStockParams(volPercent, driftMode);
            let newStock = {
                id: customStocks.length,
                name: name,
                creatorId: creatorId,
                initInvestment: initInvestment,
                volatility: params.volatility,
                maxUp: params.maxUp,
                maxDown: params.maxDown,
                drift: params.drift,
                keepRatio: 0.5,
                downRatio: -params.maxDown,
                value: initInvestment,
                price: 100,
                history: [],
                recentMultiplier: 1,
                netFlow: 0,
                color: '#ffb74d',
                trend: 0
            };
            customStocks.push(newStock);

            // 创建者必须初始投资（投多少自己定）
            creator.cash -= initInvestment;
            if (!creator.customStockInvestments) creator.customStockInvestments = {};
            creator.customStockInvestments[newStock.id] = initInvestment;
            updateAchievementStats(creatorId, 'buy', initInvestment, 'custom');

            addLog(`${creator.name} 创办自建股「${name}」并投入 ${fmt(initInvestment)}（波动系数 ${(params.volatility*100).toFixed(0)}%，${params.riskLevel}）`,
                'highlight');
            showBanner(`${creator.name} 创办「${name}」并投入 ${fmt(initInvestment)}`, 'success', null, '✨ 自建股上市');
            updateUI();
            updatePlayersDisplay();
            updateStockStatus();
            if (window.GAME_MODE === 'master' && typeof window.xfwBroadcastState === 'function') window.xfwBroadcastState();
            return { ok: true, stock: newStock };
        }

        function investCustomStock(playerId, stockId, amount) {
            let p = players[playerId];
            let stock = customStocks[stockId];
            if (!stock || p.bankrupt) return;
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
            if (!stock || p.bankrupt) return;
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
