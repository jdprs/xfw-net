//  10. 外接AI（v9.1 完善）
        // ================================================================
        // v10.0 联机说明：
        //   联机模式下外接AI【仅在房主端运行】（与内置AI一样在权威端完成决策）。
        //   非房主玩家端不会显示外接AI指令面板，也不会执行本模块的决策逻辑；
        //   AI 的所有操作结果由房主通过 state_sync 下发，玩家端仅渲染。
        // ================================================================

        function generateExternalAIPrompt(playerId) {
            let p = players[playerId];
            if (!p) return '错误：玩家不存在';
            let lines = [];
            lines.push('=== 小富翁股票投资游戏 — 外接AI决策指令 v9.3 ===');
            lines.push('');
            lines.push('【游戏规则摘要】');
            lines.push('- 目标：总资产最高者获胜。总资产 = 现金 + 股票市值（股份数×股价） + 自建股投资');
            lines.push('- 所有金额为整数元，总资产低于阈值即破产（默认100元）');
            lines.push('- 投资以"股份"为单位，输入股份数量，系统自动计算金额 = 股份数 × 当前股价');
            let stockTypeParts = ['A', 'B', 'C', 'D'].map(k => {
                let s = stocks[k];
                let up = (s.maxUp * 100).toFixed(0);
                let down = (s.maxDown * 100).toFixed(0);
                let label = k + '股';
                let tag = '';
                if (k === 'A') tag = '稳健';
                else if (k === 'B') tag = '周期';
                else if (k === 'C') tag = '科技';
                else if (k === 'D') tag = '蓝筹';
                return `${label}(${tag}${down}%~+${up}%) 当前股价 ${fmt(s.price)}`;
            });
            lines.push(`- 股票类型：${stockTypeParts.join('、')}`);
            lines.push('- 自建股：其他玩家创建的股票，您可投资（以金额计）');
            lines.push('- 彩票：每轮可购买，中奖获得奖金，但也有诈骗风险');
            lines.push('- 银行资产低于阈值时将触发掠夺税，掠夺后下一轮有50%概率随机封掉一只股票（老板跑路）');
            lines.push('- 被封股票：持仓清零、无法买卖/预测、价格冻结；4轮后重开（价格重置，持仓不恢复）');
            if (currentDarkHorse) {
                lines.push(`- 🐴 本轮黑马股：${currentDarkHorse.name}（涨跌幅倍率 ${DARK_HORSE_MULTIPLIER}x）`);
            } else {
                lines.push('- 🐴 本轮无黑马股');
            }
            lines.push('');
            lines.push('【🏅 成就系统】');
            lines.push('游戏内置9项成就（v9.1 移除「破产者」成就），达成后按当前总资产比例获得奖励。');
            const achList = ACHIEVEMENT_IDS.map(id => {
                const def = ACHIEVEMENT_DEFS[id];
                return `  - ${def.icon} ${def.name}：${def.desc}（奖励总资产 × ${(achievementRewardRatios[id]||0.10)*100}%）`;
            });
            lines.push(...achList);
            lines.push('');
            lines.push('【🔮 股神预测】');
            lines.push('您可以在本轮进行预测，押注某只股票上涨、持平或下跌。');
            lines.push('押注金额上限为总资产的5%，猜对获得押注×2.5的奖金。');
            lines.push('A股只涨不跌，因此下跌选项不可用。');
            lines.push('每轮限预测一次，押注金额任意整数。');
            lines.push('📌 持平判定：股价变化在 ±1.5% 以内视为持平。');
            lines.push('📌 预测上涨/下跌但实际持平时，押金没收（视为预测错误）。');
            lines.push('');
            lines.push('【✨ 创建自建股】');
            lines.push('您可以创建自己的股票，供其他玩家投资。');
            lines.push('需要提供：股票名称、上涨利率(%)、利润留存比例(%)。');
            lines.push('创建者不能投资自己创建的股票。');
            lines.push('');
            lines.push('【当前市场状态】');
            let stockStatus = ['A', 'B', 'C', 'D'].map(k => {
                let s = stocks[k];
                let mult = s.recentMultiplier || 1;
                let pct = ((mult - 1) * 100).toFixed(1);
                let trendText = '平稳';
                if (s.trend > 0.02) trendText = '上涨';
                else if (s.trend < -0.02) trendText = '下跌';
                let isDark = currentDarkHorse && currentDarkHorse.key === k;
                return `  ${k}股${isDark ? ' 🐴黑马' : ''}：股价 ${fmt(s.price)}，上轮涨跌 ${pct}%，趋势：${trendText}`;
            });
            lines.push(...stockStatus);
            lines.push(`  当前银行资产：${fmt(bankAssets)}${bankAssets < LOOT_THRESHOLD ? ' ⚠️ 低于掠夺阈值！' : '（安全）'}`);
            let sealedKeys = Object.keys(sealedStocks || {});
            if (sealedKeys.length > 0) {
                let sealedInfo = sealedKeys.map(k => {
                    let info = sealedStocks[k];
                    let recoverRound = info ? info.recoverRound : '?';
                    return `${k}股(第${recoverRound}轮恢复)`;
                }).join('、');
                lines.push(`  🚫 已跑路股票：${sealedInfo}（持仓已清零，无法交易/预测）`);
            } else {
                lines.push('  🚫 已跑路股票：无');
            }
            lines.push('');
            lines.push('【自建股列表】');
            if (customStocks.length === 0) {
                lines.push('  暂无自建股');
            } else {
                customStocks.forEach(cs => {
                    let creator = players.find(p2 => p2.id === cs.creatorId);
                    let mult = cs.recentMultiplier || 1;
                    let pct = ((mult - 1) * 100).toFixed(1);
                    let isDark = currentDarkHorse && currentDarkHorse.key === `custom_${cs.id}`;
                    lines.push(
                        `  [${cs.id}] ${cs.name}${isDark ? ' 🐴黑马' : ''} (创建者: ${creator ? creator.name : '未知'})，上轮涨跌 ${pct}%`
                        );
                });
            }
            lines.push('');
            lines.push('【彩票信息】');
            lotteries.forEach((l, idx) => {
                let winRate = (l.winProb * 100).toFixed(1);
                let scamRate = (l.scamRate * 100).toFixed(1);
                lines.push(
                    `  [${idx}] ${l.name}：价格${fmt(l.price)}/张，中奖率${winRate}%，奖金为现金×${(l.rewardRatio*100).toFixed(0)}%，诈骗率${scamRate}%`
                    );
            });
            lines.push('');
            lines.push('【您的当前状态】');
            lines.push(`  玩家：${p.name}（外接AI）`);
            lines.push(`  现金：${fmt(p.cash)}`);
            let sharesInfo = ['A', 'B', 'C', 'D'].map(k => {
                let shares = p[`shares${k}`] || 0;
                let price = stocks[k].price;
                return `${k}股 ${shares}股 (市值 ${fmt(shares*price)})`;
            }).join('，');
            lines.push(`  持仓：${sharesInfo}`);
            if (p.customStockInvestments && Object.keys(p.customStockInvestments).length > 0) {
                let custStr = Object.entries(p.customStockInvestments).map(([cid, val]) => {
                    let cs = customStocks[parseInt(cid)];
                    return cs ? `${cs.name} ${fmt(val)}` : `自建股#${cid} ${fmt(val)}`;
                }).join('，');
                lines.push(`  自建股投资：${custStr}`);
            } else {
                lines.push('  自建股投资：无');
            }
            lines.push(`  总资产：${fmt(p.totalAssets())}`);
            let unlocked = getUnlockedAchievements(p);
            if (unlocked.length > 0) {
                lines.push(`  已解锁成就：${unlocked.map(a=>a.name).join('、')}`);
            } else {
                lines.push('  已解锁成就：无');
            }
            let alreadyPred = !!predictionsThisRound[p.id];
            lines.push(`  预测状态：${alreadyPred ? '已预测' : '未预测'}`);
            lines.push('');
            lines.push('【其他玩家简况】');
            players.filter(p2 => p2.id !== p.id && !p2.bankrupt).forEach(p2 => {
                let type = p2.isAI ? '场内AI' : (p2.isExternal ? '外接AI' : '真人');
                lines.push(`  ${p2.name} (${type})：总资产 ${fmt(p2.totalAssets())}`);
            });
            lines.push('');
            lines.push('【📋 可执行操作列表】');
            lines.push('你可以执行以下任意操作，按需组合：');
            lines.push('  1. 买入股票：{ "type": "buy", "stock": "A/B/C/D", "shares": 股份数 }');
            lines.push('  2. 卖出股票：{ "type": "sell", "stock": "A/B/C/D", "shares": 股份数 }');
            lines.push('  3. 投资自建股：{ "type": "buy_custom", "stockId": 自建股ID, "amount": 金额 }');
            lines.push('  4. 取回自建股：{ "type": "sell_custom", "stockId": 自建股ID, "amount": 金额 }');
            lines.push('  5. 购买彩票：{ "type": "lottery", "lotteryId": 彩票ID, "quantity": 张数 }');
            lines.push('  6. 股神预测：{ "type": "predict", "stock": "A/B/C/D", "direction": "up/down/hold", "amount": 押注金额 }');
            lines.push('  7. 创建自建股：{ "type": "create_custom", "name": "股票名", "maxUpPercent": 上涨利率%, "keepPercent": 利润留存% }');
            lines.push('');
            lines.push('【决策格式要求】');
            lines.push('请以纯JSON格式返回您的决策（不要包含```json标记或解释文字）：');
            lines.push('{');
            lines.push('  "actions": [');
            lines.push('    { "type": "buy", "stock": "A", "shares": 10 },');
            lines.push('    { "type": "sell", "stock": "B", "shares": 5 },');
            lines.push('    { "type": "buy_custom", "stockId": 0, "amount": 800 },');
            lines.push('    { "type": "sell_custom", "stockId": 1, "amount": 300 },');
            lines.push('    { "type": "lottery", "lotteryId": 0, "quantity": 1 },');
            lines.push('    { "type": "predict", "stock": "C", "direction": "up", "amount": 200 },');
            lines.push('    { "type": "create_custom", "name": "新能源", "maxUpPercent": 30, "keepPercent": 50 }');
            lines.push('  ]');
            lines.push('}');
            lines.push('');
            lines.push('【详细说明】');
            lines.push('- "stock" 可选值：A, B, C, D');
            lines.push('- "shares" 为股份数量（整数），系统自动计算金额 = shares × 当前股价');
            lines.push('- "stockId" 为自建股的索引（0, 1, 2, ...）');
            lines.push('- "lotteryId" 为彩票索引（0-4）');
            lines.push('- "predict" 为股神预测，direction 为 "up" / "down" / "hold"，amount 为押注金额（整数）');
            lines.push('- "create_custom" 创建自建股，maxUpPercent 为上涨利率%，keepPercent 为利润留存%');
            lines.push('- 所有金额必须为整数（元）');
            lines.push('- 买入总金额不能超过您的现金，卖出不能超过持仓');
            lines.push('- 每轮限预测一次，若已预测则 ignore');
            lines.push('- 预测金额上限为总资产的5%');
            lines.push('- A股方向只能为 "up" 或 "hold"');
            lines.push('- 持平判定阈值：±1.5% 股价变化视为持平');
            lines.push('- 🚫 已跑路（被封）股票无法买卖和预测，请勿对其发起操作');
            lines.push('- 被封股票4轮后重开，价格重置为初始价，之前持仓不恢复');
            lines.push('- 创建自建股需要提供名称、上涨利率(1-80%)、留存比例(10-90%)');
            lines.push('- 请仅返回纯净JSON，不要包含任何其他文字');
            lines.push('');
            lines.push('=== 指令结束 ===');
            return lines.join('\n');
        }

        function parseExternalAIResponse(text) {
            try {
                let jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    return { error: '未找到有效的JSON格式' };
                }
                let data = JSON.parse(jsonMatch[0]);
                if (!data.actions || !Array.isArray(data.actions)) {
                    return { error: '缺少 actions 数组' };
                }
                return { actions: data.actions };
            } catch (e) {
                return { error: 'JSON解析失败：' + e.message };
            }
        }

        function executeExternalAIDecision(playerId, actions) {
            let p = players[playerId];
            if (!p || p.bankrupt) {
                showBanner(`外接AI ${p ? p.name : '未知'} 已破产或不存在`, 'error', null, '🌐 外接AI');
                return { success: false, errors: ['玩家已破产'], summary: [] };
            }
            let executed = 0;
            let errors = [];
            let summary = [];
            let failedActions = [];

            for (let act of actions) {
                try {
                    let type = act.type;
                    let success = false;
                    let detail = '';

                    if (type === 'buy') {
                        let stock = act.stock;
                        let shares = Math.floor(act.shares || 0);
                        if (shares < 1) {
                            errors.push(`买入${stock}股份数需≥1`);
                            failedActions.push(act);
                            continue;
                        }
                        let price = stocks[stock]?.price;
                        if (!price) {
                            errors.push(`无效股票：${stock}`);
                            failedActions.push(act);
                            continue;
                        }
                        let amount = Math.round(shares * price);
                        if (amount > p.cash) {
                            errors.push(`买入${stock} ${shares}股 (${fmt(amount)}) 失败：现金不足 (${fmt(p.cash)})`);
                            failedActions.push(act);
                            continue;
                        }
                        investStock(p.id, stock, shares);
                        executed++;
                        success = true;
                        detail = `买入 ${stock}股 ${shares}股 (${fmt(amount)})`;
                        summary.push(detail);
                    } else if (type === 'sell') {
                        let stock = act.stock;
                        let shares = Math.floor(act.shares || 0);
                        if (shares < 1) {
                            errors.push(`卖出${stock}股份数需≥1`);
                            failedActions.push(act);
                            continue;
                        }
                        let key = `shares${stock}`;
                        if ((p[key] || 0) < shares) {
                            errors.push(`卖出${stock} ${shares}股 失败：持仓不足 (最多 ${p[key]||0}股)`);
                            failedActions.push(act);
                            continue;
                        }
                        withdrawStock(p.id, stock, shares);
                        executed++;
                        success = true;
                        detail = `卖出 ${stock}股 ${shares}股`;
                        summary.push(detail);
                    } else if (type === 'buy_custom') {
                        let stockId = act.stockId;
                        let amount = Math.round(act.amount || 0);
                        if (amount < 1) {
                            errors.push('投资自建股金额需≥1元');
                            failedActions.push(act);
                            continue;
                        }
                        if (amount > p.cash) {
                            errors.push(`投资自建股 失败：现金不足 (${fmt(p.cash)})`);
                            failedActions.push(act);
                            continue;
                        }
                        let cs = customStocks[stockId];
                        if (!cs) {
                            errors.push(`自建股${stockId}不存在`);
                            failedActions.push(act);
                            continue;
                        }
                        if (cs.creatorId === p.id) {
                            errors.push('不能投资自己创建的股票');
                            failedActions.push(act);
                            continue;
                        }
                        investCustomStock(p.id, stockId, amount);
                        executed++;
                        success = true;
                        detail = `投资自建股「${cs.name}」${fmt(amount)}`;
                        summary.push(detail);
                    } else if (type === 'sell_custom') {
                        let stockId = act.stockId;
                        let amount = Math.round(act.amount || 0);
                        if (amount < 1) {
                            errors.push('取回自建股金额需≥1元');
                            failedActions.push(act);
                            continue;
                        }
                        let inv = p.customStockInvestments?.[stockId] || 0;
                        if (amount > inv) {
                            errors.push(`取回自建股 失败：持仓不足 (最多 ${fmt(inv)})`);
                            failedActions.push(act);
                            continue;
                        }
                        let cs = customStocks[stockId];
                        if (!cs) {
                            errors.push(`自建股${stockId}不存在`);
                            failedActions.push(act);
                            continue;
                        }
                        withdrawCustomStock(p.id, stockId, amount);
                        executed++;
                        success = true;
                        detail = `取回自建股「${cs.name}」${fmt(amount)}`;
                        summary.push(detail);
                    } else if (type === 'lottery') {
                        let lotteryId = act.lotteryId;
                        let quantity = Math.floor(act.quantity || 0);
                        if (quantity < 1) {
                            errors.push('彩票数量需≥1');
                            failedActions.push(act);
                            continue;
                        }
                        let lot = lotteries[lotteryId];
                        if (!lot) {
                            errors.push(`彩票${lotteryId}不存在`);
                            failedActions.push(act);
                            continue;
                        }
                        let totalCost = lot.price * quantity;
                        if (totalCost > p.cash) {
                            errors.push(`购买彩票失败：现金不足 (${fmt(p.cash)})`);
                            failedActions.push(act);
                            continue;
                        }
                        buyLottery(p.id, lotteryId, quantity);
                        executed++;
                        success = true;
                        detail = `购买 ${quantity} 张 ${lot.name}`;
                        summary.push(detail);
                    } else if (type === 'predict') {
                        let stock = act.stock;
                        let direction = act.direction;
                        let amount = Math.round(act.amount || 0);
                        if (!['up', 'down', 'hold'].includes(direction)) {
                            errors.push('direction 必须为 up/down/hold');
                            failedActions.push(act);
                            continue;
                        }
                        if (amount < 1) {
                            errors.push('预测押注金额需≥1元');
                            failedActions.push(act);
                            continue;
                        }
                        if (amount > p.cash) {
                            errors.push(`预测押注 ${fmt(amount)} 失败：现金不足 (${fmt(p.cash)})`);
                            failedActions.push(act);
                            continue;
                        }
                        let totalAssets = p.totalAssets();
                        let maxBet = Math.floor(totalAssets * 0.05);
                        if (amount > maxBet) {
                            errors.push(`预测押注上限为总资产的5%（${fmt(maxBet)}）`);
                            failedActions.push(act);
                            continue;
                        }
                        if (!['A', 'B', 'C', 'D'].includes(stock)) {
                            errors.push(`无效股票：${stock}`);
                            failedActions.push(act);
                            continue;
                        }
                        if (stock === 'A' && direction === 'down') {
                            errors.push('A股不会下跌，不能预测下跌');
                            failedActions.push(act);
                            continue;
                        }
                        if (predictionsThisRound[p.id]) {
                            errors.push('本轮已预测，每轮限一次');
                            failedActions.push(act);
                            continue;
                        }
                        makePrediction(p.id, stock, direction, amount);
                        executed++;
                        success = true;
                        let dirText = direction === 'up' ? '上涨📈' : direction === 'down' ? '下跌📉' : '持平➖';
                        detail = `预测 ${stock}股 ${dirText}，押注 ${fmt(amount)}`;
                        summary.push(detail);
                    } else if (type === 'create_custom') {
                        let name = (act.name || '').trim();
                        let maxUpPercent = parseFloat(act.maxUpPercent) || 30;
                        let keepPercent = parseFloat(act.keepPercent) || 50;
                        if (!name) {
                            errors.push('创建自建股失败：名称不能为空');
                            failedActions.push(act);
                            continue;
                        }
                        if (maxUpPercent < 1 || maxUpPercent > 80) {
                            errors.push('上涨利率应在1-80之间');
                            failedActions.push(act);
                            continue;
                        }
                        if (keepPercent < 10 || keepPercent > 90) {
                            errors.push('利润留存应在10-90之间');
                            failedActions.push(act);
                            continue;
                        }
                        if (customStocks.some(cs => cs.name === name)) {
                            errors.push(`自建股「${name}」已存在`);
                            failedActions.push(act);
                            continue;
                        }
                        createCustomStock(p.id, name, maxUpPercent, keepPercent);
                        executed++;
                        success = true;
                        detail = `创建自建股「${name}」(${maxUpPercent}%/${keepPercent}%)`;
                        summary.push(detail);
                    } else {
                        errors.push(`未知操作类型：${type}`);
                        failedActions.push(act);
                    }

                    if (!success && detail) {
                        if (!errors.includes(detail)) {
                            errors.push(detail);
                        }
                    }
                } catch (e) {
                    errors.push('操作异常：' + (e.message || '未知错误'));
                    failedActions.push(act);
                }
            }

            if (executed > 0) {
                addLog(`🌐 ${p.name} 执行了 ${executed} 项操作`, 'external');
                let msg = `🌐 ${p.name} 执行了 ${executed} 项操作：\n` + summary.join('\n');
                if (errors.length > 0) {
                    msg += '\n⚠️ 部分操作失败：' + errors.slice(0, 5).join('; ');
                    if (errors.length > 5) msg += `... 共 ${errors.length} 项失败`;
                }
                showBanner(msg, 'success', null, '🌐 外接AI');
                updateUI();
                updatePlayersDisplay();
                updateLeaderboard();
            } else {
                let msg = `🌐 ${p.name} 所有操作均失败`;
                if (errors.length > 0) {
                    msg += '\n错误：' + errors.slice(0, 5).join('; ');
                    if (errors.length > 5) msg += `... 共 ${errors.length} 项错误`;
                }
                showBanner(msg, 'warning', null, '🌐 外接AI');
                let retryPrompt = generateExternalAIPrompt(playerId);
                document.getElementById('eai-prompt-box').textContent = retryPrompt;
                document.getElementById('eai-panel-title').textContent = `🌐 ${p.name} 指令面板（重试）`;
                let overlay = document.getElementById('eai-overlay');
                overlay.classList.add('active');
                document.body.classList.add('modal-open');
                overlay.dataset.currentPlayerId = playerId;
                return { success: false, errors, summary: [] };
            }

            if (failedActions.length > 0 && executed > 0) {
                let retryPrompt = generateExternalAIPrompt(playerId);
                document.getElementById('eai-prompt-box').textContent = retryPrompt;
                document.getElementById('eai-panel-title').textContent = `🌐 ${p.name} 指令面板（部分失败，请重试）`;
                let overlay = document.getElementById('eai-overlay');
                if (!overlay.classList.contains('active')) {
                    overlay.classList.add('active');
                    document.body.classList.add('modal-open');
                    overlay.dataset.currentPlayerId = playerId;
                }
                showBanner(`部分操作失败 (${failedActions.length}项)，请检查后重新生成指令`, 'warning', null, '🌐 外接AI');
            }

            return { success: executed > 0, errors, summary };
        }

        async function callExternalAIAPI(playerId, apiConfig) {
            if (!gameActive) return;
            let p = players[playerId];
            if (!p) return;
            let prompt = generateExternalAIPrompt(playerId);
            let url = apiConfig.endpoint || 'https://api.openai.com/v1/chat/completions';
            let headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiConfig.apiKey}`
            };
            let body = {
                model: apiConfig.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: '你是一个专业的股票投资决策AI，请根据游戏状态做出最优投资决策。只返回JSON格式的决策。' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 800
            };
            try {
                let resp = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(body)
                });
                if (!gameActive) return;
                if (!resp.ok) {
                    let err = await resp.text();
                    addLog(`🌐 API调用失败：${resp.status}`, 'loss');
                    showBanner(`API调用失败：${resp.status}`, 'error', null, '🌐 外接AI');
                    markPlayerDone(playerId);
                    checkAllDone();
                    return;
                }
                let data = await resp.json();
                if (!gameActive) return;
                let reply = data.choices?.[0]?.message?.content || '';
                let parsed = parseExternalAIResponse(reply);
                if (parsed.error) {
                    addLog(`🌐 解析AI回复失败：${parsed.error}`, 'loss');
                    showBanner(`解析AI回复失败：${parsed.error}`, 'error', null, '🌐 外接AI');
                    markPlayerDone(playerId);
                    checkAllDone();
                    return;
                }
                let result = executeExternalAIDecision(playerId, parsed.actions);
                markPlayerDone(playerId);
                checkAllDone();
            } catch (e) {
                if (!gameActive) return;
                addLog(`🌐 API调用异常：${e.message || '网络错误'}`, 'loss');
                showBanner(`API调用异常：${e.message || '请检查网络'}`, 'error', null, '🌐 外接AI');
                markPlayerDone(playerId);
                checkAllDone();
            }
        }

        function handleExternalAITurn(playerId) {
            if (!gameActive) return;
            let p = players[playerId];
            if (!p || p.bankrupt || !p.isExternal) {
                markPlayerDone(playerId);
                checkAllDone();
                return;
            }
            let config = externalAIConfigs.find(c => c.playerId === playerId);
            if (!config) {
                addLog(`🌐 ${p.name} 缺少配置，跳过`, 'loss');
                showBanner(`${p.name} 缺少配置，跳过`, 'warning', null, '🌐 外接AI');
                markPlayerDone(playerId);
                checkAllDone();
                return;
            }
            if (config.accessMode === 'api') {
                if (!config.apiKey) {
                    addLog(`🌐 ${p.name} API密钥未配置`, 'loss');
                    showBanner(`请为 ${p.name} 配置API密钥`, 'error', null, '🌐 外接AI');
                    markPlayerDone(playerId);
                    checkAllDone();
                    return;
                }
                addLog(`🌐 ${p.name} 正在通过API决策...`, 'external');
                callExternalAIAPI(playerId, config);
            } else {
                let prompt = generateExternalAIPrompt(playerId);
                document.getElementById('eai-prompt-box').textContent = prompt;
                document.getElementById('eai-panel-title').textContent = `🌐 ${p.name} 指令面板`;
                let overlay = document.getElementById('eai-overlay');
                overlay.classList.add('active');
                document.body.classList.add('modal-open');
                document.getElementById('eai-response-text').value = '';
                switchEAITab('prompt');
                document.getElementById('eai-overlay').dataset.currentPlayerId = playerId;
            }
        }

        // ================================================================
