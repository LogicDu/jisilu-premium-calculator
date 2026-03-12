// ==UserScript==
// @name         集思录溢价率计算
// @namespace    https://github.com/LogicDu/jisilu-premium-calculator
// @version      1.4.0
// @description  在集思录 LOF/QDII 基金页面自动计算并显示溢价率，新增实时估值功能，支持排序
// @author       LogicDu
// @match        https://www.jisilu.cn/data/lof/*
// @match        https://www.jisilu.cn/data/qdii/*
// @icon         https://www.jisilu.cn/favicon.ico
// @grant        GM_xmlhttpRequest
// @license      MIT
// @homepage     https://github.com/LogicDu/jisilu-premium-calculator
// @supportURL   https://github.com/LogicDu/jisilu-premium-calculator/issues
// @updateURL    https://github.com/LogicDu/jisilu-premium-calculator/raw/main/src/jisilu-lof-premium.user.js
// @downloadURL  https://github.com/LogicDu/jisilu-premium-calculator/raw/main/src/jisilu-lof-premium.user.js
// ==/UserScript==

(function() {
    'use strict';
    console.log('[集思录溢价率] 脚本已加载 v1.4.0');

    // 通用配置
    const CONFIG = {
        COLUMN_NAME: '溢价率',
        ESTIMATE_COLUMN_NAME: '实时估值',  // 新增：实时估值列名
        COLUMN_WIDTH: '80px',
        POSITIVE_COLOR: '#ff4444',  // 正溢价颜色（红色）
        NEGATIVE_COLOR: '#00aa00',  // 负溢价颜色（绿色）
        DECIMAL_PLACES: 2,          // 小数位数
        ESTIMATE_API: 'https://fundgz.1234567.com.cn/js/',  // 天天基金实时估值API
        CACHE_DURATION: 60000,      // 缓存时长（毫秒）：60秒
    };

    // 页面配置：根据路径和 hash 获取表格 ID 和列索引
    // 注意：一个 hash 可能对应多个表格（如 QDII 页面的#qdiie 包含欧美指数和商品两个表）
    const PAGE_CONFIG = {
        '/data/lof/': {
            tables: {
                '#index': { id: 'flex_index', priceIndex: 2, navIndex: 8 },
                '#stock': { id: 'flex_stock', priceIndex: 2, navIndex: 8 },
                '#arb': { id: 'flex_arb', priceIndex: 2, navIndex: 8 },
            },
            defaultTable: 'flex_index'
        },
        '/data/qdii/': {
            tables: {
                // #qdiie hash 下有两个表格：欧美指数和商品
                '#qdiie': [
                    { id: 'flex_qdiie', priceIndex: 2, navIndex: 7 },  // 欧美指数
                    { id: 'flex_qdiic', priceIndex: 2, navIndex: 7 }   // 商品
                ],
                '#qdiia': { id: 'flex_qdiia', priceIndex: 2, navIndex: 7 },
            },
            defaultTable: 'flex_qdiie'
        }
    };

    // 当前状态
    let currentTableConfigs = [];  // 当前 hash 对应的所有表格配置（数组）
    let currentTableIds = [];      // 当前 hash 对应的所有表格 ID（数组）
    let currentObservers = {};     // 每个表格独立的 observer，key 为 tableId
    let sortState = {};
    let estimateCache = {};        // 实时估值缓存 { fundCode: { value, timestamp } }
    /**
     * 获取当前页面路径
     * @returns {string}
     */
    function getCurrentPath() {
        const pathname = window.location.pathname;
        if (pathname.includes('/data/lof')) {
            return '/data/lof/';
        } else if (pathname.includes('/data/qdii')) {
            return '/data/qdii/';
        }
        return null;
    }

    /**
     * 获取当前表格配置
     * @returns {Array|null} 返回表格配置数组（一个 hash 可能对应多个表格）
     */
    function getCurrentTableConfig() {
        const path = getCurrentPath();
        if (!path || !PAGE_CONFIG[path]) {
            return null;
        }

        const pageConfig = PAGE_CONFIG[path];
        const hash = window.location.hash || Object.keys(pageConfig.tables)[0];
        
        if (pageConfig.tables[hash]) {
            // 如果是数组（多表格），直接返回；如果是对象（单表格），转为数组
            return Array.isArray(pageConfig.tables[hash]) 
                ? pageConfig.tables[hash] 
                : [pageConfig.tables[hash]];
        }

        // 返回默认表格配置（转为数组）
        const defaultConfig = pageConfig.tables[Object.keys(pageConfig.tables)[0]];
        return defaultConfig ? [defaultConfig] : null;
    }

    /**
     * 获取当前激活的表格 ID 列表
     * @returns {Array<string>|null}
     */
    function getActiveTableIds() {
        const configs = getCurrentTableConfig();
        return configs ? configs.map(cfg => cfg.id) : null;
    }

    /**
     * 计算溢价率
     * @param {number} price - 场内实时价
     * @param {number} nav - 基金净值
     * @returns {number|null} 溢价率百分比
     */
    function calculatePremiumRate(price, nav) {
        if (!price || !nav || isNaN(price) || isNaN(nav) || nav === 0) {
            return null;
        }
        return ((price - nav) / nav) * 100;
    }

    /**
     * 格式化溢价率显示
     * @param {number|null} rate - 溢价率
     * @returns {string} 格式化后的字符串
     */
    function formatPremiumRate(rate) {
        if (rate === null) {
            return '--';
        }
        const sign = rate >= 0 ? '+' : '';
        return sign + rate.toFixed(CONFIG.DECIMAL_PLACES) + '%';
    }

    /**
     * 获取溢价率颜色
     * @param {number|null} rate - 溢价率
     * @returns {string} 颜色值
     */
    function getPremiumColor(rate) {
        if (rate === null) {
            return '#666';
        }
        return rate >= 0 ? CONFIG.POSITIVE_COLOR : CONFIG.NEGATIVE_COLOR;
    }

    /**
     * 从天天基金API获取实时估值
     * @param {string} fundCode - 基金代码
     * @returns {Promise<number|null>} 实时估值或null
     */
    async function fetchRealTimeEstimate(fundCode) {
        // 检查缓存
        const cached = estimateCache[fundCode];
        const now = Date.now();
        if (cached && (now - cached.timestamp) < CONFIG.CACHE_DURATION) {
            console.log(`[集思录溢价率] 使用缓存: ${fundCode} = ${cached.value}`);
            return cached.value;
        }

        const url = CONFIG.ESTIMATE_API + fundCode + '.js';
        console.log(`[集思录溢价率] 请求实时估值: ${url}`);
        
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: function(response) {
                    try {
                        const text = response.responseText;
                        // 解析JSONP格式: jsonpgz({...})
                        const match = text.match(/jsonpgz\((.*)\)/);
                        
                        if (match && match[1]) {
                            const data = JSON.parse(match[1]);
                            const estimateValue = parseFloat(data.gsz);
                            
                            if (!isNaN(estimateValue)) {
                                // 更新缓存
                                estimateCache[fundCode] = {
                                    value: estimateValue,
                                    timestamp: now
                                };
                                console.log(`[集思录溢价率] 获取成功: ${fundCode} = ${estimateValue}`);
                                resolve(estimateValue);
                                return;
                            }
                        }
                        
                        resolve(null);
                    } catch (error) {
                        console.error(`[集思录溢价率] 解析响应失败 (${fundCode}):`, error.message);
                        resolve(null);
                    }
                },
                onerror: function(error) {
                    console.error(`[集思录溢价率] 请求失败 (${fundCode}):`, error.error || '网络错误');
                    resolve(null);
                },
                ontimeout: function() {
                    console.error(`[集思录溢价率] 请求超时 (${fundCode})`);
                    resolve(null);
                },
                timeout: 10000  // 10秒超时
            });
        });
    }

    /**
     * 在表格头部添加溢价率列
     * @param {HTMLTableElement} table - 表格元素
     * @param {Object} tableConfig - 表格配置
     * @returns {boolean} 是否成功
     */
    function addPremiumColumnHeader(table, tableConfig) {
        if (!table) {
            console.log('[集思录溢价率] 未找到表格');
            return false;
        }

        const thead = table.querySelector('thead');
        if (!thead) {
            console.log('[集思录溢价率] 未找到 thead');
            return false;
        }

        // 获取第二行（实际的表头行）
        const theadRows = thead.querySelectorAll('tr');
        const headerRow = theadRows[1];
        
        if (!headerRow) {
            console.log('[集思录溢价率] 未找到表头行');
            return false;
        }

        // 检查是否已添加
        const existingEstimateHeader = Array.from(headerRow.querySelectorAll('th')).find(
            th => th.textContent.trim().replace(/[↑↓]/g, '') === CONFIG.ESTIMATE_COLUMN_NAME
        );
        const existingPremiumHeader = Array.from(headerRow.querySelectorAll('th')).find(
            th => th.textContent.trim().replace(/[↑↓]/g, '') === CONFIG.COLUMN_NAME
        );
        
        if (existingEstimateHeader && existingPremiumHeader) {
            console.log('[集思录溢价率] 列已存在');
            return true;
        }

        // 在净值列后面插入
        const headers = headerRow.querySelectorAll('th');
        const navHeader = headers[tableConfig.navIndex];

        if (!navHeader) {
            console.log('[集思录溢价率] 未找到净值列');
            return false;
        }

        // 先添加“实时估值”列
        if (!existingEstimateHeader) {
            const estimateHeader = document.createElement('th');
            estimateHeader.className = 'header sticky';
            estimateHeader.innerHTML = `<span class="estimate-header-text">${CONFIG.ESTIMATE_COLUMN_NAME}</span>`;
            estimateHeader.style.cssText = `
                width: 70px;
                text-align: center;
                position: sticky;
                top: 0;
                z-index: 1000;
                background-color: rgb(134, 197, 227);
            `;
            estimateHeader.setAttribute('data-estimate-column', 'true');
            navHeader.after(estimateHeader);
            console.log('[集思录溢价率] 实时估值列表头已添加');
        }

        // 再添加“溢价率”列（在实时估值列后面）
        if (!existingPremiumHeader) {
            const newHeader = document.createElement('th');
            newHeader.className = 'header sticky';
            newHeader.innerHTML = `<span class="premium-header-text">${CONFIG.COLUMN_NAME}</span><span class="premium-sort-indicator"></span>`;
            newHeader.style.cssText = `
                width: ${CONFIG.COLUMN_WIDTH};
                text-align: center;
                cursor: pointer;
                user-select: none;
                position: sticky;
                top: 0;
                z-index: 1000;
                background-color: rgb(134, 197, 227);
            `;
            newHeader.setAttribute('data-premium-column', 'true');
            
            // 添加排序样式（只添加一次）
            if (!document.querySelector('style[data-premium-styles]')) {
                const style = document.createElement('style');
                style.textContent = `
                    .premium-sort-indicator {
                        margin-left: 4px;
                        font-size: 12px;
                    }
                    .premium-sort-indicator.asc::after {
                        content: '↑';
                        color: #333;
                    }
                    .premium-sort-indicator.desc::after {
                        content: '↓';
                        color: #333;
                    }
                    th[data-premium-column="true"]:hover {
                        background-color: rgb(114, 177, 207) !important;
                    }
                `;
                style.setAttribute('data-premium-styles', 'true');
                document.head.appendChild(style);
            }

            // 添加点击排序事件
            newHeader.addEventListener('click', () => handleSortClick(table, tableConfig));

            // 获取刚插入的实时估值列表头，在其后插入溢价率列
            const estimateHeader = headerRow.querySelector('th[data-estimate-column="true"]');
            if (estimateHeader) {
                estimateHeader.after(newHeader);
            } else {
                navHeader.after(newHeader);
            }
            console.log('[集思录溢价率] 溢价率列表头已添加');
        }

        console.log('[集思录溢价率] 表头已添加');
        return true;
    }

    /**
     * 处理排序点击
     * @param {HTMLTableElement} table - 表格元素
     * @param {Object} tableConfig - 表格配置
     */
    function handleSortClick(table, tableConfig) {
        const tableId = table.id;
        
        // 切换排序状态
        if (!sortState[tableId]) {
            sortState[tableId] = 'desc';
        } else if (sortState[tableId] === 'desc') {
            sortState[tableId] = 'asc';
        } else {
            sortState[tableId] = null;
        }

        updateSortIndicator(table);

        if (sortState[tableId] !== null) {
            sortTable(table, tableConfig);
        } else {
            processAllRows(table, tableConfig);
        }
    }

    /**
     * 更新排序指示器
     * @param {HTMLTableElement} table - 表格元素
     */
    function updateSortIndicator(table) {
        const header = table.querySelector('th[data-premium-column="true"]');
        if (!header) return;

        const indicator = header.querySelector('.premium-sort-indicator');
        if (!indicator) return;

        indicator.classList.remove('asc', 'desc');
        if (sortState[table.id]) {
            indicator.classList.add(sortState[table.id]);
        }
    }

    /**
     * 对表格进行排序
     * @param {HTMLTableElement} table - 表格元素
     * @param {Object} tableConfig - 表格配置
     */
    function sortTable(table, tableConfig) {
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        // 溢价率列的索引（净值列索引 + 2，因为中间有实时估值列）
        const premiumIndex = tableConfig.navIndex + 2;
        rows.sort((a, b) => {
            const aCell = a.querySelectorAll('td')[premiumIndex];
            const bCell = b.querySelectorAll('td')[premiumIndex];

            const aRate = aCell ? parseFloat(aCell.getAttribute('data-premium-rate')) : NaN;
            const bRate = bCell ? parseFloat(bCell.getAttribute('data-premium-rate')) : NaN;

            // null 值排在最后
            if (isNaN(aRate) && isNaN(bRate)) return 0;
            if (isNaN(aRate)) return 1;
            if (isNaN(bRate)) return -1;

            return sortState[table.id] === 'asc' ? aRate - bRate : bRate - aRate;
        });

        rows.forEach(row => tbody.appendChild(row));

        console.log(`[集思录溢价率] 已按溢价率${sortState[table.id] === 'asc' ? '升序' : '降序'}排序`);
    }

    /**
     * 为表格行添加溢价率数据（异步版本）
     * @param {HTMLElement} row - 表格行元素
     * @param {Object} tableConfig - 表格配置
     */
    async function addPremiumDataToRow(row, tableConfig) {
        // 检查是否已添加
        if (row.querySelector('[data-estimate-cell="true"]') && 
            row.querySelector('[data-premium-cell="true"]')) {
            return;
        }

        // 获取所有单元格
        const cells = row.querySelectorAll('td');
        if (cells.length <= tableConfig.navIndex) {
            return;
        }

        // 获取基金代码（从第一列的链接或文本中提取）
        const fundCodeCell = cells[0];
        const fundCodeLink = fundCodeCell.querySelector('a');
        const fundCode = fundCodeLink ? 
            fundCodeLink.textContent.trim() : 
            fundCodeCell.textContent.trim();
        
        if (!fundCode || fundCode.length < 6) {
            return;
        }

        // 获取价格和净值
        const priceCell = cells[tableConfig.priceIndex];
        const navCell = cells[tableConfig.navIndex];

        if (!priceCell || !navCell) {
            return;
        }

        const priceText = priceCell.textContent.trim();
        const price = parseFloat(priceText);

        // 创建并插入“实时估值”单元格
        if (!row.querySelector('[data-estimate-cell="true"]')) {
            const estimateCell = document.createElement('td');
            estimateCell.textContent = '加载中...';
            estimateCell.style.textAlign = 'center';
            estimateCell.style.color = '#666';
            estimateCell.setAttribute('data-estimate-cell', 'true');
            estimateCell.setAttribute('data-fund-code', fundCode);
            navCell.after(estimateCell);

            // 异步获取实时估值
            const estimateValue = await fetchRealTimeEstimate(fundCode);
            
            if (estimateValue !== null) {
                estimateCell.textContent = estimateValue.toFixed(4);
                estimateCell.style.color = '#0066cc';
                estimateCell.setAttribute('data-estimate-value', estimateValue);
            } else {
                estimateCell.textContent = '-';
                estimateCell.style.color = '#999';
            }
        }

        // 创建并插入“溢价率”单元格
        if (!row.querySelector('[data-premium-cell="true"]')) {
            const premiumCell = document.createElement('td');
            premiumCell.textContent = '计算中...';
            premiumCell.style.textAlign = 'center';
            premiumCell.style.fontWeight = 'bold';
            premiumCell.setAttribute('data-premium-cell', 'true');
            premiumCell.setAttribute('data-fund-code', fundCode);
            
            // 获取实时估值（从刚插入的单元格或缓存）
            const estimateCell = row.querySelector('[data-estimate-cell="true"]');
            const estimateValue = estimateCell ? 
                parseFloat(estimateCell.getAttribute('data-estimate-value')) : null;
            
            // 使用实时估值计算溢价率
            let premiumRate = null;
            if (estimateValue !== null && !isNaN(estimateValue)) {
                premiumRate = calculatePremiumRate(price, estimateValue);
            }
            
            if (premiumRate !== null) {
                const formattedRate = formatPremiumRate(premiumRate);
                const color = getPremiumColor(premiumRate);
                premiumCell.textContent = formattedRate;
                premiumCell.style.color = color;
                premiumCell.setAttribute('data-premium-rate', premiumRate);
            } else {
                premiumCell.textContent = '-';
                premiumCell.style.color = '#999';
                premiumCell.setAttribute('data-premium-rate', '');
            }

            // 在实时估值列后面插入溢价率列
            if (estimateCell) {
                estimateCell.after(premiumCell);
            } else {
                navCell.after(premiumCell);
            }
        }
    }

    /**
     * 处理所有表格行
     * @param {HTMLTableElement} table - 表格元素
     * @param {Object} tableConfig - 表格配置
     */
    async function processAllRows(table, tableConfig) {
        if (!table) {
            return;
        }

        const rows = table.querySelectorAll('tbody tr');
        
        // 使用 Promise.all 并行处理所有行
        const promises = Array.from(rows).map(row => 
            addPremiumDataToRow(row, tableConfig)
        );
        
        await Promise.all(promises);

        console.log(`[集思录溢价率] 已处理 ${rows.length} 行数据`);
    }

    /**
     * 监听表格变化
     * @param {HTMLTableElement} table - 表格元素
     * @param {Object} tableConfig - 表格配置
     * @param {string} tableId - 表格 ID（用于区分多个表格的 observer）
     */
    function observeTableChanges(table, tableConfig, tableId) {
        if (!table) {
            return;
        }

        const tbody = table.querySelector('tbody');
        if (!tbody) {
            return;
        }

        // 创建观察器并保存到对应 tableId 下
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.tagName === 'TR') {
                            // 异步处理，不等待结果
                            addPremiumDataToRow(node, tableConfig).catch(err => {
                                console.error('[集思录溢价率] 处理新行失败:', err);
                            });
                        }
                    });
                }
            });
        });

        // 开始观察
        observer.observe(tbody, { childList: true, subtree: true });
        currentObservers[tableId] = observer;
        console.log(`[集思录溢价率] 已启动表格 #${tableId} 监听`);
    }

    /**
     * 初始化当前 hash 对应的所有表格
     */
    function initCurrentTable() {
        const tableConfigs = getCurrentTableConfig();
        
        if (!tableConfigs || tableConfigs.length === 0) {
            console.log('[集思录溢价率] 当前页面不支持');
            return;
        }

        const tableIds = tableConfigs.map(cfg => cfg.id);
        
        // 如果表格 ID 列表没有变化，不重复初始化
        if (JSON.stringify(currentTableIds) === JSON.stringify(tableIds)) {
            console.log('[集思录溢价率] 表格配置未变化，跳过初始化');
            return;
        }
        
        console.log(`[集思录溢价率] 切换到表格：${tableIds.join(', ')}`);
        currentTableIds = tableIds;
        currentTableConfigs = tableConfigs;
        sortState = {};
        
        // 清理旧的 observer
        Object.values(currentObservers).forEach(obs => obs.disconnect());
        currentObservers = {};

        // 为每个表格单独初始化
        tableConfigs.forEach((tableConfig, index) => {
            const tableId = tableConfig.id;
            console.log(`[集思录溢价率] 开始初始化表格 #${index + 1}/${tableConfigs.length}: #${tableId}`);
            initSingleTable(tableId, tableConfig);
        });
    }

    /**
     * 初始化单个表格
     * @param {string} tableId - 表格 ID
     * @param {Object} tableConfig - 表格配置
     */
    function initSingleTable(tableId, tableConfig) {
        // 等待表格加载
        const checkTable = setInterval(() => {
            const table = document.querySelector(`#${tableId}`);
            const thead = table ? table.querySelector('thead') : null;
            const tbody = table ? table.querySelector('tbody') : null;
            const theadRows = thead ? thead.querySelectorAll('tr') : [];
            const headerRow = theadRows[1];
            
            // 检查表格是否可见且有数据
            const computedStyle = table ? window.getComputedStyle(table) : null;
            const isVisible = computedStyle && computedStyle.display !== 'none';
            
            // 检查 tbody 是否有有效数据行（排除登录提示等）
            const hasData = tbody && tbody.querySelector('tr') && 
                           !tbody.querySelector('tr').textContent.includes('登录');
            
            if (table && isVisible && headerRow && hasData) {
                clearInterval(checkTable);
                
                console.log(`[集思录溢价率] 表格 #${tableId} 已找到，开始处理`);

                if (addPremiumColumnHeader(table, tableConfig)) {
                    // 异步处理所有行
                    processAllRows(table, tableConfig).catch(err => {
                        console.error('[集思录溢价率] 处理行失败:', err);
                    });
                    observeTableChanges(table, tableConfig, tableId);
                }
                
                console.log(`[集思录溢价率] 表格 #${tableId} 初始化完成`);
            }
        }, 500);

        // 10 秒后停止检查
        setTimeout(() => {
            clearInterval(checkTable);
            console.log(`[集思录溢价率] 表格 #${tableId} 初始化检查结束`);
        }, 10000);
    }

    /**
     * 初始化脚本
     */
    function init() {
        console.log('[集思录溢价率] 开始初始化');
        
        // 初始化当前表格
        initCurrentTable();
        
        // 监听 hash 变化，切换表格时重新初始化
        window.addEventListener('hashchange', () => {
            console.log('[集思录溢价率] 检测到 hash 变化');
            initCurrentTable();
        });
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
