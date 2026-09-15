//  26. 外接AI配置UI
        // ================================================================

        function renderExternalAIConfigs() {
            let container = document.getElementById('external-ai-list');
            // 联机页等无配置容器的页面直接跳过，避免 onload 报错
            if (!container) return;
            container.innerHTML = '';
            if (externalAIConfigs.length === 0) {
                container.innerHTML =
                    '<div style="color:var(--text-secondary);font-size:0.85rem;padding:8px 0;opacity:0.6;">暂无外接AI，点击下方添加</div>';
                return;
            }
            externalAIConfigs.forEach((cfg, idx) => {
                let div = document.createElement('div');
                div.className = 'external-ai-card';
                div.innerHTML = `
                        <div class="eai-header">
                            <span class="eai-name">
                                🌐 ${cfg.name || '外接AI-'+(idx+1)}
                                <span class="eai-badge">${cfg.accessMode === 'api' ? 'API' : '指令'}</span>
                            </span>
                            <button class="eai-remove" data-idx="${idx}">移除</button>
                        </div>
                        <div class="eai-row">
                            <label>名称 <input type="text" class="eai-name-input" value="${cfg.name || ''}" data-idx="${idx}" style="width:100px;" /></label>
                            <label>接入方式 <select class="eai-mode-select" data-idx="${idx}">
                                <option value="command" ${cfg.accessMode === 'command' ? 'selected' : ''}>指令模式</option>
                                <option value="api" ${cfg.accessMode === 'api' ? 'selected' : ''}>API模式</option>
                            </select></label>
                        </div>
                        <div class="eai-row">
                            <div class="eai-api-config" style="${cfg.accessMode === 'api' ? '' : 'display:none;'}">
                                <label>API密钥 <input type="password" class="eai-api-key" value="${cfg.apiKey || ''}" data-idx="${idx}" style="flex:1;min-width:100px;" /></label>
                                <label>模型 <input type="text" class="eai-api-model" value="${cfg.model || 'gpt-3.5-turbo'}" data-idx="${idx}" style="width:120px;" /></label>
                                <label>端点 <input type="text" class="eai-api-endpoint" value="${cfg.endpoint || 'https://api.openai.com/v1/chat/completions'}" data-idx="${idx}" style="width:160px;" /></label>
                            </div>
                        </div>
                        <div class="eai-status">${cfg.accessMode === 'api' ? '🔑 API模式（自动调用）' : '📋 指令模式（手动粘贴）'}</div>
                    `;
                container.appendChild(div);
                let removeBtn = div.querySelector('.eai-remove');
                removeBtn.onclick = function(e) {
                    e.stopPropagation();
                    showConfirmBanner(`确定移除外接AI「${cfg.name}」吗？`, () => {
                        externalAIConfigs.splice(idx, 1);
                        renderExternalAIConfigs();
                    }, () => {});
                };
                let nameInput = div.querySelector('.eai-name-input');
                nameInput.onchange = () => { externalAIConfigs[idx].name = nameInput.value.trim() || ('外接AI-' + (idx +
                    1));
                    renderExternalAIConfigs(); };
                let modeSelect = div.querySelector('.eai-mode-select');
                modeSelect.onchange = () => {
                    externalAIConfigs[idx].accessMode = modeSelect.value;
                    let apiConfig = div.querySelector('.eai-api-config');
                    apiConfig.style.display = modeSelect.value === 'api' ? '' : 'none';
                    let status = div.querySelector('.eai-status');
                    status.textContent = modeSelect.value === 'api' ? '🔑 API模式（自动调用）' : '📋 指令模式（手动粘贴）';
                };
                let apiKeyInput = div.querySelector('.eai-api-key');
                apiKeyInput.onchange = () => { externalAIConfigs[idx].apiKey = apiKeyInput.value; };
                let modelInput = div.querySelector('.eai-api-model');
                modelInput.onchange = () => { externalAIConfigs[idx].model = modelInput.value || 'gpt-3.5-turbo'; };
                let endpointInput = div.querySelector('.eai-api-endpoint');
                endpointInput.onchange = () => { externalAIConfigs[idx].endpoint = endpointInput.value ||
                        'https://api.openai.com/v1/chat/completions'; };
            });
        }

        function addExternalAI() {
            let newCfg = {
                playerId: null,
                name: `外接AI-${externalAIConfigs.length + 1}`,
                accessMode: 'command',
                apiKey: '',
                model: 'gpt-3.5-turbo',
                endpoint: 'https://api.openai.com/v1/chat/completions'
            };
            externalAIConfigs.push(newCfg);
            renderExternalAIConfigs();
        }

        function createExternalAIPlayers() {
            externalAIConfigs.forEach(c => c.playerId = null);
            let startIdx = players.length;
            externalAIConfigs.forEach((cfg, idx) => {
                let pid = startIdx + idx;
                cfg.playerId = pid;
                let p = {
                    id: pid,
                    name: cfg.name || `外接AI-${idx+1}`,
                    cash: INIT_PLAYER_MONEY,
                    sharesA: 0,
                    sharesB: 0,
                    sharesC: 0,
                    sharesD: 0,
                    customStockInvestments: {},
                    bankrupt: false,
                    isAI: false,
                    isExternal: true,
                    isHuman: false,
                    aiStrategy: null,
                    _lastRating: 'D',
                    totalAssets: function() {
                        let stockVal = ['A', 'B', 'C', 'D'].reduce((sum, k) => {
                            let shares = this[`shares${k}`] || 0;
                            return sum + shares * (stocks[k]?.price || 100);
                        }, 0);
                        let cust = this.customStockInvestments ? Object.values(this.customStockInvestments)
                            .reduce((a, b) => a + b, 0) : 0;
                        return this.cash + stockVal + cust;
                    }
                };
                initPlayerAchievements(p);
                players.push(p);
            });
        }

        // ================================================================
