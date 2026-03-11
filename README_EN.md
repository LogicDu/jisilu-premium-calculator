# Jisilu Premium Calculator

English | [简体中文](README.md)

## 📖 Introduction

A Tampermonkey userscript that automatically calculates and displays premium rates for LOF/QDII funds on Jisilu.cn, helping investors quickly identify arbitrage opportunities.

## ✨ Features

- ✅ **Auto-add Premium Column** - Seamlessly inserts premium rate data into the existing table
- ✅ **Real-time Calculation** - Calculates premium rates based on market price and NAV
- ✅ **Smart Updates** - Syncs with manual and auto-refresh
- ✅ **Color Coding** - Red for premium, green for discount, easy to read
- ✅ **Click to Sort** - Support sorting by premium rate (desc → asc → cancel)
- ✅ **Multi-page Support** - Support both LOF and QDII fund pages
- ✅ **Sticky Header** - Correctly support sticky table header
- ✅ **Lightweight** - Pure JavaScript, no dependencies, no performance impact

## 📊 Premium Rate Formula

```
Premium Rate = (Market Price - NAV) / NAV × 100%
```

**Field Explanation:**
- **Market Price**: Trading price on secondary market
- **NAV**: Net Asset Value per unit

**Premium Rate Meaning:**
- **Positive (+)**: Market Price > NAV, potential arbitrage opportunity
- **Negative (-)**: Market Price < NAV, potential buying opportunity

## 🚀 Quick Start

### 1. Install Tampermonkey

First, install Tampermonkey extension in your browser:

| Browser | Installation Link |
|---------|-------------------|
| Chrome/Edge | [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) |
| Safari | [Tampermonkey Official](https://www.tampermonkey.net/?browser=safari) |

### 2. Install Script

**Method 1: Direct Install (Recommended)**

Click the link below, Tampermonkey will automatically detect and prompt installation:

👉 [Click to Install](https://github.com/LogicDu/jisilu-premium-calculator/raw/main/src/jisilu-lof-premium.user.js)

**Method 2: Manual Install**

1. Click Tampermonkey icon → Dashboard
2. Click "+" to create new script
3. Copy content from [`src/jisilu-lof-premium.user.js`](src/jisilu-lof-premium.user.js)
4. Paste into editor
5. Save (Ctrl+S or Cmd+S)

### 3. Use Script

Visit the following pages, the script will automatically add "Premium Rate" column:
- [Jisilu LOF Page](https://www.jisilu.cn/data/lof/#stock)
- [Jisilu QDII Page](https://www.jisilu.cn/data/qdii/)

## 📸 Screenshots

![Screenshot](docs/screenshot.png)

## 📁 Project Structure

```
jisilu-premium-calculator/
├── src/
│   └── jisilu-lof-premium.user.js    # Main script file
├── docs/
│   ├── screenshot.png                 # Screenshot
│   └── method.jpg                     # Calculation method
├── README.md                          # Documentation (Chinese)
├── README_EN.md                       # Documentation (English)
├── LICENSE                            # MIT License
├── CHANGELOG.md                       # Changelog
├── CONTRIBUTING.md                    # Contributing guide
└── package.json                       # Project config
```

## 🔧 Technical Implementation

### Core Technologies

- **DOM Manipulation** - Dynamically add table columns and data
- **MutationObserver** - Monitor table changes, auto-update premium rates
- **Data Parsing** - Extract price and NAV from page elements
- **Real-time Calculation** - Use precise mathematical formula
- **Sorting Feature** - Support click header to sort by premium rate

### Workflow

```
Page Load → Detect Table → Add Header → Calculate Premium → Insert Data → Monitor Changes → Auto Update
```

### Compatibility

| Browser | Support |
|---------|---------|
| Chrome/Edge | ✅ Full Support (Recommended) |
| Firefox | ✅ Full Support |
| Safari | ✅ Full Support |
| Others | ⚠️ Requires Tampermonkey 4.0+ |

### Supported Pages

| Page | URL | Status |
|------|-----|--------|
| LOF Funds | https://www.jisilu.cn/data/lof/* | ✅ Supported |
| QDII Funds | https://www.jisilu.cn/data/qdii/* | ✅ Supported |

## ❓ FAQ

<details>
<summary><strong>Q: Why do some funds show "--"?</strong></summary>

A: Possible reasons:
- Missing NAV data
- Newly listed fund without NAV data yet
- Data format exception

Solution: Wait for data update or refresh page
</details>

<details>
<summary><strong>Q: Premium rate not updating?</strong></summary>

A: Try these methods:
1. Refresh page (F5)
2. Check if Tampermonkey has enabled the script
3. Check browser console for errors
4. Reinstall the script
</details>

<details>
<summary><strong>Q: How to customize colors and format?</strong></summary>

A: Open script editor and modify the `CONFIG` object:
```javascript
const CONFIG = {
    COLUMN_NAME: 'Premium',
    POSITIVE_COLOR: '#ff4444',  // Premium color
    NEGATIVE_COLOR: '#00aa00',  // Discount color
    DECIMAL_PLACES: 2,          // Decimal places
};
```
</details>

## 🤝 Contributing

Issues and Pull Requests are welcome!

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

### Quick Contribution

1. Fork this project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

### Latest Version v1.3.0 (2026-03-11)

- ✨ Support QDII fund page
- ✨ Add click header sorting feature
- ✨ Fix sticky header display issue
- ✨ Dynamic detect active table

## 📄 License

This project is licensed under [MIT License](LICENSE).

## ⚠️ Disclaimer

- This script is for learning and reference only
- Does not constitute investment advice
- Investment involves risks
- Users bear all consequences of using this script

## 📧 Contact

- **Submit Issue**: [GitHub Issues](https://github.com/LogicDu/jisilu-premium-calculator/issues)
- **Discussion**: [GitHub Discussions](https://github.com/LogicDu/jisilu-premium-calculator/discussions)

## 🙏 Acknowledgments

- Thanks to [Jisilu](https://www.jisilu.cn/) for providing quality data services
- Thanks to [Tampermonkey](https://www.tampermonkey.net/) team for the powerful tool
- Thanks to all contributors for their support

## ⭐ Star History

If this project helps you, please give it a Star!

[![Star History Chart](https://api.star-history.com/svg?repos=LogicDu/jisilu-premium-calculator&type=Date)](https://star-history.com/#LogicDu/jisilu-premium-calculator&Date)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/LogicDu">LogicDu</a>
</p>