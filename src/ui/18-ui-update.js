//  18. UI更新（非卡片部分）
        // ================================================================

        function updateUI() {
            document.getElementById('current-round').textContent = `${round} / ${totalRounds}`;
            document.getElementById('round-display').textContent = `第 ${round} 轮`;
            document.getElementById('bank-assets').textContent = fmt(bankAssets);
            let warn = document.getElementById('bank-warning');
            if (bankAssets < LOOT_THRESHOLD) {
                document.getElementById('bank-assets').style.color = '#ef5350';
                warn.style.display = 'block';
                warn.textContent = '⚠️ 银行告急！掠夺模式激活';
            } else {
                document.getElementById('bank-assets').style.color = 'var(--text-primary)';
                warn.style.display = 'none';
            }
            updateDarkHorseDisplay();
        }

        function updateStockStatus() {
            const ids = { A: 'stock-a-status', B: 'stock-b-status', C: 'stock-c-status', D: 'stock-d-status' };
            Object.keys(ids).forEach(k => {
                let el = document.getElementById(ids[k]);
                // v9.3: 被封股票显示跑路状态
                if (isStockSealed(k)) {
                    let info = sealedStocks[k];
                    el.textContent = `🚫 已跑路（第${info.recoverRound}轮恢复）`;
                    el.style.color = '#ef5350';
                    return;
                }
                let m = stocks[k].recentMultiplier || 1;
                let pct = ((m - 1) * 100).toFixed(1);
                let isDark = currentDarkHorse && currentDarkHorse.key === k;
                let darkTag = isDark ? ' 🐴' : '';
                let price = stocks[k].price;
                if (m > 1.005) { el.textContent = `📈 +${pct}%${darkTag} (${fmt(price)})`;
                    el.style.color = '#81c784'; } else if (m < 0.995) { el.textContent = `📉 ${pct}%${darkTag} (${fmt(price)})`;
                    el.style.color = '#e57373'; } else { el.textContent = `➖ 持平${darkTag} (${fmt(price)})`;
                    el.style.color = 'var(--text-secondary)'; }
            });
            let div = document.getElementById('custom-stock-status');
            if (div) {
                div.innerHTML = customStocks.map(cs => {
                    let isDark = currentDarkHorse && currentDarkHorse.key === `custom_${cs.id}`;
                    let darkTag = isDark ? ' 🐴' : '';
                    return `<p>${cs.name}${darkTag}：${cs.recentMultiplier > 1.005 ? '📈' : cs.recentMultiplier < 0.995 ? '📉' : '➖'} ${((cs.recentMultiplier-1)*100).toFixed(1)}%</p>`;
                }).join('');
            }
            updateDarkHorseDisplay();
        }

        function updateLeaderboard() {
            let sorted = [...players].filter(p => !p.bankrupt).sort((a, b) => b.totalAssets() - a.totalAssets());
            let content = document.getElementById('leaderboard-content');
            content.innerHTML = sorted.map((p, i) => {
                let cls = 'leaderboard-item';
                if (i === 0) cls += ' current-leader';
                if (p.isExternal) cls += ' external-leader';
                let tag = p.isAI ? ` (${p.aiStrategy})` : p.isExternal ? ' 🌐' : '';
                let achieveCount = p.achievements ? Object.values(p.achievements).filter(a => a.unlocked).length : 0;
                let badge = achieveCount > 0 ? `<span class="achieve-badge">🏅${achieveCount}</span>` : '';
                let rating = p._lastRating || 'D';
                let ratingDisplay = `<span class="rating-badge rating-${rating}">${rating}</span>`;
                let statusIcon = playerDecisionStatus[p.id] === 'done' ? '✅' : '⏳';
                return `<div class="${cls}">
                        <span><strong>#${i+1}</strong> ${p.name}${tag} ${badge} ${ratingDisplay} ${statusIcon}</span>
                        <span style="font-weight:600;color:${i===0?'var(--accent-gold)':'inherit'}">${fmt(p.totalAssets())}</span>
                    </div>`;
            }).join('');
            players.filter(p => p.bankrupt).forEach(p => {
                let achieveCount = p.achievements ? Object.values(p.achievements).filter(a => a.unlocked).length : 0;
                let badge = achieveCount > 0 ? `<span class="achieve-badge">🏅${achieveCount}</span>` : '';
                content.innerHTML +=
                    `<div class="leaderboard-item" style="opacity:0.5;"><span>💀 ${p.name} 破产 ${badge}</span><span>¥0</span></div>`;
            });
        }

        // ================================================================
