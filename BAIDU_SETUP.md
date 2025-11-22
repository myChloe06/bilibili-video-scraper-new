# 百度云「音频文件转写」配置指南

## 快速开始

百度云「音频文件转写」是本项目推荐的语音识别方案，具有以下优势：

- **10小时免费额度**（每月）
- **支持长音频**（适合 B站视频）
- **支持 mp3 格式**（无需转换）
- **准确率高**（针对中文优化）
- **异步处理**（批量提交，自动等待结果）

**API 文档**：https://cloud.baidu.com/doc/SPEECH/s/Klbxern8v

---

## 申请 API Key 步骤

### 1. 注册百度云账号

访问：https://login.bce.baidu.com/

### 2. 进入语音识别控制台

访问：https://console.bce.baidu.com/ai/#/ai/speech/overview/index

### 3. 领取免费额度

首次使用需要在「语音技术 - 概览」页面领取免费额度。

### 4. 创建应用

1. 点击「创建应用」
2. 填写应用名称（如：bilibili-scraper）
3. 勾选「音频文件转写」能力
4. 点击「立即创建」

### 5. 获取密钥

创建成功后，你会看到：

```
AppID: xxxxxxxx
API Key: xxxxxxxxxxxxxxxxxxxx
Secret Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**复制 API Key 和 Secret Key**

---

## 配置密钥

编辑 `config.js` 文件：

```javascript
baidu: {
  enabled: true,
  apiKey: '你的API_KEY',        // <- 填在这里
  secretKey: '你的SECRET_KEY',  // <- 填在这里
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

---

## 使用测试

### 测试运行（推荐）

先测试 3 个视频：

```bash
npm run channel 1514320538 -- --limit 3
```

### 正式运行

采集所有视频：

```bash
npm run channel 1514320538
```

### 单视频模式

```bash
npm run single BV1xx411c7mD
```

---

## API 调用流程

本项目使用百度云「音频文件转写」异步接口，流程如下：

```
1. 获取 Access Token
   POST https://aip.baidubce.com/oauth/2.0/token

2. 创建转写任务
   POST https://aip.baidubce.com/rpc/2.0/aasr/v1/create
   - 提交音频 URL
   - 获取 task_id

3. 轮询查询结果
   POST https://aip.baidubce.com/rpc/2.0/aasr/v1/query
   - 使用 task_id 查询
   - 等待状态变为 "Success"

4. 获取文字结果
```

**注意**：音频需要通过可访问的 URL 提交，本项目会自动将本地音频上传到临时存储。

---

## 费用说明

| 项目 | 说明 |
|------|------|
| **免费额度** | 10 小时/月 |
| **超出后收费** | 约 2.5元/小时 |

**示例计算**（127个视频，每个约10分钟 = 21小时）：
- 免费额度：10 小时 = 0元
- 超出部分：11 小时 × 2.5元 = 27.5元

---

## 故障排查

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
- 调整下载音频质量（config.js 中 download.quality）

### 问题 4：超过免费额度

**解决：**
- 查看控制台的用量统计
- 分批处理，每月用免费额度
- 或直接付费继续使用

---

## 推荐配置

```javascript
// config.js 推荐配置

baidu: {
  enabled: true,
  apiKey: '你的API_KEY',
  secretKey: '你的SECRET_KEY',
  concurrent: 5,        // 并发数：5个同时处理
  pollInterval: 5000,   // 查询间隔：5秒
},

download: {
  concurrent: 3,
  format: 'mp3',
  quality: '128',       // 音频质量：128kbps
},

output: {
  mergeTranscripts: true,  // 生成合并文件
},
```

---

## 相关链接

- **API 文档**：https://cloud.baidu.com/doc/SPEECH/s/Klbxern8v
- **控制台**：https://console.bce.baidu.com/ai/#/ai/speech/overview/index
- **计费说明**：https://cloud.baidu.com/doc/SPEECH/s/9k38lxpww
