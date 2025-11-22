const path = require('path');
const fs = require('fs-extra');

/**
 * 清理文件名中的非法字符
 */
function sanitizeFilename(filename, maxLength = 100) {
  // 替换非法字符
  let safe = filename
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  // 限制长度
  if (safe.length > maxLength) {
    safe = safe.substring(0, maxLength);
  }

  return safe;
}

/**
 * 确保目录存在
 */
async function ensureDir(dirPath) {
  await fs.ensureDir(dirPath);
}

/**
 * 读取 JSON 文件
 */
async function readJson(filePath) {
  try {
    return await fs.readJson(filePath);
  } catch {
    return null;
  }
}

/**
 * 写入 JSON 文件
 */
async function writeJson(filePath, data) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, data, { spaces: 2 });
}

/**
 * 检查文件是否存在
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 从 URL 或空间链接中提取 UID
 */
function extractUid(input) {
  // 纯数字
  if (/^\d+$/.test(input)) {
    return input;
  }

  // 空间链接: https://space.bilibili.com/1514320538
  const match = input.match(/space\.bilibili\.com\/(\d+)/);
  if (match) {
    return match[1];
  }

  return null;
}

/**
 * 从 URL 或 BV号 中提取 BVID
 */
function extractBvid(input) {
  // 纯 BV 号
  if (/^BV[\w]+$/.test(input)) {
    return input;
  }

  // 视频链接: https://www.bilibili.com/video/BV1xx411c7mD
  const match = input.match(/bilibili\.com\/video\/(BV[\w]+)/);
  if (match) {
    return match[1];
  }

  return null;
}

module.exports = {
  sanitizeFilename,
  ensureDir,
  readJson,
  writeJson,
  fileExists,
  extractUid,
  extractBvid,
};
