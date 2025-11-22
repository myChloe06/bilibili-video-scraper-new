const fs = require('fs-extra');
const path = require('path');
const { ensureDir, sanitizeFilename } = require('./file_utils');
const logger = require('./logger');
const config = require('../../config');

/**
 * 格式化时间戳为日期字符串
 */
function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toISOString().split('T')[0];
}

/**
 * 格式化当前时间
 */
function formatNow() {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

/**
 * 格式化时长（秒 -> MM:SS 或 HH:MM:SS）
 */
function formatDuration(seconds) {
  if (typeof seconds === 'string') {
    return seconds; // 已经是格式化的字符串
  }

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * 生成 Markdown 格式的文字稿
 */
function formatMarkdown(video, transcript) {
  const { bvid, title, duration, pubdate, url } = video;

  return `# ${title}

**视频信息**

- BV号：${bvid}
- 标题：${title}
- 时长：${formatDuration(duration)}
- 发布时间：${formatDate(pubdate)}
- 视频链接：${url}
- 转录时间：${formatNow()}

---

## 文字稿

${transcript || '（转录失败或无内容）'}

---

*本文字稿由 AI 自动生成*
`;
}

/**
 * 生成纯文本格式
 */
function formatText(video, transcript) {
  const { bvid, title, duration, pubdate, url } = video;

  return `${title}
================================================================================

BV号：${bvid}
时长：${formatDuration(duration)}
发布时间：${formatDate(pubdate)}
视频链接：${url}
转录时间：${formatNow()}

--------------------------------------------------------------------------------

${transcript || '（转录失败或无内容）'}

--------------------------------------------------------------------------------
本文字稿由 AI 自动生成
`;
}

/**
 * 生成 JSON 格式
 */
function formatJson(video, transcript) {
  return JSON.stringify(
    {
      bvid: video.bvid,
      title: video.title,
      duration: video.duration,
      pubdate: video.pubdate,
      url: video.url,
      transcriptTime: new Date().toISOString(),
      transcript,
    },
    null,
    2
  );
}

/**
 * 保存单个文字稿
 */
async function saveTranscript(video, transcript, uid, format = 'md') {
  const outputDir = path.join(config.output.transcriptDir, uid);
  await ensureDir(outputDir);

  const ext = format === 'md' ? 'md' : format === 'txt' ? 'txt' : 'json';
  const fileName = `${video.bvid}.${ext}`;
  const filePath = path.join(outputDir, fileName);

  let content;
  switch (format) {
    case 'txt':
      content = formatText(video, transcript);
      break;
    case 'json':
      content = formatJson(video, transcript);
      break;
    default:
      content = formatMarkdown(video, transcript);
  }

  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * 生成合并的文字稿文件
 */
async function saveMergedTranscripts(videos, transcripts, uid, format = 'md') {
  if (!config.output.mergeTranscripts) {
    return null;
  }

  const outputDir = path.join(config.output.transcriptDir, uid);
  await ensureDir(outputDir);

  const filePath = path.join(outputDir, `all_transcripts.${format === 'md' ? 'md' : format}`);

  // 生成目录
  let content = `# 全部视频文字稿

> 共 ${videos.length} 个视频
> 生成时间：${formatNow()}

## 目录

`;

  // 添加目录
  videos.forEach((video, index) => {
    content += `${index + 1}. [${video.title}](#${video.bvid})\n`;
  });

  content += '\n---\n\n';

  // 添加每个视频的文字稿
  videos.forEach((video, index) => {
    const transcript = transcripts[video.bvid] || '（转录失败或无内容）';

    content += `<a id="${video.bvid}"></a>\n\n`;
    content += `## ${index + 1}. ${video.title}\n\n`;
    content += `**视频信息**\n\n`;
    content += `- BV号：${video.bvid}\n`;
    content += `- 时长：${formatDuration(video.duration)}\n`;
    content += `- 发布时间：${formatDate(video.pubdate)}\n`;
    content += `- 视频链接：${video.url}\n\n`;
    content += `**文字稿**\n\n`;
    content += `${transcript}\n\n`;
    content += `---\n\n`;
  });

  content += `\n*本文字稿由 AI 自动生成*\n`;

  await fs.writeFile(filePath, content, 'utf-8');
  logger.info(`合并文件已保存: ${filePath}`);

  return filePath;
}

/**
 * 批量保存文字稿
 */
async function saveAllTranscripts(results, uid, format = 'md') {
  logger.step(4, '保存文字稿');

  const transcripts = {};
  let saved = 0;

  for (const result of results) {
    if (result.success && result.transcript) {
      const filePath = await saveTranscript(result.video, result.transcript, uid, format);
      transcripts[result.video.bvid] = result.transcript;
      saved++;
      logger.video(result.video.bvid, result.video.title);
    }
  }

  logger.success(`已保存 ${saved} 个文字稿`);

  // 生成合并文件
  if (config.output.mergeTranscripts && results.length > 0) {
    const videos = results.filter((r) => r.success).map((r) => r.video);
    await saveMergedTranscripts(videos, transcripts, uid, format);
  }

  return { saved, transcripts };
}

module.exports = {
  formatMarkdown,
  formatText,
  formatJson,
  saveTranscript,
  saveMergedTranscripts,
  saveAllTranscripts,
  formatDate,
  formatDuration,
};
