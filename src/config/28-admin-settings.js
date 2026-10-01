//  28. 高级设置渲染（v9.1 新增破产设置）
        // ================================================================

        function renderAdminAchievements() {
            const grid = document.getElementById('admin-achievement-grid');
            if (!grid) return;
            grid.innerHTML = '';
            ACHIEVEMENT_IDS.forEach(id => {
                const def = ACHIEVEMENT_DEFS[id];
                const val = achievementRewardRatios[id] || def.defaultRewardRatio;
                const div = document.createElement('div');
                div.className = 'admin-achievement-item';
                div.innerHTML = `
                        <span>${def.icon} ${def.name}</span>
                        <input type="number" class="ach-reward-input" data-id="${id}" value="${Math.round(val*100)}" step="1" min="0" max="100" />
                        <span style="font-size:0.7rem;">%</span>
                    `;
                grid.appendChild(div);
                const input = div.querySelector('.ach-reward-input');
                input.onchange = function() {
                    const v = parseFloat(this.value) || 0;
                    achievementRewardRatios[id] = clamp(v / 100, 0, 1);
                };
            });
        }

        function renderAdminStockGrid() {
            const grid = document.getElementById('admin-stock-grid');
            if (!grid) return;
            grid.innerHTML = '';
            const stockKeys = ['A', 'B', 'C', 'D'];
            const labels = {
                A: { short: 'A', label: '成长股', dot: '#81c784' },
                B: { short: 'B', label: '周期股', dot: '#e57373' },
                C: { short: 'C', label: '科技股', dot: '#ce93d8' },
                D: { short: 'D', label: '蓝筹股', dot: '#4db6ac' }
            };
            stockKeys.forEach(k => {
                const s = stocks[k];
                const info = labels[k];
                const div = document.createElement('div');
                div.className = 'admin-stock-item';
                let upPct = (s.maxUp * 100).toFixed(1);
                let downPct = (s.maxDown * 100).toFixed(1);
                if (k === 'A') downPct = '0';
                div.innerHTML = `
                        <div class="stock-label">
                            <span class="color-dot" style="background:${info.dot};"></span>
                            ${info.short}股 · ${info.label}
                        </div>
                        <div class="stock-row">
                            <label>名称 <input type="text" class="stock-name-input" data-key="${k}" value="${s.name}" style="width:80px;" /></label>
                            <label>涨幅% <input type="number" class="stock-up-input" data-key="${k}" value="${upPct}" step="0.5" min="0" max="200" style="width:56px;" /></label>
                            ${k !== 'A' ? `<label>跌幅% <input type="number" class="stock-down-input" data-key="${k}" value="${downPct}" step="0.5" min="-90" max="0" style="width:56px;" /></label>` : ''}
                        </div>
                    `;
                grid.appendChild(div);
                const nameInput = div.querySelector('.stock-name-input');
                nameInput.onchange = function() {
                    const key = this.dataset.key;
                    const val = this.value.trim() || (key + '股');
                    stocks[key].name = val;
                    updateGameRulesDisplay();
                    updatePlayersDisplay();
                };
                const upInput = div.querySelector('.stock-up-input');
                upInput.onchange = function() {
                    const key = this.dataset.key;
                    let val = parseFloat(this.value) || 0;
                    val = clamp(val, 0, 200) / 100;
                    if (key === 'A') {
                        stocks.A.maxUp = val;
                        ADMIN_CONFIG.aMaxUp = val;
                    } else if (key === 'B') {
                        stocks.B.maxUp = val;
                        ADMIN_CONFIG.bMaxUp = val;
                    } else if (key === 'C') {
                        stocks.C.maxUp = val;
                        ADMIN_CONFIG.cMaxUp = val;
                    } else if (key === 'D') {
                        stocks.D.maxUp = val;
                        ADMIN_CONFIG.dMaxUp = val;
                    }
                    updateGameRulesDisplay();
                };
                const downInput = div.querySelector('.stock-down-input');
                if (downInput) {
                    downInput.onchange = function() {
                        const key = this.dataset.key;
                        let val = parseFloat(this.value) || 0;
                        val = clamp(val, -90, 0) / 100;
                        if (key === 'B') {
                            stocks.B.maxDown = val;
                            ADMIN_CONFIG.bMaxDown = val;
                        } else if (key === 'C') {
                            stocks.C.maxDown = val;
                            ADMIN_CONFIG.cMaxDown = val;
                        } else if (key === 'D') {
                            stocks.D.maxDown = val;
                            ADMIN_CONFIG.dMaxDown = val;
                        }
                        updateGameRulesDisplay();
                    };
                }
            });
        }

        // ================================================================
