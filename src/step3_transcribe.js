const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const pLimit = require('p-limit');
const logger = require('./utils/logger');
const config = require('../config');

// 百度云 API 端点
const TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const CREATE_URL = 'https://aip.baidubce.com/rpc/2.0/aasr/v1/create';
const QUERY_URL = 'https://aip.baidubce.com/rpc/2.0/aasr/v1/query';

let accessToken = null;
let tokenExpireTime = 0;

/**
 * 获取百度云 Access Token
 */
async function getAccessToken() {
  // 检查缓存
  if (accessToken && Date.now() < tokenExpireTime) {
    return accessToken;
  }

  const { apiKey, secretKey } = config.baidu;

  if (!apiKey || !secretKey) {
    throw new Error('百度云 API Key 或 Secret Key 未配置，请在 config.js 中填入');
  }

  const response = await axios.post(TOKEN_URL, null, {
    params: {
      grant_type: 'client_credentials',
      client_id: apiKey,
      client_secret: secretKey,
    },
  });

  if (response.data.error) {
    throw new Error(`获取 Token 失败: ${response.data.error_description}`);
  }

  accessToken = response.data.access_token;
  // Token 有效期 30 天，这里设置 29 天过期
  tokenExpireTime = Date.now() + 29 * 24 * 60 * 60 * 1000;

  return accessToken;
}

/**
 * 将本地音频文件转为 Base64
 */
async function audioToBase64(filePath) {
  const buffer = await fs.readFile(filePath);
  return buffer.toString('base64');
}

/**
 * 获取音频时长（秒）- 简单估算
 * 注意：这是粗略估算，实际时长可能不同
 */
async function getAudioDuration(filePath) {
  const stats = await fs.stat(filePath);
  // MP3 128kbps 大约每秒 16KB
  const estimatedSeconds = Math.ceil(stats.size / (16 * 1024));
  return estimatedSeconds;
}

/**
 * 创建转写任务
 */
async function createTask(audioBase64, format = 'mp3') {
  const token = await getAccessToken();

  const response = await axios.post(
    `${CREATE_URL}?access_token=${token}`,
    {
      speech: audioBase64,
      format,
      rate: 16000,
      channel: 1,
      cuid: 'bilibili-scraper',
      dev_pid: 80001, // 普通话模型
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.data.err_no !== 0) {
    throw new Error(`创建任务失败: ${response.data.err_msg}`);
  }

  return response.data.task_id;
}

/**
 * 通过 URL 创建转写任务（推荐，避免上传大文件）
 */
async function createTaskByUrl(speechUrl, format = 'mp3') {
  const token = await getAccessToken();

  const response = await axios.post(
    `${CREATE_URL}?access_token=${token}`,
    {
      speech_url: speechUrl,
      format,
      rate: 16000,
      channel: 1,
      cuid: 'bilibili-scraper',
      dev_pid: 80001,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.data.err_no !== 0) {
    throw new Error(`创建任务失败: ${response.data.err_msg}`);
  }

  return response.data.task_id;
}

/**
 * 查询任务结果
 */
async function queryTask(taskIds) {
  const token = await getAccessToken();

  const response = await axios.post(
    `${QUERY_URL}?access_token=${token}`,
    {
      task_ids: Array.isArray(taskIds) ? taskIds : [taskIds],
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.data.err_no !== 0) {
    throw new Error(`查询任务失败: ${response.data.err_msg}`);
  }

  return response.data.tasks_info;
}

/**
 * 等待任务完成
 */
async function waitForTask(taskId, timeout = 3600000) {
  const startTime = Date.now();
  const pollInterval = config.baidu.pollInterval || 5000;

  while (Date.now() - startTime < timeout) {
    const [taskInfo] = await queryTask(taskId);

    switch (taskInfo.task_status) {
      case 'Success':
        return taskInfo.task_result;
      case 'Failed':
        throw new Error(`转写失败: ${taskInfo.task_result?.err_msg || '未知错误'}`);
      case 'Running':
      case 'Pending':
        // 继续等待
        break;
      default:
        logger.warn(`未知任务状态: ${taskInfo.task_status}`);
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  throw new Error('转写超时');
}

/**
 * 转写单个音频文件
 */
async function transcribeAudio(audioPath) {
  // 读取文件并转为 Base64
  const audioBase64 = await audioToBase64(audioPath);

  // 创建任务
  const taskId = await createTask(audioBase64, config.download.format);
  logger.info(`已创建转写任务: ${taskId}`);

  // 等待结果
  const result = await waitForTask(taskId);

  // 提取文字
  if (result && result.result) {
    return result.result.join('');
  }

  return '';
}

/**
 * 批量转写音频文件
 */
async function transcribeVideos(videos, uid, progressManager = null) {
  logger.step(3, '语音转文字');

  // 检查配置
  if (!config.baidu.apiKey || !config.baidu.secretKey) {
    throw new Error('百度云 API 未配置，请在 config.js 中填入 apiKey 和 secretKey');
  }

  logger.info(`准备转写 ${videos.length} 个音频文件...`);

  const limit = pLimit(config.baidu.concurrent);
  const results = [];
  let completed = 0;
  let success = 0;
  let failed = 0;

  const tasks = videos.map((video) =>
    limit(async () => {
      const { bvid } = video;
      const audioPath = path.join(config.output.downloadDir, uid, `${bvid}.${config.download.format}`);

      try {
        // 检查音频文件是否存在
        if (!(await fs.pathExists(audioPath))) {
          throw new Error(`音频文件不存在: ${audioPath}`);
        }

        logger.info(`正在转写: ${bvid}`);
        const transcript = await transcribeAudio(audioPath);

        // 更新进度
        if (progressManager) {
          await progressManager.updateStatus(bvid, 'transcribed', {
            transcript,
          });
        }

        results.push({ video, transcript, success: true });
        success++;
      } catch (error) {
        logger.error(`转写失败 [${bvid}]: ${error.message}`);
        results.push({ video, error: error.message, success: false });
        failed++;
      }

      completed++;
      logger.progress(completed, videos.length, `成功: ${success}, 失败: ${failed}`);

      return results[results.length - 1];
    })
  );

  await Promise.all(tasks);

  logger.success(`转写完成: 成功 ${success}, 失败 ${failed}`);

  return results;
}

module.exports = {
  getAccessToken,
  transcribeAudio,
  transcribeVideos,
  createTask,
  createTaskByUrl,
  queryTask,
  waitForTask,
};
