/**
 * 禁用所有账号的自动启动
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

async function disableAllAutoStart() {
  console.log('\n=== 禁用所有账号的自动启动 ===\n');

  try {
    // 获取账号配置文件路径
    const configPath = path.join(app.getPath('userData'), 'accounts.json');
    console.log(`配置文件路径: ${configPath}`);

    // 检查文件是否存在
    if (!fs.existsSync(configPath)) {
      console.log('❌ 账号配置文件不存在');
      console.log('💡 可能还没有创建任何账号\n');
      return;
    }

    // 读取配置文件
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    if (!config.accounts || config.accounts.length === 0) {
      console.log('没有找到任何账号配置\n');
      return;
    }

    console.log(`找到 ${config.accounts.length} 个账号\n`);

    // 统计修改前的状态
    const beforeCount = config.accounts.filter(acc => acc.autoStart === true).length;
    console.log(`修改前: ${beforeCount} 个账号启用了自动启动\n`);

    // 禁用所有账号的自动启动
    let modifiedCount = 0;
    config.accounts.forEach((account, index) => {
      if (account.autoStart === true) {
        account.autoStart = false;
        modifiedCount++;
        console.log(`✓ 已禁用账号 "${account.name}" 的自动启动`);
      }
    });

    if (modifiedCount > 0) {
      // 保存配置文件
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log(`\n✅ 成功禁用 ${modifiedCount} 个账号的自动启动`);
      console.log('💡 下次启动应用时，不会自动打开任何账号\n');
    } else {
      console.log('\n✅ 所有账号的自动启动已经是禁用状态\n');
    }

  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    console.error(error.stack);
  }

  // 退出
  setTimeout(() => {
    app.quit();
  }, 1000);
}

// 应用启动后执行
app.whenReady().then(() => {
  disableAllAutoStart();
});

app.on('window-all-closed', () => {
  // 保持应用运行
});
