const chalk = require('chalk');

const logger = {
  info: (msg) => console.log(chalk.blue('[INFO]'), msg),
  success: (msg) => console.log(chalk.green('[SUCCESS]'), msg),
  warn: (msg) => console.log(chalk.yellow('[WARN]'), msg),
  error: (msg) => console.log(chalk.red('[ERROR]'), msg),

  // 进度显示
  progress: (current, total, msg) => {
    const percent = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
    process.stdout.write(`\r${chalk.cyan('[PROGRESS]')} ${bar} ${percent}% (${current}/${total}) ${msg}`);
    if (current === total) console.log();
  },

  // 步骤标题
  step: (num, title) => {
    console.log();
    console.log(chalk.bgBlue.white(` Step ${num} `), chalk.bold(title));
    console.log(chalk.gray('─'.repeat(50)));
  },

  // 视频信息
  video: (bvid, title) => {
    console.log(chalk.magenta(`  [${bvid}]`), title.substring(0, 40) + (title.length > 40 ? '...' : ''));
  },
};

module.exports = logger;
