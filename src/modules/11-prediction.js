//  11. 股神预测（v9.1 修复版）
        //  持平阈值 1.5%，预测上涨/下跌但实际持平时押金没收
        // ================================================================

        // v9.2: 撤销预测（仅限本轮、且该玩家正在决策时），退还押金并清除记录
        function undoPrediction(playerId) {
            let p = players[playerId];
            if (!p || p.bankrupt) {
                showBanner('您已破产，无法撤销预测', 'error', null, '🔮 撤销失败');
                return;
            }
            if (!predictionsThisRound[playerId]) {
                showBanner('本轮没有可撤销的预测', 'warning', null, '🔮 撤销失败');
                return;
            }
            if (decisionState !== 'deciding' || decidingPlayerId !== playerId) {
                showBanner('只有正在决策的玩家可以撤销预测', 'warning', null, '🔮 撤销失败');
                return;
            }
            let pred = predictionsThisRound[playerId];
            p.cash = Math.round(p.cash + pred.amount);
            delete predictionsThisRound[playerId];
            let dirText = pred.direction === 'up' ? '上涨📈' : pred.direction === 'down' ? '下跌📉' : '持平➖';
            addLog(`↩️ ${p.name} 撤销了 ${pred.stock}股 ${dirText} 的预测，押金 ${fmt(pred.amount)} 已退还`, 'event');
            showBanner(`↩️ 已撤销预测，押金 ${fmt(pred.amount)} 已退还`, 'info', null, '🔮 已撤销');
            updateUI();
            updatePlayersDisplay();
        }

        function makePrediction(playerId, stockKey, direction, amount) {
            let p = players[playerId];
            if (!p || p.bankrupt) {
                showBanner('您已破产，无法预测', 'error', null, '🔮 预测失败');
                return;
            }
            // v9.3: 被封股票不能预测
            if (isStockSealed(stockKey)) {
                showBanner(`${stocks[stockKey].name} 已跑路，无法预测`, 'error', null, '🚫 股票跑路');
                return;
            }
            if (predictionsThisRound[playerId]) {
                showBanner('本轮已进行过预测，每轮限一次', 'warning', null, '🔮 预测失败');
                return;
            }
            amount = Math.round(amount);
            if (amount < 1) {
                showBanner('押注金额至少为1元', 'warning', null, '🔮 预测失败');
                return;
            }
            let totalAssets = p.totalAssets();
            let maxBet = Math.floor(totalAssets * 0.05);
            if (amount > maxBet) {
                showBanner(`押注上限为总资产的5%（${fmt(maxBet)}）`, 'warning', null, '🔮 预测失败');
                return;
            }
            if (amount > p.cash) {
                showBanner(`现金不足 ${fmt(amount)}，无法预测`, 'warning', null, '🔮 预测失败');
                return;
            }
            p.cash -= amount;
            predictionsThisRound[playerId] = {
                stock: stockKey,
                direction: direction,
                amount: amount,
                round: round
            };
            let dirText = direction === 'up' ? '上涨📈' : direction === 'down' ? '下跌📉' : '持平➖';
            addLog(`🔮 ${p.name} 预测 ${stockKey}股 ${dirText}，押注 ${fmt(amount)} (上限5%)`, 'event');
            showBanner(`🔮 ${p.name} 预测 ${stockKey}股 ${dirText}，押注 ${fmt(amount)}`, 'info', null, '🔮 预测');
            updateUI();
            updatePlayersDisplay();
        }

        function resolvePredictions() {
            if (!roundEvents[round]) roundEvents[round] = { lotteryWins: [], lotteryScams: [], predictions: [] };
            const HOLD_THRESHOLD = 0.015;

            Object.keys(predictionsThisRound).forEach(pid => {
                let pred = predictionsThisRound[pid];
                let p = players[parseInt(pid)];
                if (!p || p.bankrupt) return;
                let stockKey = pred.stock;
                let mult = stocks[stockKey]?.recentMultiplier || 1;
                let actualDirection = mult > 1 + HOLD_THRESHOLD ? 'up' : mult < 1 - HOLD_THRESHOLD ? 'down' :
                    'neutral';
                let isHold = (actualDirection === 'neutral');

                let reward = 0;
                let resultMsg = '';

                let correct = false;
                if (pred.direction === 'hold' && isHold) {
                    correct = true;
                    reward = Math.round(pred.amount * 2.5);
                    p.cash += reward;
                    resultMsg = `✅ 预测持平正确！获得奖励 ${fmt(reward)}`;
                    addLog(`🔮 ${p.name} 预测 ${stockKey}股 持平正确！奖励 ${fmt(reward)}`, 'profit');
                    showBanner(`✅ ${p.name} 预测持平正确！获得 ${fmt(reward)}`, 'success', null, '🔮 预测成功');
                    roundEvents[round].predictions.push(`${p.name} 预测持平正确，奖励 ${fmt(reward)}`);
                } else if (pred.direction === 'up' && actualDirection === 'up') {
                    correct = true;
                    reward = Math.round(pred.amount * 2.5);
                    p.cash += reward;
                    resultMsg = `✅ 预测上涨正确！获得奖励 ${fmt(reward)}`;
                    addLog(`🔮 ${p.name} 预测 ${stockKey}股 上涨正确！奖励 ${fmt(reward)}`, 'profit');
                    showBanner(`✅ ${p.name} 预测上涨正确！获得 ${fmt(reward)}`, 'success', null, '🔮 预测成功');
                    roundEvents[round].predictions.push(`${p.name} 预测上涨正确，奖励 ${fmt(reward)}`);
                } else if (pred.direction === 'down' && actualDirection === 'down') {
                    correct = true;
                    reward = Math.round(pred.amount * 2.5);
                    p.cash += reward;
                    resultMsg = `✅ 预测下跌正确！获得奖励 ${fmt(reward)}`;
                    addLog(`🔮 ${p.name} 预测 ${stockKey}股 下跌正确！奖励 ${fmt(reward)}`, 'profit');
                    showBanner(`✅ ${p.name} 预测下跌正确！获得 ${fmt(reward)}`, 'success', null, '🔮 预测成功');
                    roundEvents[round].predictions.push(`${p.name} 预测下跌正确，奖励 ${fmt(reward)}`);
                } else {
                    let dirText = pred.direction === 'up' ? '上涨' : pred.direction === 'down' ? '下跌' : '持平';
                    let actualText = actualDirection === 'up' ? '上涨' : actualDirection === 'down' ? '下跌' : '持平';
                    resultMsg = `❌ 预测错误 (预期${dirText}，实际${actualText})，损失押金 ${fmt(pred.amount)}`;
                    addLog(`🔮 ${p.name} 预测 ${stockKey}股 ${dirText}，实际${actualText}，损失 ${fmt(pred.amount)}`, 'loss');
                    showBanner(`❌ ${p.name} 预测错误，损失 ${fmt(pred.amount)}`, 'error', null, '🔮 预测失败');
                    roundEvents[round].predictions.push(`${p.name} 预测${dirText}但实际${actualText}，损失 ${fmt(pred.amount)}`);
                }

                updateUI();
                updatePlayersDisplay();
            });
            predictionsThisRound = {};
        }

        function showPredictionModal(playerId) {
            let p = players[playerId];
            if (!p || p.bankrupt) {
                showBanner('您已破产，无法预测', 'error', null, '🔮 预测失败');
                return;
            }
            if (predictionsThisRound[playerId]) {
                showBanner('本轮已进行过预测，每轮限一次', 'warning', null, '🔮 预测失败');
                return;
            }
            if (p.cash < 1) {
                showBanner('现金不足，无法预测', 'warning', null, '🔮 预测失败');
                return;
            }
            let totalAssets = p.totalAssets();
            let maxBet = Math.floor(totalAssets * 0.05);
            if (maxBet < 1) {
                showBanner('总资产不足，无法预测（需≥20元）', 'warning', null, '🔮 预测失败');
                return;
            }
            // v9.3: 过滤被封股票
            let availableStocks = Object.keys(stocks).filter(k => !isStockSealed(k));
            if (availableStocks.length === 0) {
                showBanner('所有股票均已跑路，无法预测', 'error', null, '🚫 股票跑路');
                return;
            }

            let overlay = document.createElement('div');
            overlay.style.cssText =
                'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:1200;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(4px);';
            let box = document.createElement('div');
            box.style.cssText =
                'background:var(--bg-card);padding:24px 28px;border-radius:16px;max-width:420px;width:92%;border:2px solid var(--tech-purple);text-align:center;';
            box.innerHTML = `
                    <h3 style="color:var(--tech-purple);margin-bottom:10px;">🔮 股神预测</h3>
                    <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:4px;">押注金额上限为总资产的5%（${fmt(maxBet)}）</p>
                    <p style="color:var(--text-secondary);font-size:0.8rem;margin-bottom:10px;">持平阈值：股价变化 ±1.5% 以内</p>
                    <div style="margin-bottom:10px;">
                        <label style="color:var(--text-secondary);font-size:0.8rem;">选择股票</label>
                        <select id="pred-stock" style="width:100%;padding:8px 12px;background:var(--bg-dark);border:2px solid var(--border-color);color:var(--text-primary);border-radius:8px;font-size:0.95rem;margin-top:4px;">
                            ${availableStocks.map(k => `<option value="${k}">${stocks[k].name}</option>`).join('')}
                        </select>
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="color:var(--text-secondary);font-size:0.8rem;">押注金额（元）</label>
                        <input type="number" id="pred-amount" value="${Math.min(100, maxBet)}" min="1" max="${maxBet}" step="1" style="width:100%;padding:8px 12px;background:var(--bg-dark);border:2px solid var(--border-color);color:var(--text-primary);border-radius:8px;font-size:0.95rem;margin-top:4px;">
                        <div style="font-size:0.7rem;color:var(--text-secondary);margin-top:2px;">上限 ${fmt(maxBet)}</div>
                    </div>
                    <div style="margin-bottom:14px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
                        <button class="btn btn-success" id="pred-up" style="flex:1;min-width:60px;">📈 上涨</button>
                        <button class="btn btn-cyan" id="pred-hold" style="flex:1;min-width:60px;">➖ 持平</button>
                        <button class="btn btn-danger" id="pred-down" style="flex:1;min-width:60px;">📉 下跌</button>
                    </div>
                    <div style="display:flex;gap:10px;justify-content:center;">
                        <button class="btn btn-warning" id="pred-cancel">取消</button>
                    </div>
                `;
            overlay.appendChild(box);
            document.body.appendChild(overlay);

            let stockSelect = document.getElementById('pred-stock');
            let downBtn = document.getElementById('pred-down');
            let upBtn = document.getElementById('pred-up');
            let holdBtn = document.getElementById('pred-hold');

            function updateButtons() {
                let stockVal = stockSelect.value;
                if (stockVal === 'A') {
                    downBtn.disabled = true;
                    downBtn.style.opacity = '0.4';
                    downBtn.style.cursor = 'not-allowed';
                    downBtn.title = 'A股只涨不跌';
                } else {
                    downBtn.disabled = false;
                    downBtn.style.opacity = '1';
                    downBtn.style.cursor = 'pointer';
                    downBtn.title = '';
                }
            }
            stockSelect.onchange = updateButtons;
            updateButtons();

            let amountInput = document.getElementById('pred-amount');
            amountInput.onchange = function() {
                let v = parseInt(this.value) || 0;
                if (v > maxBet) { this.value = maxBet;
                    showBanner(`押注上限为 ${fmt(maxBet)}`, 'warning', null, '🔮 上限'); }
                if (v < 1) this.value = 1;
            };

            function getPredAmount() {
                let v = parseInt(amountInput.value) || 0;
                if (v < 1) v = 1;
                if (v > maxBet) v = maxBet;
                return v;
            }

            document.getElementById('pred-up').onclick = function() {
                let stockVal = stockSelect.value;
                let amount = getPredAmount();
                if (amount > p.cash) { showBanner(`现金不足 ${fmt(amount)}`, 'warning', null, '🔮 预测失败');
                    overlay.remove(); return; }
                makePrediction(playerId, stockVal, 'up', amount);
                overlay.remove();
            };
            document.getElementById('pred-hold').onclick = function() {
                let stockVal = stockSelect.value;
                let amount = getPredAmount();
                if (amount > p.cash) { showBanner(`现金不足 ${fmt(amount)}`, 'warning', null, '🔮 预测失败');
                    overlay.remove(); return; }
                makePrediction(playerId, stockVal, 'hold', amount);
                overlay.remove();
            };
            document.getElementById('pred-down').onclick = function() {
                let stockVal = stockSelect.value;
                if (stockVal === 'A') { showBanner('A股不会下跌，不能预测下跌', 'warning', null, '🔮 预测失败');
                    overlay.remove(); return; }
                let amount = getPredAmount();
                if (amount > p.cash) { showBanner(`现金不足 ${fmt(amount)}`, 'warning', null, '🔮 预测失败');
                    overlay.remove(); return; }
                makePrediction(playerId, stockVal, 'down', amount);
                overlay.remove();
            };
            document.getElementById('pred-cancel').onclick = function() { overlay.remove(); };
            overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
        }

        // ================================================================
