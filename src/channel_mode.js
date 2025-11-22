const { fetchAllVideos, saveVideoList, loadVideoList } = require('./step1_fetch_videos');
const { downloadVideos } = require('./step2_download');
const { transcribeVideos } = require('./step3_transcribe');
const { saveAllTranscripts } = require('./utils/formatter');
const ProgressManager = require('./utils/progress');
const logger = require('./utils/logger');

/**
 * 频道模式：批量采集博主所有视频
 */
async function channelMode(uid, options = {}) {
  const { limit, engine = 'baidu', format = 'md', resume = false, skipDownload = false } = options;

  console.log();
  logger.info(`========== Bilibili 视频文字稿采集器 ==========`);
  logger.info(`博主 UID: ${uid}`);
  logger.info(`转录引擎: ${engine}`);
  logger.info(`输出格式: ${format}`);
  if (limit) logger.info(`限制数量: ${limit}`);
  if (resume) logger.info(`断点续传: 已启用`);
  if (skipDownload) logger.info(`跳过下载: 已启用`);
  console.log();

  // 初始化进度管理器
  const progressManager = new ProgressManager(uid);
  await progressManager.load();

  let videos;

  // Step 1: 获取视频列表
  if (resume) {
    // 尝试加载已保存的列表
    videos = await loadVideoList(uid);
    if (videos) {
      logger.info(`从缓存加载了 ${videos.length} 个视频`);
    }
  }

  if (!videos) {
    videos = await fetchAllVideos(uid, { limit });
    await saveVideoList(uid, videos);
  }

  if (videos.length === 0) {
    logger.warn('没有找到视频');
    return;
  }

  // 应用限制
  if (limit && videos.length > limit) {
    videos = videos.slice(0, limit);
    logger.info(`已限制为前 ${limit} 个视频`);
  }

  // Step 2: 下载音频
  let videosToDownload = videos;
  if (resume) {
    videosToDownload = progressManager.getPendingVideos(videos, 'pending');
    if (videosToDownload.length < videos.length) {
      logger.info(`断点续传: 跳过 ${videos.length - videosToDownload.length} 个已下载的视频`);
    }
  }

  if (!skipDownload && videosToDownload.length > 0) {
    await downloadVideos(videosToDownload, uid, progressManager);
  } else if (skipDownload) {
    logger.info('跳过下载步骤');
  }

  // Step 3: 语音转文字
  let videosToTranscribe = videos;
  if (resume) {
    videosToTranscribe = videos.filter((v) => {
      const status = progressManager.getStatus(v.bvid);
      return status === 'downloaded';
    });
    if (videosToTranscribe.length === 0) {
      // 如果没有待转写的，检查所有已下载的
      videosToTranscribe = videos.filter((v) => {
        const status = progressManager.getStatus(v.bvid);
        return status !== 'completed' && status !== 'transcribed';
      });
    }
  }

  let transcribeResults = [];
  if (engine === 'baidu') {
    if (videosToTranscribe.length > 0) {
      transcribeResults = await transcribeVideos(videosToTranscribe, uid, progressManager);
    } else {
      logger.info('没有需要转写的视频');
    }
  } else if (engine === 'tingwu') {
    logger.error('通义听悟引擎暂未实现');
    return;
  }

  // Step 4: 保存文字稿
  if (transcribeResults.length > 0) {
    await saveAllTranscripts(transcribeResults, uid, format);

    // 更新状态为完成
    for (const result of transcribeResults) {
      if (result.success) {
        await progressManager.updateStatus(result.video.bvid, 'completed');
      }
    }
  }

  // 显示统计
  console.log();
  const stats = progressManager.getStats();
  logger.info('========== 完成统计 ==========');
  logger.info(`总计: ${stats.total}`);
  logger.info(`已完成: ${stats.completed}`);
  logger.info(`待处理: ${stats.pending + stats.downloaded + stats.transcribed}`);
  console.log();
}

module.exports = channelMode;
