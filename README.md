# Bilibili 视频文字稿采集器

自动采集 Bilibili 博主的所有视频，并将音频转换为文字稿。支持两种转录方案：**Whisper 本地转录** 和 **通义听悟在线转录**。

## ✨ 特性

- 🎯 **两种模式**：频道模式（批量采集）和单视频模式
- 🤖 **双引擎支持**：
  - **Whisper**：OpenAI 开源模型，本地运行，完全免费，有 GPU 速度快
  - **通义听悟**：阿里云在线服务，自动化上传转录
- 📝 **多格式输出**：Markdown、纯文本、JSON、SRT 字幕
- ⚡ **并发处理**：下载和转录支持并发，提高效率
- 🔄 **断点续传**：每批次自动保存进度
- 🎛️ **灵活配置**：可限制处理数量，支持测试模式
- 📊 **实时进度**：彩色输出，清晰显示处理进度

## 📋 前置要求

### 必需

1. **Node.js 16+**
   - 下载：https://nodejs.org/

2. **Python 3.8+** （用于 Whisper）
   - 下载：https://www.python.org/

3. **yt-dlp** （用于下载视频音频）
   ```bash
   # Windows (使用 scoop)
   scoop install yt-dlp

   # macOS
   brew install yt-dlp

   # Linux
   pip install yt-dlp

   # 或从 GitHub 下载
   # https://github.com/yt-dlp/yt-dlp/releases
   ```

### 可选（推荐）

- **NVIDIA GPU + CUDA**（Whisper 加速）
  - 有 GPU：转录速度快 5-10 倍
  - 无 GPU：也能用，就是慢一些

## 🚀 快速开始

### 1. 安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 安装 Python 依赖（Whisper）
pip install -r requirements.txt

# 如果有 NVIDIA GPU，安装 CUDA 版本的 PyTorch
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### 2. 安装 Playwright 浏览器

```bash
npx playwright install chromium
```

### 3. 运行

#### 频道模式：采集博主所有视频

```bash
# 使用 Whisper（推荐，有 GPU 的话）
npm run channel 1514320538

# 使用通义听悟
npm run channel 1514320538 -- --engine tingwu

# 测试模式：只处理前 3 个视频
npm run channel 1514320538 -- --limit 3

# 指定输出格式
npm run channel 1514320538 -- --format txt
```

#### 单视频模式：采集单个视频

```bash
# 使用 BV号
npm run single BV1xx411c7mD

# 使用完整 URL
npm run single https://www.bilibili.com/video/BV1xx411c7mD

# 使用通义听悟
npm run single BV1xx411c7mD -- --engine tingwu
```

## 📖 详细使用说明

### 命令行参数

#### 频道模式

```bash
node src/index.js channel <UID或URL> [选项]
```

**选项：**

- `-l, --limit <number>`：限制处理视频数量（用于测试）
- `-e, --engine <engine>`：选择转录引擎（`whisper` 或 `tingwu`）
- `-s, --skip-download`：跳过下载步骤（使用已下载的音频）
- `-f, --format <format>`：输出格式（`md`、`txt`、`json`、`srt`）

**示例：**

```bash
# 只处理前 5 个视频，输出 JSON 格式
npm run channel 1514320538 -- --limit 5 --format json

# 跳过下载，直接转录（假设已经下载过）
npm run channel 1514320538 -- --skip-download

# 使用通义听悟，输出 Markdown
npm run channel 1514320538 -- --engine tingwu --format md
```

#### 单视频模式

```bash
node src/index.js single <BV号或URL> [选项]
```

**选项：**

- `-e, --engine <engine>`：选择转录引擎
- `-f, --format <format>`：输出格式

## ⚙️ 配置文件

编辑 `config.js` 来自定义配置：

### 常用配置项

```javascript
module.exports = {
  // Whisper 配置
  whisper: {
    enabled: true,
    model: 'base',           // 模型大小：tiny/base/small/medium/large
    device: 'cuda',          // 使用 GPU：cuda，使用 CPU：cpu
    concurrent: 2,           // 并发数量
  },

  // 通义听悟配置
  tingwu: {
    enabled: true,
    concurrent: 3,           // 并发数量
  },

  // 下载配置
  step2: {
    concurrent: 3,           // 并发下载数量
    outputFormat: 'mp3',     // 音频格式
    quality: '128',          // 音频质量（kbps）
  },

  // Playwright 配置
  playwright: {
    headless: false,         // 调试时设为 false 可以看到浏览器
    slowMo: 50,              // 操作减速（毫秒）
  },
};
```

### Whisper 模型选择

| 模型 | 大小 | 显存需求 | 速度 | 准确率 | 推荐场景 |
|------|------|----------|------|--------|----------|
| `tiny` | 75 MB | ~1 GB | ⚡⚡⚡⚡⚡ | ⭐⭐⭐ | 快速预览 |
| `base` | 145 MB | ~1 GB | ⚡⚡⚡⚡ | ⭐⭐⭐⭐ | **推荐（平衡）** |
| `small` | 488 MB | ~2 GB | ⚡⚡⚡ | ⭐⭐⭐⭐ | 更高质量 |
| `medium` | 1.5 GB | ~5 GB | ⚡⚡ | ⭐⭐⭐⭐⭐ | 最高质量 |
| `large` | 3 GB | ~10 GB | ⚡ | ⭐⭐⭐⭐⭐ | 专业用途 |

## 📂 输出文件结构

```
bilibili-video-scraper/
├── data/
│   └── 1514320538/              # 博主 UID
│       └── video_list.json      # 视频列表
├── downloads/
│   └── 1514320538/
│       ├── BV1xx411c7mD.mp3    # 下载的音频
│       └── BV2yy422d8eE.mp3
└── transcripts/
    └── 1514320538/
        ├── BV1xx411c7mD.md     # 文字稿
        ├── BV2yy422d8eE.md
        └── all_transcripts.md  # 合并的文字稿
```

## 📝 输出格式示例

### Markdown 格式

```markdown
# 视频标题

**视频信息**

- BV号：BV1xx411c7mD
- 标题：如何使用 Python 爬取网页数据
- 时长：10:35
- 发布时间：2025-11-20
- 视频链接：https://www.bilibili.com/video/BV1xx411c7mD
- 转录时间：2025-11-21 15:30:00

---

## 文字稿

大家好，今天我要跟大家分享的是如何使用 Python 来爬取网页数据...

---

*本文字稿由 AI 自动生成*
```

### JSON 格式

```json
{
  "bvid": "BV1xx411c7mD",
  "title": "如何使用 Python 爬取网页数据",
  "url": "https://www.bilibili.com/video/BV1xx411c7mD",
  "duration": "10:35",
  "pubdate": "2025-11-20",
  "transcriptTime": "2025-11-21T07:30:00.000Z",
  "transcript": {
    "fullText": "大家好，今天我要...",
    "segments": [
      {
        "start": 0.0,
        "end": 5.0,
        "text": "大家好，今天我要跟大家分享的是"
      }
    ]
  }
}
```

## 🔍 故障排查

### 常见问题

#### 1. `yt-dlp: command not found`

**解决方案：**

```bash
# Windows
scoop install yt-dlp

# macOS
brew install yt-dlp

# Linux
pip install yt-dlp
```

#### 2. `ModuleNotFoundError: No module named 'whisper'`

**解决方案：**

```bash
pip install openai-whisper torch
```

#### 3. Whisper 转录很慢

**原因：** 没有使用 GPU

**解决方案：**

- 检查是否安装了 CUDA 版本的 PyTorch
- 或者在 `config.js` 中修改并发数：`whisper.concurrent: 1`（减少内存占用）
- 或者使用更小的模型：`whisper.model: 'tiny'`

#### 4. 通义听悟需要登录

**解决方案：**

- 首次运行时，脚本会打开浏览器
- 手动登录通义听悟
- 登录后会自动保存 Cookie，下次不需要登录

#### 5. 下载视频失败

**可能原因：**

- 视频需要大会员
- 视频已删除或私密
- 网络问题

**解决方案：**

- 跳过失败的视频，脚本会继续处理其他视频
- 检查网络连接

## ⏱️ 性能参考

### Whisper（本地）

**测试环境：** NVIDIA RTX 3060, base 模型

- 10分钟视频：约 1-2 分钟
- 127个视频（平均10分钟）：约 1-1.5 小时

**测试环境：** Intel i7 CPU, base 模型

- 10分钟视频：约 10-15 分钟
- 127个视频：约 3-4 小时

### 通义听悟（在线）

- 10分钟视频：约 3-5 分钟（包含上传和处理）
- 127个视频：约 2-3 小时（并发 3 个）

## 💡 使用技巧

### 1. 测试先行

采集大量视频前，先用 `--limit` 参数测试：

```bash
npm run channel 1514320538 -- --limit 3
```

### 2. 分批处理

对于视频很多的博主，可以分批处理，避免一次运行太久：

```bash
# 处理前 50 个
npm run channel 1514320538 -- --limit 50

# 后续可以配合 --skip-download 继续处理
```

### 3. 选择合适的引擎

- **有 GPU**：优先使用 Whisper，速度快且免费
- **无 GPU**：Whisper 会很慢，可以考虑通义听悟
- **测试对比**：两个引擎都试试，比较准确率

### 4. 调试模式

如果遇到问题，可以开启可视化浏览器调试：

```javascript
// config.js
playwright: {
  headless: false,  // 可以看到浏览器操作
}
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## ⚠️ 免责声明

本工具仅供学习和研究使用。请遵守 Bilibili 的使用条款和相关法律法规。使用本工具产生的任何后果由使用者自行承担。

## 🔗 相关链接

- [OpenAI Whisper](https://github.com/openai/whisper)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [Playwright](https://playwright.dev/)
- [通义听悟](https://tingwu.aliyun.com/)
