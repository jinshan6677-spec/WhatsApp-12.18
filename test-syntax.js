// 测试注入脚本的语法
const { FingerprintInjector } = require('./src/infrastructure/fingerprint');

const testConfig = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    hardware: {
        screen: { width: 1920, height: 1080 },
        devicePixelRatio: 1,
        cpuCores: 8,
        deviceMemory: 8
    },
    os: { platform: 'Win32', type: 'Windows' },
    navigator: { language: 'en-US', languages: ['en-US'] },
    webgl: {
        mode: 'custom',
        vendor: 'Google Inc. (AMD)',
        renderer: 'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)',
        unmaskedVendor: 'Google Inc. (AMD)',
        unmaskedRenderer: 'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)'
    }
};

console.log('Testing injection script generation...\n');

try {
    const injector = new FingerprintInjector(testConfig);

    // 只包含必要的模块
    const script = injector.getInjectionScript({
        minify: false,
        includeWorkerInterceptor: false,
        include: ['navigator', 'browserBehavior', 'webgl', 'screen']
    });

    console.log('✓ Script generated');
    console.log('  Length:', script.length, 'characters\n');

    // 测试语法
    console.log('Testing syntax...');
    try {
        new Function(script);
        console.log('✓ Syntax is VALID\n');
        console.log('SUCCESS: The injection script has no syntax errors!');
    } catch (syntaxError) {
        console.log('✗ SYNTAX ERROR:');
        console.log('  Message:', syntaxError.message);
        console.log('\nThis is the problem that needs to be fixed.');
    }

} catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error.stack);
}
