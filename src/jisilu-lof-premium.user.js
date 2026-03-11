// ==UserScript==
// @name         集思录溢价率计算
// @namespace    https://github.com/LogicDu/jisilu-premium-calculator
// @version      1.3.0
// @description  在集思录LOF/QDII基金页面自动计算并显示溢价率，支持排序
// @author       LogicDu
// @match        https://www.jisilu.cn/data/lof/*
// @match        https://www.jisilu.cn/data/qdii/*
// @icon         https://www.jisilu.cn/favicon.ico
// @grant        none
// @license      MIT
// @homepage     https://github.com/LogicDu/jisilu-premium-calculator
// @supportURL   https://github.com/LogicDu/jisilu-premium-calculator/issues
// @updateURL    https://github.com/LogicDu/jisilu-premium-calculator/raw/main/src/jisilu-lof-premium.user.js
// @downloadURL  https://github.com/LogicDu/jisilu-premium-calculator/raw/main/src/jisilu-lof-premium.user.js
// ==/UserScript==
// @name         集思录溢价率计算
// @namespace    https://github.com/yourusername/jisilu-lof-premium
// @version      1.3.0
// @description  在集思录LOF/QDII基金页面自动计算并显示溢价率，支持排序
// @author       Your Name
// @match        https://www.jisilu.cn/data/lof/*
// @match        https://www.jisilu.cn/data/qdii/*
// @icon         https://www.jisilu.cn/favicon.ico
// @grant        none
// @license      MIT
// @homepage     https://github.com/yourusername/jisilu-lof-premium
// @supportURL   https://github.com/yourusername/jisilu-lof-premium/issues
// @updateURL    https://github.com/yourusername/jisilu-lof-premium/raw/main/src/jisilu-lof-premium.user.js
// @downloadURL  https://github.com/yourusername/jisilu-lof-premium/raw/main/src/jisilu-lof-premium.user.js
// ==/UserScript==

(function() {
    'use strict';

    console.log('[集思录溢价率] 脚本已加载 v1.3.0');

    // 通用配置
    const CONFIG = {
        COLUMN_NAME: '溢价率',
        COLUMN_WIDTH: '80px',
        POSITIVE_COLOR: '#ff4444',  // 正溢价颜色（红色）
        NEGATIVE_COLOR: '#00aa00',  // 负溢价颜色（绿色）
        DECIMAL_PLACES: 2,          // 小数位数
    };

    // 页面配置：根据路径和hash获取表格ID和列索引
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
                '#qdiie': { id: 'flex_qdiie', priceIndex: 2, navIndex: 7 },
                '#qdiic': { id: 'flex_qdiic', priceIndex: 2, navIndex: 7 },
                '#qdiia': { id: 'flex_qdiia', priceIndex: 2, navIndex: 7 },
            },
            defaultTable: 'flex_qdiie'
        }
    };

    // 当前状态
    let currentTableConfig = null;
    let currentTableId = null;
    let currentObserver = null;
    let sortState = null;

    /**
     * 获取当前页面路径
     * @returns {string}
     */
    function getCurrentPath() {
        const pathname = window.location.pathname;
        // 匹配路径，如 /data/lof/ 或 /data/qdii/
        if (pathname.includes('/data/lof')) {
            return '/data/lof/';
        } else if (pathname.includes('/data/qdii')) {
            return '/data/qdii/';
        }
        return null;
    }

    /**
     * 获取当前表格配置
     * @returns {Object|null}
     */
    function getCurrentTableConfig() {
        const path = getCurrentPath();
        if (!path || !PAGE_CONFIG[path]) {
            return null;
        }

        const pageConfig = PAGE_CONFIG[path];
        const hash = window.location.hash || Object.keys(pageConfig.tables)[0];
        
        if (pageConfig.tables[hash]) {
            return pageConfig.tables[hash];
        }

        // 返回默认表格配置
        return pageConfig.tables[Object.keys(pageConfig.tables)[0]];
    }

    /**
     * 获取当前激活的表格ID
     * @returns {string|null}
     */
    function getActiveTableId() {
        const config = getCurrentTableConfig();
        return config ? config.id : null;
    }

    /**
     * 获取当前激活的表格元素
     * @returns {HTMLTableElement|null}
     */
    function getActiveTable() {
        const tableId = getActiveTableId();
        return tableId ? document.querySelector(`#${tableId}`) : null;
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
            console.log('[集思录溢价率] 未找到thead');
            return false;
        }

        // 获取第二行（实际的表头行）
        const theadRows = thead.querySelectorAll('tr');
        const headerRow = theadRows[1]; // 第二行是真正的表头
        
        if (!headerRow) {
            console.log('[集思录溢价率] 未找到表头行');
            return false;
        }

        // 检查是否已添加
        const existingHeader = Array.from(headerRow.querySelectorAll('th')).find(
            th => th.textContent.trim().replace(/[↑↓]/g, '') === CONFIG.COLUMN_NAME
        );
        if (existingHeader) {
            console.log('[集思录溢价率] 溢价率列已存在');
            return true;
        }

        // 在净值列后面插入
        const headers = headerRow.querySelectorAll('th');
        const navHeader = headers[tableConfig.navIndex];

        if (!navHeader) {
            console.log('[集思录溢价率] 未找到净值列');
            return false;
        }

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

        navHeader.after(newHeader);

        console.log('[集思录溢价率] 表头已添加');
        return true;
    }

    /**
     * 处理排序点击
     * @param {HTMLTableElement} table - 表格元素
     * @param {Object} tableConfig - 表格配置
     */
    function handleSortClick(table, tableConfig) {
        // 切换排序状态
        if (sortState === null) {
            sortState = 'desc';
        } else if (sortState === 'desc') {
            sortState = 'asc';
        } else {
            sortState = null;
        }

        updateSortIndicator(table);

        if (sortState !== null) {
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
        if (sortState) {
            indicator.classList.add(sortState);
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
        
        // 溢价率列的索引（净值列索引 + 1）
        const premiumIndex = tableConfig.navIndex + 1;

        rows.sort((a, b) => {
            const aCell = a.querySelectorAll('td')[premiumIndex];
            const bCell = b.querySelectorAll('td')[premiumIndex];

            const aRate = aCell ? parseFloat(aCell.getAttribute('data-premium-rate')) : NaN;
            const bRate = bCell ? parseFloat(bCell.getAttribute('data-premium-rate')) : NaN;

            // null值排在最后
            if (isNaN(aRate) && isNaN(bRate)) return 0;
            if (isNaN(aRate)) return 1;
            if (isNaN(bRate)) return -1;

            return sortState === 'asc' ? aRate - bRate : bRate - aRate;
        });

        rows.forEach(row => tbody.appendChild(row));

        console.log(`[集思录溢价率] 已按溢价率${sortState === 'asc' ? '升序' : '降序'}排序`);
    }

    /**
     * 为表格行添加溢价率数据
     * @param {HTMLElement} row - 表格行元素
     * @param {Object} tableConfig - 表格配置
     */
    function addPremiumDataToRow(row, tableConfig) {
        // 检查是否已添加
        if (row.querySelector('[data-premium-cell="true"]')) {
            return;
        }

        // 获取所有单元格
        const cells = row.querySelectorAll('td');
        if (cells.length <= tableConfig.navIndex) {
            return;
        }

        // 获取价格和净值
        const priceCell = cells[tableConfig.priceIndex];
        const navCell = cells[tableConfig.navIndex];

        if (!priceCell || !navCell) {
            return;
        }

        const priceText = priceCell.textContent.trim();
        const navText = navCell.textContent.trim();

        const price = parseFloat(priceText);
        const nav = parseFloat(navText);

        // 计算溢价率
        const premiumRate = calculatePremiumRate(price, nav);
        const formattedRate = formatPremiumRate(premiumRate);
        const color = getPremiumColor(premiumRate);

        // 创建新单元格
        const newCell = document.createElement('td');
        newCell.textContent = formattedRate;
        newCell.style.textAlign = 'center';
        newCell.style.color = color;
        newCell.style.fontWeight = 'bold';
        newCell.setAttribute('data-premium-cell', 'true');
        newCell.setAttribute('data-premium-rate', premiumRate !== null ? premiumRate : '');
        newCell.setAttribute('data-name', 'premium_rate');

        // 在净值列后面插入
        navCell.after(newCell);
    }

    /**
     * 处理所有表格行
     * @param {HTMLTableElement} table - 表格元素
     * @param {Object} tableConfig - 表格配置
     */
    function processAllRows(table, tableConfig) {
        if (!table) {
            return;
        }

        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            addPremiumDataToRow(row, tableConfig);
        });

        console.log(`[集思录溢价率] 已处理 ${rows.length} 行数据`);
    }

    /**
     * 监听表格变化
     * @param {HTMLTableElement} table - 表格元素
     * @param {Object} tableConfig - 表格配置
     */
    function observeTableChanges(table, tableConfig) {
        if (!table) {
            return;
        }

        // 断开之前的观察器
        if (currentObserver) {
            currentObserver.disconnect();
        }

        const tbody = table.querySelector('tbody');
        if (!tbody) {
            return;
        }

        // 创建观察器
        currentObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.tagName === 'TR') {
                            addPremiumDataToRow(node, tableConfig);
                        }
                    });
                }
            });
        });

        // 开始观察
        currentObserver.observe(tbody, { childList: true, subtree: true });
        console.log('[集思录溢价率] 已启动表格监听');
    }

    /**
     * 初始化当前表格
     */
    function initCurrentTable() {
        const tableConfig = getCurrentTableConfig();
        
        if (!tableConfig) {
            console.log('[集思录溢价率] 当前页面不支持');
            return;
        }

        const tableId = tableConfig.id;
        
        // 如果表格ID没有变化，不重复初始化
        if (currentTableId === tableId) {
            return;
        }
        
        console.log(`[集思录溢价率] 切换到表格: #${tableId}`);
        currentTableId = tableId;
        currentTableConfig = tableConfig;
        sortState = null;

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
            
            // 检查tbody是否有有效数据行（排除登录提示等）
            const hasData = tbody && tbody.querySelector('tr') && 
                           !tbody.querySelector('tr').textContent.includes('登录');
            
            if (table && isVisible && headerRow && hasData) {
                clearInterval(checkTable);
                
                console.log('[集思录溢价率] 表格已找到，开始处理');

                if (addPremiumColumnHeader(table, tableConfig)) {
                    processAllRows(table, tableConfig);
                    observeTableChanges(table, tableConfig);
                }
                
                console.log('[集思录溢价率] 初始化完成');
            }
        }, 500);

        // 10秒后停止检查
        setTimeout(() => {
            clearInterval(checkTable);
            console.log('[集思录溢价率] 初始化检查结束');
        }, 10000);
    }

    /**
     * 初始化脚本
     */
    function init() {
        console.log('[集思录溢价率] 开始初始化');
        
        // 初始化当前表格
        initCurrentTable();
        
        // 监听hash变化，切换表格时重新初始化
        window.addEventListener('hashchange', () => {
            console.log('[集思录溢价率] 检测到hash变化');
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