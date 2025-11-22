const path = require('path');
const { readJson, writeJson } = require('./file_utils');
const config = require('../../config');

/**
 * 进度管理器
 * 记录每个视频的处理状态，支持断点续传
 */
class ProgressManager {
  constructor(uid) {
    this.uid = uid;
    this.filePath = path.join(config.output.dataDir, uid, 'progress.json');
    this.progress = {};
  }

  /**
   * 加载进度
   */
  async load() {
    const data = await readJson(this.filePath);
    this.progress = data || {};
    return this.progress;
  }

  /**
   * 保存进度
   */
  async save() {
    await writeJson(this.filePath, this.progress);
  }

  /**
   * 获取视频状态
   * @returns {string} pending | downloaded | transcribed | completed
   */
  getStatus(videoId) {
    return this.progress[videoId]?.status || 'pending';
  }

  /**
   * 更新视频状态
   */
  async updateStatus(videoId, status, extra = {}) {
    this.progress[videoId] = {
      ...this.progress[videoId],
      status,
      updatedAt: new Date().toISOString(),
      ...extra,
    };
    await this.save();
  }

  /**
   * 获取待处理的视频列表
   */
  getPendingVideos(videos, targetStatus = 'pending') {
    return videos.filter(v => {
      const status = this.getStatus(v.bvid);
      if (targetStatus === 'pending') {
        return status === 'pending';
      }
      if (targetStatus === 'downloaded') {
        return status === 'downloaded';
      }
      return status !== 'completed';
    });
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const statuses = Object.values(this.progress);
    return {
      total: statuses.length,
      pending: statuses.filter(s => s.status === 'pending').length,
      downloaded: statuses.filter(s => s.status === 'downloaded').length,
      transcribed: statuses.filter(s => s.status === 'transcribed').length,
      completed: statuses.filter(s => s.status === 'completed').length,
    };
  }
}

module.exports = ProgressManager;
