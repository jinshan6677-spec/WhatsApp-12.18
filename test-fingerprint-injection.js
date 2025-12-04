const { FingerprintInjector } = require('./src/infrastructure/fingerprint');
const fs = require('fs');

// 模拟一个典型的指纹配置
const testConfig = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    hardware: {
        screen: { width: 1920, height: 1080 },
        devicePixelRatio: 1,
        cpuCores: 4,
        deviceMemory: 8
    },
    os: { platform: 'Win32', type: 'Windows' },
    navigator: {
        language: 'en-US',
        languages: ['en-US', 'en']
    },
    webgl: {
        mode: 'custom',
        vendor: 'Google Inc. (Intel)',
        renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    }
};

console.log('Testing fingerprint injection script generation...\n');

try {
    const injector = new FingerprintInjector(testConfig, {
        minify: false,
        includeWorkerInterceptor: true,
        includeIframeProtection: true,
        strictMode: true
    });

    const essentialModules = ['navigator', 'browserBehavior', 'webgl', 'canvas', 'fonts', 'clientRects', 'timezone', 'geolocation', 'mediaDevices', 'webrtc', 'screen'];
    const script = injector.getInjectionScript({
        minify: false,
        includeWorkerInterceptor: true,
        include: essentialModules
    });

    console.log('Script generated successfully');
    console.log('Script length:', script.length, 'characters\n');

    // 保存脚本到文件以便检查
    fs.writeFileSync('generated-injection-script.js', script);
    console.log('✓ Script saved to: generated-injection-script.js\n');

    // 测试语法
    console.log('Testing script syntax...');
    try {
        new Function(script);
        console.log('✓ Script syntax is VALID\n');
    } catch (syntaxError) {
        console.log('✗ SYNTAX ERROR found:');
        console.log('  Message:', syntaxError.message);
        console.log('  Line:', syntaxError.lineNumber || 'unknown');

        // 尝试找到错误位置
        const lines = script.split('\n');
        if (syntaxError.lineNumber && syntaxError.lineNumber > 0) {
            const errorLine = syntaxError.lineNumber - 1;
            console.log('\n  Context:');
            for (let i = Math.max(0, errorLine - 2); i <= Math.min(lines.length - 1, errorLine + 2); i++) {
                const marker = i === errorLine ? '>>> ' : '    ';
                console.log(marker + (i + 1) + ':', lines[i]);
            }
        }

        // 检查常见的语法问题
        console.log('\n  Checking for common issues:');
        const tryCount = (script.match(/\btry\s*\{/g) || []).length;
        const catchCount = (script.match(/\}\s*catch\s*\(/g) || []).length;
        const finallyCount = (script.match(/\}\s*finally\s*\{/g) || []).length;

        console.log('  - try blocks:', tryCount);
        console.log('  - catch blocks:', catchCount);
        console.log('  - finally blocks:', finallyCount);

        if (tryCount > catchCount + finallyCount) {
            console.log('  ⚠ WARNING: More try blocks than catch/finally blocks!');
            console.log('    This suggests incomplete try-catch-finally structures');
        }
    }

} catch (error) {
    console.error('✗ Error generating script:');
    console.error('  ', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
}
