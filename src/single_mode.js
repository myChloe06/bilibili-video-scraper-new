const { fetchVideoInfo } = require('./step1_fetch_videos');
const { downloadSingleVideo } = require('./step2_download');
const { transcribeAudio } = require('./step3_transcribe');
const { saveTranscript } = require('./utils/formatter');
const { getAudioPath } = require('./step2_download');
const logger = require('./utils/logger');
const config = require('../config');

/**
 * 单视频模式：采集单个视频
 */
async function singleMode(bvid, options = {}) {
  const { engine = 'baidu', format = 'md' } = options;

  console.log();
  logger.info(`========== Bilibili 视频文字稿采集器 ==========`);
  logger.info(`视频 BV号: ${bvid}`);
  logger.info(`转录引擎: ${engine}`);
  logger.info(`输出格式: ${format}`);
  console.log();

  // Step 1: 获取视频信息
  logger.step(1, '获取视频信息');
  const video = await fetchVideoInfo(bvid);
  logger.info(`标题: ${video.title}`);
  logger.info(`时长: ${video.duration} 秒`);
  logger.info(`UP主: ${video.owner.name}`);

  if (video.pages.length > 1) {
    logger.info(`分P数: ${video.pages.length}`);
  }

  const uid = String(video.owner.mid);

  // Step 2: 下载音频
  logger.step(2, '下载音频');
  const downloadResults = await downloadSingleVideo(video, uid);

  const successDownloads = downloadResults.filter((r) => r.success);
  if (successDownloads.length === 0) {
    logger.error('所有音频下载失败');
    return;
  }

  logger.success(`成功下载 ${successDownloads.length} 个音频文件`);

  // Step 3: 语音转文字
  if (engine !== 'baidu') {
    logger.error('目前仅支持百度云引擎');
    return;
  }

  logger.step(3, '语音转文字');

  const transcripts = [];

  for (const result of successDownloads) {
    if (!result.success) continue;

    try {
      logger.info(`正在转写: ${result.path}`);
      const transcript = await transcribeAudio(result.path);
      transcripts.push({ path: result.path, transcript, success: true });
      logger.success('转写完成');
    } catch (error) {
      logger.error(`转写失败: ${error.message}`);
      transcripts.push({ path: result.path, error: error.message, success: false });
    }
  }

  // Step 4: 保存文字稿
  logger.step(4, '保存文字稿');

  for (let i = 0; i < transcripts.length; i++) {
    const t = transcripts[i];
    if (!t.success) continue;

    const videoInfo = {
      ...video,
      bvid: video.pages.length > 1 ? `${bvid}_P${i + 1}` : bvid,
    };

    const filePath = await saveTranscript(videoInfo, t.transcript, uid, format);
    logger.info(`已保存: ${filePath}`);
  }

  // 合并多P文字稿
  if (transcripts.length > 1) {
    const allText = transcripts
      .filter((t) => t.success)
      .map((t, i) => `## 第 ${i + 1} P\n\n${t.transcript}`)
      .join('\n\n---\n\n');

    const mergedVideo = { ...video };
    const mergedPath = await saveTranscript(mergedVideo, allText, uid, format);
    logger.info(`合并文件已保存: ${mergedPath}`);
  }

  console.log();
  logger.success('========== 采集完成 ==========');
  console.log();
}

module.exports = singleMode;
