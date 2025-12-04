/**
 * 清除翻译缓存脚本
 * 用于测试不同风格时清除旧的缓存结果
 */

const fs = require('fs');
const path = require('path');

const cacheDir = path.join(__dirname, 'cache');

try {
  if (fs.existsSync(cacheDir)) {
    const files = fs.readdirSync(cacheDir);
    let count = 0;
    
    for (const file of files) {
      const filePath = path.join(cacheDir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        count++;
      }
    }
    
    console.log(`✅ 已清除 ${count} 个缓存文件`);
  } else {
    console.log('ℹ️  缓存目录不存在');
  }
} catch (error) {
  console.error('❌ 清除缓存失败:', error.message);
}
