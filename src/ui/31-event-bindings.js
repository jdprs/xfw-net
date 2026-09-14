//  31. 所有事件绑定
        // ================================================================

        let closeMarketBtn, newGameBtn, startGameBtn, loadSaveBtn, saveGameBtn, restartBtn;
        let helpBtn, helpBtnSetup, helpCloseBtn, helpCopyBtn, toggleLogsBtn, togglePanelBtn;
        let exportCodeBtn, importCodeBtn, codeCloseBtn, codeCopyBtn, codeImportConfirm;
        let achievementCloseBtn, endGameBtn;

        window.onload = function() {
            // ---- 健康忠告（仅大厅页显示，游戏内页面不重复弹出） ----
            if (!window.GAME_MODE) {
                showHealthModal();
            }

            // ---- 外接AI配置 ----
            renderExternalAIConfigs();

            // ---- 高级设置UI ----
            renderAdminAchievements();
            renderAdminStockGrid();

            // ---- 存档按钮 ----
            if (hasSaveData()) {
                document.getElementById('load-save-btn').style.display = 'inline-block';
            }

            // ---- 日志 ----
            hideLogPanel();

            // ---- 规则（仅用于帮助） ----
            updateGameRulesDisplay();

            // ---- 管理员默认值 ----
            document.getElementById('admin-banner-duration').value = BANNER_DURATION;
            document.getElementById('admin-ai-think-min').value = AI_THINK_MIN;
            document.getElementById('admin-ai-think-max').value = AI_THINK_MAX;
            document.getElementById('admin-chart-type').value = CHART_TYPE;
            document.getElementById('admin-darkhorse-multiplier').value = DARK_HORSE_MULTIPLIER;
            document.getElementById('admin-darkhorse-prob').value = DARK_HORSE_PROB;
            document.getElementById('admin-share-price').value = INIT_SHARE_PRICE;
            // v9.1: 破产设置默认值
            document.getElementById('admin-bankruptcy-threshold').value = BANKRUPTCY_THRESHOLD;
            document.getElementById('admin-bankruptcy-fund').value = BANKRUPTCY_FUND;

            // ---- 获取按钮引用 ----
            closeMarketBtn = document.getElementById('close-market-btn');
            newGameBtn = document.getElementById('new-game-btn');
            startGameBtn = document.getElementById('start-game-btn');
            loadSaveBtn = document.getElementById('load-save-btn');
            saveGameBtn = document.getElementById('save-game-btn');
            restartBtn = document.getElementById('restart-btn');
            helpBtn = document.getElementById('help-btn');
            helpBtnSetup = document.getElementById('help-btn-setup');
            helpCloseBtn = document.getElementById('help-close-btn');
            helpCopyBtn = document.getElementById('help-copy-btn');
            toggleLogsBtn = document.getElementById('toggle-logs');
            togglePanelBtn = document.getElementById('toggle-panel-btn');
            exportCodeBtn = document.getElementById('export-code-btn');
            importCodeBtn = document.getElementById('import-code-btn');
            codeCloseBtn = document.getElementById('code-close-btn');
            codeCopyBtn = document.getElementById('code-copy-btn');
            codeImportConfirm = document.getElementById('code-import-confirm-btn');
            achievementCloseBtn = document.getElementById('achievement-close-btn');
            endGameBtn = document.getElementById('end-game-btn');

            // ---- 单机/联机开始按钮补绑定（兼容所有页面，避免按钮点不动） ----
            // index.html 已有 inline onclick，此处仅在未绑定时补充
            const mpLocalBtn = document.getElementById('mp-local-btn');
            const mpOnlineBtn = document.getElementById('mp-online-btn');
            if (mpLocalBtn && !mpLocalBtn.getAttribute('onclick') && !mpLocalBtn.onclick) {
                mpLocalBtn.onclick = function() {
                    if (window.lobbyStartLocal) {
                        window.lobbyStartLocal();
                    } else {
                        try {
                            const read = function(id) { const e = document.getElementById(id); return e ? e.value : null; };
                            localStorage.setItem('xfw_local_config', JSON.stringify({
                                humanPlayers: parseInt(read('human-players')) || 1,
                                aiPlayers: parseInt(read('ai-players')) || 1,
                                totalRounds: parseInt(read('total-rounds')) || 60,
                                admin: null
                            }));
                        } catch(e) {}
                        location.href = 'game_local.html';
                    }
                };
            }
            if (mpOnlineBtn && !mpOnlineBtn.getAttribute('onclick') && !mpOnlineBtn.onclick) {
                mpOnlineBtn.onclick = function() {
                    if (window.lobbyStartOnline) {
                        window.lobbyStartOnline();
                    } else {
                        // 单机页未加载联机模块，跳回大厅页
                        location.href = 'index.html';
                    }
                };
            }

            // ---- 绑定事件 ----
            closeMarketBtn.addEventListener('click', closeMarket);
            newGameBtn.addEventListener('click', backToSetup);
            startGameBtn.addEventListener('click', () => initGame(false));
            loadSaveBtn.addEventListener('click', () => initGame(true));
            saveGameBtn.addEventListener('click', () => saveGame(false));
            restartBtn.addEventListener('click', backToSetup);
            endGameBtn.addEventListener('click', directEndGame);

            helpBtn.addEventListener('click', () => {
                document.getElementById('help-modal').style.display = 'flex';
                updateGameRulesDisplay();
            });
            helpBtnSetup.addEventListener('click', () => {
                document.getElementById('help-modal').style.display = 'flex';
                updateGameRulesDisplay();
            });
            helpCloseBtn.addEventListener('click', () => document.getElementById('help-modal').style.display = 'none');

            helpCopyBtn.addEventListener('click', function() {
                let content = document.getElementById('help-content-body');
                let text = content.textContent;
                navigator.clipboard.writeText(text).then(() => {
                    showBanner('帮助内容已复制到剪贴板', 'success', null, '📋 复制');
                }).catch(() => {
                    let range = document.createRange();
                    range.selectNodeContents(content);
                    let sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                    document.execCommand('copy');
                    showBanner('帮助内容已复制到剪贴板', 'success', null, '📋 复制');
                });
            });

            toggleLogsBtn.addEventListener('click', () => {
                allLogsExpanded = !allLogsExpanded;
                rebuildLogs();
            });
            togglePanelBtn.addEventListener('click', toggleLogPanel);
            exportCodeBtn.addEventListener('click', exportCode);
            importCodeBtn.addEventListener('click', importCode);
            codeCloseBtn.addEventListener('click', () => document.getElementById('code-modal').style.display = 'none');
            codeCopyBtn.addEventListener('click', () => {
                let ta = document.getElementById('code-textarea');
                ta.select();
                document.execCommand('copy');
                showBanner('已复制到剪贴板', 'success', null, '📋 复制');
            });
            codeImportConfirm.addEventListener('click', doImportCode);
            achievementCloseBtn.addEventListener('click', () => {
                document.getElementById('achievement-modal').classList.remove('active');
                document.body.classList.remove('modal-open');
            });

            document.getElementById('achievement-modal').addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('active');
                    document.body.classList.remove('modal-open');
                }
            });

            // ---- 外接AI ----
            document.getElementById('add-external-ai-btn').addEventListener('click', addExternalAI);

            document.getElementById('eai-panel-close').addEventListener('click', closeExternalPanel);
            document.getElementById('eai-panel-close-btn').addEventListener('click', closeExternalPanel);

            document.querySelectorAll('#eai-overlay .eai-tabs button').forEach(btn => {
                btn.addEventListener('click', function() {
                    let tab = this.dataset.tab;
                    switchEAITab(tab);
                });
            });

            document.getElementById('eai-copy-prompt').addEventListener('click', function() {
                let box = document.getElementById('eai-prompt-box');
                let text = box.textContent;
                navigator.clipboard.writeText(text).then(() => {
                    showBanner('指令已复制到剪贴板', 'success', null, '📋 复制');
                }).catch(() => {
                    let range = document.createRange();
                    range.selectNodeContents(box);
                    let sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                    document.execCommand('copy');
                    showBanner('指令已复制到剪贴板', 'success', null, '📋 复制');
                });
            });

            document.getElementById('eai-execute-response').addEventListener('click', function() {
                let text = document.getElementById('eai-response-text').value.trim();
                if (!text) {
                    showBanner('请粘贴外部AI的回复内容', 'warning', null, '⚠️ 操作失败');
                    return;
                }
                let pid = parseInt(document.getElementById('eai-overlay').dataset.currentPlayerId);
                if (isNaN(pid)) {
                    showBanner('未找到外接AI', 'error', null, '❌ 错误');
                    return;
                }
                let parsed = parseExternalAIResponse(text);
                if (parsed.error) {
                    showBanner('解析失败：' + parsed.error, 'error', null, '❌ 解析错误');
                    return;
                }
                let result = executeExternalAIDecision(pid, parsed.actions);
                if (result.success && result.errors && result.errors.length > 0) {
                    document.getElementById('eai-response-text').value = '';
                    closeExternalPanel();
                    markPlayerDone(pid);
                    checkAllDone();
                } else if (result.success) {
                    document.getElementById('eai-response-text').value = '';
                    closeExternalPanel();
                    markPlayerDone(pid);
                    checkAllDone();
                } else {
                    showBanner('所有操作失败，请检查指令后重试', 'warning', null, '🌐 外接AI');
                }
            });

            document.getElementById('eai-clear-response').addEventListener('click', function() {
                document.getElementById('eai-response-text').value = '';
            });

            // ---- 密码相关 ----
            document.getElementById('admin-pw-confirm').onclick = async function() {
                let pw = document.getElementById('admin-password-input').value.trim();
                let ok = await verifyPassword(pw);
                if (ok) {
                    adminMode = true;
                    document.getElementById('admin-panel').style.display = 'block';
                    document.getElementById('password-modal').style.display = 'none';
                    document.body.classList.remove('modal-open');
                    renderAdminAchievements();
                    renderAdminStockGrid();
                    document.getElementById('admin-init-money').value = INIT_PLAYER_MONEY;
                    document.getElementById('admin-bank-money').value = INIT_BANK_MONEY;
                    document.getElementById('admin-loot-threshold').value = LOOT_THRESHOLD;
                    document.getElementById('admin-loot-ratio').value = LOOT_RATIO;
                    document.getElementById('admin-volatility-scale').value = ADMIN_CONFIG.volatilityScale;
                    document.getElementById('admin-lottery-win-scale').value = ADMIN_CONFIG.lotteryWinScale;
                    document.getElementById('admin-algo-mode').value = ADMIN_CONFIG.algoMode || '标准';
                    document.getElementById('admin-banner-duration').value = BANNER_DURATION;
                    document.getElementById('admin-ai-think-min').value = AI_THINK_MIN;
                    document.getElementById('admin-ai-think-max').value = AI_THINK_MAX;
                    document.getElementById('admin-chart-type').value = CHART_TYPE;
                    document.getElementById('admin-darkhorse-multiplier').value = DARK_HORSE_MULTIPLIER;
                    document.getElementById('admin-darkhorse-prob').value = DARK_HORSE_PROB;
                    document.getElementById('admin-share-price').value = INIT_SHARE_PRICE;
                    document.getElementById('admin-bankruptcy-threshold').value = BANKRUPTCY_THRESHOLD;
                    document.getElementById('admin-bankruptcy-fund').value = BANKRUPTCY_FUND;
                    showBanner('高级设置已激活', 'success', null, '🔓 已解锁');
                } else {
                    showBanner('密码错误', 'error', null, '🔐 验证失败');
                    document.getElementById('admin-password-input').value = '';
                    document.getElementById('admin-password-input').focus();
                }
            };
            document.getElementById('admin-pw-cancel').onclick = function() {
                document.getElementById('password-modal').style.display = 'none';
                document.body.classList.remove('modal-open');
            };
            document.getElementById('password-modal').addEventListener('click', function(e) {
                if (e.target === this) {
                    this.style.display = 'none';
                    document.body.classList.remove('modal-open');
                }
            });
            document.getElementById('admin-password-input').addEventListener('keydown', function(e) {
                if (e.key === 'Enter') document.getElementById('admin-pw-confirm').click();
            });

            // ---- 管理员Tab切换 ----
            document.querySelectorAll('.admin-tabs button').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove(
                    'active'));
                    this.classList.add('active');
                    const tabId = this.dataset.tab;
                    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.remove(
                        'active'));
                    document.getElementById(tabId).classList.add('active');
                });
            });

            // ---- 应用设置按钮 ----
            document.getElementById('apply-admin-btn').addEventListener('click', function() {
                ADMIN_CONFIG.volatilityScale = parseFloat(document.getElementById('admin-volatility-scale')
                    .value) || 1.0;
                ADMIN_CONFIG.lotteryWinScale = parseFloat(document.getElementById('admin-lottery-win-scale')
                    .value) || 1.0;
                ADMIN_CONFIG.algoMode = document.getElementById('admin-algo-mode').value || '标准';
                BANNER_DURATION = parseFloat(document.getElementById('admin-banner-duration').value) || 4;
                const thinkMin = parseFloat(document.getElementById('admin-ai-think-min').value);
                const thinkMax = parseFloat(document.getElementById('admin-ai-think-max').value);
                if (!isNaN(thinkMin) && thinkMin > 0) AI_THINK_MIN = thinkMin;
                if (!isNaN(thinkMax) && thinkMax > 0) AI_THINK_MAX = Math.max(thinkMax, AI_THINK_MIN + 0.5);

                CHART_TYPE = document.getElementById('admin-chart-type').value || 'line';

                // v9.1: 应用破产设置
                const bThreshold = parseInt(document.getElementById('admin-bankruptcy-threshold').value);
                if (!isNaN(bThreshold) && bThreshold >= 10) {
                    BANKRUPTCY_THRESHOLD = bThreshold;
                    ADMIN_CONFIG.bankruptcyThreshold = bThreshold;
                }
                const bFund = parseInt(document.getElementById('admin-bankruptcy-fund').value);
                if (!isNaN(bFund) && bFund >= 100) {
                    BANKRUPTCY_FUND = bFund;
                    ADMIN_CONFIG.bankruptcyFund = bFund;
                }

                document.querySelectorAll('.ach-reward-input').forEach(inp => {
                    const id = inp.dataset.id;
                    const v = parseFloat(inp.value) || 0;
                    if (id && v >= 0) achievementRewardRatios[id] = clamp(v / 100, 0, 1);
                });

                document.querySelectorAll('.stock-name-input').forEach(inp => {
                    const key = inp.dataset.key;
                    const val = inp.value.trim() || (key + '股');
                    if (stocks[key]) stocks[key].name = val;
                });
                document.querySelectorAll('.stock-up-input').forEach(inp => {
                    const key = inp.dataset.key;
                    let val = parseFloat(inp.value) || 0;
                    val = clamp(val, 0, 200) / 100;
                    if (stocks[key]) stocks[key].maxUp = val;
                    if (key === 'A') ADMIN_CONFIG.aMaxUp = val;
                    else if (key === 'B') ADMIN_CONFIG.bMaxUp = val;
                    else if (key === 'C') ADMIN_CONFIG.cMaxUp = val;
                    else if (key === 'D') ADMIN_CONFIG.dMaxUp = val;
                });
                document.querySelectorAll('.stock-down-input').forEach(inp => {
                    const key = inp.dataset.key;
                    let val = parseFloat(inp.value) || 0;
                    val = clamp(val, -90, 0) / 100;
                    if (stocks[key]) stocks[key].maxDown = val;
                    if (key === 'B') ADMIN_CONFIG.bMaxDown = val;
                    else if (key === 'C') ADMIN_CONFIG.cMaxDown = val;
                    else if (key === 'D') ADMIN_CONFIG.dMaxDown = val;
                });

                stocks.A.maxUp = ADMIN_CONFIG.aMaxUp;
                stocks.A.maxDown = 0;
                stocks.B.maxDown = ADMIN_CONFIG.bMaxDown;
                stocks.B.maxUp = ADMIN_CONFIG.bMaxUp;
                stocks.C.maxDown = ADMIN_CONFIG.cMaxDown;
                stocks.C.maxUp = ADMIN_CONFIG.cMaxUp;
                stocks.D.maxDown = ADMIN_CONFIG.dMaxDown;
                stocks.D.maxUp = ADMIN_CONFIG.dMaxUp;

                const dhMult = parseFloat(document.getElementById('admin-darkhorse-multiplier').value);
                if (!isNaN(dhMult) && dhMult >= 1.2) DARK_HORSE_MULTIPLIER = dhMult;
                const dhProb = parseFloat(document.getElementById('admin-darkhorse-prob').value);
                if (!isNaN(dhProb) && dhProb >= 0.05 && dhProb <= 1.0) DARK_HORSE_PROB = dhProb;

                const sharePrice = parseFloat(document.getElementById('admin-share-price').value);
                if (!isNaN(sharePrice) && sharePrice >= 10) INIT_SHARE_PRICE = sharePrice;

                if (players.length > 0 && gameActive) {
                    updateStockStatus();
                }
                initLotteries();
                updateGameRulesDisplay();
                if (stocksChart) {
                    stocksChart.config.type = CHART_TYPE;
                    stocksChart.update();
                }
                showBanner('高级参数已保存，规则已同步更新', 'success', null, '✅ 应用设置');
            });

            // ---- 键盘快捷键 ----
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    let overlay = document.getElementById('eai-overlay');
                    if (overlay.classList.contains('active')) {
                        closeExternalPanel();
                    }
                    let modals = document.querySelectorAll(
                        '.modal-overlay.active, .results-modal, .event-modal, .help-modal, .code-modal, .password-modal'
                        );
                    modals.forEach(m => {
                        if (m.style.display !== 'none' && m.style.display !== '') {
                            if (m.id === 'code-modal' || m.id === 'password-modal') return;
                            m.classList.remove('active');
                            m.style.display = 'none';
                            document.body.classList.remove('modal-open');
                        }
                    });
                    if (document.getElementById('achievement-modal').classList.contains('active')) {
                        document.getElementById('achievement-modal').classList.remove('active');
                        document.body.classList.remove('modal-open');
                    }
                }
            });

            // ---- 模态框外部点击关闭 ----
            document.querySelectorAll('.results-modal, .event-modal, .help-modal, .code-modal').forEach(el => {
                el.addEventListener('click', function(e) {
                    if (e.target === this) {
                        if (this.id === 'code-modal' || this.id === 'password-modal') return;
                        this.style.display = 'none';
                        document.body.classList.remove('modal-open');
                    }
                });
            });

            // ---- 日志面板显示按钮 ----
            document.getElementById('show-log-btn').addEventListener('click', function() {
                let panel = document.getElementById('game-history');
                if (panel.classList.contains('hidden')) return;
                panel.classList.remove('collapsed');
                logPanelVisible = true;
                this.style.display = 'none';
            });

            // ---- 控制台提示 ----
            console.log('✅ 小富翁股票投资游戏 v9.3 增强版 已加载完成');
            console.log('🔧 v9.3：掠夺模式封股票跑路机制；AI即将破产时撤资保命；补全存档/预测拦截');
        };

        // ================================================================
