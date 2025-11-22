const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs-extra');
const open = require('open');

const { fetchAllVideos, fetchVideoInfo, saveVideoList } = require('./step1_fetch_videos');
const { downloadVideos, downloadSingleVideo, checkYtDlp } = require('./step2_download');
const { transcribeVideos, transcribeAudio, getAccessToken } = require('./step3_transcribe');
const { saveAllTranscripts, saveTranscript } = require('./utils/formatter');
const ProgressManager = require('./utils/progress');
const { extractUid, extractBvid } = require('./utils/file_utils');
const config = require('../config');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;
const SETTINGS_FILE = path.join(__dirname, '../.settings.json');

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// WebSocket 连接管理
let wsClient = null;
wss.on('connection', (ws) => {
  wsClient = ws;
  ws.on('close', () => {
    wsClient = null;
  });
});

// 发送进度到前端
function sendProgress(type, data) {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify({ type, ...data }));
  }
}

// ==================== API 路由 ====================

// 获取设置
app.get('/api/settings', async (req, res) => {
  try {
    if (await fs.pathExists(SETTINGS_FILE)) {
      const settings = await fs.readJson(SETTINGS_FILE);
      res.json(settings);
    } else {
      res.json({ apiKey: '', secretKey: '' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 保存设置
app.post('/api/settings', async (req, res) => {
  try {
    const { apiKey, secretKey } = req.body;
    await fs.writeJson(SETTINGS_FILE, { apiKey, secretKey });

    // 更新运行时配置
    config.baidu.apiKey = apiKey;
    config.baidu.secretKey = secretKey;

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 测试 API 连接
app.post('/api/test-connection', async (req, res) => {
  try {
    const { apiKey, secretKey } = req.body;

    // 临时设置
    config.baidu.apiKey = apiKey;
    config.baidu.secretKey = secretKey;

    await getAccessToken();
    res.json({ success: true, message: 'API 连接成功' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 获取视频列表（频道模式）
app.post('/api/fetch-videos', async (req, res) => {
  try {
    const { input, startDate, endDate } = req.body;

    const uid = extractUid(input);
    if (!uid) {
      return res.status(400).json({ error: '无效的 UID 或空间链接' });
    }

    sendProgress('status', { message: '正在获取视频列表...' });

    const videos = await fetchAllVideos(uid, {});
    await saveVideoList(uid, videos);

    // 日期筛选
    let filteredVideos = videos;
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() / 1000 : 0;
      const end = endDate ? new Date(endDate).getTime() / 1000 + 86400 : Infinity;

      filteredVideos = videos.filter(v => v.pubdate >= start && v.pubdate <= end);
    }

    res.json({
      uid,
      total: videos.length,
      filtered: filteredVideos.length,
      videos: filteredVideos,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个视频信息（单视频模式）
app.post('/api/fetch-single-video', async (req, res) => {
  try {
    const { input } = req.body;

    const bvid = extractBvid(input);
    if (!bvid) {
      return res.status(400).json({ error: '无效的 BV号 或视频链接' });
    }

    sendProgress('status', { message: '正在获取视频信息...' });

    const video = await fetchVideoInfo(bvid);

    res.json({
      uid: String(video.owner.mid),
      video: {
        bvid: video.bvid,
        aid: video.aid,
        title: video.title,
        description: video.description,
        pic: video.pic,
        duration: video.duration,
        pubdate: video.pubdate,
        owner: video.owner,
        pages: video.pages,
        url: video.url,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 只下载音频（不转写）
app.post('/api/download-only', async (req, res) => {
  try {
    const { uid, videos } = req.body;

    // 检查 yt-dlp 是否安装
    if (!checkYtDlp()) {
      return res.status(400).json({
        error: '未检测到 yt-dlp，请先安装:\n• Windows: 下载 https://github.com/yt-dlp/yt-dlp/releases 并放入 PATH\n• Mac: brew install yt-dlp\n• Linux: pip install yt-dlp'
      });
    }

    res.json({ success: true, message: '下载任务已开始' });

    // 异步执行下载
    runDownloadOnly(uid, videos);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 只转写（已下载的音频）
app.post('/api/transcribe-only', async (req, res) => {
  try {
    const { uid, videos, format = 'md', engine = 'baidu' } = req.body;

    // 加载设置
    if (await fs.pathExists(SETTINGS_FILE)) {
      const settings = await fs.readJson(SETTINGS_FILE);
      config.baidu.apiKey = settings.apiKey;
      config.baidu.secretKey = settings.secretKey;
    }

    if (engine === 'baidu' && (!config.baidu.apiKey || !config.baidu.secretKey)) {
      return res.status(400).json({ error: '请先配置百度云 API Key' });
    }

    res.json({ success: true, message: '转写任务已开始' });

    // 异步执行转写
    runTranscribeOnly(uid, videos, format, engine);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 开始采集任务
app.post('/api/start-task', async (req, res) => {
  try {
    const { uid, videos, format = 'md', engine = 'baidu' } = req.body;

    // 检查 yt-dlp 是否安装
    if (!checkYtDlp()) {
      return res.status(400).json({
        error: '未检测到 yt-dlp，请先安装:\n• Windows: 下载 https://github.com/yt-dlp/yt-dlp/releases 并放入 PATH\n• Mac: brew install yt-dlp\n• Linux: pip install yt-dlp'
      });
    }

    // 加载设置
    if (await fs.pathExists(SETTINGS_FILE)) {
      const settings = await fs.readJson(SETTINGS_FILE);
      config.baidu.apiKey = settings.apiKey;
      config.baidu.secretKey = settings.secretKey;
    }

    if (engine === 'baidu' && (!config.baidu.apiKey || !config.baidu.secretKey)) {
      return res.status(400).json({ error: '请先配置百度云 API Key' });
    }

    res.json({ success: true, message: '任务已开始' });

    // 异步执行任务
    runTask(uid, videos, format, engine);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 执行采集任务
async function runTask(uid, videos, format, engine = 'baidu') {
  const progressManager = new ProgressManager(uid);
  await progressManager.load();

  try {
    // Step 1: 下载音频
    sendProgress('step', { step: 1, name: '下载音频' });

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      sendProgress('video-status', {
        bvid: video.bvid,
        status: 'downloading',
        progress: { current: i + 1, total: videos.length }
      });

      try {
        const { downloadAudio } = require('./step2_download');
        const result = await downloadAudio(video, uid);

        if (result.success) {
          await progressManager.updateStatus(video.bvid, 'downloaded', {
            audioPath: result.path,
          });
          sendProgress('video-status', { bvid: video.bvid, status: 'downloaded' });
        } else {
          sendProgress('video-status', { bvid: video.bvid, status: 'error', error: result.error });
        }
      } catch (error) {
        sendProgress('video-status', { bvid: video.bvid, status: 'error', error: error.message });
      }

      sendProgress('progress', { current: i + 1, total: videos.length, phase: 'download' });
    }

    // Step 2: 语音转文字
    const engineNames = { baidu: '百度云', whisper: 'Whisper', tingwu: '通义听悟' };
    sendProgress('step', { step: 2, name: `语音转文字 (${engineNames[engine] || engine})` });

    const transcriptResults = [];
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const status = progressManager.getStatus(video.bvid);

      if (status !== 'downloaded') continue;

      sendProgress('video-status', {
        bvid: video.bvid,
        status: 'transcribing',
        progress: { current: i + 1, total: videos.length }
      });

      try {
        const audioPath = path.join(config.output.downloadDir, uid, `${video.bvid}.${config.download.format}`);
        let transcript = '';

        if (engine === 'baidu') {
          transcript = await transcribeAudio(audioPath);
        } else if (engine === 'whisper') {
          throw new Error('Whisper 引擎暂未实现');
        } else if (engine === 'tingwu') {
          // TODO: 实现通义听悟 Playwright 方案
          throw new Error('通义听悟引擎暂未实现');
        }

        await progressManager.updateStatus(video.bvid, 'transcribed', { transcript });
        transcriptResults.push({ video, transcript, success: true });

        sendProgress('video-status', { bvid: video.bvid, status: 'transcribed' });
      } catch (error) {
        sendProgress('video-status', { bvid: video.bvid, status: 'error', error: error.message });
        transcriptResults.push({ video, error: error.message, success: false });
      }

      sendProgress('progress', { current: i + 1, total: videos.length, phase: 'transcribe' });
    }

    // Step 3: 保存文字稿
    sendProgress('step', { step: 3, name: '保存文字稿' });

    await saveAllTranscripts(transcriptResults, uid, format);

    // 更新完成状态
    for (const result of transcriptResults) {
      if (result.success) {
        await progressManager.updateStatus(result.video.bvid, 'completed');
        sendProgress('video-status', { bvid: result.video.bvid, status: 'completed' });
      }
    }

    sendProgress('complete', {
      success: transcriptResults.filter(r => r.success).length,
      failed: transcriptResults.filter(r => !r.success).length,
      outputDir: path.join(config.output.transcriptDir, uid),
    });

  } catch (error) {
    sendProgress('error', { message: error.message });
  }
}

// 只下载音频任务
async function runDownloadOnly(uid, videos) {
  const progressManager = new ProgressManager(uid);
  await progressManager.load();

  try {
    sendProgress('step', { step: 1, name: '下载音频' });

    let success = 0;
    let failed = 0;

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      sendProgress('video-status', {
        bvid: video.bvid,
        status: 'downloading',
        progress: { current: i + 1, total: videos.length }
      });

      try {
        const { downloadAudio } = require('./step2_download');
        const result = await downloadAudio(video, uid);

        if (result.success) {
          await progressManager.updateStatus(video.bvid, 'downloaded', {
            audioPath: result.path,
          });
          sendProgress('video-status', { bvid: video.bvid, status: 'downloaded' });
          success++;
        } else {
          sendProgress('video-status', { bvid: video.bvid, status: 'error', error: result.error });
          failed++;
        }
      } catch (error) {
        sendProgress('video-status', { bvid: video.bvid, status: 'error', error: error.message });
        failed++;
      }

      sendProgress('progress', { current: i + 1, total: videos.length, phase: 'download' });
    }

    sendProgress('complete', {
      success,
      failed,
      outputDir: path.join(config.output.downloadDir, uid),
      downloadOnly: true,
    });

  } catch (error) {
    sendProgress('error', { message: error.message });
  }
}

// 只转写音频任务
async function runTranscribeOnly(uid, videos, format, engine) {
  const progressManager = new ProgressManager(uid);
  await progressManager.load();

  try {
    sendProgress('step', { step: 1, name: `语音转文字 (${engine})` });

    const transcriptResults = [];

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];

      sendProgress('video-status', {
        bvid: video.bvid,
        status: 'transcribing',
        progress: { current: i + 1, total: videos.length }
      });

      try {
        const audioPath = path.join(config.output.downloadDir, uid, `${video.bvid}.${config.download.format}`);

        // 检查音频文件是否存在
        if (!(await fs.pathExists(audioPath))) {
          throw new Error('音频文件不存在，请先下载');
        }

        let transcript = '';

        if (engine === 'baidu') {
          transcript = await transcribeAudio(audioPath);
        } else if (engine === 'whisper') {
          // TODO: 实现 Whisper 转写
          throw new Error('Whisper 引擎暂未实现');
        } else if (engine === 'tingwu') {
          // TODO: 实现通义听悟转写
          throw new Error('通义听悟引擎暂未实现');
        }

        await progressManager.updateStatus(video.bvid, 'transcribed', { transcript });
        transcriptResults.push({ video, transcript, success: true });

        sendProgress('video-status', { bvid: video.bvid, status: 'transcribed' });
      } catch (error) {
        sendProgress('video-status', { bvid: video.bvid, status: 'error', error: error.message });
        transcriptResults.push({ video, error: error.message, success: false });
      }

      sendProgress('progress', { current: i + 1, total: videos.length, phase: 'transcribe' });
    }

    // 保存文字稿
    sendProgress('step', { step: 2, name: '保存文字稿' });

    await saveAllTranscripts(transcriptResults, uid, format);

    // 更新完成状态
    for (const result of transcriptResults) {
      if (result.success) {
        await progressManager.updateStatus(result.video.bvid, 'completed');
        sendProgress('video-status', { bvid: result.video.bvid, status: 'completed' });
      }
    }

    sendProgress('complete', {
      success: transcriptResults.filter(r => r.success).length,
      failed: transcriptResults.filter(r => !r.success).length,
      outputDir: path.join(config.output.transcriptDir, uid),
    });

  } catch (error) {
    sendProgress('error', { message: error.message });
  }
}

// 获取输出目录
app.get('/api/output-dir', (req, res) => {
  res.json({
    outputDir: path.resolve(config.output.transcriptDir),
    downloadDir: path.resolve(config.output.downloadDir),
  });
});

// 启动服务器
server.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Bilibili 视频文字稿采集器                               ║
║                                                           ║
║   服务已启动: http://localhost:${PORT}                      ║
║                                                           ║
║   正在打开浏览器...                                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // 加载已保存的设置
  if (await fs.pathExists(SETTINGS_FILE)) {
    const settings = await fs.readJson(SETTINGS_FILE);
    config.baidu.apiKey = settings.apiKey || '';
    config.baidu.secretKey = settings.secretKey || '';
  }

  // 打开浏览器
  await open(`http://localhost:${PORT}`);
});
