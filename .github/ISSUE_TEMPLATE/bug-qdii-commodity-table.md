# Bug: QDII 页面"商品"表格不显示溢价率列

## 问题描述

在 QDII 基金页面 (https://www.jisilu.cn/data/qdii/#qdiie) 中，存在两个表格:
- **欧美指数** 表格 (flex_qdiie) - ✅ 脚本正常工作
- **商品** 表格 (flex_qdiic) - ❌ 脚本失效，不显示溢价率列

## 复现步骤

1. 访问 https://www.jisilu.cn/data/qdii/#qdiie
2. 查看"欧美指数"表格 - 溢价率列正常显示
3. 切换到"商品"表格
4. **预期**: 溢价率列应该显示
5. **实际**: 溢价率列未显示

## 根本原因分析

当前脚本配置将 `#qdiie` 和 `#qdiic` 视为两个独立的 hash:

```javascript
const PAGE_CONFIG = {
    '/data/qdii/': {
        tables: {
            '#qdiie': { id: 'flex_qdiie', priceIndex: 2, navIndex: 7 },  // 欧美指数
            '#qdiic': { id: 'flex_qdiic', priceIndex: 2, navIndex: 7 },  // 商品
            '#qdiia': { id: 'flex_qdiia', priceIndex: 2, navIndex: 7 },
        }
    }
};
```

**实际问题**: 
- 两个表格 (`flex_qdiie` 和 `flex_qdiic`) 实际上存在于**同一个页面** (hash `#qdiie`) 下
- 当前配置假设每个 hash 只对应一个表格
- 当页面加载时，只有 `flex_qdiie` 被处理，`flex_qdiic` 被忽略

## 技术方案

需要修改配置结构，支持**一个 hash 对应多个表格**:

```javascript
const PAGE_CONFIG = {
    '/data/qdii/': {
        tables: {
            '#qdiie': [
                { id: 'flex_qdiie', priceIndex: 2, navIndex: 7 },  // 欧美指数
                { id: 'flex_qdiic', priceIndex: 2, navIndex: 7 }   // 商品
            ],
            '#qdiia': { id: 'flex_qdiia', priceIndex: 2, navIndex: 7 },
        }
    }
};
```

并相应修改:
1. `getCurrentTableConfig()` - 返回表格数组而非单个表格
2. `initCurrentTable()` - 遍历并初始化所有表格

## 影响范围

- **受影响页面**: QDII 基金页面 (/data/qdii/)
- **受影响表格**: 商品表格 (flex_qdiic)
- **用户影响**: 无法查看商品类别基金的溢价率数据

## 环境信息

- 脚本版本：v1.3.0
- 浏览器：Chrome/Edge/Firefox
- 测试 URL: https://www.jisilu.cn/data/qdii/#qdiie

## 验收标准

- [ ] "欧美指数"表格正常显示溢价率列
- [ ] "商品"表格正常显示溢价率列
- [ ] 切换表格时溢价率数据正确更新
- [ ] 排序功能在两个表格中均正常工作
