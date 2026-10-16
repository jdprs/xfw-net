//  5. 股票算法（含黑马股）
        // ================================================================

        function calcStockMultiplier(stockKey, isCustom = false, darkHorseMult = 1) {
            let s = isCustom ? null : stocks[stockKey];
            let volScale = ADMIN_CONFIG.volatilityScale || 1.0;
            let mode = ADMIN_CONFIG.algoMode || '标准';

            if (!isCustom) {
                let trend = s.trend || 0;
                let histLen = s.history ? s.history.length : 0;
                let realizedVol = 0;
                if (histLen > 2) {
                    let recent = s.history.slice(-6);
                    let sumSq = recent.reduce((acc, h) => acc + Math.pow((h.multiplier || h) - 1, 2), 0);
                    realizedVol = Math.sqrt(sumSq / Math.max(recent.length, 1));
                }
                let garchVol = 0.08 + 0.5 * realizedVol + 0.3 * Math.abs(trend);
                let modeMult = 1.0;
                if (mode === '平稳') modeMult = 0.55;
                else if (mode === '剧烈') modeMult = 1.6;
                garchVol *= modeMult * volScale;
                let flowImpact = 0;
                if (s.netFlow !== undefined && s.value > 0) {
                    flowImpact = 0.018 * Math.tanh(s.netFlow / Math.max(s.value, 1000) * 5);
                }
                let meanRevStrength = 0.08 + 0.12 * Math.min(Math.abs(trend) * 5, 0.5);
                let meanReversion = -meanRevStrength * trend;
                let momentumBoost = trend * 0.35 * Math.exp(-Math.abs(trend) * 4);
                let skew = trend < -0.02 ? 1.3 : trend > 0.02 ? 0.85 : 1.0;
                let shock = rand(-garchVol * skew, garchVol);
                let raw = 1 + trend + meanReversion + momentumBoost + flowImpact + shock;
                let capped = clamp(raw, 1 + s.maxDown, 1 + s.maxUp);
                if (stockKey === 'A') capped = Math.max(1, capped);

                if (darkHorseMult > 1) {
                    let base = capped - 1;
                    capped = 1 + base * darkHorseMult;
                    capped = clamp(capped, 1 + s.maxDown * darkHorseMult, 1 + s.maxUp * darkHorseMult);
                    if (stockKey === 'A') capped = Math.max(1, capped);
                }

                s.trend = 0.6 * s.trend + 0.4 * (capped - 1);
                s.netFlow = 0;
                return capped;
            } else {
                // 自建股与普通股共用算法：趋势/均值回归/GARCH波动/资金流/涨跌停
                // 基础波动率由创办者设定的波动系数决定，drift 为长期漂移
                let cs = stockKey;
                // 旧存档字段容错
                if (cs.volatility === undefined) cs.volatility = 0.12;
                if (cs.maxDown === undefined) cs.maxDown = Math.abs(cs.downRatio || 0.2);
                if (cs.drift === undefined) cs.drift = 0;
                if (cs.netFlow === undefined) cs.netFlow = 0;
                let histLen = cs.history ? cs.history.length : 0;
                let realizedVol = 0;
                if (histLen > 2) {
                    let recent = cs.history.slice(-6);
                    let sumSq = recent.reduce((acc, h) => acc + Math.pow((h.multiplier || h) - 1, 2), 0);
                    realizedVol = Math.sqrt(sumSq / Math.max(recent.length, 1));
                }
                let garchVol = cs.volatility * 0.6 + 0.5 * realizedVol + 0.3 * Math.abs(cs.trend || 0);
                let modeMult = 1.0;
                if (mode === '平稳') modeMult = 0.55;
                else if (mode === '剧烈') modeMult = 1.6;
                garchVol *= modeMult * volScale;
                let flowImpact = 0;
                if (cs.netFlow !== undefined && cs.value > 0) {
                    flowImpact = 0.018 * Math.tanh(cs.netFlow / Math.max(cs.value, 1000) * 5);
                }
                let csTrend = cs.trend || 0;
                let meanRevStrength = 0.08 + 0.12 * Math.min(Math.abs(csTrend) * 5, 0.5);
                let meanReversion = -meanRevStrength * csTrend;
                let momentumBoost = csTrend * 0.35 * Math.exp(-Math.abs(csTrend) * 4);
                let skew = csTrend < -0.02 ? 1.3 : csTrend > 0.02 ? 0.85 : 1.0;
                let shock = rand(-garchVol * skew, garchVol);
                let drift = cs.drift || 0;
                let raw = 1 + drift + csTrend + meanReversion + momentumBoost + flowImpact + shock;
                let result = clamp(raw, 1 - cs.maxDown, 1 + cs.maxUp);
                if (darkHorseMult > 1) {
                    let base = result - 1;
                    result = 1 + base * darkHorseMult;
                    result = clamp(result, 1 - cs.maxDown * darkHorseMult, 1 + cs.maxUp * darkHorseMult);
                }
                cs.trend = 0.6 * csTrend + 0.4 * (result - 1);
                return result;
            }
        }

        function calcAllMultipliers(eventMult, darkHorseInfo) {
            eventMult = eventMult || { A: 1, B: 1, C: 1, D: 1 };
            let mults = {};

            let darkHorseKey = null;
            let darkHorseMult = 1;
            if (darkHorseInfo && darkHorseInfo.active) {
                darkHorseKey = darkHorseInfo.key;
                darkHorseMult = darkHorseInfo.multiplier || DARK_HORSE_MULTIPLIER;
            }

            Object.keys(stocks).forEach(k => {
                let isDark = (darkHorseKey === k);
                let dhMult = isDark ? darkHorseMult : 1;
                let base = calcStockMultiplier(k, false, dhMult);
                let combined = base * (eventMult[k] || 1);
                if (k === 'A') combined = Math.max(1, combined);
                mults[k] = combined;
                stocks[k].recentMultiplier = combined;
                stocks[k].price = Math.round(stocks[k].price * combined);
                if (stocks[k].price < 1) stocks[k].price = 1;
            });

            customStocks.forEach((cs, idx) => {
                let isDark = (darkHorseKey === `custom_${idx}`);
                let dhMult = isDark ? darkHorseMult : 1;
                let mult = calcStockMultiplier(cs, true, dhMult);
                mult = mult * (eventMult[`custom_${idx}`] || 1);
                cs.recentMultiplier = mult;
                mults[`custom_${idx}`] = mult;
            });

            return mults;
        }

        // ================================================================
