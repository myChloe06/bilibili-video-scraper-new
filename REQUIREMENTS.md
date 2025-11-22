# Bilibili 视频文字稿采集器 - 需求文档

## 📋 项目概述

### 项目目标
开发一个工具，自动采集指定 Bilibili 博主的所有视频，将视频音频提取出来，然后通过语音识别转换为文字稿。

### 核心需求
- 输入博主空间链接或 UID，自动获取该博主所有视频
- 下载视频的音频部分
- 使用语音识别 API 将音频转为文字
- 导出为 Markdown 格式的文字稿（适合导入知识库）

---

## 🎯 功能需求

### 1. 两种运行模式

#### 1.1 频道模式（批量采集）
- **输入**：博主 UID 或空间链接（如 `https://space.bilibili.com/1514320538`）
- **输出**：该博主所有视频的文字稿
- **支持参数**：
  - `--limit <n>`：限制只处理前 n 个视频（用于测试）
  - `--engine <engine>`：选择语音识别引擎
  - `--format <format>`：选择输出格式

#### 1.2 单视频模式
- **输入**：视频 BV 号或链接（如 `BV1xx411c7mD` 或 `https://www.bilibili.com/video/BV1xx411c7mD`）
- **输出**：单个视频的文字稿

### 2. 语音识别引擎（二选一或都实现）

#### 2.1 百度云语音识别 API（推荐）
- **优点**：
  - 10 小时/月免费额度
  - 速度快（云端处理）
  - 准确率高（针对中文优化）
  - 纯 API 调用，简单稳定
- **实现要点**：
  - 使用 API Key 和 Secret Key 获取 Access Token
  - 支持短语音（<60秒）和长语音（>60秒）识别
  - 长语音需要创建任务，轮询查询结果
- **API 文档**：https://cloud.baidu.com/doc/SPEECH/s/0lbxfnc9b

#### 2.2 通义听悟（网页自动化）
- **优点**：
  - 免费（阿里云提供）
  - 准确率高
- **实现要点**：
  - 使用 Playwright 自动化操作网页
  - 上传音频文件
  - 等待转录完成
  - 提取文字稿
- **网址**：https://tingwu.aliyun.com

### 3. 输出格式

#### 3.1 Markdown 格式（主要）
```markdown
# 视频标题

**视频信息**
- BV号：BV1xx411c7mD
- 标题：xxx
- 视频链接：https://www.bilibili.com/video/BV1xx411c7mD
- 转录时间：2025-11-21 15:30:00

---

## 文字稿

（完整的文字内容）

---

*本文字稿由 AI 自动生成*
```

#### 3.2 合并文件
- 生成一个包含所有视频文字稿的合并文件
- 带有目录，方便导航
- 文件名：`all_transcripts.md`

#### 3.3 其他格式（可选）
- 纯文本 (.txt)
- JSON（结构化数据）
- SRT 字幕格式

---

## 🔧 技术方案

### 整体流程

```
Step 1: 获取视频列表
        ↓
Step 2: 下载视频音频
        ↓
Step 3: 语音转文字（百度云 API 或 通义听悟）
        ↓
Step 4: 格式化输出（Markdown）
```

### Step 1: 获取视频列表

**方案**：Playwright 自动化
- 访问博主空间视频页面：`https://space.bilibili.com/{UID}/video`
- 自动滚动加载所有视频（B站使用懒加载）
- 提取每个视频的 BV 号和标题
- 保存为 JSON 文件

**需要提取的信息**：
- BV 号
- 视频标题（用于文件命名和显示）
- 视频链接

### Step 2: 下载音频

**方案**：yt-dlp
- yt-dlp 是最可靠的视频下载工具，支持 B 站
- 只下载音频（节省空间和时间）
- 输出格式：MP3

**命令示例**：
```bash
yt-dlp --extract-audio --audio-format mp3 --audio-quality 128 \
  -o "downloads/{bvid}.mp3" \
  https://www.bilibili.com/video/{bvid}
```

**并发控制**：
- 同时下载 3 个（可配置）
- 避免请求过快被限制

### Step 3: 语音转文字

#### 方案 A：百度云 API

**流程**：
1. 使用 API Key + Secret Key 获取 Access Token
2. 读取音频文件，转为 Base64
3. 调用语音识别 API
4. 获取文字结果

**API 端点**：
- 获取 Token：`https://aip.baidubce.com/oauth/2.0/token`
- 短语音识别：`https://vop.baidu.com/server_api`
- 长语音创建任务：`https://aip.baidubce.com/rpc/2.0/aasr/v1/create`
- 长语音查询结果：`https://aip.baidubce.com/rpc/2.0/aasr/v1/query`

**配置项**：
```javascript
baidu: {
  apiKey: '',      // 用户填入
  secretKey: '',   // 用户填入
  concurrent: 5,   // 并发数
}
```

#### 方案 B：通义听悟

**流程**：
1. Playwright 打开通义听悟网页
2. 首次需要用户手动登录（保存 Cookie）
3. 自动上传音频文件
4. 等待转录完成（轮询检查状态）
5. 提取文字稿内容

### Step 4: 格式化输出

- 将文字稿格式化为 Markdown
- 添加视频元信息
- 保存到 `transcripts/{UID}/` 目录
- 生成合并文件

---

## 📂 目录结构

```
bilibili-video-scraper/
├── src/
│   ├── index.js              # 主入口（命令行解析）
│   ├── channel_mode.js       # 频道模式
│   ├── single_mode.js        # 单视频模式
│   ├── step1_fetch_urls.js   # 获取视频列表
│   ├── step2_download.js     # 下载音频
│   ├── step3_baidu.js        # 百度云语音识别
│   ├── step3_tingwu.js       # 通义听悟（可选）
│   └── utils/
│       ├── formatter.js      # 格式化输出
│       ├── logger.js         # 日志工具
│       └── retry.js          # 重试和延迟工具
├── config.js                 # 配置文件
├── package.json              # Node.js 依赖
├── data/                     # 视频列表数据
│   └── {UID}/
│       └── video_list.json
├── downloads/                # 下载的音频
│   └── {UID}/
│       └── {BVID}.mp3
└── transcripts/              # 文字稿输出
    └── {UID}/
        ├── {BVID}.md
        └── all_transcripts.md
```

---

## 🖥️ 使用方式

### 命令行接口

```bash
# 安装依赖
npm install

# 频道模式：采集博主所有视频
npm run channel <UID> [options]

# 单视频模式
npm run single <BVID> [options]

# 选项
--limit <n>        # 限制处理数量（测试用）
--engine <engine>  # 引擎：baidu 或 tingwu
--format <format>  # 格式：md, txt, json
```

### 示例

```bash
# 测试：只处理 1 个视频
npm run channel 1514320538 -- --engine baidu --limit 1

# 正式采集
npm run channel 1514320538 -- --engine baidu

# 单视频
npm run single BV1xx411c7mD -- --engine baidu
```

---

## ⚙️ 配置文件 (config.js)

```javascript
module.exports = {
  // 百度云语音识别
  baidu: {
    enabled: true,
    apiKey: '',        // 用户填入
    secretKey: '',     // 用户填入
    concurrent: 5,     // 并发数
  },

  // 通义听悟（可选）
  tingwu: {
    enabled: true,
    url: 'https://tingwu.aliyun.com',
    concurrent: 3,
  },

  // 下载配置
  download: {
    concurrent: 3,
    format: 'mp3',
    quality: '128',
  },

  // 输出配置
  output: {
    dataDir: './data',
    downloadDir: './downloads',
    transcriptDir: './transcripts',
    mergeTranscripts: true,
  },

  // Playwright 配置
  playwright: {
    headless: false,   // 调试时设为 false
    slowMo: 50,
  },
};
```

---

## 📦 依赖

### Node.js 依赖
```json
{
  "dependencies": {
    "playwright": "^1.40.0",
    "commander": "^11.1.0",
    "chalk": "^4.1.2",
    "fs-extra": "^11.2.0",
    "p-limit": "^3.1.0"
  }
}
```

### 外部工具
- **yt-dlp**：视频/音频下载
  - 安装：`pip install yt-dlp` 或 `brew install yt-dlp`

---

## 🔐 百度云 API 申请步骤

1. 访问：https://console.bce.baidu.com/ai/#/ai/speech/overview/index
2. 登录/注册百度云账号
3. 创建应用
4. 获取 API Key 和 Secret Key
5. 填入 config.js

**免费额度**：10 小时/月

---

## 📊 性能预估

以 127 个视频、每个 10 分钟为例：

| 步骤 | 时间 |
|------|------|
| 获取列表 | 20 秒 |
| 下载音频（并发3） | 15-20 分钟 |
| 语音识别（百度云并发5） | 20-30 分钟 |
| **总计** | **约 40-50 分钟** |

---

## ✅ 验收标准

1. 能够输入博主 UID，自动获取所有视频列表
2. 能够下载视频音频（MP3 格式）
3. 能够调用百度云 API 进行语音识别
4. 能够输出 Markdown 格式的文字稿
5. 支持 `--limit` 参数限制处理数量
6. 有清晰的进度显示和错误提示

---

## 🎯 目标博主

测试用博主：
- UID：`1514320538`
- 空间链接：`https://space.bilibili.com/1514320538`

---

## 📝 备注

- 优先实现百度云 API 方案（更简单稳定）
- 通义听悟作为备选方案
- Whisper 本地方案暂不实现（需要安装模型，不适合公司电脑）
- 代码使用 Node.js 实现
