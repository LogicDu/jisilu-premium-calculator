# 项目开发说明

## 数据接口分析

### API端点
```
https://www.jisilu.cn/data/lof/index_lof_list/?___jsl=LST___t={timestamp}&rp=25&page=1
```

### 请求参数
- `___jsl`: 固定值 `LST___t={timestamp}`
- `rp`: 每页记录数（默认25）
- `page`: 页码（从1开始）

### 响应数据结构
```json
{
  "page": 1,
  "rows": [
    {
      "id": "160119",
      "cell": {
        "fund_id": "160119",
        "fund_nm": "500ETF联接LOF",
        "price": "2.341",           // 场内实时价
        "fund_nav": "2.3483",       // 基金净值
        "increase_rt": "-0.26",     // 涨跌幅
        "discount_rt": "-",         // 折价率
        "index_nm": "中证 500",     // 跟踪指数
        ...
      }
    }
  ],
  "total": 20,
  "all": 127
}
```

### 关键字段说明
- `price`: 场内实时价格（二级市场交易价格）
- `fund_nav`: 基金净值（单位净值）
- `discount_rt`: 原有的折价率字段（可能为"-"）

## 溢价率计算逻辑

### 公式
```
溢价率 = (场内实时价 - 基金净值) / 基金净值 × 100%
```

### 实现细节
1. 从表格行中提取 `price` 和 `fund_nav` 字段
2. 转换为浮点数进行计算
3. 处理异常情况（空值、非数字、除零）
4. 格式化显示（保留2位小数，添加正负号）

### 颜色标识
- 正溢价（> 0）：红色 `#ff4444`
- 负溢价（< 0）：绿色 `#00aa00`
- 无数据：灰色 `#666`

## 技术实现方案

### 1. DOM操作
- 使用 `querySelector` 定位表格元素
- 动态创建 `<th>` 和 `<td>` 元素
- 使用 `after()` 方法在指定列后插入

### 2. 数据监听
- 使用 `MutationObserver` 监听表格变化
- 监听 `childList` 和 `subtree` 变化
- 自动为新增行添加溢价率数据

### 3. 初始化流程
```
页面加载 → 轮询检测表格 → 添加表头 → 处理现有行 → 启动监听器
```

### 4. 防重复机制
- 使用 `data-premium-column` 标记表头
- 使用 `data-premium-cell` 标记数据单元格
- 每次操作前检查标记，避免重复添加

## 兼容性考虑

### 浏览器支持
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### 依赖的Web API
- `MutationObserver` (IE11+)
- `querySelector` (IE8+)
- `Element.after()` (Chrome 54+, Firefox 49+)

### 降级方案
如果 `Element.after()` 不支持，可使用：
```javascript
parentNode.insertBefore(newElement, referenceElement.nextSibling);
```

## 测试要点

### 功能测试
- [ ] 页面加载后自动添加溢价率列
- [ ] 溢价率计算准确
- [ ] 颜色标识正确
- [ ] 手动刷新后数据更新
- [ ] 自动刷新后数据更新
- [ ] 翻页后正常显示

### 边界测试
- [ ] 净值为0的情况
- [ ] 价格或净值为空的情况
- [ ] 非数字数据的处理
- [ ] 表格未加载时的处理

### 性能测试
- [ ] 大量数据时的渲染性能
- [ ] 内存泄漏检查
- [ ] 观察器的资源占用

## 已知限制

1. **游客限制**：游客仅能查看前20条记录
2. **数据延迟**：场内价格和净值可能存在时间差
3. **净值更新**：基金净值通常T+1更新
4. **IOPV数据**：当前版本未使用IOPV（实时估值）

## 未来优化方向

### 功能增强
- [ ] 支持使用IOPV进行实时计算
- [ ] 添加溢价率排序功能
- [ ] 添加溢价率提醒功能
- [ ] 支持自定义阈值高亮

### 性能优化
- [ ] 使用虚拟滚动优化大数据渲染
- [ ] 使用Web Worker进行计算
- [ ] 缓存计算结果

### 用户体验
- [ ] 添加配置面板
- [ ] 支持导出数据
- [ ] 添加历史溢价率趋势图

## 开发环境

### 工具
- Tampermonkey 4.0+
- Chrome DevTools
- Visual Studio Code

### 调试技巧
1. 打开浏览器控制台查看日志
2. 使用 `console.log` 输出关键信息
3. 使用断点调试复杂逻辑
4. 使用 Elements 面板检查DOM结构

## 部署说明

### 发布流程
1. 更新版本号（package.json 和脚本头部）
2. 更新 CHANGELOG.md
3. 提交代码到GitHub
4. 创建Release标签
5. 更新安装链接

### 版本管理
遵循语义化版本规范：
- 主版本号：不兼容的API修改
- 次版本号：向下兼容的功能性新增
- 修订号：向下兼容的问题修正

## 维护指南

### 常见问题处理
1. **表格结构变化**：更新选择器
2. **API变化**：更新数据解析逻辑
3. **样式冲突**：使用更具体的选择器

### 监控指标
- 脚本加载成功率
- 计算准确性
- 用户反馈的问题

## 参考资料

- [Tampermonkey文档](https://www.tampermonkey.net/documentation.php)
- [MDN Web Docs](https://developer.mozilla.org/)
- [集思录官网](https://www.jisilu.cn/)
