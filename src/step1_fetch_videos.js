const axios = require('axios');
const path = require('path');
const { encWbi } = require('./utils/bili_wbi');
const { writeJson, readJson, ensureDir } = require('./utils/file_utils');
const logger = require('./utils/logger');
const config = require('../config');

const API_BASE = 'https://api.bilibili.com/x/space/wbi/arc/search';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.bilibili.com',
};

/**
 * 获取单页视频列表
 */
async function fetchPage(mid, pn = 1, ps = 50) {
  const params = {
    mid,
    pn,
    ps,
    order: 'pubdate', // 按发布时间排序
  };

  const signedParams = await encWbi(params);
  const query = Object.entries(signedParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const response = await axios.get(`${API_BASE}?${query}`, { headers });

  if (response.data.code !== 0) {
    throw new Error(`API 错误: ${response.data.message}`);
  }

  return response.data.data;
}

/**
 * 获取博主所有视频列表
 */
async function fetchAllVideos(uid, options = {}) {
  const { limit } = options;
  const videos = [];
  let page = 1;
  const pageSize = 50;
  let total = 0;

  logger.step(1, '获取视频列表');
  logger.info(`正在获取 UID: ${uid} 的视频列表...`);

  while (true) {
    try {
      const data = await fetchPage(uid, page, pageSize);

      if (page === 1) {
        total = data.page.count;
        logger.info(`共找到 ${total} 个视频`);
      }

      const vlist = data.list.vlist || [];
      if (vlist.length === 0) break;

      for (const v of vlist) {
        videos.push({
          bvid: v.bvid,
          aid: v.aid,
          title: v.title,
          description: v.description,
          pic: v.pic,
          duration: v.length, // 格式: "10:35"
          pubdate: v.created,
          play: v.play,
          comment: v.comment,
          url: `https://www.bilibili.com/video/${v.bvid}`,
        });

        // 检查是否达到限制
        if (limit && videos.length >= limit) {
          logger.info(`已达到限制数量: ${limit}`);
          break;
        }
      }

      logger.progress(Math.min(videos.length, total), total, `已获取 ${videos.length} 个视频`);

      // 检查是否达到限制或已获取完毕
      if (limit && videos.length >= limit) break;
      if (videos.length >= total) break;

      page++;

      // 延迟避免请求过快
      await new Promise(r => setTimeout(r, 300));
    } catch (error) {
      logger.error(`获取第 ${page} 页失败: ${error.message}`);
      throw error;
    }
  }

  logger.success(`成功获取 ${videos.length} 个视频`);
  return videos;
}

/**
 * 获取视频分P信息
 */
async function fetchVideoParts(bvid) {
  const url = `https://api.bilibili.com/x/player/pagelist?bvid=${bvid}`;
  const response = await axios.get(url, { headers });

  if (response.data.code !== 0) {
    throw new Error(`获取分P信息失败: ${response.data.message}`);
  }

  return response.data.data.map((p, index) => ({
    cid: p.cid,
    page: index + 1,
    part: p.part,
    duration: p.duration, // 秒
  }));
}

/**
 * 获取单个视频信息
 */
async function fetchVideoInfo(bvid) {
  const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
  const response = await axios.get(url, { headers });

  if (response.data.code !== 0) {
    throw new Error(`获取视频信息失败: ${response.data.message}`);
  }

  const v = response.data.data;
  return {
    bvid: v.bvid,
    aid: v.aid,
    title: v.title,
    description: v.desc,
    pic: v.pic,
    duration: v.duration, // 秒
    pubdate: v.pubdate,
    owner: {
      mid: v.owner.mid,
      name: v.owner.name,
    },
    pages: v.pages.map((p, index) => ({
      cid: p.cid,
      page: index + 1,
      part: p.part,
      duration: p.duration,
    })),
    url: `https://www.bilibili.com/video/${v.bvid}`,
  };
}

/**
 * 保存视频列表到文件
 */
async function saveVideoList(uid, videos) {
  const dir = path.join(config.output.dataDir, uid);
  await ensureDir(dir);

  const filePath = path.join(dir, 'video_list.json');
  await writeJson(filePath, {
    uid,
    count: videos.length,
    updatedAt: new Date().toISOString(),
    videos,
  });

  logger.info(`视频列表已保存到: ${filePath}`);
  return filePath;
}

/**
 * 加载已保存的视频列表
 */
async function loadVideoList(uid) {
  const filePath = path.join(config.output.dataDir, uid, 'video_list.json');
  const data = await readJson(filePath);
  return data?.videos || null;
}

module.exports = {
  fetchAllVideos,
  fetchVideoParts,
  fetchVideoInfo,
  saveVideoList,
  loadVideoList,
};
