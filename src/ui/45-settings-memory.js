//  45. 设置记忆（自动记住玩家的设置选择，跨刷新保留）
//  - 收集设置面板内所有 input/select（含动态生成的股票网格、成就奖励）
//  - 控件变化时自动保存（防抖），页面加载/打开设置时自动恢复
//  ================================================================
(function () {
    const STORE_KEY = 'xfw_settings';
    const SAVE_DELAY = 250; // 防抖毫秒

    // 为单个控件生成稳定 key：有 id 用 id，否则用 class+data 组合
    function keyOf(el) {
        if (el.id) return '#' + el.id;
        if (el.classList.contains('stock-name-input')) return 'stock:' + el.dataset.key + ':name';
        if (el.classList.contains('stock-up-input')) return 'stock:' + el.dataset.key + ':up';
        if (el.classList.contains('stock-down-input')) return 'stock:' + el.dataset.key + ':down';
        if (el.classList.contains('ach-reward-input')) return 'ach:' + el.dataset.id;
        return null;
    }

    // 收集当前所有设置为 {key: value}（checkbox 记布尔）
    function collect() {
        const data = {};
        const root = document.getElementById('game-setup') || document.getElementById('runtime-config');
        if (!root) return data;
        root.querySelectorAll('input, select').forEach(el => {
            const k = keyOf(el);
            if (!k) return;
            data[k] = el.type === 'checkbox' ? el.checked : el.value;
        });
        return data;
    }

    // 保存到 localStorage
    function save() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(collect())); } catch (e) {}
    }

    // 读取已保存设置
    function read() {
        try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; }
    }

    // 把单个值应用到控件（不触发额外保存，避免循环）
    function applyValue(el, val) {
        if (el.type === 'checkbox') el.checked = !!val;
        else el.value = val;
    }

    // 恢复静态控件
    function restoreStatic() {
        const data = read();
        const root = document.getElementById('game-setup') || document.getElementById('runtime-config');
        if (!root) return;
        root.querySelectorAll('input, select').forEach(el => {
            const k = keyOf(el);
            if (k && Object.prototype.hasOwnProperty.call(data, k)) applyValue(el, data[k]);
        });
    }

    // 恢复动态控件（股票网格 / 成就奖励），在 render 之后调用
    function restoreDynamic() {
        const data = read();
        document.querySelectorAll('.stock-name-input,.stock-up-input,.stock-down-input,.ach-reward-input')
            .forEach(el => {
                const k = keyOf(el);
                if (k && Object.prototype.hasOwnProperty.call(data, k)) {
                    applyValue(el, data[k]);
                    // 触发一次 change，让内部状态（stocks/achievementRewardRatios）同步
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
    }

    // 包装 render 函数：先 render 再回填动态数据
    function hookRender(name) {
        const orig = window[name];
        if (typeof orig !== 'function') return;
        window[name] = function () {
            orig.apply(this, arguments);
            restoreDynamic();
        };
    }

    // 包装 enableAdminSettings：打开高级设置后恢复所有设置
    function hookEnableAdmin() {
        const orig = window.enableAdminSettings;
        if (typeof orig !== 'function') return;
        window.enableAdminSettings = function () {
            orig.apply(this, arguments);
            restoreStatic();
            restoreDynamic();
        };
    }

    // 监听设置面板控件变化，自动保存（事件委托 + 防抖）
    let timer = null;
    function bindAutoSave() {
        const root = document.getElementById('game-setup') || document.getElementById('runtime-config');
        if (!root) return;
        root.addEventListener('input', scheduleSave, true);
        root.addEventListener('change', scheduleSave, true);
    }
    function scheduleSave() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(save, SAVE_DELAY);
    }

    // 对外暴露
    window.settingsMemory = { save, restore: function () { restoreStatic(); restoreDynamic(); } };

    // 初始化挂钩
    function init() {
        hookEnableAdmin();
        hookRender('renderAdminStockGrid');
        hookRender('renderAdminAchievements');
        bindAutoSave();
        // 页面已存在设置面板时先恢复一次静态值
        restoreStatic();
    }

    // enableAdminSettings 在 31 模块的 window.onload 中才定义，
    // 因此用 load 事件（在 31 的 onload 之后执行）确保能包装到它
    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }
})();
