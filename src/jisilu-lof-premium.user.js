// ==UserScript==
// @name         集思录溢价率计算
// @namespace    https://github.com/LogicDu/jisilu-premium-calculator
// @version      1.6.0
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
    console.log('[集思录溢价率] 脚本已加载 v1.6.0 (性能优化版)');
    
    // 检查 GM_xmlhttpRequest 是否存在（防止在非Tampermonkey环境下报错）
    if (typeof GM_xmlhttpRequest === 'undefined') {
        console.warn('[集思录溢价率] GM_xmlhttpRequest 不可用，请确保在Tampermonkey环境中运行');
        // 提供一个空实现，避免脚本崩溃
        window.GM_xmlhttpRequest = function(options) {
            console.error('[集思录溢价率] GM_xmlhttpRequest 不可用');
            if (options.onerror) options.onerror({ error: 'GM_xmlhttpRequest not available' });
        };
    }

    // 通用配置
    const CONFIG = {
        COLUMN_NAME: '溢价率',
        ESTIMATE_COLUMN_NAME: '实时估值',
        COLUMN_WIDTH: '80px',
        POSITIVE_COLOR: '#ff4444',
        NEGATIVE_COLOR: '#00aa00',
        DECIMAL_PLACES: 2,
        ESTIMATE_API: 'https://fundgz.1234567.com.cn/js/',
        CACHE_DURATION: 60000,           // 缓存时长（毫秒）：60秒
        // 性能优化配置
        MAX_CONCURRENT_REQUESTS: 5,      // 最大并发请求数
        STORAGE_KEY: 'jisilu_estimate_cache',  // localStorage 键名
        // 调试配置
        DEBUG_MODE: true,
        SHOW_DEBUG_PANEL: true,
    };

    // 页面配置
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
                '#qdiie': [
                    { id: 'flex_qdiie', priceIndex: 2, navIndex: 7 },
                    { id: 'flex_qdiic', priceIndex: 2, navIndex: 7 }
                ],
                '#qdiia': { id: 'flex_qdiia', priceIndex: 2, navIndex: 7 },
            },
            defaultTable: 'flex_qdiie'
        }
    };

    // 当前状态
    let currentTableConfigs = [];
    let currentTableIds = [];
    let currentObservers = {};
    let sortState = {};
    let estimateCache = {};
    let debugData = {};
    let debugPanelVisible = false;
    let selectedFundCode = null;
    
    // ==================== 请求队列（并发控制） ====================
    class RequestQueue {
        constructor(maxConcurrent) {
            this.queue = [];
            this.active = 0;
            this.maxConcurrent = maxConcurrent;
        }
        
        async add(requestFn) {
            // 如果当前活跃数已达上限，等待
            if (this.active >= this.maxConcurrent) {
                await new Promise(resolve => this.queue.push(resolve));
            }
            
            this.active++;
            try {
                return await requestFn();
            } finally {
                this.active--;
                // 启动下一个等待的请求
                if (this.queue.length > 0) {
                    const next = this.queue.shift();
                    next();
                }
            }
        }
    }
    
    // 创建全局请求队列实例
    const requestQueue = new RequestQueue(CONFIG.MAX_CONCURRENT_REQUESTS);
    
    // ==================== localStorage 缓存 ====================
    
    /**
     * 从 localStorage 加载缓存
     */
    function loadCacheFromStorage() {
        try {
            const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                const now = Date.now();
                
                // 只加载未过期的缓存
                const validCache = {};
                for (const [code, data] of Object.entries(parsed)) {
                    if (data && data.timestamp && (now - data.timestamp) < CONFIG.CACHE_DURATION) {
                        validCache[code] = data;
                    }
                }
                
                if (Object.keys(validCache).length > 0) {
                    estimateCache = validCache;
                    console.log(`[集思录溢价率] 从 localStorage 加载了 ${Object.keys(validCache).length} 条有效缓存`);
                }
            }
        } catch (e) {
            console.warn('[集思录溢价率] 加载 localStorage 缓存失败:', e.message);
        }
    }
    
    /**
     * 保存缓存到 localStorage
     */
    function saveCacheToStorage() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(estimateCache));
        } catch (e) {
            console.warn('[集思录溢价率] 保存 localStorage 缓存失败:', e.message);
        }
    }

    function getCurrentPath() {
        const pathname = window.location.pathname;
        if (pathname.includes('/data/lof')) {
            return '/data/lof/';
        } else if (pathname.includes('/data/qdii')) {
            return '/data/qdii/';
        }
        return null;
    }

    function getCurrentTableConfig() {
        const path = getCurrentPath();
        if (!path || !PAGE_CONFIG[path]) {
            return null;
        }

        const pageConfig = PAGE_CONFIG[path];
        const hash = window.location.hash || Object.keys(pageConfig.tables)[0];
        
        if (pageConfig.tables[hash]) {
            return Array.isArray(pageConfig.tables[hash]) 
                ? pageConfig.tables[hash] 
                : [pageConfig.tables[hash]];
        }

        const defaultConfig = pageConfig.tables[Object.keys(pageConfig.tables)[0]];
        return defaultConfig ? [defaultConfig] : null;
    }

    function getActiveTableIds() {
        const configs = getCurrentTableConfig();
        return configs ? configs.map(cfg => cfg.id) : null;
    }

    function calculatePremiumRate(price, nav) {
        if (!price || !nav || isNaN(price) || isNaN(nav) || nav === 0) {
            return null;
        }
        return ((price - nav) / nav) * 100;
    }

    function formatPremiumRate(rate) {
        if (rate === null) {
            return '--';
        }
        const sign = rate >= 0 ? '+' : '';
        return sign + rate.toFixed(CONFIG.DECIMAL_PLACES) + '%';
    }

    function getPremiumColor(rate) {
        if (rate === null) {
            return '#666';
        }
        return rate >= 0 ? CONFIG.POSITIVE_COLOR : CONFIG.NEGATIVE_COLOR;
    }

    /**
     * 从天天基金API获取实时估值（性能优化版）
     * 集成了：请求队列并发控制 + localStorage持久化缓存
     */
    async function fetchRealTimeEstimate(fundCode) {
        const cached = estimateCache[fundCode];
        const now = Date.now();
        
        // 检查缓存
        if (cached && (now - cached.timestamp) < CONFIG.CACHE_DURATION) {
            if (CONFIG.DEBUG_MODE) {
                const cacheAge = Math.round((now - cached.timestamp) / 1000);
                console.log(`[验证] ${fundCode} 使用缓存: 估值=${cached.value}, 缓存时间=${cacheAge}秒前`);
            }
            return cached.value;
        }
        
        // 使用请求队列控制并发
        return requestQueue.add(() => {
            return new Promise((resolve) => {
                const url = CONFIG.ESTIMATE_API + fundCode + '.js';
                const requestTime = Date.now();
                
                if (CONFIG.DEBUG_MODE) {
                    console.log(`[验证] ${fundCode} API请求: ${url}`);
                }
                
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: function(response) {
                        try {
                            const responseTime = Date.now() - requestTime;
                            const text = response.responseText;
                            
                            if (CONFIG.DEBUG_MODE) {
                                console.log(`[验证] ${fundCode} API响应 (${responseTime}ms):`, text.substring(0, 200));
                            }
                            
                            const match = text.match(/jsonpgz\((.*)\)/);
                            
                            if (match && match[1]) {
                                const data = JSON.parse(match[1]);
                                const estimateValue = parseFloat(data.gsz);
                                
                                if (!isNaN(estimateValue)) {
                                    // 更新内存缓存
                                    estimateCache[fundCode] = {
                                        value: estimateValue,
                                        timestamp: now,
                                        rawData: data
                                    };
                                    
                                    // 保存到 localStorage
                                    saveCacheToStorage();
                                    
                                    if (CONFIG.DEBUG_MODE) {
                                        console.log(`[验证] ${fundCode} 估值解析成功: gsz="${data.gsz}" → ${estimateValue}`);
                                    }
                                    
                                    resolve(estimateValue);
                                    return;
                                } else {
                                    if (CONFIG.DEBUG_MODE) {
                                        console.warn(`[验证] ${fundCode} 估值解析失败: gsz="${data.gsz}" 不是有效数字`);
                                    }
                                }
                            } else {
                                if (CONFIG.DEBUG_MODE) {
                                    console.warn(`[验证] ${fundCode} JSONP解析失败: 未找到 jsonpgz(...) 格式`);
                                }
                            }
                            
                            resolve(null);
                        } catch (error) {
                            if (CONFIG.DEBUG_MODE) {
                                console.error(`[验证] ${fundCode} 解析异常:`, error.message);
                            }
                            resolve(null);
                        }
                    },
                    onerror: function(error) {
                        if (CONFIG.DEBUG_MODE) {
                            console.error(`[验证] ${fundCode} 网络错误:`, error.error || '未知错误');
                        }
                        resolve(null);
                    },
                    ontimeout: function() {
                        if (CONFIG.DEBUG_MODE) {
                            console.error(`[验证] ${fundCode} 请求超时 (10s)`);
                        }
                        resolve(null);
                    },
                    timeout: 10000
                });
            });
        });
    }

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

        const theadRows = thead.querySelectorAll('tr');
        const headerRow = theadRows[1];
        
        if (!headerRow) {
            console.log('[集思录溢价率] 未找到表头行');
            return false;
        }

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

        const headers = headerRow.querySelectorAll('th');
        const navHeader = headers[tableConfig.navIndex];

        if (!navHeader) {
            console.log('[集思录溢价率] 未找到净值列');
            return false;
        }

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

            newHeader.addEventListener('click', () => handleSortClick(table, tableConfig));

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

    function handleSortClick(table, tableConfig) {
        const tableId = table.id;
        
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

    function sortTable(table, tableConfig) {
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr'));
        const premiumIndex = tableConfig.navIndex + 2;
        
        rows.sort((a, b) => {
            const aCell = a.querySelectorAll('td')[premiumIndex];
            const bCell = b.querySelectorAll('td')[premiumIndex];

            const aRate = aCell ? parseFloat(aCell.getAttribute('data-premium-rate')) : NaN;
            const bRate = bCell ? parseFloat(bCell.getAttribute('data-premium-rate')) : NaN;

            if (isNaN(aRate) && isNaN(bRate)) return 0;
            if (isNaN(aRate)) return 1;
            if (isNaN(bRate)) return -1;

            return sortState[table.id] === 'asc' ? aRate - bRate : bRate - aRate;
        });

        rows.forEach(row => tbody.appendChild(row));

        console.log(`[集思录溢价率] 已按溢价率${sortState[table.id] === 'asc' ? '升序' : '降序'}排序`);
    }

    /**
     * 为表格行添加溢价率数据（增强版，含调试面板）
     */
    async function addPremiumDataToRow(row, tableConfig) {
        if (row.querySelector('[data-estimate-cell="true"]') && 
            row.querySelector('[data-premium-cell="true"]')) {
            return;
        }

        const cells = row.querySelectorAll('td');
        if (cells.length <= tableConfig.navIndex) {
            return;
        }

        // 获取基金代码
        const fundCodeCell = cells[0];
        const fundCodeLink = fundCodeCell.querySelector('a');
        const fundCodeRaw = fundCodeLink ? fundCodeLink.textContent : fundCodeCell.textContent;
        const fundCode = fundCodeRaw.trim();
        
        if (CONFIG.DEBUG_MODE) {
            console.log(`[验证] 基金代码提取: 原始="${fundCodeRaw}" → 清理="${fundCode}", 来源=${fundCodeLink ? '链接' : '文本'}`);
        }
        
        if (!fundCode || fundCode.length < 6) {
            if (CONFIG.DEBUG_MODE) {
                console.warn(`[验证] 基金代码无效: "${fundCode}", 长度=${fundCode.length}`);
            }
            return;
        }

        // 获取价格
        const priceCell = cells[tableConfig.priceIndex];
        const navCell = cells[tableConfig.navIndex];

        if (!priceCell || !navCell) {
            if (CONFIG.DEBUG_MODE) {
                console.warn(`[验证] ${fundCode} 单元格缺失: priceCell=${!!priceCell}, navCell=${!!navCell}`);
            }
            return;
        }

        const priceText = priceCell.textContent.trim();
        const price = parseFloat(priceText);
        
        if (CONFIG.DEBUG_MODE) {
            console.log(`[验证] ${fundCode} 场内价格: 原始="${priceText}" → 解析=${price}, 类型=${typeof price}`);
        }

        // 创建实时估值单元格
        if (!row.querySelector('[data-estimate-cell="true"]')) {
            const estimateCell = document.createElement('td');
            estimateCell.textContent = '加载中...';
            estimateCell.style.textAlign = 'center';
            estimateCell.style.color = '#666';
            estimateCell.style.cursor = 'pointer';
            estimateCell.setAttribute('data-estimate-cell', 'true');
            estimateCell.setAttribute('data-fund-code', fundCode);
            navCell.after(estimateCell);

            const estimateValue = await fetchRealTimeEstimate(fundCode);
            const timestamp = new Date();
            
            if (estimateValue !== null) {
                const cached = estimateCache[fundCode];
                const cacheAge = cached ? Math.round((Date.now() - cached.timestamp) / 1000) : 0;
                const timeStr = timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                
                estimateCell.innerHTML = `<span>${estimateValue.toFixed(4)}</span><span style="font-size:10px;color:#999;display:block">${timeStr}</span>`;
                estimateCell.style.color = '#0066cc';
                estimateCell.setAttribute('data-estimate-value', estimateValue);
                estimateCell.setAttribute('data-timestamp', timestamp.toISOString());
                estimateCell.title = `估值: ${estimateValue}\n时间: ${timeStr}\n缓存: ${cacheAge}秒前\n点击查看详情`;
                
                // 保存调试数据
                debugData[fundCode] = {
                    fundCode,
                    price,
                    priceText,
                    estimate: estimateValue,
                    timestamp: timestamp.toISOString(),
                    cacheAge,
                    apiResponse: cached?.rawData || null
                };
            } else {
                estimateCell.textContent = '-';
                estimateCell.style.color = '#999';
                estimateCell.title = '获取估值失败\n点击查看详情';
            }
            
            estimateCell.addEventListener('click', (e) => {
                e.stopPropagation();
                showDebugPanel(fundCode);
            });
        }

        // 创建溢价率单元格
        if (!row.querySelector('[data-premium-cell="true"]')) {
            const premiumCell = document.createElement('td');
            premiumCell.textContent = '计算中...';
            premiumCell.style.textAlign = 'center';
            premiumCell.style.fontWeight = 'bold';
            premiumCell.style.cursor = 'pointer';
            premiumCell.setAttribute('data-premium-cell', 'true');
            premiumCell.setAttribute('data-fund-code', fundCode);
            
            const estimateCell = row.querySelector('[data-estimate-cell="true"]');
            const estimateValue = estimateCell ? 
                parseFloat(estimateCell.getAttribute('data-estimate-value')) : null;
            
            let premiumRate = null;
            if (estimateValue !== null && !isNaN(estimateValue)) {
                premiumRate = calculatePremiumRate(price, estimateValue);
                
                if (CONFIG.DEBUG_MODE) {
                    console.log(`[验证] ${fundCode} 溢价率计算: (${price} - ${estimateValue}) / ${estimateValue} × 100 = ${premiumRate.toFixed(2)}%`);
                }
            }
            
            if (premiumRate !== null) {
                const formattedRate = formatPremiumRate(premiumRate);
                const color = getPremiumColor(premiumRate);
                premiumCell.textContent = formattedRate;
                premiumCell.style.color = color;
                premiumCell.setAttribute('data-premium-rate', premiumRate);
                premiumCell.title = `溢价率: ${formattedRate}\n计算: (${price} - ${estimateValue}) / ${estimateValue} × 100\n点击查看详情`;
                
                if (debugData[fundCode]) {
                    debugData[fundCode].premiumRate = premiumRate;
                    debugData[fundCode].formula = `(${price} - ${estimateValue}) / ${estimateValue} × 100`;
                }
            } else {
                premiumCell.textContent = '-';
                premiumCell.style.color = '#999';
                premiumCell.setAttribute('data-premium-rate', '');
                premiumCell.title = '无法计算溢价率\n点击查看详情';
            }

            if (estimateCell) {
                estimateCell.after(premiumCell);
            } else {
                navCell.after(premiumCell);
            }
            
            premiumCell.addEventListener('click', (e) => {
                e.stopPropagation();
                showDebugPanel(fundCode);
            });
        }
    }

    async function processAllRows(table, tableConfig) {
        if (!table) {
            return;
        }

        const rows = table.querySelectorAll('tbody tr');
        const promises = Array.from(rows).map(row => 
            addPremiumDataToRow(row, tableConfig)
        );
        
        await Promise.all(promises);

        console.log(`[集思录溢价率] 已处理 ${rows.length} 行数据`);
    }

    function observeTableChanges(table, tableConfig, tableId) {
        if (!table) {
            return;
        }

        const tbody = table.querySelector('tbody');
        if (!tbody) {
            return;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.tagName === 'TR') {
                            addPremiumDataToRow(node, tableConfig).catch(err => {
                                console.error('[集思录溢价率] 处理新行失败:', err);
                            });
                        }
                    });
                }
            });
        });

        observer.observe(tbody, { childList: true, subtree: true });
        currentObservers[tableId] = observer;
        console.log(`[集思录溢价率] 已启动表格 #${tableId} 监听`);
    }

    function initCurrentTable() {
        const tableConfigs = getCurrentTableConfig();
        
        if (!tableConfigs || tableConfigs.length === 0) {
            console.log('[集思录溢价率] 当前页面不支持');
            return;
        }

        const tableIds = tableConfigs.map(cfg => cfg.id);
        
        if (JSON.stringify(currentTableIds) === JSON.stringify(tableIds)) {
            console.log('[集思录溢价率] 表格配置未变化，跳过初始化');
            return;
        }
        
        console.log(`[集思录溢价率] 切换到表格：${tableIds.join(', ')}`);
        currentTableIds = tableIds;
        currentTableConfigs = tableConfigs;
        sortState = {};
        
        Object.values(currentObservers).forEach(obs => obs.disconnect());
        currentObservers = {};

        tableConfigs.forEach((tableConfig, index) => {
            const tableId = tableConfig.id;
            console.log(`[集思录溢价率] 开始初始化表格 #${index + 1}/${tableConfigs.length}: #${tableId}`);
            initSingleTable(tableId, tableConfig);
        });
    }

    function initSingleTable(tableId, tableConfig) {
        const checkTable = setInterval(() => {
            const table = document.querySelector(`#${tableId}`);
            const thead = table ? table.querySelector('thead') : null;
            const tbody = table ? table.querySelector('tbody') : null;
            const theadRows = thead ? thead.querySelectorAll('tr') : [];
            const headerRow = theadRows[1];
            
            const computedStyle = table ? window.getComputedStyle(table) : null;
            const isVisible = computedStyle && computedStyle.display !== 'none';
            
            const hasData = tbody && tbody.querySelector('tr') && 
                           !tbody.querySelector('tr').textContent.includes('登录');
            
            if (table && isVisible && headerRow && hasData) {
                clearInterval(checkTable);
                
                console.log(`[集思录溢价率] 表格 #${tableId} 已找到，开始处理`);

                if (addPremiumColumnHeader(table, tableConfig)) {
                    processAllRows(table, tableConfig).catch(err => {
                        console.error('[集思录溢价率] 处理行失败:', err);
                    });
                    observeTableChanges(table, tableConfig, tableId);
                }
                
                console.log(`[集思录溢价率] 表格 #${tableId} 初始化完成`);
            }
        }, 500);

        setTimeout(() => {
            clearInterval(checkTable);
            console.log(`[集思录溢价率] 表格 #${tableId} 初始化检查结束`);
        }, 10000);
    }

    /**
     * 添加调试面板样式
     */
    function addDebugStyles() {
        if (document.querySelector('style[data-debug-styles]')) return;
        
        const style = document.createElement('style');
        style.textContent = `
            .premium-debug-panel {
                position: fixed;
                top: 80px;
                right: 20px;
                width: 400px;
                max-height: 80vh;
                background: #fff;
                border: 1px solid #ddd;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                font-size: 13px;
                overflow: hidden;
                display: none;
            }
            .premium-debug-panel.visible {
                display: block;
            }
            .premium-debug-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 16px;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .premium-debug-close {
                cursor: pointer;
                font-size: 18px;
                opacity: 0.8;
            }
            .premium-debug-close:hover {
                opacity: 1;
            }
            .premium-debug-content {
                padding: 16px;
                max-height: calc(80vh - 50px);
                overflow-y: auto;
            }
            .premium-debug-section {
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid #eee;
            }
            .premium-debug-section:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }
            .premium-debug-label {
                color: #666;
                font-size: 11px;
                text-transform: uppercase;
                margin-bottom: 4px;
            }
            .premium-debug-value {
                font-weight: 500;
                color: #333;
            }
            .premium-debug-code {
                font-family: monospace;
                background: #f5f5f5;
                padding: 8px;
                border-radius: 4px;
                overflow-x: auto;
                font-size: 12px;
            }
            .premium-debug-link {
                color: #1890ff;
                text-decoration: none;
                margin-right: 12px;
            }
            .premium-debug-link:hover {
                text-decoration: underline;
            }
            .premium-debug-formula {
                background: #e6f7ff;
                border: 1px solid #91d5ff;
                border-radius: 4px;
                padding: 8px 12px;
                font-family: monospace;
            }
            .premium-debug-status {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                margin-left: 8px;
            }
            .premium-debug-status.success {
                background: #f6ffed;
                color: #52c41a;
            }
            .premium-debug-status.error {
                background: #fff2f0;
                color: #ff4d4f;
            }
            .premium-debug-status.cached {
                background: #fffbe6;
                color: #faad14;
            }
        `;
        style.setAttribute('data-debug-styles', 'true');
        document.head.appendChild(style);
    }

    /**
     * 创建调试面板容器
     */
    function createDebugPanelContainer() {
        if (document.querySelector('.premium-debug-panel')) return;
        
        const panel = document.createElement('div');
        panel.className = 'premium-debug-panel';
        panel.innerHTML = `
            <div class="premium-debug-header">
                <span>🔍 数据验证面板</span>
                <span class="premium-debug-close" title="关闭">×</span>
            </div>
            <div class="premium-debug-content">
                <div style="color: #999; text-align: center; padding: 20px;">
                    点击任意基金的<strong>实时估值</strong>或<strong>溢价率</strong>单元格查看详细信息
                </div>
            </div>
        `;
        document.body.appendChild(panel);
        
        // 关闭按钮事件
        const closeBtn = panel.querySelector('.premium-debug-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                panel.classList.remove('visible');
                debugPanelVisible = false;
            });
        }
        
        // 全局点击关闭 - 使用事件委托，避免内存泄漏
        const closePanelOnOutsideClick = (e) => {
            if (!debugPanelVisible) return;
            const panelEl = document.querySelector('.premium-debug-panel');
            if (!panelEl) return;
            
            try {
                const isEstimateCell = e.target && e.target.closest('[data-estimate-cell="true"]');
                const isPremiumCell = e.target && e.target.closest('[data-premium-cell="true"]');
                if (!panelEl.contains(e.target) && !isEstimateCell && !isPremiumCell) {
                    panelEl.classList.remove('visible');
                    debugPanelVisible = false;
                }
            } catch (err) {
                // 忽略错误，不中断页面
            }
        };
        
        // 使用捕获阶段，确保在页面其他事件之前处理
        document.addEventListener('click', closePanelOnOutsideClick, true);
    }

    /**
     * 显示调试面板
     */
    function showDebugPanel(fundCode) {
        const panel = document.querySelector('.premium-debug-panel');
        if (!panel) return;
        
        const data = debugData[fundCode];
        const cached = estimateCache[fundCode];
        
        const content = panel.querySelector('.premium-debug-content');
        
        if (!data) {
            content.innerHTML = `
                <div style="color: #999; text-align: center; padding: 20px;">
                    暂无 <strong>${fundCode}</strong> 的调试数据<br>
                    请刷新页面重新加载
                </div>
            `;
        } else {
            const statusClass = data.estimate ? 'success' : 'error';
            const statusText = data.estimate ? '数据正常' : '获取失败';
            const cacheStatus = data.cacheAge > 0 ? `<span class="premium-debug-status cached">缓存 ${data.cacheAge}s</span>` : '<span class="premium-debug-status success">实时</span>';
            
            content.innerHTML = `
                <div class="premium-debug-section">
                    <div class="premium-debug-label">基金代码</div>
                    <div class="premium-debug-value">${data.fundCode}</div>
                </div>
                
                <div class="premium-debug-section">
                    <div class="premium-debug-label">场内价格（来源: 集思录页面）</div>
                    <div class="premium-debug-value">${data.price} <span style="color:#999;font-size:11px">(原始: "${data.priceText}")</span></div>
                </div>
                
                <div class="premium-debug-section">
                    <div class="premium-debug-label">实时估值（来源: 天天基金API）</div>
                    <div class="premium-debug-value">
                        ${data.estimate ? data.estimate.toFixed(4) : '-'}
                        <span class="premium-debug-status ${statusClass}">${statusText}</span>
                        ${cacheStatus}
                    </div>
                    <div style="font-size:11px;color:#999;margin-top:4px">
                        更新时间: ${new Date(data.timestamp).toLocaleString('zh-CN')}
                    </div>
                </div>
                
                <div class="premium-debug-section">
                    <div class="premium-debug-label">溢价率计算</div>
                    <div class="premium-debug-formula">${data.formula || '无法计算'}</div>
                    <div class="premium-debug-value" style="margin-top:8px;font-size:18px">
                        ${data.premiumRate !== undefined ? formatPremiumRate(data.premiumRate) : '-'}
                    </div>
                </div>
                
                <div class="premium-debug-section">
                    <div class="premium-debug-label">API原始响应</div>
                    <div class="premium-debug-code">${data.apiResponse ? JSON.stringify(data.apiResponse, null, 2) : '无数据'}</div>
                </div>
                
                <div class="premium-debug-section">
                    <div class="premium-debug-label">验证链接</div>
                    <div>
                        <a href="https://fund.eastmoney.com/${data.fundCode}.html" target="_blank" class="premium-debug-link">📊 天天基金</a>
                        <a href="https://www.jisilu.cn/data/lof/#stock" target="_blank" class="premium-debug-link">📈 集思录</a>
                    </div>
                </div>
            `;
        }
        
        panel.classList.add('visible');
        debugPanelVisible = true;
        selectedFundCode = fundCode;
    }

    /**
     * 初始化脚本
     */
    function init() {
        console.log('[集思录溢价率] 开始初始化 v1.6.0 (性能优化版)');
        
        // 从 localStorage 加载缓存
        loadCacheFromStorage();
        
        addDebugStyles();
        
        if (CONFIG.SHOW_DEBUG_PANEL) {
            createDebugPanelContainer();
        }
        
        initCurrentTable();
        
        window.addEventListener('hashchange', () => {
            console.log('[集思录溢价率] 检测到 hash 变化');
            initCurrentTable();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();