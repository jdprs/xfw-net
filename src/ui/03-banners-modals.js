//  3. 自定义横幅与模态框（无系统弹窗）
        // ================================================================

        // 联机模式把标题前的符号用作左侧大图标，标题本身只保留文字。
        function showBanner(message, type = 'info', duration = null, title = '', iconOverride = '') {
            const container = document.getElementById('banner-container');
            if (!container) return;
            // 置顶：确保横幅显示在所有 overlay / loading 遮罩之上
            container.style.zIndex = '9999';
            const dur = duration || (BANNER_DURATION * 1000) || 4000;
            const icons = { info: '📌', success: '✅', warning: '⚠️', error: '❌', achievement: '🏅' };
            const isOnlineMode = window.GAME_MODE === 'master' || window.GAME_MODE === 'player';
            const trimmedTitle = String(title || '').trim();
            const titleIcon = trimmedTitle.split(/\s+/)[0];
            const titleHasIcon = !!titleIcon && /^[^\p{L}\p{N}]+$/u.test(titleIcon);
            const onlineIcon = isOnlineMode ? (iconOverride || (titleHasIcon ? titleIcon : '')) : '';
            const icon = isOnlineMode ? (onlineIcon || icons[type] || '📌') : (iconOverride || icons[type] || '📌');
            const el = document.createElement('div');
            el.className = `banner-message banner-${type}`;
            if (type === 'achievement') {
                el.style.borderLeftColor = 'var(--accent-gold)';
                el.style.background = 'linear-gradient(135deg, var(--bg-card), rgba(255,215,0,0.08))';
            }
            const titleTextBase = isOnlineMode && titleHasIcon
                ? trimmedTitle.slice(titleIcon.length).trimStart()
                : title;
            const titleByIcon = {
                '🚀': '开局通知', '🎯': '决策提示', '🤖': 'AI 状态', '🌐': '外接 AI',
                '👋': '玩家动态', '🔌': '连接状态', '📡': '网络状态', '⏰': '倒计时',
                '🚪': '房间动态', '⚠️': '操作提醒', '❌': '错误通知', '✅': '进度通知',
                '🏠': '房间状态', '🎮': '玩家入场', '⏳': '操作受限', '🔇': '聊天管理',
                '⏭': '回合管理', '💀': '玩家状态', '↩️': '撤销操作', '⏹': '对局结束', '📊': '进度更新'
            };
            const titleText = isOnlineMode && !titleTextBase
                ? (titleByIcon[onlineIcon] || { info: '联机通知', success: '操作成功', warning: '操作提醒', error: '操作失败', achievement: '成就解锁' }[type] || '联机通知')
                : titleTextBase;
            let bannerMessage = message;
            if (isOnlineMode && onlineIcon && typeof bannerMessage === 'string') {
                const messageStart = bannerMessage.trimStart();
                if (messageStart.startsWith(onlineIcon)) {
                    bannerMessage = messageStart.slice(onlineIcon.length).trimStart();
                }
            }
            let titleHtml = titleText ? `<span class="banner-title">${titleText}</span>` : '';
            let badgeHtml = '';
            if (type === 'achievement') {
                badgeHtml = `<div class="banner-achievement-badge">🏅 成就解锁！</div>`;
            }
            el.innerHTML = `
                    <div class="banner-icon">${icon}</div>
                    <div class="banner-content">${titleHtml}${bannerMessage}${badgeHtml}</div>
                    <button class="banner-close" aria-label="关闭">✕</button>
                    <div class="banner-progress" style="width:100%;"></div>
                `;
            container.appendChild(el);
            const closeBtn = el.querySelector('.banner-close');
            closeBtn.addEventListener('click', () => { removeBanner(el); });
            let startX = 0,
                startY = 0,
                isSwiping = false;
            el.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                isSwiping = false;
                el.classList.add('swiping');
            }, { passive: true });
            el.addEventListener('touchmove', (e) => {
                const touch = e.touches[0];
                const dx = touch.clientX - startX;
                const dy = touch.clientY - startY;
                if (Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 0.8) {
                    isSwiping = true;
                    const offset = Math.min(dx, 0);
                    el.style.transform = `translateX(${offset}px)`;
                    el.style.opacity = 1 - Math.abs(offset) / 200;
                    e.preventDefault();
                }
            }, { passive: false });
            el.addEventListener('touchend', () => {
                const transform = el.style.transform;
                const match = transform.match(/translateX\(([-\d.]+)px\)/);
                const offset = match ? parseFloat(match[1]) : 0;
                if (offset < -80) {
                    el.style.transition = 'none';
                    el.style.transform = `translateX(${offset}px)`;
                    void el.offsetWidth;
                    requestAnimationFrame(() => {
                        el.style.transition = '';
                        el.style.transform = 'translateX(-110%)';
                        el.style.opacity = '0';
                    });
                    setTimeout(() => { if (el.parentNode) el.remove(); }, 320);
                } else {
                    el.classList.remove('swiping');
                    el.style.transform = '';
                    el.style.opacity = '';
                }
            }, { passive: true });
            const progress = el.querySelector('.banner-progress');
            let startTime = Date.now();
            let timer = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, 1 - elapsed / dur);
                progress.style.width = (remaining * 100) + '%';
                if (remaining <= 0) {
                    clearInterval(timer);
                    removeBanner(el);
                }
            }, 50);
            el.addEventListener('mouseenter', () => {
                clearInterval(timer);
                progress.style.width = '100%';
            });
            el.addEventListener('mouseleave', () => {
                startTime = Date.now() - (dur * (1 - parseFloat(progress.style.width) / 100));
                timer = setInterval(() => {
                    const elapsed = Date.now() - startTime;
                    const remaining = Math.max(0, 1 - elapsed / dur);
                    progress.style.width = (remaining * 100) + '%';
                    if (remaining <= 0) {
                        clearInterval(timer);
                        removeBanner(el);
                    }
                }, 50);
            });
            setTimeout(() => { if (el.parentNode) removeBanner(el); }, dur + 500);
            const maxShow = 5;
            while (container.children.length > maxShow) {
                container.firstChild.remove();
            }
        }

        function removeBanner(el) {
            if (!el || !el.parentNode) return;
            el.classList.add('swiped-out');
            setTimeout(() => { if (el.parentNode) el.remove(); }, 350);
        }

        function clearAllBanners() {
            const container = document.getElementById('banner-container');
            if (container) container.innerHTML = '';
        }

        /** 自定义信息模态框（替代 alert） */
        function showInfoModal(title, body, callback) {
            let overlay = document.getElementById('info-modal');
            document.getElementById('info-modal-title').textContent = title || '📢 信息';
            document.getElementById('info-modal-body').textContent = body || '';
            overlay.classList.add('active');
            document.body.classList.add('modal-open');
            let okBtn = document.getElementById('info-modal-ok');
            okBtn.onclick = function() {
                overlay.classList.remove('active');
                document.body.classList.remove('modal-open');
                if (callback) callback();
            };
            overlay.onclick = function(e) {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                    document.body.classList.remove('modal-open');
                    if (callback) callback();
                }
            };
        }

        /** 自定义确认框（替代 confirm） */
        function showConfirmBanner(message, onConfirm, onCancel) {
            let overlay = document.createElement('div');
            overlay.style.cssText =
                'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(4px);';
            let box = document.createElement('div');
            box.style.cssText =
                'background:var(--bg-card);padding:24px 28px;border-radius:16px;max-width:400px;width:92%;border:2px solid var(--accent-gold);text-align:center;';
            box.innerHTML = `
                    <h3 style="color:var(--accent-gold);margin-bottom:12px;">⚠️ 确认</h3>
                    <p style="color:var(--text-secondary);margin-bottom:16px;">${message}</p>
                    <div class="btn-row" style="display:flex;gap:10px;justify-content:center;">
                        <button class="btn btn-success" id="confirm-yes">确定</button>
                        <button class="btn btn-warning" id="confirm-no">取消</button>
                    </div>
                `;
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            document.getElementById('confirm-yes').onclick = function() {
                overlay.remove();
                if (onConfirm) onConfirm();
            };
            document.getElementById('confirm-no').onclick = function() {
                overlay.remove();
                if (onCancel) onCancel();
            };
            overlay.onclick = function(e) {
                if (e.target === overlay) { overlay.remove(); if (onCancel) onCancel(); }
            };
        }

        // ================================================================
