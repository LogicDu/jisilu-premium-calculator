# 快速安装指南

## 5分钟快速上手

### 第一步：安装Tampermonkey

根据你的浏览器选择对应的安装方式：

#### Chrome / Edge 用户
1. 访问 [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. 点击"添加至Chrome"或"添加至Edge"
3. 确认安装

#### Firefox 用户
1. 访问 [Firefox Add-ons](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/)
2. 点击"添加到Firefox"
3. 确认安装

#### Safari 用户
1. 访问 [Tampermonkey官网](https://www.tampermonkey.net/?browser=safari)
2. 按照说明安装

### 第二步：安装脚本

#### 方法一：一键安装（推荐）

点击下面的链接，Tampermonkey会自动识别：

**[点击安装脚本](https://github.com/yourusername/jisilu-lof-premium/raw/main/src/jisilu-lof-premium.user.js)**

然后点击"安装"按钮即可。

#### 方法二：手动安装

1. 点击浏览器工具栏的Tampermonkey图标
2. 选择"管理面板"
3. 点击左侧的"+"号（新建脚本）
4. 删除编辑器中的所有内容
5. 复制以下脚本内容并粘贴：

```javascript
// 访问 https://github.com/yourusername/jisilu-lof-premium/blob/main/src/jisilu-lof-premium.user.js
// 复制完整脚本内容
```

6. 按 `Ctrl+S`（Windows）或 `Cmd+S`（Mac）保存

### 第三步：使用脚本

1. 访问 [集思录LOF页面](https://www.jisilu.cn/data/lof/#index)
2. 等待页面加载完成
3. 你会看到表格中自动添加了"溢价率"列
4. 享受便捷的溢价率计算功能！

## 验证安装

### 检查脚本是否启用

1. 点击Tampermonkey图标
2. 确认"集思录LOF溢价率计算"前面有绿色圆点
3. 如果是灰色，点击切换为启用状态

### 检查脚本是否工作

打开浏览器控制台（按F12），应该能看到：
```
[集思录LOF溢价率] 脚本已加载
[集思录LOF溢价率] 开始初始化
[集思录LOF溢价率] 表头已添加
[集思录LOF溢价率] 已处理 XX 行数据
[集思录LOF溢价率] 已启动表格监听
```

## 常见问题

### Q: 安装后没有看到溢价率列？

**解决方法：**
1. 刷新页面（F5）
2. 检查Tampermonkey是否启用该脚本
3. 打开控制台（F12）查看是否有错误信息
4. 确认访问的是正确的页面：`https://www.jisilu.cn/data/lof/`

### Q: 显示"--"是什么意思？

**说明：**
- 该基金的净值数据缺失
- 或者是新上市基金尚未有净值数据
- 等待数据更新即可

### Q: 如何更新脚本？

**方法一：自动更新**
- Tampermonkey会自动检查更新
- 有新版本时会提示更新

**方法二：手动更新**
1. 点击Tampermonkey图标 → 管理面板
2. 找到"集思录LOF溢价率计算"
3. 点击右侧的"编辑"
4. 复制最新版本的脚本内容
5. 粘贴并保存

### Q: 如何卸载脚本？

1. 点击Tampermonkey图标 → 管理面板
2. 找到"集思录LOF溢价率计算"
3. 点击右侧的垃圾桶图标
4. 确认删除

## 高级配置

### 自定义颜色

编辑脚本，修改 `CONFIG` 对象：

```javascript
const CONFIG = {
    COLUMN_NAME: '溢价率',
    COLUMN_WIDTH: '80px',
    POSITIVE_COLOR: '#ff4444',  // 改为你喜欢的颜色
    NEGATIVE_COLOR: '#00aa00',  // 改为你喜欢的颜色
    DECIMAL_PLACES: 2,          // 小数位数
};
```

### 修改小数位数

将 `DECIMAL_PLACES` 改为你想要的位数（如 3 或 4）。

### 修改列名

将 `COLUMN_NAME` 改为你想要的名称（如"溢价"或"Premium"）。

## 效果预览

安装成功后，你会看到：

```
基金代码 | 基金名称 | 现价 | 净值 | 折价率 | 溢价率 | ...
160119  | 500ETF  | 2.341| 2.348| --    | -0.30% | ...
```

- 正溢价显示为红色，如：`+1.50%`
- 负溢价显示为绿色，如：`-0.30%`
- 无数据显示为灰色：`--`

## 需要帮助？

- 提交问题：[GitHub Issues](https://github.com/yourusername/jisilu-lof-premium/issues)
- 查看文档：[完整文档](../README.md)
- 开发说明：[开发文档](DEVELOPMENT.md)

---

**祝你使用愉快！如果觉得有用，请给项目一个Star ⭐**
