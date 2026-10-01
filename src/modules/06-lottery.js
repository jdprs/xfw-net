//  6. 彩票
        // ================================================================

        function initLotteries() {
            let winScale = ADMIN_CONFIG.lotteryWinScale || 1.0;
            lotteries = LOTTERY_TYPES.map((lt, idx) => ({
                id: idx,
                name: lt.name,
                price: lt.price,
                winProb: clamp(lt.winProb * winScale, 0.001, 0.99),
                rewardRatio: lt.rewardRatio,
                scamRate: lt.scamRate || 0.12,
                fineMin: lt.fineMin || 0.10,
                fineMax: lt.fineMax || 0.25,
                tickets: [],
                jackpot: 0
            }));
            lotteryJackpot = 0;
        }

        function buyLottery(playerId, lotteryId, quantity) {
            let p = players[playerId];
            if (p.bankrupt) return false;
            let lot = lotteries[lotteryId];
            let totalCost = lot.price * quantity;
            if (p.cash < totalCost) return false;
            p.cash -= totalCost;
            let jackpotContribution = Math.round(totalCost * 0.08);
            lot.jackpot = (lot.jackpot || 0) + jackpotContribution;
            lotteryJackpot += jackpotContribution;
            let numbers = [];
            for (let i = 0; i < quantity; i++) {
                let num = randInt(0, 999999);
                lot.tickets.push({ playerId, number: num });
                numbers.push(num);
            }
            addLog(`${p.name} 购买 ${quantity} 张 ${lot.name}，号码 ${numbers.join(', ')}`, 'profit');
            updatePlayersDisplay();
            updateAchievementStats(playerId, 'lottery', totalCost, 'lottery');
            return true;
        }

        function drawLotteries() {
            if (!roundEvents[round]) roundEvents[round] = { lotteryWins: [], lotteryScams: [], predictions: [] };

            lotteries.forEach(lot => {
                if (lot.tickets.length === 0) return;
                let scamTriggered = Math.random() < lot.scamRate;
                if (scamTriggered) {
                    let buyerMap = {};
                    lot.tickets.forEach(t => {
                        if (!buyerMap[t.playerId]) buyerMap[t.playerId] = 0;
                        buyerMap[t.playerId] += 1;
                    });
                    let scamDesc = SCAM_EVENTS[randInt(0, SCAM_EVENTS.length - 1)];
                    addLog(`⚠️ 【${lot.name}】${scamDesc}`, 'loss');
                    Object.keys(buyerMap).forEach(pid => {
                        let p = players[parseInt(pid)];
                        let count = buyerMap[pid];
                        let totalCost = lot.price * count;
                        let fineRatio = rand(lot.fineMin, lot.fineMax);
                        let fine = Math.round(p.cash * fineRatio);
                        fine = Math.max(100, fine);
                        if (p && !p.bankrupt) {
                            if (p.achievementStats) p.achievementStats.hasBeenScammed = true;
                            if (p.cash >= fine) {
                                p.cash -= fine;
                                bankAssets += fine;
                                addLog(`💀 ${p.name} 因彩票诈骗被罚款 ${fmt(fine)}`, 'loss');
                                showBanner(`${p.name} 因彩票诈骗被罚款 ${fmt(fine)}`, 'error', null, '💔 彩票诈骗');
                                roundEvents[round].lotteryScams.push(`${p.name} 被罚款 ${fmt(fine)}`);
                            } else {
                                let remaining = fine - p.cash;
                                p.cash = 0;
                                let totalAssets = p.totalAssets();
                                if (totalAssets > 0) {
                                    let ratio = remaining / totalAssets;
                                    ['A', 'B', 'C', 'D'].forEach(k => {
                                        let shares = p[`shares${k}`] || 0;
                                        if (shares > 0) {
                                            let reduce = Math.floor(shares * ratio);
                                            if (reduce > 0) {
                                                p[`shares${k}`] -= reduce;
                                                let price = stocks[k].price;
                                                bankAssets += reduce * price;
                                                remaining -= reduce * price;
                                            }
                                        }
                                    });
                                    if (remaining > 0) {
                                        p.bankrupt = true;
                                        p.cash = 0;
                                        ['A', 'B', 'C', 'D'].forEach(k => p[`shares${k}`] = 0);
                                        p.customStockInvestments = {};
                                        if (p.achievementStats) p.achievementStats.hasBankrupted = true;
                                        addLog(`💀 ${p.name} 因彩票诈骗破产！`, 'loss');
                                        showBanner(`${p.name} 因彩票诈骗破产！`, 'error', null, '💀 破产');
                                        roundEvents[round].lotteryScams.push(`${p.name} 破产`);
                                    } else {
                                        addLog(`💀 ${p.name} 变卖资产缴付彩票罚款 ${fmt(fine)}`, 'loss');
                                        showBanner(`${p.name} 变卖资产缴付彩票罚款 ${fmt(fine)}`, 'warning', null,
                                            '💔 罚款');
                                        roundEvents[round].lotteryScams.push(`${p.name} 变卖资产缴罚款`);
                                    }
                                } else {
                                    p.bankrupt = true;
                                    p.cash = 0;
                                    if (p.achievementStats) p.achievementStats.hasBankrupted = true;
                                    addLog(`💀 ${p.name} 因彩票诈骗破产！`, 'loss');
                                    showBanner(`${p.name} 因彩票诈骗破产！`, 'error', null, '💀 破产');
                                    roundEvents[round].lotteryScams.push(`${p.name} 破产`);
                                }
                            }
                        }
                    });
                    lot.tickets = [];
                    lot.jackpot = 0;
                    return;
                }
                let winners = [];
                lot.tickets.forEach(ticket => {
                    if (Math.random() < lot.winProb) {
                        winners.push(ticket);
                    }
                });
                if (winners.length > 0) {
                    let jackpotShare = lot.jackpot > 0 ? Math.round(lot.jackpot / winners.length) : 0;
                    let totalReward = 0;
                    winners.forEach(w => {
                        let p = players[w.playerId];
                        if (!p.bankrupt) {
                            let reward = Math.round(p.cash * lot.rewardRatio) + jackpotShare;
                            reward = Math.max(reward, 100);
                            p.cash += reward;
                            totalReward += reward;
                            if (p.achievementStats) p.achievementStats.hasWonLottery = true;
                            addLog(`🎉 彩票开奖：${lot.name}，${p.name} 的号码 ${w.number} 中得 ${fmt(reward)}！`,
                                'profit');
                            showBanner(`${p.name} 中得 ${lot.name} 奖金 ${fmt(reward)}！`, 'success', null,
                                '🍀 彩票中奖');
                            roundEvents[round].lotteryWins.push(`${p.name} 中奖 ${fmt(reward)}`);
                        }
                    });
                    bankAssets -= totalReward;
                    lot.jackpot = 0;
                } else {
                    if (lot.tickets.length > 0) {
                        addLog(`🎫 ${lot.name} 开奖，无人中奖 (奖池累积 ${fmt(lot.jackpot)})`, 'event');
                    }
                }
                lot.tickets = [];
            });
            bankAssets = Math.round(bankAssets);
            if (bankAssets < 0) bankAssets = 0;
            lotteryJackpot = 0;
        }

        // ================================================================
