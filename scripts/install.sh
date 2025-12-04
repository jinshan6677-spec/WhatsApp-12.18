#!/bin/bash

# WhatsApp Desktop Container - 安装脚本

echo "========================================="
echo "WhatsApp Desktop Container - 安装"
echo "========================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    echo "请先安装 Node.js 18 或更高版本"
    echo "访问: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js 版本: $(node --version)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到 npm"
    exit 1
fi

echo "✓ npm 版本: $(npm --version)"
echo ""

# 安装依赖
echo "正在安装依赖..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "✓ 安装完成！"
    echo "========================================="
    echo ""
    echo "使用以下命令启动应用:"
    echo "  npm start          - 启动应用"
    echo "  npm run dev        - 开发模式（带调试）"
    echo "  npm run build      - 打包应用"
    echo ""
else
    echo ""
    echo "❌ 安装失败"
    exit 1
fi
