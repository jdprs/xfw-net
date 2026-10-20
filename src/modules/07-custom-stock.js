//  7. 自建股

        // 自建股详情弹窗（自定义模态框）
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
            // 近期涨跌（最近12轮）迷你柱状图：flex 占位，高度固定，避免定位错乱
            let hist = cs.history || [];
            let barsHtml = '';
            if (hist.length > 0) {
                let recent = hist.slice(-12);
                const BAR_HALF = 24;   // 中心线上下可用高度
                let maxAbs = Math.max(...recent.map(h => Math.abs((h.multiplier||1)-1)), 0.02);
                barsHtml = `<div style="position:relative;height:${BAR_HALF*2}px;">
                    <div style="position:absolute;left:0;right:0;top:${BAR_HALF}px;height:1px;background:rgba(255,255,255,0.14);z-index:0;"></div>
                    <div style="display:flex;gap:3px;position:relative;z-index:1;height:100%;">
                        ${recent.map(h => {
                            let m = h.multiplier || 1;
                            let pct = (m - 1) * 100;
                            let hPx = Math.max(2, Math.round(Math.abs(pct) / maxAbs * BAR_HALF));
                            let isUp = m >= 1;
                            let color = isUp ? '#4ade80' : '#f87171';
                            let bg = isUp
                                ? 'linear-gradient(to top, rgba(74,222,128,0.5), rgba(74,222,128,0.95))'
                                : 'linear-gradient(to bottom, rgba(248,113,113,0.5), rgba(248,113,113,0.95))';
                            let radius = isUp ? '3px 3px 0 0' : '0 0 3px 3px';
                            // 固定高度 spacer，保证总高 = BAR_HALF*2
                            let topSpacer = isUp ? BAR_HALF - hPx : BAR_HALF;
                            let bottomSpacer = isUp ? BAR_HALF : BAR_HALF - hPx;
                            return `<div style="flex:1;display:flex;flex-direction:column;min-width:0;">
                                <div style="height:${topSpacer}px;flex:none;"></div>
                                <div style="height:${hPx}px;flex:none;background:${bg};border-radius:${radius};"></div>
                                <div style="height:${bottomSpacer}px;flex:none;"></div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
            } else {
                barsHtml = '<div style="color:var(--text-secondary);font-size:0.8rem;padding:14px 0;text-align:center;">暂无历史数据</div>';
            }

            let riskColor = cs.riskLevel === '高' ? '#f87171' : cs.riskLevel === '中' ? '#facc15' : '#4ade80';
            let riskBg = cs.riskLevel === '高' ? 'rgba(248,113,113,0.15)' : cs.riskLevel === '中' ? 'rgba(250,204,21,0.15)' : 'rgba(74,222,128,0.15)';
            let ratioText = cs.ratio ? cs.ratio.toFixed(2) + ' : 1' : '—';
            let upPct = ((cs.maxUp||0)*100).toFixed(0);
            let downPct = ((cs.maxDown||0)*100).toFixed(0);
            let volPct = cs.volatility ? (cs.volatility*100).toFixed(0) : '—';

            // 动态创建模态框（如果不存在）
            let overlay = document.getElementById('cs-detail-modal');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'cs-detail-modal';
                overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.78);z-index:9500;display:none;justify-content:center;align-items:center;backdrop-filter:blur(8px);padding:20px;overflow-y:auto;';
                document.body.appendChild(overlay);
            }
            overlay.innerHTML = `
                <div style="background:var(--bg-card);border-radius:18px;max-width:480px;width:100%;max-height:85vh;overflow-y:auto;border:1px solid rgba(255,183,77,0.3);box-shadow:0 8px 40px rgba(0,0,0,0.5),0 0 30px rgba(255,183,77,0.08);animation:csModalIn 0.25s ease-out;-webkit-overflow-scrolling:touch;">
                    <style>@keyframes csModalIn{from{opacity:0;transform:translateY(16px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}</style>
                    <!-- 标题栏 -->
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 20px 14px;border-bottom:1px solid rgba(255,255,255,0.08);">
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                            <span style="font-size:1.25rem;font-weight:bold;color:var(--accent-gold);">${cs.name}</span>
                            <span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:rgba(255,183,77,0.15);color:#ffb74d;border:1px solid rgba(255,183,77,0.3);">自建股</span>
                            <span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:${riskBg};color:${riskColor};border:1px solid ${riskColor};">${cs.riskLevel || '—'}风险</span>
                        </div>
                        <button id="cs-detail-close" style="background:none;border:none;color:var(--text-secondary);font-size:1.3rem;cursor:pointer;padding:4px 8px;border-radius:8px;line-height:1;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='none'">✕</button>
                    </div>
                    <!-- 市值大数字 -->
                    <div style="padding:16px 20px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">
                        <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:4px;">当前市值</div>
                        <div style="font-size:2rem;font-weight:bold;color:var(--accent-gold);">${fmt(cs.value || 0)}</div>
                        <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:4px;">创建者：${creatorName} · 初始投资 ${fmt(cs.initInvestment || 0)}</div>
                    </div>
                    <!-- 详情网格 -->
                    <div style="padding:16px 20px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:10px 12px;">
                            <div style="font-size:0.7rem;color:var(--text-secondary);">涨跌比</div>
                            <div style="font-size:1rem;font-weight:bold;color:var(--text-primary);">${ratioText}</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:10px 12px;">
                            <div style="font-size:0.7rem;color:var(--text-secondary);">波动系数</div>
                            <div style="font-size:1rem;font-weight:bold;color:var(--text-primary);">±${volPct}%</div>
                        </div>
                        <div style="background:rgba(74,222,128,0.08);border-radius:10px;padding:10px 12px;">
                            <div style="font-size:0.7rem;color:var(--text-secondary);">涨停</div>
                            <div style="font-size:1rem;font-weight:bold;color:#4ade80;">+${upPct}%</div>
                        </div>
                        <div style="background:rgba(248,113,113,0.08);border-radius:10px;padding:10px 12px;">
                            <div style="font-size:0.7rem;color:var(--text-secondary);">跌停</div>
                            <div style="font-size:1rem;font-weight:bold;color:#f87171;">−${downPct}%</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:10px 12px;">
                            <div style="font-size:0.7rem;color:var(--text-secondary);">持仓人数</div>
                            <div style="font-size:1rem;font-weight:bold;color:var(--text-primary);">${holderCount} 人</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:10px 12px;">
                            <div style="font-size:0.7rem;color:var(--text-secondary);">总持仓额</div>
                            <div style="font-size:1rem;font-weight:bold;color:var(--text-primary);">${fmt(totalHolding)}</div>
                        </div>
                    </div>
                    <!-- 近期走势 -->
                    <div style="padding:0 20px 16px;">
                        <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:8px;">近期走势（最近12轮）</div>
                        <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:8px 10px;">${barsHtml}</div>
                        <div style="display:flex;justify-content:space-between;font-size:0.65rem;color:var(--text-secondary);margin-top:4px;">
                            <span>较早</span><span>较近</span>
                        </div>
                    </div>
                    <!-- 底部 -->
                    <div style="padding:12px 20px 18px;border-top:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:0.7rem;color:var(--text-secondary);">股票ID: #${cs.id}</span>
                        <button id="cs-detail-ok" style="background:var(--accent,#4a9eff);color:#fff;border:none;padding:8px 24px;border-radius:10px;cursor:pointer;font-size:0.9rem;font-weight:bold;">关闭</button>
                    </div>
                </div>`;
            overlay.style.display = 'flex';
            document.body.classList.add('modal-open');
            // 绑定关闭
            function closeCs() { overlay.style.display = 'none'; document.body.classList.remove('modal-open'); }
            overlay.querySelector('#cs-detail-close').onclick = closeCs;
            overlay.querySelector('#cs-detail-ok').onclick = closeCs;
            overlay.onclick = function(e) { if (e.target === overlay) closeCs(); };
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
