/* ============================================================
 * 43. 英文界面翻译（Beta）
 * 在设置中开启「英文（Beta）」后，将整个游戏界面（HTML 静态文本
 * 与 JS 动态生成的文本）翻译为英文。核心机制：
 *   - 内置 中文->英文 词典，t() 做子串替换（按词长降序，长词优先）
 *   - 补丁 Node.textContent / Element.innerHTML 的 setter：
 *     任何 JS 写入界面的文本（含模板字符串生成的）在赋值瞬间被翻译
 *   - 页面加载时遍历静态 DOM，翻译文本节点与关键属性
 * 默认中文模式（lang!=='en'）下不做任何补丁，零影响。
 * 语言切换采用 localStorage: xfw_lang = 'zh' | 'en'。
 * ============================================================ */
(function () {
    var DICT = {
        // ---------- 游戏标题 / 顶部 ----------
        '小富翁股票投资游戏': 'Millionaire Stock Game',
        '历史版本': 'History',
        '版本号': 'Version',
        '版本': 'Version',
        '动画效果': 'Animations',
        '默认关闭': 'off by default',
        '默认开启': 'on by default',
        '英文': 'English',
        '英文模式': 'English mode',

        // ---------- 按钮 / 通用操作 ----------
        '开始游戏': 'Start Game',
        '开始操作': 'Start',
        '新游戏': 'New Game',
        '开始新游戏': 'Start New Game',
        '读取存档': 'Load Save',
        '保存': 'Save',
        '保存游戏': 'Save Game',
        '加载': 'Load',
        '导入': 'Import',
        '导出': 'Export',
        '导出存档码': 'Export Code',
        '导入存档码': 'Import Code',
        '存档码': 'Save Code',
        '存档': 'Save',
        '历史记录': 'History',
        '展开日志': 'Expand Log',
        '展开图表': 'Expand Chart',
        '展开': 'Expand',
        '收起': 'Collapse',
        '关闭': 'Close',
        '关闭面板': 'Close Panel',
        '复制': 'Copy',
        '复制指令': 'Copy Code',
        '复制到外部': 'Copy Out',
        '粘贴回复': 'Paste Reply',
        '清空': 'Clear',
        '确定': 'OK',
        '确认': 'Confirm',
        '确认继续': 'Confirm Continue',
        '取消': 'Cancel',
        '取消决策': 'Cancel Decision',
        '已取消': 'Cancelled',
        '应用设置': 'Apply Settings',
        '跳过': 'Skip',
        '跳过回合': 'Skip Turn',
        '返回': 'Back',
        '返回大厅': 'Back to Lobby',
        '返回模式选择': 'Back to Mode Select',
        '进入下一轮': 'Next Round',
        '下一轮': 'Next Round',
        '强制收盘': 'Force Close',
        '结束游戏': 'End Game',
        '直接结束游戏': 'End Game Now',
        '重新开始': 'Restart',
        '创建': 'Create',
        '创建房间': 'Create Room',
        '加入房间': 'Join Room',
        '创建自建股': 'Create Stock',
        '添加外接': 'Add AI',
        '更新': 'Update',
        '帮助': 'Help',
        '操作': 'Action',
        '操作失败': 'Action Failed',
        '操作无效': 'Invalid Action',
        '执行': 'Execute',
        '执行决策': 'Execute Decision',
        '完成': 'Done',
        '完成决策': 'Finish Decision',
        '已完成': 'Done',
        '移除': 'Remove',
        '撤销': 'Undo',
        '撤销失败': 'Undo Failed',
        '撤销预测': 'Undo Prediction',
        '返回模式': 'Back',

        // ---------- 设置 / 配置 ----------
        '高级设置': 'Advanced Settings',
        '设置': 'Settings',
        '配置': 'Config',
        '初始资金': 'Initial Cash',
        '总轮数': 'Total Rounds',
        '破产阈值': 'Bankruptcy Line',
        '破产救助金': 'Bankruptcy Aid',
        '救助金': 'Aid',
        '倍数': 'Multiplier',
        '倍率': 'Multiplier',
        '概率': 'Chance',
        '税率': 'Tax Rate',
        '掠夺阈值': 'Plunder Threshold',
        '掠夺税': 'Plunder Tax',
        '模式': 'Mode',
        '标准': 'Standard',
        '决策机制': 'Decision System',
        '整元交易': 'Whole-Yuan Trading',
        '盈亏显示': 'P&L Display',
        '全信息': 'Full Info',
        '联机模式': 'Online Mode',
        '单机': 'Offline',
        '决策中': 'Deciding',
        '等待中': 'Waiting',
        '思考中': 'Thinking',
        '已思考': 'Thought',
        '已确认': 'Confirmed',
        '已保存': 'Saved',
        '名称': 'Name',
        '房间名': 'Room Name',
        '密钥': 'API Key',
        '房主': 'Host',
        '玩家': 'Player',
        '真人': 'Human',
        '场内': 'Built-in',
        '内置': 'Built-in',
        '外接': 'External',
        '官方': 'Official',
        '免费': 'Free',

        // ---------- 股票 ----------
        '股票': 'Stock',
        'A股': 'A-stock',
        'B股': 'B-stock',
        'C股': 'C-stock',
        'D股': 'D-stock',
        '即': ' is ',
        '股票类型': 'Stock Type',
        '股票名称': 'Stock Name',
        '股票市值': 'Stock Value',
        '股价': 'Price',
        '当前股价': 'Current Price',
        '持仓': 'Holding',
        '股份数': 'Shares',
        '金额': 'Amount',
        '现金': 'Cash',
        '现金不足': 'Insufficient Cash',
        '银行资产': 'Bank Assets',
        '总资产': 'Total Assets',
        '银行告急': 'Bank Alert',
        '上涨': 'Up',
        '下跌': 'Down',
        '持平': 'Flat',
        '涨跌幅': 'Change',
        '只涨不跌': 'Rises only',
        '股不会下跌': 'never falls',
        '涨跌图': 'Chart',
        '股票涨跌': 'Stock Change',
        '玩家涨跌': 'Player Change',
        '盈利': 'Profit',
        '亏损': 'Loss',
        '持有': 'Hold',
        '买入': 'Buy',
        '卖出': 'Sell',
        '卖出股票': 'Sell Stock',
        '买回': 'Buy Back',
        '投资': 'Invest',
        '投资自建股': 'Invest Custom',
        '取回自建股': 'Withdraw Custom',
        '自建股': 'Custom Stock',
        '自建': 'Custom',
        '自建股投资': 'Custom Invest',
        '以金额计': 'by amount',
        '市场概况': 'Market Overview',
        '市场事件': 'Market Event',
        '资产趋势': 'Asset Trend',
        '实时排行榜': 'Live Ranking',
        '破产者': 'Bankrupt',
        '黑马股': 'Dark Horse',
        '本轮黑马股': 'Dark Horse This Round',
        '本轮无黑马股': 'No Dark Horse This Round',
        '被封闭股': 'Blocked',
        '被封股票': 'Blocked Stock',
        '已跑路': 'has gone bust',
        '跑路': 'went bust',
        '老板跑路': 'Boss Gone Bust',
        '股票跑路': 'Stock Went Bust',
        '无法交易': 'Cannot Trade',
        '无法买卖': 'Cannot Trade',
        '无法预测': 'Cannot Predict',
        '暂停交易': 'Paused',
        '价格重置': 'Price Reset',
        '价格重置为初始价': 'Price reset to initial',
        '价格冻结': 'Price Frozen',
        '持仓清零': 'Holding Cleared',
        '可重新交易': 'Tradeable Again',
        '重新上市': 'Re-listed',
        '轮恢复': 'rounds to recover',
        '轮后重开': 'rounds later reopens',
        '之前持仓不恢复': 'old holdings not restored',
        '定投': 'DCA',
        '小额分散买入': 'Small Spread Buys',
        '趋势跟随': 'Trend Follow',
        '逆向投资': 'Contrarian',
        '稳健型': 'Steady',
        '进取型': 'Aggressive',
        '平衡型': 'Balanced',
        '剧烈': 'Volatile',
        '平稳': 'Stable',

        // ---------- 游戏机制 ----------
        '游戏目标': 'Game Goal',
        '游戏规则详解': 'Game Rules',
        '游戏准备就绪': 'Game Ready',
        '游戏结束': 'Game Over',
        '游戏未开始或已结束': 'Game not started or over',
        '游戏日志': 'Game Log',
        '指令面板': 'Command Panel',
        '指令代码': 'Command Code',
        '指令模式': 'Command Mode',
        '正在生成指令': 'Generating Command',
        '多因子决策引擎': 'Multi-factor Engine',
        '成就系统': 'Achievements',
        '成就馆': 'Achievements',
        '成就': 'Achievement',
        '个成就': 'achievements',
        '项成就': 'achievements',
        '已解锁': 'Unlocked',
        '解锁成就': 'Achievement Unlocked',
        '成就解锁': 'Achievement Unlocked',
        '已解锁成就': 'Unlocked Achievements',
        '获得': 'Earned',
        '奖励': 'Reward',
        '奖励总资产': 'Reward % of Total',
        '总资产奖励': 'Total Asset Reward',
        '首次投资': 'First Investment',
        '投资达人': 'Investment Pro',
        '股神': 'Stock God',
        '彩票幸运儿': 'Lottery Lucky',
        '彩票倒霉蛋': 'Lottery Unlucky',
        '百万富翁': 'Millionaire',
        '交易狂': 'Trade Maniac',
        '稳健投资者': 'Steady Investor',
        '冒险家': 'Adventurer',
        '预测上涨': 'Predict Up',
        '预测下跌': 'Predict Down',
        '预测持平': 'Predict Flat',
        '预测失败': 'Prediction Failed',
        '预测正确': 'Prediction Correct',
        '预测错误': 'Prediction Wrong',
        '股神预测': 'Stock Prediction',
        '押注': 'Bet',
        '押金': 'Deposit',
        '押注金额': 'Bet Amount',
        '押注金额上限为总资产的': 'Bet cap is 5% of total assets',
        '持平判定': 'Flat Threshold',
        '持平阈值': 'Flat Threshold',
        '股价变化在': 'price change within',
        '以内视为持平': 'is considered flat',
        '每轮限预测一次': 'One prediction per round',
        '每轮限一次': 'Once per round',
        '不能预测下跌': 'cannot predict down',
        '因此下跌选项不可用': 'down option disabled',
        '退还押金并清除记录': 'refund deposit & clear record',
        '预测上涨正确': 'Up prediction correct',
        '预测下跌正确': 'Down prediction correct',
        '预测持平正确': 'Flat prediction correct',
        '已退还': 'Refunded',
        '中奖': 'Won',
        '中奖率': 'Win Rate',
        '彩票': 'Lottery',
        '购买彩票': 'Buy Lottery',
        '彩票中奖': 'Lottery Win',
        '彩票诈骗': 'Lottery Scam',
        '诈骗率': 'Scam Rate',
        '彩票倒霉': 'Lottery Bad Luck',
        '中得': 'Won',
        '破产': 'Bankrupt',
        '已破产': 'Bankrupt',
        '破产救助': 'Bankruptcy Aid',
        '救助': 'Aid',
        '触发掠夺模式': 'Plunder Mode',
        '掠夺模式激活': 'Plunder Active',
        '掠夺': 'Plunder',
        '缴纳掠夺税': 'Pay Plunder Tax',
        '变卖资产缴税': 'Sell to Pay Tax',
        '变卖资产缴罚款': 'Sell to Pay Fine',
        '变卖资产缴付彩票罚款': 'Sell to Pay Lottery Fine',
        '因彩票诈骗破产': 'Bankrupt from Lottery Scam',
        '因彩票诈骗被罚款': 'Fined for Lottery Scam',
        '无法交易': 'Cannot Trade',
        '已跑路股票': 'Gone-bust Stock',
        '资产微薄': 'Assets too small',
        '免于掠夺': 'exempt from plunder',
        '收税': 'Collect Tax',
        '罚款': 'Fine',
        '倍数': 'Multiplier',
        '方向': 'Direction',
        '上涨/下跌': 'Up/Down',
        '奖金': 'Bonus',
        '没收': 'Confiscated',
        '不返还': 'not returned',
        '全部没收': 'all confiscated',
        '上限': 'Cap',
        '最高': 'Max',
        '最少': 'Min',
        '默认': 'Default',
        '最多': 'Max',

        // ---------- 回合 / 状态 ----------
        '当前轮数': 'Round',
        '第': 'Round ',
        '轮': '',
        '所有玩家已完成决策': 'All players finished',
        '等待其他玩家': 'Waiting for others',
        '等待玩家': 'Waiting for players',
        '等待房主': 'Waiting for host',
        '等待': 'Waiting',
        '请等待轮到你': 'Please wait for your turn',
        '现在不是你的回合': 'Not your turn now',
        '轮到': "It's ",
        '的回合': "'s turn",
        '回合': 'Turn',
        '请进行操作': 'Please take an action',
        '完成后点击': 'then click',
        '进行中': 'In Progress',
        '完成决策': 'Finish Decision',
        '决策进度': 'Progress',
        '已思考': 'Thought',
        '开始决策': 'Start Decision',
        '指定下一位决策者': 'Choose Next Player',
        '等待房主指定下一位决策者': 'Waiting for host to choose',
        '房主端为权威': 'Host is authoritative',
        '仅玩家客户端拦截': 'players block',
        '非本人回合': 'other turns',
        '房主已结束本轮游戏': 'Host ended this round',
        '结束本轮': 'End Round',
        '轮收盘': 'Round Close',
        '收盘时统一检测破产': 'Bankruptcy checked at close',
        '收盘统一破产检测': 'Uniform bankruptcy check',
        '进入': 'Enter',
        '即将返回大厅': 'Returning to lobby',
        '秒后自动进入游戏': 'seconds to auto-start',
        '倒计时': 'Countdown',
        '健康忠告': 'Health Tip',
        '仅设置页存在': 'Setup page only',

        // ---------- 联机 ----------
        '联机开始': 'Start Online',
        '联机模式下': 'In online mode',
        '正在连接房主': 'Connecting to host',
        '已连接房主': 'Connected to host',
        '连接失败': 'Connection Failed',
        '连接中': 'Connecting',
        '网络错误': 'Network Error',
        '重连失败': 'Reconnect Failed',
        '重连成功': 'Reconnected',
        '与房主断开': 'Disconnected from host',
        '断线': 'Disconnected',
        '房间已关闭': 'Room Closed',
        '加入房间': 'Join Room',
        '创建房间': 'Create Room',
        '房间': 'Room',
        '等待室': 'Waiting Room',
        '的房间': "'s Room",
        '加入了房间': 'joined the room',
        '加入了游戏': 'joined the game',
        '已重连': 'reconnected',
        '等待': 'Waiting',
        '房主端': 'Host',
        '玩家端': 'Player',
        '仅房主可见': 'Host only',
        '玩家端隐藏': 'Hidden for players',
        '进程按钮': 'Process buttons',
        '改由大厅': 'via lobby',
        '模式进入': 'mode',
        '禁言': 'Mute',
        '强制收盘': 'Force Close',
        '聊天室': 'Chat',
        '发送消息': 'Send Message',
        '发送': 'Send',
        '新消息': 'New Message',
        '消息': 'Message',
        '网络状态': 'Network Status',
        '已连接': 'Connected',
        '等待连接': 'Waiting to connect',
        '你': 'You',
        '': '',

        // ---------- 提示 / 横幅 ----------
        '帮助内容已复制到剪贴板': 'Help copied to clipboard',
        '操作提醒': 'Reminder',
        '联机通知': 'Online Notice',
        '注意': 'Note',
        '提示': 'Tip',
        '信息': 'Info',
        '描述': 'Description',
        '事件': 'Event',
        '错误': 'Error',
        '失败': 'Failed',
        '成功': 'Success',
        '警告': 'Warning',
        '已复制': 'Copied',
        '复制失败': 'Copy Failed',

        // ---------- 图表 / 分析 ----------
        '图表总览': 'Chart Overview',
        '股票的涨跌图': 'Stock Chart',
        '查看每个玩家': 'View Each Player',
        '资产': 'Assets',
        '总资产奖励': 'Asset Reward',

        // ---------- AI ----------
        '缺少配置': 'Missing Config',
        '未配置': 'Not Configured',
        '自动调用': 'Auto Call',
        '调用失败': 'Call Failed',
        '调用异常': 'Call Error',
        '解析失败': 'Parse Failed',
        '解析': 'Parse',
        '回复失败': 'Reply Failed',
        '不存在': 'Not Found',
        '未找到': 'Not Found',
        '请先点击': 'Please click',
        '添加到右侧': 'add to right',
        '将回复粘贴到右侧': 'Paste reply on the right',
        '基氮实验室': 'Base Nitrogen Lab',
        '版权所有': 'All Rights Reserved',

        // ---------- 游戏过程 ----------
        '中奖概率': 'Win Chance',
        '诈骗风险': 'Scam Risk',
        '破产阈值': 'Bankruptcy Line',
        '高于': 'above',
        '低于': 'below',
        '阈值': 'threshold',
        '判定': 'judged',
        '判断': 'judged',
        '整': 'whole',
        '整数': 'whole number',
        '整数元': 'whole yuan',
        '元': ' yuan',
        '所有金额为整数': 'All amounts are whole numbers',
        '所有金额必须为整数': 'All amounts must be whole numbers',
        '所有金额以元为单位': 'All amounts in yuan',
        '以元为单位': 'in yuan',
        '自动发放': 'auto-grant',
        '帮助玩家继续游戏': 'help player continue',
        '自动进入': 'auto-enter',
        '清除': 'clear',
        '记录': 'record',
        '操作成功': 'Success',
        '操作失败': 'Failed',
        '项操作': 'actions',
        '部分操作失败': 'some failed',
        '执行了': 'Executed',
        '项失败': 'failed',
        '项错误': 'errors',
        '执行失败': 'Execution Failed',
        '正在执行': 'Executing',
        '暂无': 'None',
        '暂无外接': 'No external AI',
        '点击下方添加': 'Click below to add',
        '无': 'None',
        '请': 'Please',
        '您': 'You',
        '你的': 'your',
        '您的': 'your',
        '当前': 'Current',
        '数据': 'Data',
        '日期': 'Date',
        '时间': 'Time',
        '周': 'w',
        '天': 'd',
        '小时': 'h',
        '分钟': 'm',
        '秒': 's',
        '日': 'd',
        '月': 'mo',
        '年': 'y',
        '已结束': 'Ended',
        '已开始': 'Started',
        '进行中': 'In progress',
        '暂停': 'Pause',
        '继续': 'Resume',
        '重新': 'Re-',
        '全部': 'All',
        '任一': 'Any',
        '部分': 'Some',
        '只有': 'Only',
        '无限制': 'Unlimited',
        '随机': 'Random',
        '总计': 'Total',
        '合计': 'Total',
        '剩余': 'Left',
        '共': 'Total',
        '之间': 'between',
        '以内': 'within',
        '以上': 'or more',
        '以下': 'or less',
        '从': 'from',
        '至': 'to',
        '到': 'to',
        '用于': 'for',
        '作为': 'as',
        '根据': 'based on',
        '系统': 'System',
        '在线': 'Online',
        '离线': 'Offline',
        '确认': 'Confirm',
        '提示': 'Tip',
        // ---------- 常用标点（英文模式下转英文标点，改善可读性） ----------
        '，': ', ',
        '。': '. ',
        '：': ': ',
        '？': '? ',
        '！': '! ',
        '、': ', ',
        '（': ' (',
        '）': ') ',
        '“': '"',
        '”': '"',
        '「': '“',
        '」': '”'
    };

    // 生成正则：按键长降序，转义特殊字符
    var keys = Object.keys(DICT).filter(function (k) { return k; });
    keys.sort(function (a, b) { return b.length - a.length; });
    var escaped = keys.map(function (k) {
        return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    var RE = new RegExp(escaped.join('|'), 'g');

    var lang = (function () {
        try { return (localStorage.getItem('xfw_lang') || 'zh'); }
        catch (e) { return 'zh'; }
    })();
    window.LANG = lang;

    function t(s) {
        if (lang !== 'en' || typeof s !== 'string' || !s) return s;
        if (!/[\u4e00-\u9fff]/.test(s)) return s;
        // 子串替换：英文词相邻处自动补空格，避免 "Total Assetsbelow" 这类拼接
        return s.replace(RE, function (m, offset, str) {
            var val = DICT[m];
            if (val === undefined) return m;
            if (offset > 0 && /[\u4e00-\u9fff]/.test(str[offset - 1]) && /[A-Za-z0-9]/.test(val[0])) val = ' ' + val;
            var end = offset + m.length;
            if (end < str.length && /[\u4e00-\u9fff]/.test(str[end]) && /[A-Za-z0-9]/.test(val[val.length - 1])) val = val + ' ';
            return val;
        }).replace(/ {2,}/g, ' ').replace(/^ | $/g, '');
    }
    window.t = t;

    // 翻译含占位符的模板片段（供 JS 直接使用）
    function tt(s) { return t(s); }

    var patched = false;
    function installSetters() {
        if (patched || lang !== 'en') return;
        patched = true;
        try {
            var nodeDesc = Object.getOwnPropertyDescriptor(window.Node.prototype, 'textContent');
            var origTCSet = nodeDesc && nodeDesc.set;
            if (origTCSet) {
                Object.defineProperty(window.Node.prototype, 'textContent', {
                    configurable: true,
                    enumerable: nodeDesc.enumerable,
                    get: nodeDesc.get,
                    set: function (v) { origTCSet.call(this, t(v)); }
                });
            }
        } catch (e) { /* 忽略 */ }
        try {
            // innerHTML 定义在 Element.prototype（不是 HTMLElement.prototype）
            var elDesc = Object.getOwnPropertyDescriptor(window.Element.prototype, 'innerHTML');
            var origIHSet = elDesc && elDesc.set;
            if (origIHSet) {
                Object.defineProperty(window.Element.prototype, 'innerHTML', {
                    configurable: true,
                    enumerable: elDesc.enumerable,
                    get: elDesc.get,
                    set: function (v) { origIHSet.call(this, t(v)); }
                });
            }
        } catch (e) { /* 忽略 */ }
    }

    // 遍历静态 DOM，翻译文本节点与关键属性
    function translateAttributes(el) {
        if (!el || lang !== 'en') return;
        ['placeholder', 'title', 'alt', 'value'].forEach(function (attr) {
            if (el.hasAttribute && el.hasAttribute(attr)) {
                var v = el.getAttribute(attr);
                if (v && /[\u4e00-\u9fff]/.test(v)) el.setAttribute(attr, t(v));
            }
        });
        // button 文本走文本节点
    }
    function walkDom(root) {
        if (lang !== 'en') return;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        var n;
        while (n = walker.nextNode()) {
            if (n.nodeValue && /[\u4e00-\u9fff]/.test(n.nodeValue)) nodes.push(n);
        }
        nodes.forEach(function (node) { node.nodeValue = t(node.nodeValue); });
        var els = root.querySelectorAll ? root.querySelectorAll('*') : [];
        for (var i = 0; i < els.length; i++) translateAttributes(els[i]);
    }

    function applyEnglish() {
        lang = 'en';
        window.LANG = 'en';
        installSetters();
        if (window.refreshHelp) window.refreshHelp('en');
        walkDom(document.body || document.documentElement);
    }

    window.applyEnglish = applyEnglish;
    window.i18n = { t: t, setLang: function (l) { lang = l; window.LANG = l; } };

    // 高级设置里的「英文（Beta）」开关：写入 localStorage 并刷新应用
    function initSettings() {
        var cb = document.getElementById('admin-english');
        if (!cb) return;
        cb.checked = (lang === 'en');
        cb.addEventListener('change', function () {
            try { localStorage.setItem('xfw_lang', cb.checked ? 'en' : 'zh'); }
            catch (e) { /* 忽略 */ }
            location.reload();
        });
    }

    // 页面加载：英文模式启用补丁 + 翻译静态 DOM
    function onReady() {
        initSettings();
        if (lang === 'en') {
            installSetters();
            // 用 42-help.js 的完整英文版帮助，而非词典逐词翻译
            if (window.refreshHelp) window.refreshHelp('en');
            walkDom(document.body || document.documentElement);
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
    else onReady();
})();
