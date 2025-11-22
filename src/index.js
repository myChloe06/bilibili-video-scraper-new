#!/usr/bin/env node

const { program } = require('commander');
const channelMode = require('./channel_mode');
const singleMode = require('./single_mode');
const { extractUid, extractBvid } = require('./utils/file_utils');
const logger = require('./utils/logger');

program
  .name('bilibili-scraper')
  .description('Bilibili 视频文字稿采集器')
  .version('1.0.0');

// 频道模式
program
  .command('channel <uid>')
  .description('采集博主所有视频的文字稿')
  .option('-l, --limit <number>', '限制处理视频数量', parseInt)
  .option('-e, --engine <engine>', '转录引擎: baidu 或 tingwu', 'baidu')
  .option('-f, --format <format>', '输出格式: md, txt, json', 'md')
  .option('--resume', '从上次中断处继续')
  .option('--skip-download', '跳过下载步骤')
  .action(async (uidInput, options) => {
    try {
      const uid = extractUid(uidInput);
      if (!uid) {
        logger.error('无效的 UID 或空间链接');
        process.exit(1);
      }

      await channelMode(uid, {
        limit: options.limit,
        engine: options.engine,
        format: options.format,
        resume: options.resume,
        skipDownload: options.skipDownload,
      });
    } catch (error) {
      logger.error(`执行失败: ${error.message}`);
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// 单视频模式
program
  .command('single <bvid>')
  .description('采集单个视频的文字稿')
  .option('-e, --engine <engine>', '转录引擎: baidu 或 tingwu', 'baidu')
  .option('-f, --format <format>', '输出格式: md, txt, json', 'md')
  .action(async (bvidInput, options) => {
    try {
      const bvid = extractBvid(bvidInput);
      if (!bvid) {
        logger.error('无效的 BV号 或视频链接');
        process.exit(1);
      }

      await singleMode(bvid, {
        engine: options.engine,
        format: options.format,
      });
    } catch (error) {
      logger.error(`执行失败: ${error.message}`);
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
  });

program.parse();
