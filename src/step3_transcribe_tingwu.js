const path = require('path');
const fs = require('fs-extra');
const logger = require('./utils/logger');
const config = require('../config');

// 用户数据目录，用于保存登录状态
const USER_DATA_DIR = path.join(__dirname, '../.tingwu-user-data');
const TINGWU_URL = 'https://tingwu.aliyun.com/';

let browser = null;
let context = null;
let playwrightAvailable = null;

/**
 * 检查 Playwright 是否可用
 */
function checkPlaywright() {
  if (playwrightAvailable !== null) {
    return playwrightAvailable;
  }

  try {
    require.resolve('playwright');
    playwrightAvailable = true;
    return true;
  } catch {
    playwrightAvailable = false;
    return false;
  }
}

/**
 * 获取 chromium（延迟加载）
 */
function getChromium() {
  if (!checkPlaywright()) {
    throw new Error('Playwright 未安装，请运行: npm install playwright && npx playwright install chromium');
  }
  return require('playwright').chromium;
}

/**
 * 初始化浏览器
 */
async function initBrowser(headless = false) {
  if (browser) return;

  const chromium = getChromium();
  await fs.ensureDir(USER_DATA_DIR);

  browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless,
    viewport: { width: 1280, height: 800 },
    locale: 'zh-CN',
  });

  context = browser;
  logger.info('浏览器已启动');
}

/**
 * 关闭浏览器
 */
async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
    logger.info('浏览器已关闭');
  }
}

/**
 * 检查是否已登录
 */
async function checkLogin(page) {
  try {
    // 等待页面加载
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // 检查是否有登录按钮或用户头像
    const loginBtn = await page.$('text=登录');
    const userAvatar = await page.$('[class*="avatar"]');

    if (loginBtn && !userAvatar) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 等待用户登录
 */
async function waitForLogin(page, sendProgress = null) {
  const isLoggedIn = await checkLogin(page);

  if (!isLoggedIn) {
    logger.warn('请在浏览器中登录阿里云账号...');
    if (sendProgress) {
      sendProgress('status', { message: '请在浏览器中登录阿里云账号，登录后自动继续...' });
    }

    // 等待登录成功（最多5分钟）
    let attempts = 0;
    while (attempts < 60) {
      await page.waitForTimeout(5000);
      if (await checkLogin(page)) {
        logger.success('登录成功！');
        if (sendProgress) {
          sendProgress('status', { message: '登录成功，开始处理...' });
        }
        return true;
      }
      attempts++;
    }

    throw new Error('登录超时，请重试');
  }

  return true;
}

/**
 * 上传音频文件并获取转写结果
 */
async function transcribeWithTingwu(audioPath, sendProgress = null) {
  // 检查 Playwright
  if (!checkPlaywright()) {
    throw new Error('Playwright 未安装，请运行: npm install playwright && npx playwright install chromium');
  }

  if (!await fs.pathExists(audioPath)) {
    throw new Error(`音频文件不存在: ${audioPath}`);
  }

  // 首次使用时以有头模式启动，让用户登录
  const needLogin = !await fs.pathExists(path.join(USER_DATA_DIR, 'Default'));
  await initBrowser(!needLogin); // 如果需要登录则显示浏览器

  const page = await context.newPage();

  try {
    // 访问通义听悟
    logger.info('正在访问通义听悟...');
    await page.goto(TINGWU_URL, { waitUntil: 'networkidle' });

    // 检查/等待登录
    await waitForLogin(page, sendProgress);

    // 点击上传按钮或找到上传入口
    logger.info('正在上传音频文件...');
    if (sendProgress) {
      sendProgress('status', { message: '正在上传音频文件...' });
    }

    // 查找上传按钮
    const uploadBtn = await page.$('text=上传音视频') ||
                      await page.$('text=上传') ||
                      await page.$('[class*="upload"]');

    if (uploadBtn) {
      await uploadBtn.click();
      await page.waitForTimeout(1000);
    }

    // 处理文件上传
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      // 尝试点击触发文件选择
      const uploadArea = await page.$('[class*="upload"]') ||
                         await page.$('[class*="drag"]');
      if (uploadArea) {
        await uploadArea.click();
        await page.waitForTimeout(500);
      }
    }

    // 设置文件
    const input = await page.$('input[type="file"]');
    if (input) {
      await input.setInputFiles(audioPath);
    } else {
      throw new Error('无法找到文件上传入口');
    }

    logger.info('文件已上传，等待转写完成...');
    if (sendProgress) {
      sendProgress('status', { message: '文件已上传，等待转写完成（可能需要几分钟）...' });
    }

    // 等待转写完成（最多30分钟）
    let transcript = '';
    let attempts = 0;
    const maxAttempts = 360; // 30分钟 = 360 * 5秒

    while (attempts < maxAttempts) {
      await page.waitForTimeout(5000);

      // 检查是否有转写结果
      // 通义听悟的结果可能在不同的元素中
      const resultSelectors = [
        '[class*="transcript"]',
        '[class*="result"]',
        '[class*="content"]',
        '.text-content',
      ];

      for (const selector of resultSelectors) {
        const resultEl = await page.$(selector);
        if (resultEl) {
          const text = await resultEl.textContent();
          if (text && text.length > 50) { // 假设有效结果至少50字符
            transcript = text.trim();
            break;
          }
        }
      }

      if (transcript) {
        break;
      }

      // 检查是否显示"转写中"状态
      const processingEl = await page.$('text=转写中') ||
                           await page.$('text=处理中') ||
                           await page.$('[class*="loading"]');

      if (!processingEl && attempts > 12) { // 1分钟后如果没有处理中状态
        // 尝试点击查看结果
        const viewResultBtn = await page.$('text=查看') ||
                              await page.$('text=详情');
        if (viewResultBtn) {
          await viewResultBtn.click();
          await page.waitForTimeout(2000);
        }
      }

      attempts++;

      if (attempts % 12 === 0) { // 每分钟报告一次
        logger.info(`转写进行中... (${Math.floor(attempts * 5 / 60)} 分钟)`);
      }
    }

    if (!transcript) {
      throw new Error('转写超时或无法获取结果');
    }

    logger.success('转写完成！');
    return transcript;

  } finally {
    await page.close();
  }
}

/**
 * 批量转写音频文件
 */
async function transcribeVideosWithTingwu(videos, uid, sendProgress = null) {
  logger.step(3, '语音转文字 (通义听悟)');

  const results = [];
  let success = 0;
  let failed = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const { bvid } = video;
    const audioPath = path.join(config.output.downloadDir, uid, `${bvid}.${config.download.format}`);

    try {
      if (sendProgress) {
        sendProgress('video-status', { bvid, status: 'transcribing' });
        sendProgress('progress', { current: i + 1, total: videos.length, phase: 'transcribe' });
      }

      logger.info(`正在转写: ${bvid}`);
      const transcript = await transcribeWithTingwu(audioPath, sendProgress);

      results.push({ video, transcript, success: true });
      success++;

      if (sendProgress) {
        sendProgress('video-status', { bvid, status: 'transcribed' });
      }

    } catch (error) {
      logger.error(`转写失败 [${bvid}]: ${error.message}`);
      results.push({ video, error: error.message, success: false });
      failed++;

      if (sendProgress) {
        sendProgress('video-status', { bvid, status: 'error', error: error.message });
      }
    }
  }

  // 关闭浏览器
  await closeBrowser();

  logger.success(`转写完成: 成功 ${success}, 失败 ${failed}`);
  return results;
}

module.exports = {
  checkPlaywright,
  initBrowser,
  closeBrowser,
  transcribeWithTingwu,
  transcribeVideosWithTingwu,
};
