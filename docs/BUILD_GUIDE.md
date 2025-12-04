# 构建和发布指南

## 目录

- [环境准备](#环境准备)
- [本地构建](#本地构建)
- [打包应用](#打包应用)
- [发布流程](#发布流程)
- [持续集成](#持续集成)
- [故障排除](#故障排除)

---

## 环境准备

### 系统要求

**Windows**:
- Windows 10 或更高版本
- Node.js 18.x 或更高
- Python 3.x（用于 node-gyp）
- Visual Studio Build Tools

**macOS**:
- macOS 12 或更高版本
- Node.js 18.x 或更高
- Xcode Command Line Tools

**Linux**:
- Ubuntu 20.04 或更高版本
- Node.js 18.x 或更高
- 构建工具：`build-essential`, `libssl-dev`

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/your-org/whatsapp-desktop-translation.git
cd whatsapp-desktop-translation

# 安装依赖
npm install

# 安装应用依赖
npm run postinstall
```

---

## 本地构建

### 开发模式

```bash
# 启动应用（开发模式）
npm run dev

# 或者普通启动
npm start
```

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```


### 代码检查

```bash
# 运行 ESLint
npm run lint

# 自动修复问题
npm run lint:fix
```

---

## 打包应用

### 打包所有平台

```bash
# 打包 Windows、macOS 和 Linux
npm run build:all
```

### 打包特定平台

**Windows**:

```bash
npm run build:win
```

生成文件：
- `dist/WhatsApp Desktop Translation-1.0.0-x64.exe` (NSIS 安装程序)
- `dist/WhatsApp Desktop Translation-1.0.0-ia32.exe` (32位安装程序)
- `dist/WhatsApp Desktop Translation-1.0.0-portable.exe` (便携版)

**macOS**:

```bash
npm run build:mac
```

生成文件：
- `dist/WhatsApp Desktop Translation-1.0.0-x64.dmg` (Intel)
- `dist/WhatsApp Desktop Translation-1.0.0-arm64.dmg` (Apple Silicon)
- `dist/WhatsApp Desktop Translation-1.0.0-x64.zip`
- `dist/WhatsApp Desktop Translation-1.0.0-arm64.zip`

**Linux**:

```bash
npm run build:linux
```

生成文件：
- `dist/WhatsApp Desktop Translation-1.0.0-x64.AppImage`
- `dist/WhatsApp Desktop Translation-1.0.0-arm64.AppImage`
- `dist/WhatsApp Desktop Translation-1.0.0-x64.deb`
- `dist/WhatsApp Desktop Translation-1.0.0-arm64.deb`
- `dist/WhatsApp Desktop Translation-1.0.0-x64.rpm`

### 仅打包不构建安装程序

```bash
npm run pack
```

这会在 `dist` 目录中创建未打包的应用程序文件夹，用于测试。

---

## 发布流程

### 1. 准备发布

**更新版本号**:

```bash
# 更新 package.json 中的版本号
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

**更新 CHANGELOG**:

在 `CHANGELOG.md` 中记录更改：

```markdown
## [1.0.1] - 2024-01-20

### Added
- 新增 DeepSeek 翻译引擎支持
- 添加翻译统计功能

### Fixed
- 修复缓存清理问题
- 修复群组翻译开关无效的问题

### Changed
- 优化翻译速度
- 改进 UI 响应性
```

### 2. 构建发布版本

```bash
# 清理旧的构建文件
rm -rf dist

# 运行测试
npm test

# 构建所有平台
npm run build:all
```

### 3. 测试构建产物

在各个平台上测试安装包：

**Windows**:
- 安装 NSIS 安装程序
- 测试便携版
- 验证所有功能

**macOS**:
- 挂载 DMG 文件
- 拖动到 Applications
- 验证签名和公证

**Linux**:
- 安装 AppImage
- 安装 DEB/RPM 包
- 验证依赖

### 4. 创建 GitHub Release

```bash
# 创建 Git 标签
git tag -a v1.0.1 -m "Release version 1.0.1"
git push origin v1.0.1
```

在 GitHub 上创建 Release：

1. 访问 `https://github.com/your-org/whatsapp-desktop-translation/releases/new`
2. 选择标签 `v1.0.1`
3. 填写 Release 标题和说明
4. 上传构建产物
5. 发布 Release

### 5. 自动发布（推荐）

配置 `package.json` 中的 `publish` 字段后，electron-builder 可以自动发布到 GitHub：

```bash
# 设置 GitHub Token
export GH_TOKEN="your_github_token"

# 构建并发布
npm run build:all
```

---

## 持续集成

### GitHub Actions

创建 `.github/workflows/build.yml`：

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build application
        run: npm run build
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-build
          path: dist/*
```

### 配置 Secrets

在 GitHub 仓库设置中添加：

- `GH_TOKEN`: GitHub Personal Access Token（用于发布）
- `APPLE_ID`: Apple ID（用于 macOS 公证）
- `APPLE_ID_PASSWORD`: Apple ID 密码
- `CSC_LINK`: 代码签名证书（Base64 编码）
- `CSC_KEY_PASSWORD`: 证书密码

---

## 代码签名

### Windows 代码签名

1. **获取代码签名证书**

从证书颁发机构（如 DigiCert、Sectigo）购买证书。

2. **配置签名**

在 `package.json` 中添加：

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.pfx",
      "certificatePassword": "password",
      "signingHashAlgorithms": ["sha256"],
      "signDlls": true
    }
  }
}
```

或使用环境变量：

```bash
export CSC_LINK=path/to/certificate.pfx
export CSC_KEY_PASSWORD=password
npm run build:win
```

### macOS 代码签名和公证

1. **获取开发者证书**

在 Apple Developer 网站申请证书。

2. **配置签名**

```json
{
  "build": {
    "mac": {
      "identity": "Developer ID Application: Your Name (TEAM_ID)",
      "hardenedRuntime": true,
      "entitlements": "resources/entitlements.mac.plist",
      "entitlementsInherit": "resources/entitlements.mac.plist"
    }
  }
}
```

3. **公证应用**

```bash
export APPLE_ID=your@email.com
export APPLE_ID_PASSWORD=app-specific-password
npm run build:mac
```

electron-builder 会自动处理公证流程。

### Linux 签名

Linux 通常不需要代码签名，但可以使用 GPG 签名：

```bash
# 生成 GPG 密钥
gpg --gen-key

# 签名文件
gpg --detach-sign --armor dist/WhatsApp-Desktop-Translation-1.0.0-x64.AppImage
```

---

## 故障排除

### 问题 1: 构建失败 - 缺少依赖

**错误**:
```
Error: Cannot find module 'electron-builder'
```

**解决方法**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### 问题 2: Windows 构建失败 - 缺少 Python

**错误**:
```
gyp ERR! find Python
```

**解决方法**:
```bash
# 安装 Python 3.x
# 或者使用 windows-build-tools
npm install --global windows-build-tools
```

### 问题 3: macOS 公证失败

**错误**:
```
Error: Notarization failed
```

**解决方法**:
1. 确保使用 App-Specific Password
2. 检查 Apple ID 和密码是否正确
3. 确保证书有效

### 问题 4: Linux 构建失败 - 缺少库

**错误**:
```
Error: libssl.so.1.1: cannot open shared object file
```

**解决方法**:
```bash
# Ubuntu/Debian
sudo apt-get install libssl-dev

# Fedora
sudo dnf install openssl-devel
```

### 问题 5: 构建产物过大

**解决方法**:

1. **排除不必要的文件**

在 `package.json` 中：

```json
{
  "build": {
    "files": [
      "src/**/*",
      "!src/**/*.test.js",
      "!src/**/__tests__/**",
      "!**/*.map"
    ]
  }
}
```

2. **使用 asar 压缩**

```json
{
  "build": {
    "asar": true
  }
}
```

3. **移除开发依赖**

确保开发依赖在 `devDependencies` 中，不在 `dependencies` 中。

---

## 最佳实践

### 1. 版本管理

使用语义化版本：
- **主版本号**: 不兼容的 API 更改
- **次版本号**: 向后兼容的功能新增
- **修订号**: 向后兼容的问题修正

### 2. 发布前检查清单

- [ ] 更新版本号
- [ ] 更新 CHANGELOG
- [ ] 运行所有测试
- [ ] 检查代码质量
- [ ] 构建所有平台
- [ ] 测试安装包
- [ ] 更新文档
- [ ] 创建 Git 标签
- [ ] 发布 Release

### 3. 自动化

使用 CI/CD 自动化构建和发布流程：
- 自动运行测试
- 自动构建
- 自动发布到 GitHub Releases
- 自动更新文档

### 4. 备份

保存重要文件：
- 代码签名证书
- API 密钥
- 配置文件

### 5. 文档

保持文档更新：
- README.md
- CHANGELOG.md
- 用户指南
- 开发者文档

---

## 资源链接

- **electron-builder 文档**: https://www.electron.build/
- **代码签名指南**: https://www.electron.build/code-signing
- **GitHub Actions**: https://docs.github.com/en/actions
- **Apple 公证**: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution

---

**最后更新**: 2024-01-15  
**版本**: 1.0.0

祝您构建顺利！🚀
