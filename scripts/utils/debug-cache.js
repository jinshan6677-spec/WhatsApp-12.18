const fs = require('fs');
const path = require('path');

const mockUserDataPath = path.join(__dirname, 'temp_test_userdata');
if (!fs.existsSync(mockUserDataPath)) {
    fs.mkdirSync(mockUserDataPath, { recursive: true });
}

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'electron') {
        console.log('Mocking electron require');
        return {
            app: {
                getPath: (name) => {
                    console.log(`app.getPath called with ${name}`);
                    return mockUserDataPath;
                }
            }
        };
    }
    return originalRequire.apply(this, arguments);
};

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

try {
    console.log('Requiring CacheManager...');
    const CacheManager = require('./src/translation/managers/CacheManager');
    console.log('CacheManager required.');

    const cacheManager = new CacheManager({ ttl: 1000 });
    console.log(`Cache Dir: ${cacheManager.cacheDir}`);

    fs.writeFileSync('debug-output.txt', logs.join('\n'), 'utf8');
} catch (e) {
    logs.push(`ERROR: ${e.message}\n${e.stack}`);
    fs.writeFileSync('debug-output.txt', logs.join('\n'), 'utf8');
}
