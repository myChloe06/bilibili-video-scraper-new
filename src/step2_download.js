const { spawn, execSync } = require('child_process');
const path = require('path');
const pLimit = require('p-limit');
const { ensureDir, fileExists, sanitizeFilename } = require('./utils/file_utils');
const logger = require('./utils/logger');
const config = require('../config');

/**
 * 检查 yt-dlp 是否已安装
 */
function checkYtDlp() {
  try {
    execSync('yt-dlp --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 使用 yt-dlp 下载单个视频的音频
 */
async function downloadAudio(video, uid, pageNum = null) {
  // 检查 yt-dlp 是否安装
  if (!checkYtDlp()) {
    const errorMsg = '未检测到 yt-dlp，请先安装: pip install yt-dlp 或 brew install yt-dlp (Mac) 或下载 https://github.com/yt-dlp/yt-dlp/releases';
    logger.error(errorMsg);
    return { success: false, error: errorMsg, path: '' };
  }

  const { bvid, title } = video;

  // 构建文件名
  const safeName = sanitizeFilename(title);
  const fileName = pageNum ? `${bvid}_P${pageNum}.${config.download.format}` : `${bvid}.${config.download.format}`;

  // 构建输出路径
  const outputDir = path.join(config.output.downloadDir, uid);
  await ensureDir(outputDir);
  const outputPath = path.join(outputDir, fileName);

  // 检查是否已下载
  if (await fileExists(outputPath)) {
    logger.info(`已存在，跳过: ${fileName}`);
    return { success: true, path: outputPath, skipped: true };
  }

  // 构建视频 URL
  let url = `https://www.bilibili.com/video/${bvid}`;
  if (pageNum) {
    url += `?p=${pageNum}`;
  }

  // yt-dlp 命令参数
  const args = [
    '--extract-audio',
    '--audio-format', config.download.format,
    '--audio-quality', config.download.quality,
    '-o', outputPath,
    '--no-playlist',
    '--progress',
    url,
  ];

  return new Promise((resolve) => {
    logger.info(`开始下载: ${bvid} -> ${fileName}`);
    const ytdlp = spawn('yt-dlp', args);

    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code === 0) {
        logger.success(`下载完成: ${fileName}`);
        resolve({ success: true, path: outputPath, skipped: false });
      } else {
        const errorMsg = stderr || stdout || `退出码: ${code}`;
        logger.error(`下载失败 [${bvid}]: ${errorMsg}`);
        resolve({ success: false, error: errorMsg, path: outputPath });
      }
    });

    ytdlp.on('error', (err) => {
      logger.error(`yt-dlp 执行错误: ${err.message}`);
      resolve({ success: false, error: err.message, path: outputPath });
    });
  });
}

/**
 * 批量下载视频音频
 */
async function downloadVideos(videos, uid, progressManager = null) {
  logger.step(2, '下载音频');
  logger.info(`准备下载 ${videos.length} 个视频的音频...`);

  const limit = pLimit(config.download.concurrent);
  const results = [];
  let completed = 0;
  let success = 0;
  let failed = 0;
  let skipped = 0;

  const tasks = videos.map((video) =>
    limit(async () => {
      const result = await downloadAudio(video, uid);
      completed++;

      if (result.success) {
        if (result.skipped) {
          skipped++;
        } else {
          success++;
        }

        // 更新进度
        if (progressManager) {
          await progressManager.updateStatus(video.bvid, 'downloaded', {
            audioPath: result.path,
          });
        }
      } else {
        failed++;
      }

      results.push({ video, result });
      logger.progress(completed, videos.length, `成功: ${success}, 跳过: ${skipped}, 失败: ${failed}`);

      return result;
    })
  );

  await Promise.all(tasks);

  logger.success(`下载完成: 成功 ${success}, 跳过 ${skipped}, 失败 ${failed}`);

  return results;
}

/**
 * 下载单个视频（处理分P）
 */
async function downloadSingleVideo(video, uid, progressManager = null) {
  const { bvid, pages } = video;

  // 如果有多个分P
  if (pages && pages.length > 1) {
    logger.info(`视频 ${bvid} 有 ${pages.length} 个分P`);

    const results = [];
    for (const page of pages) {
      const result = await downloadAudio(
        { ...video, title: `${video.title}_P${page.page}_${page.part}` },
        uid,
        page.page
      );
      results.push(result);

      if (result.success && progressManager) {
        await progressManager.updateStatus(`${bvid}_P${page.page}`, 'downloaded', {
          audioPath: result.path,
        });
      }
    }
    return results;
  }

  // 单P视频
  const result = await downloadAudio(video, uid);
  if (result.success && progressManager) {
    await progressManager.updateStatus(bvid, 'downloaded', {
      audioPath: result.path,
    });
  }

  return [result];
}

/**
 * 获取音频文件路径
 */
function getAudioPath(uid, bvid, pageNum = null) {
  const fileName = pageNum
    ? `${bvid}_P${pageNum}.${config.download.format}`
    : `${bvid}.${config.download.format}`;
  return path.join(config.output.downloadDir, uid, fileName);
}

module.exports = {
  checkYtDlp,
  downloadAudio,
  downloadVideos,
  downloadSingleVideo,
  getAudioPath,
};
