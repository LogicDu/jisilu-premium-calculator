# 贡献指南

感谢你考虑为本项目做出贡献！

## 如何贡献

### 报告Bug

如果你发现了bug，请通过 [GitHub Issues](https://github.com/yourusername/jisilu-lof-premium/issues) 提交，并包含以下信息：

- 问题的详细描述
- 复现步骤
- 预期行为
- 实际行为
- 浏览器版本和Tampermonkey版本
- 相关截图（如果有）

### 提出新功能

如果你有新功能的想法：

1. 先检查 [Issues](https://github.com/yourusername/jisilu-lof-premium/issues) 中是否已有类似建议
2. 创建新Issue，详细描述你的想法
3. 等待维护者反馈

### 提交代码

1. **Fork 项目**
   ```bash
   # 点击GitHub页面右上角的Fork按钮
   ```

2. **克隆你的Fork**
   ```bash
   git clone https://github.com/your-username/jisilu-lof-premium.git
   cd jisilu-lof-premium
   ```

3. **创建特性分支**
   ```bash
   git checkout -b feature/AmazingFeature
   ```

4. **进行修改**
   - 保持代码风格一致
   - 添加必要的注释
   - 确保代码可以正常运行

5. **提交更改**
   ```bash
   git add .
   git commit -m 'Add some AmazingFeature'
   ```

6. **推送到分支**
   ```bash
   git push origin feature/AmazingFeature
   ```

7. **创建Pull Request**
   - 在GitHub上打开你的Fork
   - 点击 "New Pull Request"
   - 填写PR描述，说明你的更改

## 代码规范

### JavaScript风格

- 使用4个空格缩进
- 使用单引号
- 函数和变量使用驼峰命名
- 常量使用大写下划线命名
- 添加JSDoc注释

示例：
```javascript
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
```

### 提交信息规范

使用清晰的提交信息：

- `feat: 添加新功能`
- `fix: 修复bug`
- `docs: 更新文档`
- `style: 代码格式调整`
- `refactor: 代码重构`
- `test: 添加测试`
- `chore: 构建/工具变动`

## 测试

在提交PR之前，请确保：

- [ ] 代码在Chrome/Edge上正常运行
- [ ] 代码在Firefox上正常运行
- [ ] 没有控制台错误
- [ ] 功能符合预期
- [ ] 不影响现有功能

## 版本发布

版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)：

- **主版本号**：不兼容的API修改
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

## 行为准则

### 我们的承诺

为了营造开放和友好的环境，我们承诺：

- 使用友好和包容的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

### 不可接受的行为

- 使用性化的语言或图像
- 人身攻击或侮辱性评论
- 公开或私下骚扰
- 未经许可发布他人的私人信息
- 其他不道德或不专业的行为

## 问题？

如有任何问题，请通过以下方式联系：

- 提交 [Issue](https://github.com/yourusername/jisilu-lof-premium/issues)
- 发送邮件至 your.email@example.com

---

再次感谢你的贡献！🎉
