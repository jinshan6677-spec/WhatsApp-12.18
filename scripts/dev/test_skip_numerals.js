const TranslationManager = require('./src/translation/managers/TranslationManager');
const assert = require('assert');

// Mock dependencies
const mockConfigManager = {
    getConfig: () => ({})
};
const mockCacheManager = {
    generateKey: () => 'key',
    get: () => null,
    set: () => Promise.resolve()
};

async function testSkipNumerals() {
    console.log('Testing skip translation for numerals...');

    const manager = new TranslationManager(mockConfigManager, mockCacheManager);

    // Mock content security to avoid dependency issues in test
    manager.contentSecurity = {
        cleanTranslationInput: (text) => ({ text, valid: true }),
        validateLanguageCode: () => true,
        truncateText: (text) => text,
        sanitizeLogMessage: (msg) => msg,
        cleanTranslationOutput: (text) => text
    };

    // Mock performance optimizer
    manager.performanceOptimizer = {
        executeRequest: (key, fn) => fn()
    };

    const text = '123456';
    const result = await manager.translate(text, 'en', 'es', 'google');

    console.log('Result:', result);

    assert.strictEqual(result.translatedText, text, 'Translated text should match input for numerals');
    assert.strictEqual(result.skipped, true, 'Translation should be skipped');

    console.log('Test passed!');
}

testSkipNumerals().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
