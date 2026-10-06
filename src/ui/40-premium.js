/* ============================================================
   40. 高级动效
   - 板块入场（淡入上移 + 逐区交错）
   - 数值滚动（count-up）：仅对纯金额文本做滚动动画，
     "1 / 60"、"A股"等非纯金额格式直接显示。
   - 动画开关：高级设置页可关闭，关闭时给 body 加 no-anim，
     并跳过入场/数字滚动（CSS 侧由 body.no-anim 禁用效果）。
   纯叠加增强，不影响任何游戏逻辑。
   ============================================================ */
(function () {
    'use strict';

    var state = new WeakMap(); // el -> { value, raf, animating }

    // ---- 动画开关（localStorage 持久化，默认开启） ----
    var animEnabled = (localStorage.getItem('xfw_animations') || '0') !== '0'; // 默认关闭
    function applyNoAnim() {
        if (document.body) document.body.classList.toggle('no-anim', !animEnabled);
    }

    function isAmountText(t) {
        return /^[¥￥]?\s?[\d][\d,]*$/.test(String(t).trim());
    }
    function extract(t) {
        var s = String(t).trim();
        var m = s.match(/([\d][\d,]*)/);
        if (!m) return { num: NaN, prefix: s };
        return { num: parseFloat(m[1].replace(/,/g, '')), prefix: s.slice(0, s.indexOf(m[0])) };
    }
    function fmt(n) {
        return Math.round(n).toLocaleString('en-US');
    }

    function animate(el) {
        var st = state.get(el);
        if (!st || st.animating) return; // 自身写入时不重复触发
        var text = el.textContent;
        if (!isAmountText(text)) { st.value = NaN; return; }
        var info = extract(text);
        if (!isFinite(info.num)) return;
        var from = isFinite(st.value) ? st.value : info.num;
        var to = info.num;
        if (from === to) { st.value = to; return; }
        if (st.raf) cancelAnimationFrame(st.raf);
        st.animating = true;
        var dur = 650;
        var t0 = performance.now();
        function ease(t) { return 1 - Math.pow(1 - t, 3); }
        function step(now) {
            var p = Math.min(1, (now - t0) / dur);
            var val = from + (to - from) * ease(p);
            el.textContent = info.prefix + fmt(val);
            if (p < 1) {
                st.raf = requestAnimationFrame(step);
            } else {
                st.animating = false;
                st.value = to;
                st.raf = 0;
                // 动画期间又来了新值则用新值再滚一次
                if (el.textContent.trim() !== text.trim()) animate(el);
                else el.textContent = text;
            }
        }
        st.raf = requestAnimationFrame(step);
    }

    function hook(el) {
        if (state.has(el)) return;
        state.set(el, { value: NaN, raf: 0, animating: false });
        new MutationObserver(function () { animate(el); })
            .observe(el, { childList: true, characterData: true, subtree: true });
        animate(el);
    }

    function scan() {
        document.querySelectorAll('.info-value, .player-total, .leaderboard-item .lb-value, .leaderboard-total')
            .forEach(hook);
    }

    function init() {
        scan();
        new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
    }

    /* ---- 板块入场：进入页面时逐区淡入上移（仅一次，克制） ---- */
    function initEntrance() {
        if (window.__entranceDone) return;
        window.__entranceDone = true;
        var selectors = [
            'header',
            '#banner-container',
            '.game-info',
            '.round-info',
            '.leaderboard',
            '.players-container',
            '.chart-card',
            '.net-status-bar',
            '.controls-bar',
            '.actions-bar',
            '.setup-panel'
        ];
        var els = [];
        for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            if (el) els.push(el);
        }
        if (els.length === 0) return;
        var stagger = 0.06;
        for (var k = 0; k < els.length; k++) els[k].classList.add('enter-rise');
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                for (var m = 0; m < els.length; m++) {
                    els[m].style.transitionDelay = (m * stagger).toFixed(2) + 's';
                    els[m].classList.add('in');
                }
                setTimeout(function () {
                    for (var n = 0; n < els.length; n++) els[n].style.transitionDelay = '';
                }, (els.length * stagger + 0.7) * 1000);
            });
        });
    }

    /* 游戏页有健康提示时，等它关闭后再做板块入场，避免被遮住看不到 */
    function readyEntrance() {
        var hm = document.getElementById('health-modal');
        var gameVisible = !!(document.getElementById('game-main') || document.querySelector('.game-info'));
        var waiting = false;
        if (hm && !hm.classList.contains('hidden') && gameVisible) {
            waiting = true;
            var mo = new MutationObserver(function () {
                if (hm.classList.contains('hidden')) {
                    mo.disconnect();
                    initEntrance();
                }
            });
            mo.observe(hm, { attributes: true, attributeFilter: ['class'] });
        }
        // 兜底：健康提示迟迟不关或逻辑异常时，也保证入场最终执行
        if (waiting) setTimeout(initEntrance, 5000);
        else initEntrance();
    }

    function initAll() {
        applyNoAnim();
        if (animEnabled) {
            scan();
            new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
            readyEntrance();
        }
        // 高级设置页的「动画开关」：变更即持久化并即时生效
        var toggle = document.getElementById('admin-animations');
        if (toggle) {
            toggle.checked = animEnabled;
            toggle.addEventListener('change', function () {
                animEnabled = toggle.checked;
                localStorage.setItem('xfw_animations', animEnabled ? '1' : '0');
                applyNoAnim();
                if (animEnabled && !window.__entranceDone) {
                    scan();
                    readyEntrance();
                }
            });
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
    else initAll();
})();
