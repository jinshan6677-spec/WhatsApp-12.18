/**
 * 检查账号的自动启动配置
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

async function checkAutoStartConfig() {
  console.log('\n=== 检查账号自动启动配置 ===\n');

  try {
    // 获取账号配置文件路径
    const userDataPath = app.getPath('userData');
    console.log(`用户数据路径: ${userDataPath}`);
    
    const configPath = path.join(userDataPath, 'accounts.json');
    console.log(`配置文件路径: ${configPath}`);

    // 检查文件是否存在
    if (!fs.existsSync(configPath)) {
      console.log('❌ 账号配置文件不存在');
      return;
    }

    // 读取配置文件
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    console.log(`\n找到 ${config.accounts ? config.accounts.length : 0} 个账号\n`);

    // 检查每个账号的 autoStart 配置
    if (config.accounts && config.accounts.length > 0) {
      config.accounts.forEach((account, index) => {
        console.log(`账号 ${index + 1}:`);
        console.log(`  ID: ${account.id}`);
        console.log(`  名称: ${account.name}`);
        console.log(`  自动启动: ${account.autoStart === true ? '✅ 是' : '❌ 否'}`);
        console.log('');
      });

      // 统计
      const autoStartCount = config.accounts.filter(acc => acc.autoStart === true).length;
      console.log(`总计: ${autoStartCount} 个账号配置了自动启动\n`);

      if (autoStartCount > 0) {
        console.log('⚠️  这些账号会在应用启动时自动打开');
        console.log('💡 如果不想自动打开，请在账号设置中关闭"自动启动"选项\n');
      } else {
        console.log('✅ 没有账号配置自动启动，应用启动时不会自动打开任何账号\n');
      }
    } else {
      console.log('没有找到任何账号配置\n');
    }

  } catch (error) {
    console.error('❌ 检查配置失败:', error.message);
  }

  // 退出
  setTimeout(() => {
    app.quit();
  }, 1000);
}

// 应用启动后执行检查
app.whenReady().then(() => {
  checkAutoStartConfig();
});

app.on('window-all-closed', () => {
  // 保持应用运行
});
