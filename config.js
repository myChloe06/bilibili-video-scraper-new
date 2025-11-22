module.exports = {
  // 百度云「音频文件转写」API
  baidu: {
    enabled: true,
    apiKey: '',        // 用户填入
    secretKey: '',     // 用户填入
    concurrent: 5,     // 并发任务数
    pollInterval: 5000, // 查询间隔（毫秒）
  },

  // 通义听悟（备选，需要 Playwright）
  tingwu: {
    enabled: false,
    url: 'https://tingwu.aliyun.com',
    concurrent: 3,
  },

  // 下载配置
  download: {
    concurrent: 3,     // 并发下载数
    format: 'mp3',     // 音频格式
    quality: '128',    // 音频质量（kbps）
  },

  // 输出配置
  output: {
    dataDir: './data',
    downloadDir: './downloads',
    transcriptDir: './transcripts',
    mergeTranscripts: true,
  },

  // Playwright 配置（仅通义听悟需要）
  playwright: {
    headless: false,
    slowMo: 50,
  },
};
