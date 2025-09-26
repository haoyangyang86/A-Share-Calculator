// A股高抛低吸计算器 - 基于ES6+特性重构

/**
 * 防抖函数 - 用于性能优化
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间(毫秒)
 * @returns {Function} - 返回防抖处理后的函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

class StockCalculator {
    constructor() {
        // --- 常量定义 ---
        this.STAMP_DUTY_RATE = 0.0005; // 印花税率 0.05%
        this.TRANSFER_FEE_RATE = 0.00001; // 沪市过户费率 0.001%
        this.MIN_COMMISSION = 5; // 最低佣金
        this.HISTORY_KEY = 'stockCalculatorHistory';
        
        // --- 获取页面元素 ---
        this.elements = {
            // 基础输入元素
            shares: document.getElementById('shares'),
            commissionRate: document.getElementById('commissionRate'),
            calculateBtn: document.getElementById('calculateBtn'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn'),
            result: document.getElementById('result'),
            history: document.getElementById('history'),
            historyList: document.getElementById('historyList'),
            // 原有模式输入元素
            basePrice: document.getElementById('basePrice'),
            profitValue: document.getElementById('profitValue'),
            calcSell: document.getElementById('calcSell'),
            calcBuy: document.getElementById('calcBuy'),
            profitPercent: document.getElementById('profitPercent'),
            profitFixed: document.getElementById('profitFixed'),
            // 模式二输入元素
            buyPrice: document.getElementById('buyPrice'),
            sellPrice: document.getElementById('sellPrice'),
            calcProfit: document.getElementById('calcProfit'),
            calcProfitRate: document.getElementById('calcProfitRate'),
            // 模式选择元素
            useMode1: document.getElementById('useMode1'),
            useMode2: document.getElementById('useMode2'),
            // 结果展示元素
            resultTypeLabel: document.getElementById('resultTypeLabel'),
            resultValue: document.getElementById('resultValue'),
            resultUnit: document.getElementById('resultUnit'),
            totalCost: document.getElementById('totalCost'),
            buyCost: document.getElementById('buyCost'),
            sellCost: document.getElementById('sellCost'),
            // 新模式结果显示元素
            mode1Result: document.getElementById('mode1Result'),
            mode2Result: document.getElementById('mode2Result'),
            resultTypeLabel2: document.getElementById('resultTypeLabel2'),
            resultValue2: document.getElementById('resultValue2'),
            resultUnit2: document.getElementById('resultUnit2'),
            netProfit: document.getElementById('netProfit'),
            profitRate: document.getElementById('profitRate'),
            buyPriceDisplay: document.getElementById('buyPriceDisplay'),
            sellPriceDisplay: document.getElementById('sellPriceDisplay'),
            sharesDisplay: document.getElementById('sharesDisplay'),
            // 模式2中新增的利润和利润率显示元素
            mode2NetProfit: document.getElementById('mode2NetProfit'),
            mode2ProfitRate: document.getElementById('mode2ProfitRate')
        };
        
        // --- 初始化事件监听 ---
        this.initEventListeners();
        
        // --- 加载历史记录 ---
        this.loadHistory();
    }
    
    // 初始化事件监听
    initEventListeners() {
        // 计算按钮点击事件
        this.elements.calculateBtn.addEventListener('click', () => this.handleCalculate());
        
        // 清空历史记录按钮点击事件
        this.elements.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        
        // 添加键盘快捷键支持
        document.addEventListener('keydown', (e) => {
            // Enter键触发计算
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleCalculate();
            }
        });
        
        // 添加输入即时验证（使用防抖优化）
        const debouncedValidateInput = debounce((inputEl) => {
            this.validateInput(inputEl);
        }, 300);
        
        Object.values(this.elements).forEach(el => {
            if (el && el.nodeName === 'INPUT' && el.type === 'number') {
                el.addEventListener('input', (e) => debouncedValidateInput(e.target));
            }
        });
    }
    
    // 输入验证
    validateInput(inputEl) {
        // 获取缓存的验证状态，避免不必要的DOM操作
        if (inputEl.dataset.lastValue === inputEl.value) {
            return;
        }
        
        const value = parseFloat(inputEl.value);
        const minValue = parseFloat(inputEl.min) || 0;
        
        if (!isNaN(value) && value <= minValue) {
            // 使用requestAnimationFrame批量处理DOM操作
            requestAnimationFrame(() => {
                inputEl.classList.add('input-error');
            });
        } else {
            // 使用requestAnimationFrame批量处理DOM操作
            requestAnimationFrame(() => {
                inputEl.classList.remove('input-error');
            });
        }
        
        // 缓存当前值
        inputEl.dataset.lastValue = inputEl.value;
    }
    
    // 处理计算逻辑
    handleCalculate() {
        // 获取并转换用户输入
        const shares = parseInt(this.elements.shares.value, 10);
        const commissionRate = parseFloat(this.elements.commissionRate.value) / 100; // 转换为小数
        
        // 检查共用输入是否有效
        if (isNaN(shares) || isNaN(commissionRate) || shares <= 0) {
            this.showNotification('请输入有效的股数和佣金率！', 'error');
            return;
        }
        
        // 尝试获取两头价格计算模式的输入
        const buyPrice = parseFloat(this.elements.buyPrice.value);
        const sellPrice = parseFloat(this.elements.sellPrice.value);
        
        // 尝试获取原有模式的输入
        const basePrice = parseFloat(this.elements.basePrice.value);
        const profitValue = parseFloat(this.elements.profitValue.value);
        
        // 检查两个模式是否都有输入
        const hasMode1Input = !isNaN(basePrice) && !isNaN(profitValue) && basePrice > 0 && profitValue > 0;
        const hasMode2Input = !isNaN(buyPrice) && !isNaN(sellPrice) && buyPrice > 0 && sellPrice > 0;
        
        // 决定使用哪种计算模式
        // 优先检查是否选中了特定模式的单选按钮
        if (this.elements.useMode1 && this.elements.useMode1.checked && hasMode1Input) {
            // 用户明确选择了模式1
            if (this.elements.calcSell.checked) {
                this.calculateSellPrice(basePrice, shares, commissionRate, profitValue);
            } else {
                this.calculateBuyPrice(basePrice, shares, commissionRate, profitValue);
            }
        } else if (this.elements.useMode2 && this.elements.useMode2.checked && hasMode2Input) {
            // 用户明确选择了模式2
            this.calculateProfitAndCost(buyPrice, sellPrice, shares, commissionRate);
        } else if (hasMode2Input && !hasMode1Input) {
            // 只有模式2有输入
            this.calculateProfitAndCost(buyPrice, sellPrice, shares, commissionRate);
        } else if (hasMode1Input && !hasMode2Input) {
            // 只有模式1有输入
            if (this.elements.calcSell.checked) {
                this.calculateSellPrice(basePrice, shares, commissionRate, profitValue);
            } else {
                this.calculateBuyPrice(basePrice, shares, commissionRate, profitValue);
            }
        } else if (hasMode1Input && hasMode2Input) {
            // 两个模式都有输入，但没有明确选择
            this.showNotification('请选择要使用的计算模式！', 'error');
        } else {
            // 显示输入错误提示
            this.showNotification('请输入完整的计算参数！', 'error');
        }
    }
    
    // 计算两头价格的利润和交易费用
    calculateProfitAndCost(buyPrice, sellPrice, shares, commissionRate) {
        // 计算买入和卖出金额
        const buyAmount = buyPrice * shares;
        const sellAmount = sellPrice * shares;
        
        // 计算买入费用
        const buyCommission = this.getCommission(buyAmount, commissionRate);
        const buyTransferFee = buyAmount * this.TRANSFER_FEE_RATE;
        const totalBuyCost = buyCommission + buyTransferFee;
        const actualBuyAmount = buyAmount + totalBuyCost;
        
        // 计算卖出费用
        const sellCommission = this.getCommission(sellAmount, commissionRate);
        const sellStampDuty = sellAmount * this.STAMP_DUTY_RATE;
        const sellTransferFee = sellAmount * this.TRANSFER_FEE_RATE;
        const totalSellCost = sellCommission + sellStampDuty + sellTransferFee;
        const actualSellRevenue = sellAmount - totalSellCost;
        
        // 计算净利润
        const netProfit = actualSellRevenue - actualBuyAmount;
        
        // 计算利润率（基于股票的实际成本：买入价 * 股数）
        const stockCost = buyPrice * shares;
        const profitRate = (netProfit / stockCost) * 100;
        
        // 判断计算类型
        const calcType = this.elements.calcProfit.checked ? 'profit' : 'profitRate';
        
        // 展示结果
        this.displayResults({
            profit: netProfit,
            profitRate: profitRate,
            calcType: calcType,
            totalCost: totalBuyCost + totalSellCost,
            buyCost: totalBuyCost,
            sellCost: totalSellCost,
            buyPrice: buyPrice,
            sellPrice: sellPrice,
            shares: shares,
            timestamp: new Date().toISOString()
        });
    }
    
    // 计算佣金 (包含最低5元)
    getCommission(amount, rate) {
        const commission = amount * rate;
        return Math.max(commission, this.MIN_COMMISSION);
    }
    
    // 计算目标卖出价 (高抛)
    calculateSellPrice(buyPrice, shares, commissionRate, profitValue) {
        const isPercentMode = this.elements.profitPercent.checked;
        const totalBuyValue = buyPrice * shares;

        // 计算买入成本
        const buyCommission = this.getCommission(totalBuyValue, commissionRate);
        const buyTransferFee = totalBuyValue * this.TRANSFER_FEE_RATE;
        const totalBuyCost = buyCommission + buyTransferFee;
        const actualBuyAmount = totalBuyValue + totalBuyCost;

        // 计算期望利润
        const targetProfit = isPercentMode 
            ? actualBuyAmount * (profitValue / 100) // 百分比模式
            : profitValue; // 固定金额模式

        // 核心公式：推导目标卖出价
        const costRateSum = commissionRate + this.STAMP_DUTY_RATE + this.TRANSFER_FEE_RATE;
        let targetSellPrice = (actualBuyAmount + targetProfit) / (shares * (1 - costRateSum));
        
        // 验证卖出佣金是否低于最低值，并修正
        const sellCommission = targetSellPrice * shares * commissionRate;
        if (sellCommission < this.MIN_COMMISSION) {
             targetSellPrice = (actualBuyAmount + targetProfit + this.MIN_COMMISSION) / (shares * (1 - this.STAMP_DUTY_RATE - this.TRANSFER_FEE_RATE));
        }

        // 更新最终的卖出成本和利润用于展示
        const finalSellValue = targetSellPrice * shares;
        const finalSellCommission = this.getCommission(finalSellValue, commissionRate);
        const finalSellStampDuty = finalSellValue * this.STAMP_DUTY_RATE;
        const finalSellTransferFee = finalSellValue * this.TRANSFER_FEE_RATE;
        const totalSellCost = finalSellCommission + finalSellStampDuty + finalSellTransferFee;
        const netProfit = finalSellValue - actualBuyAmount - totalSellCost;

        // 展示结果
        this.displayResults({
            targetPrice: targetSellPrice.toFixed(3),
            netProfit: netProfit.toFixed(2),
            totalCost: (totalBuyCost + totalSellCost).toFixed(2),
            buyCost: totalBuyCost.toFixed(2),
            sellCost: totalSellCost.toFixed(2),
            type: 'sell',
            basePrice: buyPrice.toFixed(3),
            shares: shares,
            profitValue: profitValue,
            profitMode: isPercentMode ? 'percent' : 'fixed',
            timestamp: new Date().toISOString()
        });
    }
    
    // 计算目标买入价 (低吸)
    calculateBuyPrice(sellPrice, shares, commissionRate, profitValue) {
        const isPercentMode = this.elements.profitPercent.checked;
        const totalSellValue = sellPrice * shares;

        // 计算卖出净收入
        const sellCommission = this.getCommission(totalSellValue, commissionRate);
        const sellStampDuty = totalSellValue * this.STAMP_DUTY_RATE;
        const sellTransferFee = totalSellValue * this.TRANSFER_FEE_RATE;
        const totalSellCost = sellCommission + sellStampDuty + sellTransferFee;
        const actualSellRevenue = totalSellValue - totalSellCost;

        // 计算期望利润
        const targetProfit = isPercentMode 
            ? actualSellRevenue * (profitValue / 100) // 百分比模式
            : profitValue; // 固定金额模式

        // 核心公式：推导目标买入价
        const costRateSum = commissionRate + this.TRANSFER_FEE_RATE;
        let targetBuyPrice = (actualSellRevenue - targetProfit) / (shares * (1 + costRateSum));

        // 验证买入佣金是否低于最低值，并修正
        const buyCommission = targetBuyPrice * shares * commissionRate;
        if (buyCommission < this.MIN_COMMISSION) {
            targetBuyPrice = (actualSellRevenue - targetProfit - this.MIN_COMMISSION) / (shares * (1 + this.TRANSFER_FEE_RATE));
        }

        // 更新最终的买入成本和利润用于展示
        const finalBuyValue = targetBuyPrice * shares;
        const finalBuyCommission = this.getCommission(finalBuyValue, commissionRate);
        const finalBuyTransferFee = finalBuyValue * this.TRANSFER_FEE_RATE;
        const totalBuyCost = finalBuyCommission + finalBuyTransferFee;
        const netProfit = actualSellRevenue - finalBuyValue - totalBuyCost;
        
        // 展示结果
        this.displayResults({
            targetPrice: targetBuyPrice.toFixed(3),
            netProfit: netProfit.toFixed(2),
            totalCost: (totalBuyCost + totalSellCost).toFixed(2),
            buyCost: totalBuyCost.toFixed(2),
            sellCost: totalSellCost.toFixed(2),
            type: 'buy',
            basePrice: sellPrice.toFixed(3),
            shares: shares,
            profitValue: profitValue,
            profitMode: isPercentMode ? 'percent' : 'fixed',
            timestamp: new Date().toISOString()
        });
    }
    
    // 在页面上展示结果
    displayResults(data) {
        // 批量更新DOM元素以提高性能
        requestAnimationFrame(() => {
            // 显示结果和历史记录区域
            this.elements.result.classList.remove('hidden');
            this.elements.history.classList.remove('hidden');
            
            // 判断是哪种计算模式
            if (data.calcType) {
                // 两头价格计算模式
                // 显示模式二结果区域，隐藏模式一
                this.elements.mode1Result.classList.add('hidden');
                this.elements.mode2Result.classList.remove('hidden');
                
                // 设置计算类型和结果
                if (data.calcType === 'profit') {
                    this.elements.resultTypeLabel2.textContent = '利润';
                    this.elements.resultValue2.textContent = data.profit.toFixed(2);
                    this.elements.resultUnit2.textContent = '元';
                } else {
                    this.elements.resultTypeLabel2.textContent = '利润率';
                    this.elements.resultValue2.textContent = data.profitRate.toFixed(2);
                    this.elements.resultUnit2.textContent = '%';
                }
                
                // 在模式2中同时显示利润和利润率
                this.elements.mode2NetProfit.textContent = data.profit.toFixed(2);
                this.elements.mode2ProfitRate.textContent = data.profitRate.toFixed(2);
                
                // 显示交易信息
                this.elements.buyPriceDisplay.textContent = parseFloat(data.buyPrice).toFixed(3);
                this.elements.sellPriceDisplay.textContent = parseFloat(data.sellPrice).toFixed(3);
                this.elements.sharesDisplay.textContent = data.shares;
            } else {
                // 原有模式（高抛低吸）
                // 显示模式一结果区域，隐藏模式二
                this.elements.mode2Result.classList.add('hidden');
                this.elements.mode1Result.classList.remove('hidden');
                
                // 设置计算类型和目标价格
                if (data.type === 'sell') {
                    this.elements.resultTypeLabel.textContent = '目标卖出价';
                } else {
                    this.elements.resultTypeLabel.textContent = '目标买入价';
                }
                
                // 更新价格和单位显示
                this.elements.resultValue.textContent = data.targetPrice;
                this.elements.resultUnit.textContent = '元';
                
                // 显示利润信息
                // 注意：在原有模式中，netProfit和totalCost已经是字符串类型
                const netProfit = parseFloat(data.netProfit);
                this.elements.netProfit.textContent = netProfit.toFixed(2);
                
                // 修复模式1的利润率计算
                // 如果是百分比模式，直接使用用户输入的利润率
                // 否则，计算实际利润率（利润除以股票实际成本）
                if (data.profitMode === 'percent') {
                    // 百分比模式：显示用户设置的利润率
                    this.elements.profitRate.textContent = data.profitValue.toFixed(2);
                } else {
                    // 固定金额模式：计算实际利润率
                    // 计算股票的实际成本（基准价 * 股数）
                    const stockCost = parseFloat(data.basePrice) * data.shares;
                    this.elements.profitRate.textContent = ((netProfit / stockCost) * 100).toFixed(2);
                }
            }
            
            // 更新通用交易费用信息
            // 注意：在模式1中，费用数据已经是字符串类型
            if (data.calcType) {
                // 模式2：费用数据是数字类型
                this.elements.totalCost.textContent = data.totalCost.toFixed(2);
                this.elements.buyCost.textContent = `¥ ${data.buyCost.toFixed(2)}`;
                this.elements.sellCost.textContent = `¥ ${data.sellCost.toFixed(2)}`;
            } else {
                // 模式1：费用数据已经是字符串类型
                this.elements.totalCost.textContent = data.totalCost;
                this.elements.buyCost.textContent = data.buyCost;
                this.elements.sellCost.textContent = data.sellCost;
            }
        });
        
        // 保存到历史记录
        this.saveToHistory(data);
        
        // 显示通知
        this.showNotification('计算完成！', 'success');
    }
    
    // 历史记录相关方法    
    // 保存到历史记录
    saveToHistory(resultData) {
        try {
            // 获取现有历史记录
            let history = this.getHistory();
            
            // 添加新记录到开头
            history.unshift(resultData);
            
            // 限制历史记录数量为20条
            if (history.length > 20) {
                history = history.slice(0, 20);
            }
            
            // 保存到localStorage
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
            
            // 更新历史记录显示
            this.renderHistoryList(history);
        } catch (error) {
            console.error('保存历史记录失败:', error);
        }
    }
    
    // 获取历史记录
    getHistory() {
        try {
            const historyStr = localStorage.getItem(this.HISTORY_KEY);
            return historyStr ? JSON.parse(historyStr) : [];
        } catch (error) {
            console.error('获取历史记录失败:', error);
            return [];
        }
    }
    
    // 加载历史记录
    loadHistory() {
        const history = this.getHistory();
        if (history.length > 0) {
            this.elements.history.classList.remove('hidden');
            this.renderHistoryList(history);
        }
    }
    
    // 渲染历史记录列表
    renderHistoryList(history) {
        this.elements.historyList.innerHTML = '';
        
        history.forEach((record, index) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            // 格式化时间
            const date = new Date(record.timestamp);
            const formattedTime = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            
            let historyItemContent = '';
            
            // 判断是哪种计算模式
            if (record.calcType) {
                // 两头价格计算模式
                const calcTypeText = record.calcType === 'profit' ? '计算利润' : '计算利润率';
                
                historyItemContent = `
                    <div class="history-item-header">
                        ${formattedTime} · ${calcTypeText}
                    </div>
                    <div class="history-item-details">
                        <span>买入价: ${record.buyPrice}元</span>
                        <span>卖出价: ${record.sellPrice}元</span>
                    </div>
                    <div class="history-item-details">
                        <span>股数: ${record.shares}股</span>
                        <span>总费用: ¥${record.totalCost.toFixed(2)}</span>
                    </div>
                    <div class="history-item-details">
                        <span>净利润: ¥${record.profit.toFixed(2)}</span>
                        <span>利润率: ${record.profitRate.toFixed(2)}%</span>
                    </div>
                `;
            } else {
                // 原有模式（高抛低吸）
                const tradeTypeText = record.type === 'sell' ? '高抛卖出' : '低吸买入';
                const profitModeText = record.profitMode === 'percent' ? `${record.profitValue}%` : `¥${record.profitValue}`;
                
                historyItemContent = `
                    <div class="history-item-header">
                        ${formattedTime} · ${tradeTypeText}
                    </div>
                    <div class="history-item-details">
                        <span>基准价: ${record.basePrice}元 × ${record.shares}股</span>
                        <span>目标: ${record.targetPrice}元</span>
                    </div>
                    <div class="history-item-details">
                        <span>利润: ${profitModeText}</span>
                        <span>净利润: ¥${record.netProfit}</span>
                    </div>
                    <div class="history-item-details">
                        <span>总费用: ¥${record.totalCost}</span>
                    </div>
                `;
            }
            
            // 设置项目内容
            item.innerHTML = historyItemContent;
            
            // 添加点击事件 - 重新填充表单
            item.addEventListener('click', () => this.loadRecordToForm(record));
            
            this.elements.historyList.appendChild(item);
        });
    }
    
    // 从历史记录加载数据到表单
    loadRecordToForm(record) {
        // 填充共享的字段
        this.elements.shares.value = record.shares;
        
        // 判断是哪种计算模式
        if (record.calcType) {
            // 两头价格计算模式
            this.elements.buyPrice.value = record.buyPrice;
            this.elements.sellPrice.value = record.sellPrice;
            
            // 选择计算类型
            if (record.calcType === 'profit') {
                this.elements.calcProfit.checked = true;
            } else {
                this.elements.calcProfitRate.checked = true;
            }
        } else {
            // 原有模式（高抛低吸）
            this.elements.basePrice.value = record.basePrice;
            this.elements.profitValue.value = record.profitValue;
            
            // 选择交易类型
            if (record.type === 'sell') {
                this.elements.calcSell.checked = true;
            } else {
                this.elements.calcBuy.checked = true;
            }
            
            // 选择利润模式
            if (record.profitMode === 'percent') {
                this.elements.profitPercent.checked = true;
            } else {
                this.elements.profitFixed.checked = true;
            }
        }
        
        // 显示提示
        this.showNotification('已从历史记录加载数据');
    }
    
    // 清空历史记录
    clearHistory() {
        if (confirm('确定要清空所有历史记录吗？')) {
            try {
                localStorage.removeItem(this.HISTORY_KEY);
                this.elements.historyList.innerHTML = '';
                this.elements.history.classList.add('hidden');
                this.showNotification('历史记录已清空！', 'success');
            } catch (error) {
                console.error('清空历史记录失败:', error);
                this.showNotification('清空失败，请重试！', 'error');
            }
        }
    }
    
    // 显示通知
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 显示通知
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // 3秒后自动消失
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// 初始化计算器
document.addEventListener('DOMContentLoaded', () => {
    const calculator = new StockCalculator();
});