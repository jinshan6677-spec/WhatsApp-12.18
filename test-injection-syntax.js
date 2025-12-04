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
    const script = injector.getInjectionScript({ minify: false });

    // Try to evaluate the script to check for syntax errors
    try {
        new Function(script);
        console.log('✓ Script syntax is valid');
    } catch (syntaxError) {
        console.error('✗ Syntax error in generated script:');
        console.error(syntaxError.message);
        console.error('\nScript preview (first 2000 chars):');
        console.error(script.substring(0, 2000));
        console.error('\n... (truncated)');
        console.error('\nScript end (last 500 chars):');
        console.error(script.substring(script.length - 500));
    }
} catch (error) {
    console.error('Error generating script:', error);
}
