//  7. 自建股

        // 自建股详情弹窗
        function showCustomStockDetail(stockId) {
            let cs = customStocks[stockId];
            if (!cs) return;
            let creator = players[cs.creatorId];
            let creatorName = creator ? creator.name : '未知';
            // 持仓统计
            let holderCount = 0, totalHolding = 0;
            for (let p of players) {
                let inv = p.customStockInvestments && p.customStockInvestments[cs.id];
                if (inv && inv > 0) { holderCount++; totalHolding += inv; }
            }
            // 近期涨跌（最近8轮）
            let hist = cs.history || [];
            let recentHtml = '';
            if (hist.length > 0) {
                let recent = hist.slice(-8);
                recentHtml = recent.map((h,i) => {
                    let m = h.multiplier || 1;
                    let pct = ((m - 1) * 100).toFixed(1);
                    let color = m >= 1 ? 'var(--profit-green,#4ade80)' : 'var(--danger-red,#f87171)';
                    let arrow = m >= 1 ? '▲' : '▼';
                    return `<span style="display:inline-block;margin:2px 4px;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,0.06);color:${color};font-size:0.8rem;">${arrow}${pct}%</span>`;
                }).join('');
            } else {
                recentHtml = '<span style="color:var(--text-secondary);">暂无历史数据</span>';
            }
            let riskColor = cs.riskLevel === '高' ? '#f87171' : cs.riskLevel === '中' ? '#facc15' : '#4ade80';
            let ratioText = cs.ratio ? cs.ratio.toFixed(2) + ' : 1' : '—';
            let body = `
                <div style="text-align:left;font-size:0.9rem;line-height:1.8;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin-bottom:12px;">
                        <div><span style="color:var(--text-secondary);">创建者：</span>${creatorName}</div>
                        <div><span style="color:var(--text-secondary);">初始投资：</span>${fmt(cs.initInvestment || 0)}</div>
                        <div><span style="color:var(--text-secondary);">当前市值：</span><strong style="color:var(--accent-gold);">${fmt(cs.value || 0)}</strong></div>
                        <div><span style="color:var(--text-secondary);">涨跌比：</span>${ratioText}</div>
                        <div><span style="color:var(--text-secondary);">风险等级：</span><span style="color:${riskColor};font-weight:bold;">${cs.riskLevel || '—'}</span></div>
                        <div><span style="color:var(--text-secondary);">波动系数：</span>${cs.volatility ? (cs.volatility*100).toFixed(0) + '%' : '—'}</div>
                        <div><span style="color:var(--text-secondary);">涨停：</span><span style="color:var(--profit-green,#4ade80);">+${((cs.maxUp||0)*100).toFixed(0)}%</span></div>
                        <div><span style="color:var(--text-secondary);">跌停：</span><span style="color:var(--danger-red,#f87171);">-${((cs.maxDown||0)*100).toFixed(0)}%</span></div>
                        <div><span style="color:var(--text-secondary);">持仓人数：</span>${holderCount} 人</div>
                        <div><span style="color:var(--text-secondary);">总持仓额：</span>${fmt(totalHolding)}</div>
                    </div>
                    <div style="margin-bottom:8px;color:var(--text-secondary);">近期涨跌（最近8轮）：</div>
                    <div style="margin-bottom:8px;">${recentHtml}</div>
                    <div style="color:var(--text-secondary);font-size:0.8rem;margin-top:8px;">股票ID: #${cs.id} · 创办者可撤销创建并退回所有持仓</div>
                </div>`;
            // 用 info-modal 显示
            let overlay = document.getElementById('info-modal');
            if (overlay) {
                document.getElementById('info-modal-title').textContent = '📊 ' + cs.name + ' · 自建股详情';
                document.getElementById('info-modal-body').innerHTML = body;
                overlay.classList.add('active');
                document.body.classList.add('modal-open');
                let okBtn = document.getElementById('info-modal-ok');
                okBtn.onclick = function() {
                    overlay.classList.remove('active');
                    document.body.classList.remove('modal-open');
                };
                overlay.onclick = function(e) {
                    if (e.target === overlay) {
                        overlay.classList.remove('active');
                        document.body.classList.remove('modal-open');
                    }
                };
            }
        }

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
