// 等待HTML文档加载完毕
document.addEventListener('DOMContentLoaded', () => {

    // --- 获取页面元素 ---
    const basePriceEl = document.getElementById('basePrice');
    const sharesEl = document.getElementById('shares');
    const commissionRateEl = document.getElementById('commissionRate');
    const calcSellEl = document.getElementById('calcSell');
    const profitPercentEl = document.getElementById('profitPercent');
    const profitValueEl = document.getElementById('profitValue');
    const calculateBtn = document.getElementById('calculateBtn');
    const resultEl = document.getElementById('result');

    // 结果展示元素
    const targetPriceEl = document.getElementById('targetPrice');
    const netProfitEl = document.getElementById('netProfit');
    const totalCostEl = document.getElementById('totalCost');
    const buyCostEl = document.getElementById('buyCost');
    const sellCostEl = document.getElementById('sellCost');
    
    // --- 定义常量 ---
    const STAMP_DUTY_RATE = 0.0005; // 印花税率 0.05%
    const TRANSFER_FEE_RATE = 0.00001; // 沪市过户费率 0.001% (暂定所有股票都计算)
    const MIN_COMMISSION = 5; // 最低佣金

    // --- 事件监听 ---
    calculateBtn.addEventListener('click', () => {
        // 1. 获取并转换用户输入
        const basePrice = parseFloat(basePriceEl.value);
        const shares = parseInt(sharesEl.value, 10);
        const commissionRate = parseFloat(commissionRateEl.value) / 100; // 转换为小数
        const profitValue = parseFloat(profitValueEl.value);
        
        // 2. 检查输入是否有效
        if (isNaN(basePrice) || isNaN(shares) || isNaN(commissionRate) || isNaN(profitValue) || basePrice <= 0 || shares <= 0 || profitValue <= 0) {
            alert('请输入所有有效的数值！');
            return;
        }

        // 3. 判断计算类型并执行
        const tradeType = calcSellEl.checked ? 'sell' : 'buy';

        if (tradeType === 'sell') {
            calculateSellPrice(basePrice, shares, commissionRate, profitValue);
        } else {
            calculateBuyPrice(basePrice, shares, commissionRate, profitValue);
        }
    });

    /**
     * 计算佣金 (包含最低5元)
     * @param {number} amount - 成交金额
     * @param {number} rate - 佣金率
     * @returns {number} - 计算后的佣金
     */
    function getCommission(amount, rate) {
        const commission = amount * rate;
        return Math.max(commission, MIN_COMMISSION);
    }

    /**
     * 计算目标卖出价 (高抛)
     */
    function calculateSellPrice(buyPrice, shares, commissionRate, profitValue) {
        const isPercentMode = profitPercentEl.checked;
        const totalBuyValue = buyPrice * shares;

        // 计算买入成本
        const buyCommission = getCommission(totalBuyValue, commissionRate);
        const buyTransferFee = totalBuyValue * TRANSFER_FEE_RATE;
        const totalBuyCost = buyCommission + buyTransferFee;
        const actualBuyAmount = totalBuyValue + totalBuyCost;

        // 计算期望利润
        let targetProfit;
        if (isPercentMode) {
            // 百分比模式基于买入总金额计算
            targetProfit = actualBuyAmount * (profitValue / 100);
        } else {
            // 固定金额模式
            targetProfit = profitValue;
        }

        // 核心公式：推导目标卖出价
        // 设目标卖出价为 P_sell
        // 卖出总额 = P_sell * shares
        // 卖出成本 = Commission + StampDuty + TransferFee
        //            = max(5, P_sell*shares*rate) + P_sell*shares*0.0005 + P_sell*shares*0.00001
        // 净利润 = (卖出总额 - 卖出成本) - (买入总额 + 买入成本)
        // targetProfit = P_sell*shares - (sellCosts) - actualBuyAmount
        // 为了简化，我们先假设佣金不是按最低5元收取进行推导，最后再验证
        // P_sell * shares - P_sell * shares * (commissionRate + STAMP_DUTY_RATE + TRANSFER_FEE_RATE) = actualBuyAmount + targetProfit
        // P_sell * shares * (1 - commissionRate - STAMP_DUTY_RATE - TRANSFER_FEE_RATE) = actualBuyAmount + targetProfit
        // P_sell = (actualBuyAmount + targetProfit) / (shares * (1 - commissionRate - STAMP_DUTY_RATE - TRANSFER_FEE_RATE))
        
        const costRateSum = commissionRate + STAMP_DUTY_RATE + TRANSFER_FEE_RATE;
        let targetSellPrice = (actualBuyAmount + targetProfit) / (shares * (1 - costRateSum));
        
        // 验证卖出佣金是否低于5元，并修正
        let sellCommission = targetSellPrice * shares * commissionRate;
        if (sellCommission < MIN_COMMISSION) {
             // 如果低于5元，则佣金按5元计算，重新推导价格
             targetSellPrice = (actualBuyAmount + targetProfit + MIN_COMMISSION) / (shares * (1 - STAMP_DUTY_RATE - TRANSFER_FEE_RATE));
        }

        // 更新最终的卖出成本和利润用于展示
        const finalSellValue = targetSellPrice * shares;
        const finalSellCommission = getCommission(finalSellValue, commissionRate);
        const finalSellStampDuty = finalSellValue * STAMP_DUTY_RATE;
        const finalSellTransferFee = finalSellValue * TRANSFER_FEE_RATE;
        const totalSellCost = finalSellCommission + finalSellStampDuty + finalSellTransferFee;
        const netProfit = finalSellValue - actualBuyAmount - totalSellCost;

        // 展示结果
        displayResults({
            targetPrice: targetSellPrice.toFixed(3),
            netProfit: netProfit.toFixed(2),
            totalCost: (totalBuyCost + totalSellCost).toFixed(2),
            buyCost: totalBuyCost.toFixed(2),
            sellCost: totalSellCost.toFixed(2)
        });
    }

    /**
     * 计算目标买入价 (低吸)
     */
    function calculateBuyPrice(sellPrice, shares, commissionRate, profitValue) {
        const isPercentMode = profitPercentEl.checked;
        const totalSellValue = sellPrice * shares;

        // 计算卖出净收入
        const sellCommission = getCommission(totalSellValue, commissionRate);
        const sellStampDuty = totalSellValue * STAMP_DUTY_RATE;
        const sellTransferFee = totalSellValue * TRANSFER_FEE_RATE;
        const totalSellCost = sellCommission + sellStampDuty + sellTransferFee;
        const actualSellRevenue = totalSellValue - totalSellCost;

        // 计算期望利润
        let targetProfit;
        if (isPercentMode) {
            // 百分比模式基于卖出净收入计算
            targetProfit = actualSellRevenue * (profitValue / 100);
        } else {
            // 固定金额模式
            targetProfit = profitValue;
        }

        // 核心公式：推导目标买入价
        // 设目标买入价为 P_buy
        // 目标买入总成本 = actualSellRevenue - targetProfit
        // 买入总额 = P_buy * shares
        // 买入成本 = Commission + TransferFee
        //            = max(5, P_buy*shares*rate) + P_buy*shares*0.00001
        // P_buy * shares * (1 + commissionRate + TRANSFER_FEE_RATE) = actualSellRevenue - targetProfit
        // P_buy = (actualSellRevenue - targetProfit) / (shares * (1 + commissionRate + TRANSFER_FEE_RATE))

        const costRateSum = commissionRate + TRANSFER_FEE_RATE;
        let targetBuyPrice = (actualSellRevenue - targetProfit) / (shares * (1 + costRateSum));

        // 验证买入佣金是否低于5元，并修正
        let buyCommission = targetBuyPrice * shares * commissionRate;
        if (buyCommission < MIN_COMMISSION) {
            targetBuyPrice = (actualSellRevenue - targetProfit - MIN_COMMISSION) / (shares * (1 + TRANSFER_FEE_RATE));
        }

        // 更新最终的买入成本和利润用于展示
        const finalBuyValue = targetBuyPrice * shares;
        const finalBuyCommission = getCommission(finalBuyValue, commissionRate);
        const finalBuyTransferFee = finalBuyValue * TRANSFER_FEE_RATE;
        const totalBuyCost = finalBuyCommission + finalBuyTransferFee;
        const netProfit = actualSellRevenue - finalBuyValue - totalBuyCost;
        
        // 展示结果
        displayResults({
            targetPrice: targetBuyPrice.toFixed(3),
            netProfit: netProfit.toFixed(2),
            totalCost: (totalBuyCost + totalSellCost).toFixed(2),
            buyCost: totalBuyCost.toFixed(2),
            sellCost: totalSellCost.toFixed(2)
        });
    }

    /**
     * 在页面上展示结果
     * @param {object} data - 结果数据
     */
    function displayResults(data) {
        targetPriceEl.textContent = data.targetPrice;
        netProfitEl.textContent = data.netProfit;
        totalCostEl.textContent = data.totalCost;
        buyCostEl.textContent = `¥ ${data.buyCost}`;
        sellCostEl.textContent = `¥ ${data.sellCost}`;
        resultEl.classList.remove('hidden');
    }
});