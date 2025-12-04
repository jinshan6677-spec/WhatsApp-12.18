const fs = require('fs');
const path = require('path');

// Capture console output
const logs = [];
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
    logs.push(`WARN: ${args.join(' ')}`);
    originalConsoleWarn(...args);
};
const originalConsoleLog = console.log;
console.log = (...args) => {
    logs.push(`LOG: ${args.join(' ')}`);
    originalConsoleLog(...args);
};
const originalConsoleError = console.error;
console.error = (...args) => {
    logs.push(`ERROR: ${args.join(' ')}`);
    originalConsoleError(...args);
};

function writeLog() {
    try {
        fs.writeFileSync('test-result.txt', logs.join('\n'), 'utf8');
    } catch (e) {
        // Ignore write error
    }
}

const mockUserDataPath = path.join(__dirname, 'temp_test_userdata');
if (!fs.existsSync(mockUserDataPath)) {
    fs.mkdirSync(mockUserDataPath, { recursive: true });
}

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'electron') {
        return {
            app: {
                getPath: () => mockUserDataPath
            }
        };
    }
    return originalRequire.apply(this, arguments);
};

async function runTest() {
    try {
        console.log('Starting Cache Cleanup Test...');
        const CacheManager = require('./src/translation/managers/CacheManager');

        const cacheManager = new CacheManager({
            ttl: 1000 // 1 second TTL for testing
        });

        // Ensure cache dir exists
        if (!cacheManager.cacheDir) {
            throw new Error('Cache directory not initialized');
        }

        console.log(`Cache directory: ${cacheManager.cacheDir}`);

        // Create a fresh file
        const freshKey = 'fresh_key';
        await cacheManager.set(freshKey, { translatedText: 'Fresh', detectedLang: 'en' });
        console.log('Created fresh cache entry');

        // Create an expired file (simulate by modifying mtime)
        const expiredKey = 'expired_key';
        await cacheManager.set(expiredKey, { translatedText: 'Expired', detectedLang: 'en' });
        const expiredFile = path.join(cacheManager.cacheDir, `${expiredKey}.json`);

        // Set mtime to 2 seconds ago
        const oldTime = new Date(Date.now() - 2000);
        fs.utimesSync(expiredFile, oldTime, oldTime);
        console.log('Created expired cache entry (mtime modified)');

        // Verify files exist
        if (fs.existsSync(path.join(cacheManager.cacheDir, `${freshKey}.json`)) &&
            fs.existsSync(expiredFile)) {
            console.log('Both files exist before cleanup');
        } else {
            throw new Error('Setup failed: files not created');
        }

        // Run cleanup
        console.log('Running cleanup...');
        await cacheManager.cleanup();

        // Verify results
        const freshExists = fs.existsSync(path.join(cacheManager.cacheDir, `${freshKey}.json`));
        const expiredExists = fs.existsSync(expiredFile);

        if (freshExists && !expiredExists) {
            console.log('SUCCESS: Fresh file remains, expired file deleted.');
        } else {
            console.error(`FAILURE: Fresh file exists: ${freshExists}, Expired file exists: ${expiredExists}`);
        }

    } catch (e) {
        console.error(`Test failed with error: ${e.message}\n${e.stack}`);
    } finally {
        // Clean up test environment
        try {
            fs.rmSync(mockUserDataPath, { recursive: true, force: true });
            console.log('Test environment cleaned up');
        } catch (e) {
            console.error('Failed to clean up test environment:', e);
        }
        writeLog();
    }
}

runTest();
