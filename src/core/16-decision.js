//  16. 决策系统（核心）
        //  v9.1 保留取消决策按钮
        // v10.1: 联机模式下仅本人卡片可发起/完成/取消决策，他人卡片只读
        // ================================================================

        function isOnlineMode() {
            return window.GAME_MODE === 'master' || window.GAME_MODE === 'player';
        }
        function canOperateCard(p) {
            if (!isOnlineMode()) return true;
            return !!window.Sync && p.id === Sync.myPlayerId;
        }

        function resetDecisionState() {
            decisionState = 'idle';
            decidingPlayerId = null;
            playerDecisionStatus = {};
            players.forEach(p => {
                if (!p.bankrupt) {
                    playerDecisionStatus[p.id] = 'pending';
                } else {
                    playerDecisionStatus[p.id] = 'done';
                }
            });
            players.forEach(p => {
                if (p.bankrupt) playerDecisionStatus[p.id] = 'done';
            });
            updateDecisionUI();
            updateCloseMarketButton();
            updateEndGameButton();
        }

        function checkAllDone() {
            let allDone = true;
            players.forEach(p => {
                if (playerDecisionStatus[p.id] !== 'done') {
                    allDone = false;
                }
            });
            if (allDone) {
                decisionState = 'all_done';
                let overlay = document.getElementById('eai-overlay');
                if (overlay.classList.contains('active')) {
                    overlay.classList.remove('active');
                    document.body.classList.remove('modal-open');
                }
                updateDecisionUI();
                updateCloseMarketButton();
                updateEndGameButton();
                showBanner('📊 所有玩家已完成决策，可以收盘！', 'success', null, '✅ 准备收盘');
                addLog('📊 所有玩家已完成决策，可以收盘', 'highlight');
            }
        }

        function markPlayerDone(playerId) {
            if (playerDecisionStatus[playerId] === 'done') return;
            playerDecisionStatus[playerId] = 'done';
            checkAchievements(playerId);

            if (decidingPlayerId === playerId) {
                decisionState = 'idle';
                decidingPlayerId = null;
                setAllControlsEnabled(false);
            }
            updateDecisionUI();
            checkAllDone();
        }

        function cancelDecision(playerId) {
            // v10.1: 联机模式下只能取消自己的回合
            if (isOnlineMode() && (!window.Sync || playerId !== Sync.myPlayerId)) {
                showBanner('现在不是你的回合，请等待轮到你', 'warning', null, '⏳ 等待中');
                return;
            }
            if (decisionState !== 'deciding' || decidingPlayerId !== playerId) {
                showBanner('当前没有可取消的决策', 'warning', null, '⚠️ 操作无效');
                return;
            }
            let p = players[playerId];
            if (!p) return;

            if (p.isAI || p.isExternal) {
                if (aiThinkTimer) {
                    clearInterval(aiThinkTimer);
                    aiThinkTimer = null;
                }
                if (pendingAITimeout) {
                    clearTimeout(pendingAITimeout);
                    pendingAITimeout = null;
                }
                aiThinkPlayerId = null;
                let overlay = document.getElementById('eai-overlay');
                if (overlay.classList.contains('active')) {
                    overlay.classList.remove('active');
                    document.body.classList.remove('modal-open');
                }
            }

            decisionState = 'idle';
            decidingPlayerId = null;
            if (playerDecisionStatus[playerId] !== 'done') {
                playerDecisionStatus[playerId] = 'pending';
            }
            // v9.2: 取消决策时回滚本轮已下的预测（退还押金并清除记录），
            // 否则预测记录残留会导致取消后无法再次预测/决策
            if (predictionsThisRound[playerId]) {
                let pred = predictionsThisRound[playerId];
                p.cash = Math.round(p.cash + pred.amount);
                delete predictionsThisRound[playerId];
                addLog(`↩️ ${p.name} 取消决策，预测押金 ${fmt(pred.amount)} 已退还`, 'event');
            }
            setAllControlsEnabled(false);
            updateDecisionUI();
            updateCloseMarketButton();
            updateEndGameButton();
            showBanner(`✅ 已取消 ${p.name} 的决策`, 'info', null, '↩️ 已取消');
            addLog(`↩️ ${p.name} 取消决策`, 'event');
            updatePlayersDisplay();
        }

        function startDecision(playerId) {
            // v10.1: 联机模式下只能操作自己的回合
            if (isOnlineMode() && (!window.Sync || playerId !== Sync.myPlayerId)) {
                showBanner('现在不是你的回合，请等待轮到你', 'warning', null, '⏳ 等待中');
                return;
            }
            if (decisionState !== 'idle') {
                showBanner('当前有其他玩家正在决策，请等待', 'warning', null, '⏳ 等待中');
                return;
            }
            let p = players[playerId];
            if (!p || p.bankrupt) {
                showBanner('该玩家已破产，无法决策', 'error', null, '💀 破产');
                return;
            }
            if (playerDecisionStatus[playerId] === 'done') {
                showBanner('该玩家本轮已完成决策', 'warning', null, '✅ 已完成');
                return;
            }

            decisionState = 'deciding';
            decidingPlayerId = playerId;
            setAllControlsEnabled(false);
            setPlayerControlsEnabled(playerId, true);

            if (p.isAI) {
                addLog(`🤖 ${p.name} 开始决策`, 'event');
                showBanner(`🤖 ${p.name} 正在思考...`, 'info', null, '🤖 AI决策');
                let minMs = (AI_THINK_MIN || 4) * 1000;
                let maxMs = (AI_THINK_MAX || 8) * 1000;
                let delay = minMs + Math.random() * (maxMs - minMs);
                aiThinkPlayerId = p.id;
                aiThinkStartTime = Date.now();
                if (aiThinkTimer) clearInterval(aiThinkTimer);
                aiThinkTimer = setInterval(() => {
                    let elapsed = Math.floor((Date.now() - aiThinkStartTime) / 1000);
                    let thinkEl = document.querySelector(`.player-card[data-player-id="${p.id}"] .ai-think`);
                    if (thinkEl) {
                        thinkEl.innerHTML = `🤖 思考中…已思考 <span class="think-timer">${elapsed}</span> 秒`;
                    }
                }, 200);
                updatePlayersDisplay();

                if (pendingAITimeout) clearTimeout(pendingAITimeout);
                pendingAITimeout = setTimeout(() => {
                    if (!gameActive) {
                        pendingAITimeout = null;
                        return;
                    }
                    if (aiThinkTimer) {
                        clearInterval(aiThinkTimer);
                        aiThinkTimer = null;
                    }
                    let thinkEl = document.querySelector(`.player-card[data-player-id="${p.id}"] .ai-think`);
                    if (thinkEl) {
                        thinkEl.textContent = '🤖 决策完成 ✓';
                        setTimeout(() => {
                            if (thinkEl) thinkEl.textContent = '🤖 多因子决策引擎';
                        }, 1500);
                    }
                    makeAIDecision(p);
                    markPlayerDone(p.id);
                    updatePlayersDisplay();
                    pendingAITimeout = null;
                }, delay);
            } else if (p.isExternal) {
                addLog(`🌐 ${p.name} 开始决策`, 'external');
                showBanner(`🌐 ${p.name} 正在通过外接AI决策...`, 'info', null, '🌐 外接AI');
                if (pendingAITimeout) clearTimeout(pendingAITimeout);
                pendingAITimeout = setTimeout(() => {
                    if (!gameActive) {
                        pendingAITimeout = null;
                        return;
                    }
                    handleExternalAITurn(p.id);
                    pendingAITimeout = null;
                }, 300);
            } else {
                showBanner(`🎯 ${p.name} 请进行操作，完成后点击"完成"`, 'success', null, '🎯 决策中');
                updatePlayersDisplay();
            }
            updateDecisionUI();
        }

        function completeDecision(playerId) {
            // v10.1: 联机模式下只能完成自己的回合
            if (isOnlineMode() && (!window.Sync || playerId !== Sync.myPlayerId)) {
                showBanner('现在不是你的回合，请等待轮到你', 'warning', null, '⏳ 等待中');
                return;
            }
            if (decisionState !== 'deciding' || decidingPlayerId !== playerId) {
                showBanner('当前没有活跃的决策', 'warning', null, '⚠️ 操作无效');
                return;
            }
            let p = players[playerId];
            if (!p || p.bankrupt) {
                showBanner('该玩家已破产', 'error', null, '💀 破产');
                return;
            }
            if (playerDecisionStatus[playerId] === 'done') {
                showBanner('该玩家已完成决策', 'warning', null, '✅ 已完成');
                return;
            }
            markPlayerDone(playerId);
            showBanner(`✅ ${p.name} 完成决策`, 'success', null, '✅ 已完成');
            addLog(`✅ ${p.name} 完成决策`, 'highlight');
            setAllControlsEnabled(false);
            updatePlayersDisplay();
        }

        function setAllControlsEnabled(enabled) {
            document.querySelectorAll('.invest-section input, .invest-section button:not(.btn-decision):not(.achievement-btn):not(.btn-bailout):not(.btn-cancel-decision)')
                .forEach(el => {
                    el.disabled = !enabled;
                });
            document.querySelectorAll('.btn-predict').forEach(el => {
                el.disabled = !enabled;
            });
            document.querySelectorAll('.create-stock-btn, .buy-lottery-btn').forEach(el => {
                el.disabled = !enabled;
            });
        }

        function setPlayerControlsEnabled(playerId, enabled) {
            let card = document.querySelector(`.player-card[data-player-id="${playerId}"]`);
            if (!card) return;
            card.querySelectorAll('.invest-section input, .invest-section button:not(.btn-decision):not(.achievement-btn):not(.btn-bailout):not(.btn-cancel-decision)')
                .forEach(el => {
                    el.disabled = !enabled;
                });
            card.querySelectorAll('.btn-predict').forEach(el => {
                el.disabled = !enabled;
            });
            card.querySelectorAll('.create-stock-btn, .buy-lottery-btn').forEach(el => {
                el.disabled = !enabled;
            });
        }

        function updateDecisionUI() {
            let total = players.filter(p => !p.bankrupt).length;
            let done = players.filter(p => playerDecisionStatus[p.id] === 'done').length;
            document.getElementById('decision-count').textContent = `${done}/${total}`;

            players.forEach(p => {
                let card = document.querySelector(`.player-card[data-player-id="${p.id}"]`);
                if (!card) return;
                let status = playerDecisionStatus[p.id] || 'pending';
                card.classList.remove('decision-done', 'decision-waiting', 'decision-active', 'decision-idle');
                if (status === 'done') {
                    card.classList.add('decision-done');
                } else if (decidingPlayerId === p.id) {
                    card.classList.add('decision-active');
                } else if (decisionState === 'deciding') {
                    card.classList.add('decision-waiting');
                } else if (decisionState === 'idle') {
                    card.classList.add('decision-idle');
                }

                let area = card.querySelector('.decision-area');
                if (area) {
                    area.innerHTML = buildDecisionHTML(p);
                    let btn = area.querySelector('.btn-decision');
                    if (btn) {
                        let action = btn.dataset.action;
                        if (action === 'start') {
                            btn.onclick = () => startDecision(p.id);
                        } else if (action === 'complete') {
                            btn.onclick = () => completeDecision(p.id);
                        }
                    }
                    let cancelBtn = area.querySelector('.btn-cancel-decision');
                    if (cancelBtn) {
                        cancelBtn.onclick = () => cancelDecision(p.id);
                    }
                }
            });
            updateCloseMarketButton();
            updateEndGameButton();
        }

        function buildDecisionHTML(p) {
            let status = playerDecisionStatus[p.id] || 'pending';
            let isDeciding = (decidingPlayerId === p.id);
            let isIdle = (decisionState === 'idle');
            const operable = canOperateCard(p);

            if (p.bankrupt) {
                return `<span class="decision-status">💀 已破产</span>`;
            }

            if (status === 'done') {
                return `<span class="decision-status done">✅ 已完成决策</span>`;
            }

            if (isDeciding) {
                // v10.1: 联机模式下，正在决策的不是本人时只读展示
                if (!operable) {
                    return `<span class="decision-status active">⏳ ${p.name} 决策中...</span>`;
                }
                if (p.isAI || p.isExternal) {
                    return `
                            <span class="decision-status active">⏳ 决策中...</span>
                            <button class="btn-cancel-decision" data-action="cancel">✖ 取消</button>
                        `;
                } else {
                    return `
                            <button class="btn-decision btn-done" data-action="complete">✅ 完成决策</button>
                            <button class="btn-cancel-decision" data-action="cancel">✖ 取消</button>
                            <span class="decision-status active">🎯 决策中</span>
                        `;
                }
            }

            if (decisionState === 'deciding') {
                return `<span class="decision-status waiting">⏳ 等待 ${players.find(p2=>p2.id===decidingPlayerId)?.name || '其他玩家'} 决策...</span>`;
            }

            // v10.1: 联机模式下，非本人卡片不显示「决策」按钮，仅提示等待
            if (!operable) {
                return `<span class="decision-status waiting">⏳ 等待轮到你...</span>`;
            }

            return `<button class="btn-decision" data-action="start">🎯 决策</button>`;
        }

        function updateCloseMarketButton() {
            let btn = document.getElementById('close-market-btn');
            if (decisionState === 'all_done') {
                btn.disabled = false;
                btn.title = '所有玩家已完成决策';
            } else {
                btn.disabled = true;
                let total = players.filter(p => !p.bankrupt).length;
                let done = players.filter(p => playerDecisionStatus[p.id] === 'done').length;
                btn.title = `等待玩家决策 (${done}/${total})`;
            }
        }

        // v9.1: 更新"直接结束游戏"按钮状态
        function updateEndGameButton() {
            let btn = document.getElementById('end-game-btn');
            if (!btn) return;
            if (gameActive && players.length > 0) {
                btn.disabled = false;
                btn.title = '立即结束当前游戏';
            } else {
                btn.disabled = true;
                btn.title = '游戏未开始或已结束';
            }
        }

        function setInitialControls() {
            setAllControlsEnabled(false);
        }

        // ================================================================
