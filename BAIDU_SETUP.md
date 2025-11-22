# 百度云语音识别配置指南

## 🎯 快速开始

百度云语音识别是推荐的转录方案之一，具有以下优势：

- ✅ **10小时免费额度**（每月）
- ✅ **准确率高**（针对中文优化）
- ✅ **速度快**（云端并发处理）
- ✅ **简单易用**（纯 API 调用，无需安装模型）

---

## 📝 申请 API Key 步骤

### 1. 注册百度云账号

访问：https://login.bce.baidu.com/

### 2. 进入语音识别控制台

访问：https://console.bce.baidu.com/ai/#/ai/speech/overview/index

### 3. 创建应用

1. 点击「创建应用」
2. 填写应用名称（如：bilibili-scraper）
3. 选择应用类型：其他
4. 点击「立即创建」

### 4. 获取密钥

创建成功后，你会看到：

```
AppID: xxxxxxxx
API Key: xxxxxxxxxxxxxxxxxxxx
Secret Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**复制 API Key 和 Secret Key**（下一步要用）

---

## ⚙️ 配置密钥

### 方式 1：直接在 config.js 中配置（推荐）

编辑 `config.js` 文件：

```javascript
// 步骤3C: 百度云语音识别 API
baidu: {
  enabled: true,
  apiKey: '你的API_KEY',        // ← 填在这里
  secretKey: '你的SECRET_KEY',  // ← 填在这里
  concurrent: 5,
},
```

**示例：**

```javascript
baidu: {
  enabled: true,
  apiKey: 'Ab1Cd2Ef3Gh4Ij5Kl6Mn',
  secretKey: 'Op7Qr8St9Uv0Wx1Yz2Ab3Cd4Ef5Gh6Hi',
  concurrent: 5,
},
```

### 方式 2：使用环境变量（高级）

如果你不想把密钥直接写在代码里，可以使用环境变量：

1. 创建 `.env` 文件：
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env`：
   ```
   BAIDU_API_KEY=你的API_KEY
   BAIDU_SECRET_KEY=你的SECRET_KEY
   ```

3. 修改 `config.js`：
   ```javascript
   baidu: {
     enabled: true,
     apiKey: process.env.BAIDU_API_KEY || '',
     secretKey: process.env.BAIDU_SECRET_KEY || '',
     concurrent: 5,
   },
   ```

---

## 🚀 使用百度云转录

### 测试运行（推荐）

先测试 3 个视频：

```bash
npm run channel 1514320538 -- --engine baidu --limit 3
```

### 正式运行

采集所有视频：

```bash
npm run channel 1514320538 -- --engine baidu
```

### 单视频模式

```bash
npm run single BV1xx411c7mD -- --engine baidu
```

---

## 📊 性能和费用

### 性能对比（127个视频，每个10分钟）

| 方案 | 时间 | 费用 | 准确率 |
|------|------|------|--------|
| **百度云** | 30-40分钟 | 0元（免费额度内） | ⭐⭐⭐⭐ |
| **通义听悟** | 2-3小时 | 0元（需确认额度） | ⭐⭐⭐⭐⭐ |
| **Whisper (GPU)** | 1-1.5小时 | 0元 | ⭐⭐⭐⭐ |
| **Whisper (CPU)** | 3-4小时 | 0元 | ⭐⭐⭐⭐ |

### 费用说明

- **免费额度**：10 小时/月
- **超出后收费**：约 2.5元/小时
- **127个视频（21小时）**：
  - 免费额度内：10 小时 = 0元
  - 超出部分：11 小时 × 2.5元 = 27.5元

**结论：测试少量视频完全免费，批量采集成本也很低！**

---

## 🔍 故障排查

### 问题 1：提示「百度云 API 未配置」

**原因：** 没有填写 API Key 和 Secret Key

**解决：** 在 `config.js` 中填入你的密钥

### 问题 2：提示「获取 Token 失败」

**可能原因：**
- API Key 或 Secret Key 填写错误
- 网络问题

**解决：**
1. 检查密钥是否正确（不要有多余空格）
2. 检查网络连接
3. 访问控制台确认应用状态

### 问题 3：识别失败或准确率低

**可能原因：**
- 音频质量差
- 背景噪音大
- 非标准普通话

**解决：**
- 使用高质量音频源
- 对比通义听悟的结果
- 调整下载音频质量（config.js 中 step2.quality）

### 问题 4：超过免费额度

**解决：**
- 查看控制台的用量统计
- 考虑切换到 Whisper（完全免费）
- 或者分批处理，每月用免费额度

---

## 💡 对比测试建议

为了选择最适合你的方案，建议同时测试百度云和通义听悟：

```bash
# 测试百度云（3个视频）
npm run channel 1514320538 -- --engine baidu --limit 3

# 测试通义听悟（同样的3个视频）
npm run channel 1514320538 -- --engine tingwu --limit 3

# 对比结果
# 查看 transcripts/1514320538/ 目录
# 对比文字稿的准确率和完整性
```

**对比维度：**
1. ✅ 准确率（有没有错别字）
2. ✅ 完整性（有没有遗漏）
3. ✅ 标点符号（是否正确）
4. ✅ 速度（哪个更快）
5. ✅ 稳定性（是否经常失败）

---

## 📞 获取帮助

- **百度云文档**：https://cloud.baidu.com/doc/SPEECH/s/0lbxfnc9b
- **控制台**：https://console.bce.baidu.com/ai/#/ai/speech/overview/index
- **问题反馈**：项目 GitHub Issues

---

## ⭐ 推荐配置

```javascript
// config.js 推荐配置

baidu: {
  enabled: true,
  apiKey: '你的API_KEY',
  secretKey: '你的SECRET_KEY',
  concurrent: 5,  // 并发数：5个同时处理（速度快）
},

step2: {
  concurrent: 3,
  outputFormat: 'mp3',
  quality: '128',  // 音频质量：128kbps（足够清晰）
},

output: {
  mergeTranscripts: true,  // 生成合并文件
},
```

这样配置可以获得最佳的速度和质量平衡！
