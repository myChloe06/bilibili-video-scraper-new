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
Step 1: 调用 B站 API 获取视频列表
        ↓
Step 2: 下载视频音频（yt-dlp）
        ↓
Step 3: 语音转文字（百度云「音频文件转写」API）
        ↓
Step 4: 格式化输出（Markdown）+ 进度保存
```

### Step 1: 获取视频列表

**方案**：调用 B站官方 API（替代 Playwright 自动化）
- API 地址：`https://api.bilibili.com/x/space/wbi/arc/search`
- 需要实现 WBI 签名（代码自动获取 key，无需用户配置）
- 翻页获取所有视频（每页 50 条）
- 保存为 JSON 文件

**WBI 签名流程**：
1. 调用 nav 接口获取 `img_key` 和 `sub_key`
2. 打乱拼接成 `mixin_key`
3. 参数排序 + 添加时间戳 `wts`
4. 计算 `md5(query + mixin_key)` 得到 `w_rid`

**API 参考文档**：https://github.com/SocialSisterYi/bilibili-API-collect

**需要提取的信息**：
- BV 号
- 视频标题（用于文件命名和显示）
- 视频链接
- 分P信息（如有）

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

#### 方案：百度云「音频文件转写」API（推荐）

**特点**：
- 支持长音频（适合 B站视频）
- 支持 mp3 格式（无需转换）
- 异步处理，12小时内返回结果
- 10小时/月免费额度

**API 文档**：https://cloud.baidu.com/doc/SPEECH/s/Klbxern8v

**流程**：
1. 使用 API Key + Secret Key 获取 Access Token
2. 将音频上传到可访问的 URL（或使用百度云存储）
3. 创建转写任务，获取 task_id
4. 轮询查询任务状态
5. 获取文字结果

**API 端点**：
- 获取 Token：`https://aip.baidubce.com/oauth/2.0/token`
- 创建任务：`https://aip.baidubce.com/rpc/2.0/aasr/v1/create`
- 查询结果：`https://aip.baidubce.com/rpc/2.0/aasr/v1/query`

**配置项**：
```javascript
baidu: {
  apiKey: '',      // 用户填入
  secretKey: '',   // 用户填入
  concurrent: 5,   // 并发数
}
```

#### 备选方案：通义听悟（网页自动化）

**流程**：
1. Playwright 打开通义听悟网页
2. 首次需要用户手动登录（保存 Cookie）
3. 自动上传音频文件
4. 等待转录完成（轮询检查状态）
5. 提取文字稿内容

**注意**：网页自动化方案稳定性较差，建议优先使用百度云 API

### Step 4: 格式化输出 + 进度保存

- 将文字稿格式化为 Markdown
- 添加视频元信息
- 保存到 `transcripts/{UID}/` 目录
- 生成合并文件

**进度保存机制**：
- 记录每个视频的处理状态（pending/downloaded/transcribed/completed）
- 保存到 `data/{UID}/progress.json`
- 支持 `--resume` 参数从中断处继续
- 避免重复下载和转写

**文件名安全处理**：
- 清理视频标题中的特殊字符（`/\:*?"<>|`）
- 限制文件名长度（最多 100 字符）

**分P视频处理**：
- 检测视频是否有多P
- 每个分P单独下载和转写
- 文件名格式：`{BVID}_P{n}.md`

---

## 📂 目录结构

```
bilibili-video-scraper/
├── src/
│   ├── index.js              # 主入口（命令行解析）
│   ├── channel_mode.js       # 频道模式
│   ├── single_mode.js        # 单视频模式
│   ├── step1_fetch_videos.js # B站 API 获取视频列表
│   ├── step2_download.js     # yt-dlp 下载音频
│   ├── step3_transcribe.js   # 百度云音频文件转写
│   ├── step3_tingwu.js       # 通义听悟（备选）
│   └── utils/
│       ├── bili_wbi.js       # B站 WBI 签名实现
│       ├── formatter.js      # 格式化输出
│       ├── logger.js         # 日志工具
│       ├── progress.js       # 进度管理
│       └── file_utils.js     # 文件名处理等工具
├── config.js                 # 配置文件
├── package.json              # Node.js 依赖
├── data/                     # 视频列表数据
│   └── {UID}/
│       ├── video_list.json   # 视频列表
│       └── progress.json     # 处理进度
├── downloads/                # 下载的音频
│   └── {UID}/
│       ├── {BVID}.mp3
│       └── {BVID}_P2.mp3     # 分P视频
└── transcripts/              # 文字稿输出
    └── {UID}/
        ├── {BVID}.md
        ├── {BVID}_P2.md      # 分P视频
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
--engine <engine>  # 引擎：baidu 或 tingwu（默认 baidu）
--format <format>  # 格式：md, txt, json（默认 md）
--resume           # 从上次中断处继续
--skip-download    # 跳过下载，只转写已下载的音频
```

### 示例

```bash
# 测试：只处理 3 个视频
npm run channel 1514320538 -- --limit 3

# 正式采集
npm run channel 1514320538

# 从中断处继续
npm run channel 1514320538 -- --resume

# 单视频
npm run single BV1xx411c7mD

# 使用通义听悟（备选）
npm run channel 1514320538 -- --engine tingwu
```

---

## ⚙️ 配置文件 (config.js)

```javascript
module.exports = {
  // 百度云「音频文件转写」API
  baidu: {
    enabled: true,
    apiKey: '',        // 用户填入
    secretKey: '',     // 用户填入
    concurrent: 5,     // 并发任务数
    pollInterval: 5000, // 查询间隔（毫秒）
  },

  // 通义听悟（备选，需要 Playwright）
  tingwu: {
    enabled: false,    // 默认关闭
    url: 'https://tingwu.aliyun.com',
    concurrent: 3,
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

  // Playwright 配置（仅通义听悟需要）
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
    "axios": "^1.6.0",
    "commander": "^11.1.0",
    "chalk": "^4.1.2",
    "fs-extra": "^11.2.0",
    "p-limit": "^3.1.0",
    "playwright": "^1.40.0"
  }
}
```

**说明**：
- `axios`：HTTP 请求（B站 API、百度云 API）
- `commander`：命令行参数解析
- `chalk`：彩色日志输出
- `fs-extra`：文件操作增强
- `p-limit`：并发控制
- `playwright`：仅通义听悟备选方案需要

### 外部工具
- **yt-dlp**：视频/音频下载
  - 安装：`pip install yt-dlp` 或 `brew install yt-dlp`
  - Windows：`scoop install yt-dlp`

---

## 🔐 百度云 API 申请步骤

1. 访问：https://console.bce.baidu.com/ai/#/ai/speech/overview/index
2. 登录/注册百度云账号
3. 创建应用，勾选「音频文件转写」能力
4. 获取 API Key 和 Secret Key
5. 填入 config.js

**API 文档**：https://cloud.baidu.com/doc/SPEECH/s/Klbxern8v

**免费额度**：10 小时/月

---

## 📊 性能预估

以 127 个视频、每个 10 分钟为例：

| 步骤 | 时间 |
|------|------|
| 获取列表（API） | 5-10 秒 |
| 下载音频（并发3） | 15-20 分钟 |
| 语音转写（百度云并发5） | 30-60 分钟（异步处理） |
| **总计** | **约 50-80 分钟** |

**注意**：百度云「音频文件转写」是异步接口，提交任务后需要等待处理完成，一般 12 小时内返回结果。实际等待时间取决于百度云服务器负载。

---

## ✅ 验收标准

1. 能够输入博主 UID，通过 B站 API 自动获取所有视频列表
2. 能够下载视频音频（MP3 格式）
3. 能够调用百度云「音频文件转写」API 进行语音识别
4. 能够输出 Markdown 格式的文字稿
5. 支持 `--limit` 参数限制处理数量
6. 支持 `--resume` 参数从中断处继续
7. 有清晰的进度显示和错误提示
8. 正确处理分P视频

---

## 🎯 目标博主

测试用博主：
- UID：`1514320538`
- 空间链接：`https://space.bilibili.com/1514320538`

---

## 📝 备注

- 使用 B站官方 API 获取视频列表（需实现 WBI 签名）
- 优先实现百度云「音频文件转写」API（支持长音频、mp3 格式）
- 通义听悟作为备选方案（需要 Playwright 网页自动化）
- 代码使用 Node.js 实现
- B站 API 参考文档：https://github.com/SocialSisterYi/bilibili-API-collect
