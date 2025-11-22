# Bilibili 视频文字稿采集器

自动采集 Bilibili 博主的所有视频，并将音频转换为文字稿。

## 特性

- **两种模式**：频道模式（批量采集）和单视频模式
- **B站 API**：直接调用官方 API 获取视频列表，快速稳定
- **百度云转写**：使用「音频文件转写」API，支持长音频、mp3 格式
- **多格式输出**：Markdown、纯文本、JSON
- **并发处理**：下载和转写支持并发，提高效率
- **断点续传**：自动保存进度，支持从中断处继续
- **分P支持**：自动处理多分P视频

## 前置要求

### 必需

1. **Node.js 16+**
   - 下载：https://nodejs.org/

2. **yt-dlp**（用于下载视频音频）
   ```bash
   # Windows (使用 scoop)
   scoop install yt-dlp

   # macOS
   brew install yt-dlp

   # Linux
   pip install yt-dlp
   ```

3. **百度云账号**
   - 注册并创建应用，获取 API Key 和 Secret Key
   - 详见 [BAIDU_SETUP.md](./BAIDU_SETUP.md)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置百度云 API

编辑 `config.js`，填入你的 API Key 和 Secret Key：

```javascript
baidu: {
  apiKey: '你的API_KEY',
  secretKey: '你的SECRET_KEY',
}
```

### 3. 运行

#### 频道模式：采集博主所有视频

```bash
# 测试模式：只处理前 3 个视频
npm run channel 1514320538 -- --limit 3

# 正式采集
npm run channel 1514320538

# 从中断处继续
npm run channel 1514320538 -- --resume
```

#### 单视频模式：采集单个视频

```bash
# 使用 BV号
npm run single BV1xx411c7mD

# 使用完整 URL
npm run single https://www.bilibili.com/video/BV1xx411c7mD
```

## 命令行参数

### 频道模式

```bash
node src/index.js channel <UID或URL> [选项]
```

**选项：**

| 参数 | 说明 |
|------|------|
| `-l, --limit <number>` | 限制处理视频数量（用于测试） |
| `-e, --engine <engine>` | 转录引擎：`baidu`（默认）或 `tingwu` |
| `-f, --format <format>` | 输出格式：`md`（默认）、`txt`、`json` |
| `--resume` | 从上次中断处继续 |
| `--skip-download` | 跳过下载，只转写已下载的音频 |

### 单视频模式

```bash
node src/index.js single <BV号或URL> [选项]
```

## 配置文件

编辑 `config.js` 来自定义配置：

```javascript
module.exports = {
  // 百度云「音频文件转写」API
  baidu: {
    apiKey: '',        // 必填
    secretKey: '',     // 必填
    concurrent: 5,     // 并发任务数
  },

  // 下载配置
  download: {
    concurrent: 3,     // 并发下载数
    format: 'mp3',     // 音频格式
    quality: '128',    // 音频质量（kbps）
  },

  // 输出配置
  output: {
    dataDir: './data',
    downloadDir: './downloads',
    transcriptDir: './transcripts',
    mergeTranscripts: true,
  },
};
```

## 输出文件结构

```
bilibili-video-scraper/
├── data/
│   └── 1514320538/              # 博主 UID
│       ├── video_list.json      # 视频列表
│       └── progress.json        # 处理进度
├── downloads/
│   └── 1514320538/
│       ├── BV1xx411c7mD.mp3     # 下载的音频
│       └── BV2yy422d8eE_P2.mp3  # 分P视频
└── transcripts/
    └── 1514320538/
        ├── BV1xx411c7mD.md      # 文字稿
        ├── BV2yy422d8eE_P2.md   # 分P视频
        └── all_transcripts.md   # 合并的文字稿
```

## 输出格式示例

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

## 故障排查

### 1. `yt-dlp: command not found`

**解决方案：** 安装 yt-dlp

```bash
# Windows
scoop install yt-dlp

# macOS
brew install yt-dlp

# Linux
pip install yt-dlp
```

### 2. 百度云 API 报错

**可能原因：**
- API Key 或 Secret Key 填写错误
- 免费额度用完

**解决方案：**
1. 检查 config.js 中的密钥是否正确
2. 登录百度云控制台查看用量

### 3. 下载视频失败

**可能原因：**
- 视频需要大会员
- 视频已删除或私密
- 网络问题

**解决方案：**
- 跳过失败的视频，脚本会继续处理其他视频
- 使用 `--resume` 参数重试

## 性能参考

以 127 个视频（平均每个 10 分钟）为例：

| 步骤 | 时间 |
|------|------|
| 获取列表 | 5-10 秒 |
| 下载音频 | 15-20 分钟 |
| 语音转写 | 30-60 分钟 |
| **总计** | **约 50-80 分钟** |

## 免责声明

本工具仅供学习和研究使用。请遵守 Bilibili 的使用条款和相关法律法规。使用本工具产生的任何后果由使用者自行承担。

## 相关链接

- [百度云语音识别](https://cloud.baidu.com/doc/SPEECH/s/Klbxern8v)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [B站 API 文档](https://github.com/SocialSisterYi/bilibili-API-collect)
