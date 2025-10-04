// 股票交易利润计算器

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
            // 交易输入元素
            buyPrice: document.getElementById('buyPrice'),
            sellPrice: document.getElementById('sellPrice'),
            tradeDirection1: document.getElementById('tradeDirection1'),
            tradeDirection2: document.getElementById('tradeDirection2'),
            // 成本更新输入元素
            currentCost: document.getElementById('currentCost'),
            currentShares: document.getElementById('currentShares'),
            enableCostUpdate: document.getElementById('enableCostUpdate'),
            // 结果展示元素
            totalCost: document.getElementById('totalCost'),
            buyCost: document.getElementById('buyCost'),
            sellCost: document.getElementById('sellCost'),
            netProfit: document.getElementById('netProfit'),
            profitRate: document.getElementById('profitRate'),
            buyPriceDisplay: document.getElementById('buyPriceDisplay'),
            sellPriceDisplay: document.getElementById('sellPriceDisplay'),
            sharesDisplay: document.getElementById('sharesDisplay'),
            tradeDirectionDisplay: document.getElementById('tradeDirectionDisplay'),
            // 成本更新结果元素
            costUpdateResult: document.getElementById('costUpdateResult'),
            beforeCost: document.getElementById('beforeCost'),
            beforeShares: document.getElementById('beforeShares'),
            afterCost: document.getElementById('afterCost'),
            afterShares: document.getElementById('afterShares'),
            costChange: document.getElementById('costChange'),
            costChangeRate: document.getElementById('costChangeRate')
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
        
        // 添加输入验证
        const numericInputs = [this.elements.buyPrice, this.elements.sellPrice, this.elements.shares, this.elements.commissionRate];
        numericInputs.forEach(input => {
            if (input) {
                input.addEventListener('input', debounce(() => this.validateInput(input), 300));
            }
        });
    }
    
    // 输入验证
    validateInput(inputEl) {
        const value = parseFloat(inputEl.value);
        if (isNaN(value) || value < 0) {
            inputEl.style.borderColor = '#ff4444';
            return false;
        } else {
            inputEl.style.borderColor = '#ddd';
            return true;
        }
    }
    
    // 处理计算逻辑
    handleCalculate() {
        // 获取输入值
        const buyPrice = parseFloat(this.elements.buyPrice.value);
        const sellPrice = parseFloat(this.elements.sellPrice.value);
        const shares = parseInt(this.elements.shares.value);
        const commissionRate = parseFloat(this.elements.commissionRate.value) / 100;
        
        // 验证输入
        if (isNaN(buyPrice) || isNaN(sellPrice) || isNaN(shares) || isNaN(commissionRate)) {
            this.showNotification('请输入完整的计算参数！', 'error');
            return;
        }
        
        if (buyPrice <= 0 || sellPrice <= 0 || shares <= 0 || commissionRate < 0) {
            this.showNotification('请输入有效的数值！', 'error');
            return;
        }
        
        // 获取交易方向
        const tradeDirection = this.elements.tradeDirection1.checked ? 'buy_sell' : 'sell_buy';
        
        // 检查是否启用成本更新功能
        let costUpdateData = null;
        if (this.elements.enableCostUpdate.checked) {
            const currentCost = parseFloat(this.elements.currentCost.value);
            const currentShares = parseInt(this.elements.currentShares.value);
            
            if (isNaN(currentCost) || isNaN(currentShares)) {
                this.showNotification('启用成本更新功能时，请输入当前成本和持仓数量！', 'error');
                return;
            }
            
            if (currentCost <= 0 || currentShares <= 0) {
                this.showNotification('当前成本和持仓数量必须大于0！', 'error');
                return;
            }
            
            costUpdateData = { currentCost, currentShares };
        }
        
        // 计算利润和交易费用
        this.calculateProfitAndCost(buyPrice, sellPrice, shares, commissionRate, tradeDirection, costUpdateData);
    }
    
    // 计算利润和交易费用
    calculateProfitAndCost(buyPrice, sellPrice, shares, commissionRate, tradeDirection, costUpdateData = null) {
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
        
        // 计算净利润（根据交易方向）
        let netProfit;
        let stockCost;
        let tradeDirectionText;
        
        if (tradeDirection === 'buy_sell') {
            // 高抛低吸：先买后卖
            netProfit = actualSellRevenue - actualBuyAmount;
            stockCost = buyPrice * shares;
            tradeDirectionText = '高抛低吸 (先买后卖)';
        } else {
            // 低吸高抛：先卖后买
            netProfit = actualSellRevenue - actualBuyAmount;
            stockCost = sellPrice * shares;
            tradeDirectionText = '低吸高抛 (先卖后买)';
        }
        
        // 计算利润率（基于股票的实际成本）
        const profitRate = (netProfit / stockCost) * 100;
        
        // 计算成本更新（如果启用）
        let costUpdate = null;
        if (costUpdateData) {
            costUpdate = this.calculateCostUpdate(
                costUpdateData.currentCost, 
                costUpdateData.currentShares, 
                buyPrice, 
                sellPrice, 
                shares, 
                tradeDirection,
                totalBuyCost,
                totalSellCost
            );
        }
        
        // 展示结果
        this.displayResults({
            profit: netProfit,
            profitRate: profitRate,
            totalCost: totalBuyCost + totalSellCost,
            buyCost: totalBuyCost,
            sellCost: totalSellCost,
            buyPrice: buyPrice,
            sellPrice: sellPrice,
            shares: shares,
            tradeDirection: tradeDirectionText,
            costUpdate: costUpdate,
            timestamp: new Date().toISOString()
        });
    }
    
    // 计算成本更新（做T后的成本计算）
    calculateCostUpdate(currentCost, currentShares, buyPrice, sellPrice, tradeShares, tradeDirection, buyCost, sellCost) {
        let afterCost, afterShares, costChange, costChangeRate;
        
        if (tradeDirection === 'buy_sell') {
            // 高抛低吸：先买后卖
            // 买入增加持仓，卖出减少持仓
            const totalCostBefore = currentCost * currentShares;
            const buyTotalCost = (buyPrice * tradeShares) + buyCost;
            const sellRevenue = (sellPrice * tradeShares) - sellCost;
            
            // 先买入
            const sharesAfterBuy = currentShares + tradeShares;
            const totalCostAfterBuy = totalCostBefore + buyTotalCost;
            
            // 再卖出
            afterShares = sharesAfterBuy - tradeShares;
            const totalCostAfterSell = totalCostAfterBuy - sellRevenue;
            
            afterCost = afterShares > 0 ? totalCostAfterSell / afterShares : 0;
        } else {
            // 低吸高抛：先卖后买
            // 卖出减少持仓，买入增加持仓
            const totalCostBefore = currentCost * currentShares;
            const sellRevenue = (sellPrice * tradeShares) - sellCost;
            const buyTotalCost = (buyPrice * tradeShares) + buyCost;
            
            // 先卖出
            const sharesAfterSell = currentShares - tradeShares;
            const totalCostAfterSell = totalCostBefore - sellRevenue;
            
            // 再买入
            afterShares = sharesAfterSell + tradeShares;
            const totalCostAfterBuy = totalCostAfterSell + buyTotalCost;
            
            afterCost = afterShares > 0 ? totalCostAfterBuy / afterShares : 0;
        }
        
        // 计算成本变化
        costChange = afterCost - currentCost;
        costChangeRate = currentCost > 0 ? (costChange / currentCost) * 100 : 0;
        
        return {
            beforeCost: currentCost,
            beforeShares: currentShares,
            afterCost: afterCost,
            afterShares: afterShares,
            costChange: costChange,
            costChangeRate: costChangeRate
        };
    }
    
    // 计算佣金 (包含最低5元)
    getCommission(amount, rate) {
        const commission = amount * rate;
        return Math.max(commission, this.MIN_COMMISSION);
    }
    
    // 显示计算结果
    displayResults(data) {
        // 使用 requestAnimationFrame 优化DOM更新
        requestAnimationFrame(() => {
            // 显示结果区域
            this.elements.result.classList.remove('hidden');
            
            // 显示利润信息
            this.elements.netProfit.textContent = data.profit.toFixed(2);
            this.elements.profitRate.textContent = data.profitRate.toFixed(2);
            
            // 显示交易信息
            this.elements.tradeDirectionDisplay.textContent = data.tradeDirection;
            this.elements.buyPriceDisplay.textContent = parseFloat(data.buyPrice).toFixed(3);
            this.elements.sellPriceDisplay.textContent = parseFloat(data.sellPrice).toFixed(3);
            this.elements.sharesDisplay.textContent = data.shares;
            
            // 更新通用交易费用信息
            this.elements.totalCost.textContent = data.totalCost.toFixed(2);
            this.elements.buyCost.textContent = `¥ ${data.buyCost.toFixed(2)}`;
            this.elements.sellCost.textContent = `¥ ${data.sellCost.toFixed(2)}`;
            
            // 显示或隐藏成本更新结果
            if (data.costUpdate) {
                this.elements.costUpdateResult.classList.remove('hidden');
                this.elements.beforeCost.textContent = data.costUpdate.beforeCost.toFixed(3);
                this.elements.beforeShares.textContent = data.costUpdate.beforeShares;
                this.elements.afterCost.textContent = data.costUpdate.afterCost.toFixed(3);
                this.elements.afterShares.textContent = data.costUpdate.afterShares;
                this.elements.costChange.textContent = data.costUpdate.costChange.toFixed(3);
                this.elements.costChangeRate.textContent = data.costUpdate.costChangeRate.toFixed(2);
                
                // 根据成本变化设置颜色
                const changeColor = data.costUpdate.costChange < 0 ? '#4CAF50' : '#f44336';
                this.elements.costChange.style.color = changeColor;
                this.elements.costChangeRate.style.color = changeColor;
            } else {
                this.elements.costUpdateResult.classList.add('hidden');
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
            
            // 创建新记录
            const newRecord = {
                id: Date.now(),
                timestamp: resultData.timestamp,
                buyPrice: resultData.buyPrice,
                sellPrice: resultData.sellPrice,
                shares: resultData.shares,
                profit: resultData.profit,
                profitRate: resultData.profitRate,
                tradeDirection: resultData.tradeDirection,
                totalCost: resultData.totalCost
            };
            
            // 添加到历史记录开头
            history.unshift(newRecord);
            
            // 限制历史记录数量（最多保存50条）
            if (history.length > 50) {
                history = history.slice(0, 50);
            }
            
            // 保存到localStorage
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
            
            // 重新渲染历史记录列表
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
        this.renderHistoryList(history);
    }
    
    // 渲染历史记录列表
    renderHistoryList(history) {
        if (!this.elements.historyList) return;
        
        if (history.length === 0) {
            this.elements.historyList.innerHTML = '<p class="no-history">暂无历史记录</p>';
            return;
        }
        
        const historyHTML = history.map(record => {
            const date = new Date(record.timestamp);
            const formattedDate = date.toLocaleString('zh-CN');
            const profitClass = record.profit >= 0 ? 'profit-positive' : 'profit-negative';
            
            return `
                <div class="history-item" data-record-id="${record.id}">
                    <div class="history-header">
                        <span class="history-date">${formattedDate}</span>
                        <span class="history-direction">${record.tradeDirection}</span>
                    </div>
                    <div class="history-details">
                        <div class="history-prices">
                            <span>买入: ¥${record.buyPrice.toFixed(3)}</span>
                            <span>卖出: ¥${record.sellPrice.toFixed(3)}</span>
                            <span>股数: ${record.shares}</span>
                        </div>
                        <div class="history-profit ${profitClass}">
                            <span>利润: ¥${record.profit.toFixed(2)}</span>
                            <span>利润率: ${record.profitRate.toFixed(2)}%</span>
                        </div>
                    </div>
                    <div class="history-actions">
                        <button class="load-record-btn" onclick="calculator.loadRecordToForm(${record.id})">
                            重新计算
                        </button>
                        <button class="delete-record-btn" onclick="calculator.deleteRecord(${record.id})">
                            删除
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        this.elements.historyList.innerHTML = historyHTML;
    }
    
    // 加载记录到表单
    loadRecordToForm(recordId) {
        const history = this.getHistory();
        const record = history.find(r => r.id === recordId);
        
        if (record) {
            this.elements.buyPrice.value = record.buyPrice;
            this.elements.sellPrice.value = record.sellPrice;
            this.elements.shares.value = record.shares;
            
            // 设置交易方向
            if (record.tradeDirection.includes('先买后卖')) {
                this.elements.tradeDirection1.checked = true;
            } else {
                this.elements.tradeDirection2.checked = true;
            }
            
            this.showNotification('已加载历史记录到表单', 'success');
        }
    }
    
    // 删除单条记录
    deleteRecord(recordId) {
        let history = this.getHistory();
        history = history.filter(r => r.id !== recordId);
        localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
        this.renderHistoryList(history);
        this.showNotification('记录已删除', 'success');
    }
    
    // 清空历史记录
    clearHistory() {
        if (confirm('确定要清空所有历史记录吗？')) {
            localStorage.removeItem(this.HISTORY_KEY);
            this.renderHistoryList([]);
            this.showNotification('历史记录已清空', 'success');
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
        
        // 显示动画
        setTimeout(() => notification.classList.add('show'), 100);
        
        // 自动隐藏
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }
}

// 全局变量，用于历史记录操作
let calculator;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    calculator = new StockCalculator();
});