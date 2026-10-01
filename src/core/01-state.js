//  1. 全局状态
        // ================================================================

        let players = [];
        let round = 1;
        let totalRounds = 60;
        let bankAssets = 200000;
        let gameActive = true;
        let humanCount = 1;
        let aiCount = 1;
        let playerCount = 2;
        let assetsHistory = [];
        let stocksHistory = [];
        let logsByRound = {};
        let allLogsExpanded = true;
        let logPanelVisible = true;
        // v9.2: 每轮历史快照（用于历史记录面板）
        let roundHistory = [];
        // v9.3: 被封股票（跑路），key -> { sealedRound, recoverRound }
        let sealedStocks = {};

        let externalAIConfigs = [];

        // ---- 股票定义 ----
        let stocks = {
            A: { value: 0, history: [], recentMultiplier: 1, name: 'A股', color: '#81c784', maxUp: 0.18, maxDown: 0,
                trend: 0, netFlow: 0, volatility: 0.08, price: 100 },
            B: { value: 0, history: [], recentMultiplier: 1, name: 'B股', color: '#e57373', maxUp: 0.80, maxDown: -0.40,
                trend: 0, netFlow: 0, volatility: 0.25, price: 100 },
            C: { value: 0, history: [], recentMultiplier: 1, name: 'C股', color: '#ce93d8', maxUp: 1.20, maxDown: -0.60,
                trend: 0, netFlow: 0, volatility: 0.40, price: 100 },
            D: { value: 0, history: [], recentMultiplier: 1, name: 'D股', color: '#4db6ac', maxUp: 0.10, maxDown: -0.05,
                trend: 0, netFlow: 0, volatility: 0.04, price: 100 }
        };
        let customStocks = [];
        let lotteries = [];
        let lotteryJackpot = 0;

        let adminMode = false;
        let INIT_PLAYER_MONEY = 5000;
        let INIT_BANK_MONEY = 200000;
        let LOOT_THRESHOLD = 8000;
        let LOOT_RATIO = 15;
        let BANNER_DURATION = 4;
        let AI_THINK_MIN = 4;
        let AI_THINK_MAX = 8;

        // ---- v9.1 特性：破产资助金 ----
        let BANKRUPTCY_THRESHOLD = 100; // 破产阈值（默认100元）
        let BANKRUPTCY_FUND = 1000; // 破产救助金（默认1000元）

        let DARK_HORSE_MULTIPLIER = 2.0;
        let DARK_HORSE_PROB = 0.35;
        let currentDarkHorse = null;
        let marketSentiment = 0.5;
        let predictionsThisRound = {};

        let INIT_SHARE_PRICE = 100;

        // ---- 管理员配置 ----
        let ADMIN_CONFIG = {
            volatilityScale: 1.0,
            aMaxUp: 0.18,
            bMaxDown: -0.40,
            bMaxUp: 0.80,
            cMaxDown: -0.60,
            cMaxUp: 1.20,
            dMaxDown: -0.05,
            dMaxUp: 0.10,
            lotteryWinScale: 1.0,
            algoMode: '标准',
            aiStopLoss: 0.20,
            aiTakeProfit: 0.50,
            aiCashRatio: 0.15,
            darkHorseMultiplier: 2.0,
            darkHorseProb: 0.35,
            initSharePrice: 100,
            bankruptcyThreshold: 100, // v9.1
            bankruptcyFund: 1000 // v9.1
        };

        // ---- 成就（v9.1 移除 bankrupt 成就） ----
        const ACHIEVEMENT_DEFS = {
            first_invest: { id: 'first_invest', name: '首次投资', icon: '💎', desc: '完成第一次股票投资', defaultRewardRatio: 0.10 },
            invest_master: { id: 'invest_master', name: '投资达人', icon: '📊', desc: '累计投资金额达到 ¥10,000', defaultRewardRatio: 0.12 },
            stock_god: { id: 'stock_god', name: '股神', icon: '👑', desc: '单只股票持仓超过 ¥5,000', defaultRewardRatio: 0.15 },
            lottery_win: { id: 'lottery_win', name: '彩票幸运儿', icon: '🍀', desc: '中得彩票一次', defaultRewardRatio: 0.08 },
            lottery_scam: { id: 'lottery_scam', name: '彩票倒霉蛋', icon: '💔', desc: '遭遇彩票诈骗', defaultRewardRatio: 0.05 },
            millionaire: { id: 'millionaire', name: '百万富翁', icon: '💰', desc: '总资产超过 ¥100,000', defaultRewardRatio: 0.20 },
            // v9.1: 移除 bankrupt 成就
            trade_freak: { id: 'trade_freak', name: '交易狂', icon: '🔄', desc: '累计交易次数超过 20 次', defaultRewardRatio: 0.10 },
            steady_investor: { id: 'steady_investor', name: '稳健投资者', icon: '🛡️', desc: '只持有A股和D股，总资产>5,000',
                defaultRewardRatio: 0.10 },
            adventurer: { id: 'adventurer', name: '冒险家', icon: '🚀', desc: '持有C股超过 ¥3,000', defaultRewardRatio: 0.12 }
        };
        const ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENT_DEFS);
        let achievementRewardRatios = {};
        ACHIEVEMENT_IDS.forEach(id => {
            achievementRewardRatios[id] = ACHIEVEMENT_DEFS[id].defaultRewardRatio;
        });

        let CHART_TYPE = 'line';

        const LOTTERY_TYPES = [
            { name: '福彩快乐8', price: 200, winProb: 0.12, rewardRatio: 0.20, scamRate: 0.18, fineMin: 0.10,
                fineMax: 0.25 },
            { name: '体彩大乐透', price: 500, winProb: 0.06, rewardRatio: 0.25, scamRate: 0.14, fineMin: 0.12,
                fineMax: 0.30 },
            { name: '幸运刮刮乐', price: 100, winProb: 0.22, rewardRatio: 0.15, scamRate: 0.22, fineMin: 0.08,
                fineMax: 0.20 },
            { name: '超级百万', price: 1000, winProb: 0.025, rewardRatio: 0.30, scamRate: 0.10, fineMin: 0.15,
                fineMax: 0.35 },
            { name: '财富密码', price: 300, winProb: 0.09, rewardRatio: 0.18, scamRate: 0.16, fineMin: 0.10,
                fineMax: 0.22 }
        ];

        const SCAM_EVENTS = [
            '彩票中心被黑客攻击，所有资金被盗！',
            '彩票发行商跑路，您的投资血本无归！',
            '开奖结果被篡改，您的彩票无效！',
            '税务部门介入，彩票奖金被冻结并罚款！',
            '彩票系统故障，您的订单被判定为欺诈！',
            '监管机构查封彩票，投资者血本无归！'
        ];

        const RANDOM_EVENTS = [{
            id: 'policy',
            name: '政策利好',
            icon: '📈',
            type: 'positive',
            desc: '政府出台利好政策，{stock}全线上涨！',
            effect: (s) => ({ stock: s, multiplier: 1.28 })
        }, {
            id: 'blackswan',
            name: '黑天鹅',
            icon: '📉',
            type: 'negative',
            desc: '突发黑天鹅事件，{stock}大幅下跌！',
            effect: (s) => ({ stock: s, multiplier: 0.58 })
        }, {
            id: 'earnings',
            name: '财报超预期',
            icon: '💰',
            type: 'positive',
            desc: '{stock}财报超预期，股价暴涨！',
            effect: (s) => ({ stock: s, multiplier: 1.48 })
        }, {
            id: 'panic',
            name: '市场恐慌',
            icon: '😱',
            type: 'negative',
            desc: '恐慌情绪蔓延，所有股票普跌！',
            effect: () => ({ all: true, multiplier: 0.82 })
        }, {
            id: 'ratecut',
            name: '央行降息',
            icon: '🏦',
            type: 'positive',
            desc: '央行宣布降息，市场整体向好！',
            effect: () => ({ all: true, multiplier: 1.16 })
        }, {
            id: 'techboom',
            name: '科技繁荣',
            icon: '🚀',
            type: 'positive',
            desc: '科技板块迎来爆发，C股飙升！',
            effect: () => ({ stock: 'C', multiplier: 1.55 })
        }, {
            id: 'oilcrash',
            name: '油价暴跌',
            icon: '🛢️',
            type: 'positive',
            desc: '原油价格暴跌，航空、运输股受益！',
            effect: () => ({ all: true, multiplier: 1.08 })
        }, {
            id: 'regulation',
            name: '监管收紧',
            icon: '⚖️',
            type: 'negative',
            desc: '监管政策收紧，市场承压！',
            effect: () => ({ all: true, multiplier: 0.90 })
        }];

        const AI_STRATEGIES = ['稳健型', '平衡型', '进取型', '趋势跟随', '逆向投资', '价值发现'];

        let assetsChart = null;
        let stocksChart = null;

        // ---- AI 异步控制 ----
        let aiThinkTimer = null;
        let aiThinkStartTime = 0;
        let aiThinkPlayerId = null;
        let pendingAITimeout = null;

        // ---- 决策状态 ----
        let decisionState = 'idle';
        let decidingPlayerId = null;
        let playerDecisionStatus = {};

        // ---- 记录每轮事件用于收盘显示 ----
        let roundEvents = {};

        // ================================================================
