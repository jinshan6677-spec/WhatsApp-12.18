const { FingerprintInjector } = require('./src/infrastructure/fingerprint');

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
        vendor: 'Google Inc. (NVIDIA)',
        renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        unmaskedVendor: 'Google Inc. (NVIDIA)',
        unmaskedRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    }
};

try {
    const injector = new FingerprintInjector(testConfig);
    const script = injector.getInjectionScript({ minify: false, include: ['webgl'] });

    // 查找 config 对象定义
    const configMatch = script.match(/const config = \{[\s\S]*?\};/);
    if (configMatch) {
        console.log('Found WebGL config in generated script:');
        console.log(configMatch[0]);
    } else {
        console.log('Could not find config object in script');
    }

    // 检查 unmaskedRenderer 是否存在
    if (script.includes('unmaskedRenderer')) {
        console.log('\n✓ unmaskedRenderer is present in the script');
        const unmaskedRendererMatch = script.match(/unmaskedRenderer:\s*"([^"]+)"/);
        if (unmaskedRendererMatch) {
            console.log('  Value:', unmaskedRendererMatch[1]);
        }
    } else {
        console.log('\n✗ unmaskedRenderer is NOT present in the script');
    }

    // 检查语法
    try {
        new Function(script);
        console.log('\n✓ Script syntax is valid');
    } catch (syntaxError) {
        console.log('\n✗ Syntax error:', syntaxError.message);
    }
} catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
}
