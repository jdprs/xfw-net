//  19. 玩家卡片渲染（v9.1 保留救助按钮，但改为资助金机制）
        // ================================================================

        function updatePlayersDisplay() {
            let container = document.getElementById('players-container');
            container.innerHTML = '';
            players.forEach((p, idx) => {
                let card = renderPlayerCard(p);
                container.appendChild(card);
                bindPlayerCardEvents(card, p);
            });
            updateDecisionUI();
        }

        function renderPlayerCard(p) {
            let card = document.createElement('div');
            let classes = 'player-card';
            if (p.bankrupt) classes += ' bankrupt';
            if (p.isAI) classes += ' ai-player';
            if (p.isExternal) classes += ' external-player';
            card.className = classes;
            card.dataset.playerId = p.id;

            // v10.1: 联机模式下（房主/玩家）只能操作自己的卡片，
            // 其他人的卡片只读展示，等轮到自己再操作，避免误操作他人资产
            const onlineMode = window.GAME_MODE === 'master' || window.GAME_MODE === 'player';
            const isMine = !onlineMode || (!!window.Sync && p.id === Sync.myPlayerId);

            let total = p.totalAssets();
            let cash = Math.round(p.cash);

            let stockRows = ['A', 'B', 'C', 'D'].map(s => {
                let shares = p[`shares${s}`] || 0;
                let price = stocks[s].price;
                let val = Math.round(shares * price);
                let cls = `stock-${s.toLowerCase()}-color`;
                let isDark = currentDarkHorse && currentDarkHorse.key === s;
                let darkTag = isDark ? ' 🐴' : '';
                // v9.3: 被封股票显示跑路标签
                let sealedTag = isStockSealed(s) ? ' 🚫跑路' : '';
                let mult = stocks[s].recentMultiplier || 1;
                let profit = Math.round(shares * price * (mult - 1));
                let profitText = '';
                if (profit !== 0 && !isStockSealed(s)) {
                    let cls2 = profit > 0 ? 'profit' : 'loss';
                    profitText = `<span class="${cls2}">${profit>0?'+':''}${fmt(profit)}</span>`;
                }
                let valText = isStockSealed(s) ? '已清零' : `${shares}股 (${fmt(val)})`;
                return `<div class="stat-row"><span class="label ${cls}">${stocks[s].name}${darkTag}${sealedTag}</span><span class="value">${valText} ${profitText}</span></div>`;
            }).join('');

            let customRows = '';
            if (p.customStockInvestments) {
                Object.entries(p.customStockInvestments).forEach(([cid, val]) => {
                    let cs = customStocks[parseInt(cid)];
                    if (cs && val > 0) {
                        let isDark = currentDarkHorse && currentDarkHorse.key === `custom_${cs.id}`;
                        let darkTag = isDark ? ' 🐴' : '';
                        customRows +=
                            `<div class="stat-row"><span class="label stock-custom-color">${cs.name}${darkTag}</span><span class="value">${fmt(Math.round(val))}</span></div>`;
                    }
                });
            }

            let isHuman = !p.isAI && !p.isExternal;
            let rating = p._lastRating || 'D';
            let ratingDisplay = `<span class="rating-badge rating-${rating}">⭐ ${rating}</span>`;

            let predictBtn = '';
            if (isHuman && !p.bankrupt && gameActive && isMine) {
                let alreadyPred = !!predictionsThisRound[p.id];
                let disabled = alreadyPred || decisionState !== 'deciding' || decidingPlayerId !== p.id;
                let isMyTurn = (decisionState === 'deciding' && decidingPlayerId === p.id);
                // v9.2: 已预测时提供「撤销预测」按钮，可单独退回押金
                let undoBtn = (alreadyPred && isMyTurn) ?
                    `<button class="btn-undo-predict" id="undo-predict-btn-${p.id}" title="撤销本轮预测并退还押金">↩️ 撤销</button>` : '';
                predictBtn =
                    `<button class="btn-predict" id="predict-btn-${p.id}" ${disabled ? 'disabled' : ''}>🔮 ${alreadyPred ? '已预测' : '预测'}</button>${undoBtn}`;
            }

            // v9.1: 破产救助按钮（联机模式下仅房主可操作，且会广播同步）
            let bailoutBtn = '';
            if (p.bankrupt && gameActive && (!onlineMode || window.GAME_MODE === 'master')) {
                bailoutBtn = `
                        <button class="btn-bailout" data-pid="${p.id}" data-action="bailout">💰 救助</button>
                    `;
            }

            let investHtml = '';
            if (isHuman && !p.bankrupt && gameActive) {
                // v10.1: 联机模式下非本人的卡片只读展示，等待轮到自己
                if (onlineMode && !isMine) {
                    investHtml = `
                        <div class="invest-section">
                            <div class="section-label">
                                <span>🔒 查看模式 · 轮到他操作时自动开放</span>
                                <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
                                    <button class="btn-sm btn-sm-gold achievement-btn" data-pid="${p.id}" style="font-size:0.7rem;">🏅 成就馆</button>
                                </div>
                            </div>
                        </div>`;
                } else {
                let stockControls = ['A', 'B', 'C', 'D'].map(s => {
                    let cls = `stock-${s.toLowerCase()}-color`;
                    let isDark = currentDarkHorse && currentDarkHorse.key === s;
                    let darkTag = isDark ? ' 🐴' : '';
                    // v9.3: 被封股票全部禁用
                    let sealed = isStockSealed(s);
                    let sealedTag = sealed ? ' 🚫已跑路' : '';
                    let price = stocks[s].price;
                    let disabled = sealed || decisionState !== 'deciding' || decidingPlayerId !== p.id || !isMine;
                    let priceText = sealed ? '暂停交易' : `(${fmt(price)})`;
                    return `<div class="stock-control-row" style="${sealed ? 'opacity:0.55;' : ''}">
                            <span class="sname ${cls}">${stocks[s].name}${darkTag}${sealedTag} <span class="badge badge-${s.toLowerCase()}">${s==='A'?'成长':s==='B'?'周期':s==='C'?'科技':'蓝筹'}</span> ${priceText}</span>
                            <div class="amt-group">
                                <button class="dec-stock" data-stock="${s}" data-pid="${p.id}" ${disabled ? 'disabled' : ''}>−</button>
                                <input type="text" id="inv-${s}-${p.id}" placeholder="股数" autocomplete="off" ${disabled ? 'disabled' : ''}>
                                <button class="inc-stock" data-stock="${s}" data-pid="${p.id}" ${disabled ? 'disabled' : ''}>+</button>
                            </div>
                            <div class="action-group">
                                <button class="btn-sm btn-sm-invest inv-stock" data-stock="${s}" data-pid="${p.id}" ${disabled ? 'disabled' : ''}>买</button>
                                <button class="btn-sm btn-sm-withdraw wdr-stock" data-stock="${s}" data-pid="${p.id}" ${disabled ? 'disabled' : ''}>卖</button>
                                <button class="btn-sm btn-sm-max max-stock" data-stock="${s}" data-pid="${p.id}" ${disabled ? 'disabled' : ''}>上限</button>
                            </div>
                        </div>`;
                }).join('');

                let customControls = customStocks.map(cs => {
                    if (cs.creatorId === p.id) return '';
                    let isDark = currentDarkHorse && currentDarkHorse.key === `custom_${cs.id}`;
                    let darkTag = isDark ? ' 🐴' : '';
                    let disabled = decisionState !== 'deciding' || decidingPlayerId !== p.id || !isMine;
                    return `<div class="stock-control-row">
                            <span class="sname stock-custom-color">${cs.name}${darkTag} <span class="badge badge-custom">自建</span></span>
                            <div class="amt-group">
                                <button class="dec-custom" data-cid="${cs.id}" data-pid="${p.id}" ${disabled ? 'disabled' : ''}>−</button>
                                <input type="text" id="cinv-${cs.id}-${p.id}" placeholder="金额" autocomplete="off" ${disabled ? 'disabled' : ''}>
                                <button class="inc-custom" data-cid="${cs.id}" data-pid="${p.id}" ${disabled ? 'disabled' : ''}>+</button>
                            </div>
                            <div class="action-group">
                                <button class="btn-sm btn-sm-invest inv-custom" data-cid="${cs.id}" data-pid="${p.id}" ${disabled ? 'disabled' : ''}>买</button>
                                <button class="btn-sm btn-sm-withdraw wdr-custom" data-cid="${cs.id}" data-pid="${p.id}" ${disabled ? 'disabled' : ''}>卖</button>
                                <button class="btn-sm btn-sm-max max-custom" data-cid="${cs.id}" data-pid="${p.id}" ${disabled ? 'disabled' : ''}>上限</button>
                            </div>
                        </div>`;
                }).filter(s => s).join('');

                investHtml = `
                        <div class="invest-section">
                            <div class="section-label">
                                <span>📊 投资操作 (输入股数后点击 买/卖)</span>
                                <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
                                    ${predictBtn}
                                    <button class="btn-sm btn-sm-gold achievement-btn" data-pid="${p.id}" style="font-size:0.7rem;">🏅 成就馆</button>
                                    ${bailoutBtn}
                                </div>
                            </div>
                            ${stockControls}
                            ${customControls ? `<div style="margin-top:4px;border-top:1px solid var(--border-color);padding-top:4px;">${customControls}</div>` : ''}
                            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
                                <button class="btn-sm btn-sm-gold create-stock-btn" data-pid="${p.id}" ${decisionState !== 'deciding' || decidingPlayerId !== p.id || !isMine ? 'disabled' : ''}>✨ 创建自建股</button>
                                <button class="btn-sm btn-sm-purple buy-lottery-btn" data-pid="${p.id}" ${decisionState !== 'deciding' || decidingPlayerId !== p.id || !isMine ? 'disabled' : ''}>🎫 买彩票</button>
                            </div>
                        </div>
                    `;
                }
            } else if (isHuman && p.bankrupt) {
                investHtml = `
                        <div class="invest-section">
                            <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:4px;">
                                <button class="btn-sm btn-sm-gold achievement-btn" data-pid="${p.id}" style="font-size:0.7rem;">🏅 成就馆</button>
                                ${bailoutBtn}
                            </div>
                        </div>
                    `;
            } else {
                investHtml = `
                        <div class="invest-section">
                            <div style="display:flex;justify-content:flex-end;margin-top:4px;">
                                <button class="btn-sm btn-sm-gold achievement-btn" data-pid="${p.id}" style="font-size:0.7rem;">🏅 成就馆</button>
                                ${bailoutBtn}
                            </div>
                        </div>
                    `;
            }

            let badge = '';
            if (p.isAI) badge = `<span class="ai-badge">${p.aiStrategy}</span>`;
            else if (p.isExternal) {
                let cfg = externalAIConfigs.find(c => c.playerId === p.id);
                let mode = cfg ? (cfg.accessMode === 'api' ? 'API' : '指令') : '未配置';
                badge = `<span class="external-badge">🌐 外接AI · ${mode}</span>`;
            }

            let thinkHtml = '';
            if (p.isAI && !p.bankrupt) {
                let isThinking = (aiThinkPlayerId === p.id && aiThinkTimer !== null);
                if (isThinking) {
                    let elapsed = Math.floor((Date.now() - aiThinkStartTime) / 1000);
                    thinkHtml =
                        `<div class="ai-think">🤖 思考中…已思考 <span class="think-timer">${elapsed}</span> 秒</div>`;
                } else {
                    thinkHtml = `<div class="ai-think">🤖 ${p.aiStrategy} · 多因子决策引擎</div>`;
                }
            } else if (p.isExternal && !p.bankrupt) {
                let cfg = externalAIConfigs.find(c => c.playerId === p.id);
                let mode = cfg ? (cfg.accessMode === 'api' ? 'API自动调用' : '指令模式') : '未配置';
                thinkHtml = `<div class="external-think">🌐 外接AI · ${mode}</div>`;
            }

            let achieveCount = p.achievements ? Object.values(p.achievements).filter(a => a.unlocked).length : 0;
            let achieveBadge = achieveCount > 0 ? `<span style="font-size:0.7rem;color:var(--accent-gold);margin-left:4px;">🏅${achieveCount}</span>` :
                '';
            let bankruptBadge = p.bankrupt ? `<span class="bankrupt-badge">💀 破产</span>` : '';

            card.innerHTML = `
                    <div class="player-header">
                        <div class="player-name">${p.name}${badge}${bankruptBadge}${achieveBadge}${ratingDisplay}</div>
                        <div class="player-total">${fmt(total)}</div>
                    </div>
                    <div class="player-stats">
                        <div class="stat-row"><span class="label">💵 现金</span><span class="value">${fmt(cash)}</span></div>
                        ${stockRows}
                        ${customRows}
                    </div>
                    ${thinkHtml}
                    ${investHtml}
                    <div class="decision-area">
                        ${buildDecisionHTML(p)}
                    </div>
                `;
            return card;
        }

        function bindPlayerCardEvents(card, p) {
            let isHuman = !p.isAI && !p.isExternal;

            let predBtn = document.getElementById(`predict-btn-${p.id}`);
            if (predBtn) {
                predBtn.onclick = function(e) {
                    e.stopPropagation();
                    if (decisionState === 'deciding' && decidingPlayerId === p.id) {
                        showPredictionModal(p.id);
                    } else {
                        showBanner('只有正在决策的玩家可以预测', 'warning', null, '⚠️ 操作无效');
                    }
                };
            }
            // v9.2: 撤销预测按钮
            let undoPredBtn = document.getElementById(`undo-predict-btn-${p.id}`);
            if (undoPredBtn) {
                undoPredBtn.onclick = function(e) {
                    e.stopPropagation();
                    undoPrediction(p.id);
                };
            }

            // v9.1: 手动救助按钮（作为备选）
            let bailoutBtn = card.querySelector(`.btn-bailout[data-pid="${p.id}"]`);
            if (bailoutBtn) {
                bailoutBtn.onclick = function(e) {
                    e.stopPropagation();
                    if (!p.bankrupt) {
                        showBanner('该玩家未破产，无需救助', 'warning', null, '💰 救助');
                        return;
                    }
                    let fund = ADMIN_CONFIG.bankruptcyFund || BANKRUPTCY_FUND || 1000;
                    showConfirmBanner(`确定要给 ${p.name} 发放 ${fmt(fund)} 救助金吗？`, () => {
                        p.bankrupt = false;
                        p.cash += fund;
                        if (!p.sharesA) p.sharesA = 0;
                        if (!p.sharesB) p.sharesB = 0;
                        if (!p.sharesC) p.sharesC = 0;
                        if (!p.sharesD) p.sharesD = 0;
                        if (!p.customStockInvestments) p.customStockInvestments = {};
                        if (playerDecisionStatus[p.id] === 'done') {
                            playerDecisionStatus[p.id] = 'pending';
                        }
                        if (!p.achievements) initPlayerAchievements(p);
                        addLog(`💰 ${p.name} 获得 ${fmt(fund)} 救助金，已脱离破产！`, 'highlight');
                        showBanner(`💰 ${p.name} 获得 ${fmt(fund)} 救助金！`, 'success', null, '💰 救助成功');
                        // v10.1: 联机模式下房主救助后广播同步给所有玩家
                        if (window.GAME_MODE === 'master' && typeof window.xfwBroadcastState === 'function') {
                            window.xfwBroadcastState();
                        }
                        updateUI();
                        updatePlayersDisplay();
                        updateLeaderboard();
                        checkAllDone();
                        updateDecisionUI();
                    }, () => {});
                };
            }

            if (isHuman && !p.bankrupt && gameActive) {
                bindStockControls(card, p);
                bindCustomStockControls(card, p);
                bindCreateStockBtn(card, p);
                bindLotteryBtn(card, p);
            }

            let achieveBtn = card.querySelector(`.achievement-btn[data-pid="${p.id}"]`);
            if (achieveBtn) {
                achieveBtn.onclick = function(e) {
                    e.stopPropagation();
                    renderAchievementModal(p.id);
                    document.getElementById('achievement-modal').classList.add('active');
                    document.body.classList.add('modal-open');
                };
            }
        }

        // ===== 绑定标准股票控件 =====
        function bindStockControls(card, p) {
            ['A', 'B', 'C', 'D'].forEach(s => {
                let input = document.getElementById(`inv-${s}-${p.id}`);
                if (!input) return;

                function getInputNumber() {
                    let v = parseInt(input.value.trim());
                    if (input.value.trim() === '') return NaN;
                    return isNaN(v) ? NaN : v;
                }

                function setInputValue(v) {
                    if (isNaN(v) || v < 0) { input.value = ''; } else { input.value = v; }
                }

                function handleBlur() {
                    let v = getInputNumber();
                    if (isNaN(v)) { input.value = ''; }
                }
                input.onchange = handleBlur;
                input.onblur = handleBlur;

                let dec = card.querySelector(`.dec-stock[data-stock="${s}"][data-pid="${p.id}"]`);
                let inc = card.querySelector(`.inc-stock[data-stock="${s}"][data-pid="${p.id}"]`);
                if (dec) dec.onclick = function(e) {
                    e.stopPropagation();
                    if (decisionState !== 'deciding' || decidingPlayerId !== p.id) return;
                    let v = getInputNumber();
                    if (isNaN(v)) v = 0;
                    v = Math.max(0, v - 1);
                    setInputValue(v);
                    input.focus();
                    input.select();
                };
                if (inc) inc.onclick = function(e) {
                    e.stopPropagation();
                    if (decisionState !== 'deciding' || decidingPlayerId !== p.id) return;
                    let v = getInputNumber();
                    if (isNaN(v)) v = 0;
                    v = v + 1;
                    setInputValue(v);
                    input.focus();
                    input.select();
                };

                let invBtn = card.querySelector(`.inv-stock[data-stock="${s}"][data-pid="${p.id}"]`);
                if (invBtn) invBtn.onclick = function(e) {
                    e.stopPropagation();
                    if (decisionState !== 'deciding' || decidingPlayerId !== p.id) {
                        showBanner('请先点击「决策」开始操作', 'warning', null, '⚠️ 操作无效');
                        return;
                    }
                    let raw = input.value.trim();
                    if (raw === '') { showBanner('请输入股数', 'warning', null, '⚠️ 操作失败'); return; }
                    let shares = parseInt(raw);
                    if (isNaN(shares) || shares < 0) { showBanner('请输入有效整数', 'warning', null, '⚠️ 操作失败'); return; }
                    if (shares < 1) { showBanner('至少买入1股', 'warning', null, '⚠️ 操作失败'); return; }
                    investStock(p.id, s, shares);
                    input.value = '';
                    input.blur();
                };

                let wdrBtn = card.querySelector(`.wdr-stock[data-stock="${s}"][data-pid="${p.id}"]`);
                if (wdrBtn) wdrBtn.onclick = function(e) {
                    e.stopPropagation();
                    if (decisionState !== 'deciding' || decidingPlayerId !== p.id) {
                        showBanner('请先点击「决策」开始操作', 'warning', null, '⚠️ 操作无效');
                        return;
                    }
                    let raw = input.value.trim();
                    if (raw === '') { showBanner('请输入股数', 'warning', null, '⚠️ 操作失败'); return; }
                    let shares = parseInt(raw);
                    if (isNaN(shares) || shares < 0) { showBanner('请输入有效整数', 'warning', null, '⚠️ 操作失败'); return; }
                    if (shares < 1) { showBanner('至少卖出1股', 'warning', null, '⚠️ 操作失败'); return; }
                    let key = `shares${s}`;
                    if ((p[key] || 0) < shares) { showBanner(`最多 ${p[key]||0}股`, 'warning', null, '⚠️ 持仓不足'); return; }
                    withdrawStock(p.id, s, shares);
                    input.value = '';
                    input.blur();
                };

                let maxBtn = card.querySelector(`.max-stock[data-stock="${s}"][data-pid="${p.id}"]`);
                if (maxBtn) {
                    maxBtn.onclick = function(e) {
                        e.stopPropagation();
                        if (decisionState !== 'deciding' || decidingPlayerId !== p.id) {
                            showBanner('请先点击「决策」开始操作', 'warning', null, '⚠️ 操作无效');
                            return;
                        }
                        let price = stocks[s].price;
                        let maxShares = Math.floor(p.cash / price);
                        if (maxShares < 1) {
                            showBanner('现金不足以购买1股', 'warning', null, '⚠️ 上限');
                            return;
                        }
                        setInputValue(maxShares);
                        input.focus();
                        input.select();
                        showBanner(`最多可买 ${maxShares} 股 ${s}股`, 'info', null, '📊 上限');
                    };
                }
            });
        }

        // ===== 绑定自建股控件 =====
        function bindCustomStockControls(card, p) {
            customStocks.forEach(cs => {
                if (cs.creatorId === p.id) return;
                let input = document.getElementById(`cinv-${cs.id}-${p.id}`);
                if (!input) return;

                function getInputNumber() {
                    let v = parseFloat(input.value.trim());
                    if (input.value.trim() === '') return NaN;
                    return isNaN(v) ? NaN : v;
                }

                function setInputValue(v) {
                    if (isNaN(v) || v < 0) { input.value = ''; } else { input.value = v; }
                }

                function handleBlur() {
                    let v = getInputNumber();
                    if (isNaN(v)) { input.value = ''; }
                }
                input.onchange = handleBlur;
                input.onblur = handleBlur;

                let dec = card.querySelector(`.dec-custom[data-cid="${cs.id}"][data-pid="${p.id}"]`);
                let inc = card.querySelector(`.inc-custom[data-cid="${cs.id}"][data-pid="${p.id}"]`);
                if (dec) dec.onclick = function(e) {
                    e.stopPropagation();
                    if (decisionState !== 'deciding' || decidingPlayerId !== p.id) return;
                    let v = getInputNumber();
                    if (isNaN(v)) v = 0;
                    v = Math.max(0, v - 100);
                    setInputValue(v);
                    input.focus();
                    input.select();
                };
                if (inc) inc.onclick = function(e) {
                    e.stopPropagation();
                    if (decisionState !== 'deciding' || decidingPlayerId !== p.id) return;
                    let v = getInputNumber();
                    if (isNaN(v)) v = 0;
                    v = v + 100;
                    setInputValue(v);
                    input.focus();
                    input.select();
                };

                let invBtn = card.querySelector(`.inv-custom[data-cid="${cs.id}"][data-pid="${p.id}"]`);
                if (invBtn) invBtn.onclick = function(e) {
                    e.stopPropagation();
                    if (decisionState !== 'deciding' || decidingPlayerId !== p.id) {
                        showBanner('请先点击「决策」开始操作', 'warning', null, '⚠️ 操作无效');
                        return;
                    }
                    let raw = input.value.trim();
                    if (raw === '') { showBanner('请输入金额', 'warning', null, '⚠️ 操作失败'); return; }
                    let v = parseFloat(raw);
                    if (isNaN(v) || v < 0) { showBanner('请输入有效数字', 'warning', null, '⚠️ 操作失败'); return; }
                    if (v < 1) { showBanner('投资金额至少为1元', 'warning', null, '⚠️ 操作失败'); return; }
                    let rounded = Math.round(v);
                    if (rounded > p.cash) { showBanner(`最多 ${fmt(p.cash)}`, 'warning', null, '⚠️ 现金不足'); return; }
                    investCustomStock(p.id, cs.id, rounded);
                    input.value = '';
                    input.blur();
                };

                let wdrBtn = card.querySelector(`.wdr-custom[data-cid="${cs.id}"][data-pid="${p.id}"]`);
                if (wdrBtn) wdrBtn.onclick = function(e) {
                    e.stopPropagation();
                    if (decisionState !== 'deciding' || decidingPlayerId !== p.id) {
                        showBanner('请先点击「决策」开始操作', 'warning', null, '⚠️ 操作无效');
                        return;
                    }
                    let raw = input.value.trim();
                    if (raw === '') { showBanner('请输入金额', 'warning', null, '⚠️ 操作失败'); return; }
                    let v = parseFloat(raw);
                    if (isNaN(v) || v < 0) { showBanner('请输入有效数字', 'warning', null, '⚠️ 操作失败'); return; }
                    if (v < 1) { showBanner('取回金额至少为1元', 'warning', null, '⚠️ 操作失败'); return; }
                    let rounded = Math.round(v);
                    let inv = p.customStockInvestments?.[cs.id] || 0;
                    if (rounded > inv) { showBanner(`最多 ${fmt(inv)}`, 'warning', null, '⚠️ 持仓不足'); return; }
                    withdrawCustomStock(p.id, cs.id, rounded);
                    input.value = '';
                    input.blur();
                };

                let maxBtn = card.querySelector(`.max-custom[data-cid="${cs.id}"][data-pid="${p.id}"]`);
                if (maxBtn) {
                    maxBtn.onclick = function(e) {
                        e.stopPropagation();
                        if (decisionState !== 'deciding' || decidingPlayerId !== p.id) {
                            showBanner('请先点击「决策」开始操作', 'warning', null, '⚠️ 操作无效');
                            return;
                        }
                        if (p.cash < 1) {
                            showBanner('现金不足1元', 'warning', null, '⚠️ 上限');
                            return;
                        }
                        setInputValue(p.cash);
                        input.focus();
                        input.select();
                        showBanner(`最多可投 ${fmt(p.cash)}`, 'info', null, '📊 上限');
                    };
                }
            });
        }

        // ===== 绑定创建自建股按钮 =====
        function bindCreateStockBtn(card, p) {
            let createBtn = card.querySelector(`.create-stock-btn[data-pid="${p.id}"]`);
            if (createBtn) {
                createBtn.onclick = function() {
                    if (decisionState !== 'deciding' || decidingPlayerId !== p.id) {
                        showBanner('请先点击「决策」开始操作', 'warning', null, '⚠️ 操作无效');
                        return;
                    }
                    showCreateStockModal(p.id);
                };
            }
        }

        // ===== 绑定购买彩票按钮 =====
        function bindLotteryBtn(card, p) {
            let lotteryBtn = card.querySelector(`.buy-lottery-btn[data-pid="${p.id}"]`);
            if (lotteryBtn) {
                lotteryBtn.onclick = function() {
                    if (decisionState !== 'deciding' || decidingPlayerId !== p.id) {
                        showBanner('请先点击「决策」开始操作', 'warning', null, '⚠️ 操作无效');
                        return;
                    }
                    showBuyLotteryModal(p.id);
                };
            }
        }

        // ================================================================
