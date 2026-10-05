/* ============================================================
   40. 高级动效：数值滚动（count-up）
   仅对"纯金额"文本做滚动动画（如 ¥200,000、¥1,234），
   遇到"1 / 60"、"A股"等非纯金额格式时直接显示、不做动画。
   纯叠加增强，不影响任何游戏逻辑。
   ============================================================ */
(function () {
    'use strict';

    var state = new WeakMap(); // el -> { value, raf, animating }

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
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
