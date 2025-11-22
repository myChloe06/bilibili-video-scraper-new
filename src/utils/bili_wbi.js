const crypto = require('crypto');
const axios = require('axios');

// WBI 签名用的混淆表
const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

// 缓存 WBI keys
let cachedKeys = null;
let cacheTime = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 分钟

/**
 * 从 nav 接口获取 img_key 和 sub_key
 */
async function getWbiKeys() {
  // 检查缓存
  if (cachedKeys && Date.now() - cacheTime < CACHE_DURATION) {
    return cachedKeys;
  }

  const response = await axios.get('https://api.bilibili.com/x/web-interface/nav', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.bilibili.com',
    },
  });

  const { img_url, sub_url } = response.data.data.wbi_img;

  // 从 URL 中提取 key（文件名去掉扩展名）
  const imgKey = img_url.split('/').pop().split('.')[0];
  const subKey = sub_url.split('/').pop().split('.')[0];

  cachedKeys = { imgKey, subKey };
  cacheTime = Date.now();

  return cachedKeys;
}

/**
 * 生成 mixin_key
 */
function getMixinKey(imgKey, subKey) {
  const orig = imgKey + subKey;
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += orig[mixinKeyEncTab[i]];
  }
  return result;
}

/**
 * 对参数进行 WBI 签名
 */
async function encWbi(params) {
  const { imgKey, subKey } = await getWbiKeys();
  const mixinKey = getMixinKey(imgKey, subKey);

  // 添加时间戳
  const wts = Math.floor(Date.now() / 1000);
  params.wts = wts;

  // 按 key 排序
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});

  // 过滤特殊字符并编码
  const query = Object.entries(sortedParams)
    .map(([k, v]) => {
      const value = String(v).replace(/[!'()*]/g, '');
      return `${encodeURIComponent(k)}=${encodeURIComponent(value)}`;
    })
    .join('&');

  // 计算 w_rid
  const wRid = crypto.createHash('md5').update(query + mixinKey).digest('hex');

  return {
    ...sortedParams,
    w_rid: wRid,
  };
}

/**
 * 构建带 WBI 签名的 URL
 */
async function buildSignedUrl(baseUrl, params) {
  const signedParams = await encWbi(params);
  const query = Object.entries(signedParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${baseUrl}?${query}`;
}

module.exports = {
  getWbiKeys,
  getMixinKey,
  encWbi,
  buildSignedUrl,
};
