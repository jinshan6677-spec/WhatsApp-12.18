const sharp = require('sharp');
const toIco = require('to-ico');
const path = require('path');
const fs = require('fs');

const inputPath = path.join(__dirname, '..', 'resources', 'app-icon.png');
const outputPath = path.join(__dirname, '..', 'resources');
const iconsPath = path.join(outputPath, 'icons');

console.log('开始生成图标...');
console.log('输入文件:', inputPath);
console.log('输出目录:', outputPath);

// 检查输入文件是否存在
if (!fs.existsSync(inputPath)) {
  console.error('错误: 找不到输入图标文件:', inputPath);
  process.exit(1);
}

// 确保目录存在
if (!fs.existsSync(iconsPath)) {
  fs.mkdirSync(iconsPath, { recursive: true });
}

async function generateIcons() {
  try {
    // 生成不同尺寸的 PNG 图标
    const sizes = [16, 32, 48, 64, 128, 256, 512];
    const pngFiles = [];
    
    console.log('生成 PNG 图标...');
    for (const size of sizes) {
      const outputFile = path.join(iconsPath, `${size}x${size}.png`);
      await sharp(inputPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(outputFile);
      console.log(`  生成 ${size}x${size}.png`);
      
      // 收集用于生成 ICO 的文件
      if (size <= 256) {
        pngFiles.push(outputFile);
      }
    }
    
    // 生成 ICO 文件
    console.log('生成 ICO 文件...');
    const pngBuffers = await Promise.all(
      pngFiles.map(file => fs.promises.readFile(file))
    );
    const icoBuffer = await toIco(pngBuffers);
    const icoPath = path.join(outputPath, 'icon.ico');
    fs.writeFileSync(icoPath, icoBuffer);
    console.log('  生成 icon.ico');
    
    console.log('所有图标文件已生成成功！');
    console.log('注意: ICNS 文件需要在 macOS 上生成，Windows 打包只需要 ICO 文件');
  } catch (err) {
    console.error('生成图标时出错:', err);
    process.exit(1);
  }
}

generateIcons();
