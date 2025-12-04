const { FingerprintInjector } = require('./src/infrastructure/fingerprint');
const fs = require('fs');

// 使用测试配置
const testConfig = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    hardware: {
        screen: { width: 2560, height: 1440 },
        devicePixelRatio: 1,
        cpuCores: 8,
        deviceMemory: 8
    },
    os: { platform: 'Win32', type: 'Windows' },
    navigator: { language: 'en-US', languages: ['en-US'] },
    webgl: {
        mode: 'custom',
        vendor: 'Google Inc. (Intel)',
        renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    }
};

console.log('Generating injection script...\n');

try {
    const injector = new FingerprintInjector(testConfig);
    const script = injector.getInjectionScript({ minify: false, includeWorkerInterceptor: false });

    // 保存到文件
    fs.writeFileSync('test-injection-script.js', script);
    console.log('✓ Script saved to: test-injection-script.js');
    console.log('  Length:', script.length, 'characters\n');

    // 测试语法
    console.log('Testing syntax...');
    try {
        new Function(script);
        console.log('✓ Syntax is VALID\n');
    } catch (syntaxError) {
        console.log('✗ SYNTAX ERROR:');
        console.log('  Message:', syntaxError.message);

        // 分析 try-catch 块
        const tryMatches = script.match(/\btry\s*\{/g) || [];
        const catchMatches = script.match(/\}\s*catch\s*\(/g) || [];
        const finallyMatches = script.match(/\}\s*finally\s*\{/g) || [];

        console.log('\n  Try-Catch-Finally Analysis:');
        console.log('    try blocks:', tryMatches.length);
        console.log('    catch blocks:', catchMatches.length);
        console.log('    finally blocks:', finallyMatches.length);

        if (tryMatches.length > catchMatches.length + finallyMatches.length) {
            console.log('  ⚠ WARNING: Unmatched try blocks detected!');
            console.log('    Missing:', tryMatches.length - catchMatches.length - finallyMatches.length, 'catch/finally blocks');
        }

        // 尝试找到问题位置
        console.log('\n  Searching for incomplete try blocks...');
        const lines = script.split('\n');
        let tryDepth = 0;
        let catchCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/\btry\s*\{/.test(line)) {
                tryDepth++;
                console.log(`    Line ${i + 1}: try block opened (depth: ${tryDepth})`);
            }
            if (/\}\s*catch\s*\(/.test(line) || /\}\s*finally\s*\{/.test(line)) {
                catchCount++;
                tryDepth--;
                console.log(`    Line ${i + 1}: catch/finally found (depth: ${tryDepth})`);
            }
        }

        if (tryDepth > 0) {
            console.log(`\n  ✗ Found ${tryDepth} unclosed try blocks!`);
        }
    }

} catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error.stack);
}
